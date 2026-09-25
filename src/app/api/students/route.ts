import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  paginatedResponse,
  badRequest,
  handleApiError,
  safeParseBody,
} from "@/lib/api-response";
import { createStudentSchema } from "@/lib/schemas";
import { verifyInternalFileUrl } from "@/lib/upload-security";
import { requireApiAccess } from "@/lib/api-auth";
import { MAX_PAGE_SIZE } from "@/lib/constants";
import { fastCache } from "@/lib/fast-memory-cache";
import {
  resolveRequestAcademicYearId,
  ensureStudentAcademicSession,
  assertAcademicYearOpen,
} from "@/lib/academic-year-guards";

/**
 * GET /api/students
 * Get all students with pagination and academic-year-scoped roster lookups
 */
export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), MAX_PAGE_SIZE);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const gender = searchParams.get("gender") || "";
    const classId = searchParams.get("classId") || "";
    const sectionId = searchParams.get("sectionId") || "";
    const groupId = searchParams.get("groupId") || "";
    const academicYearIdParam = searchParams.get("academicYearId");
    const resolvedAcademicYearId = academicYearIdParam
      ? academicYearIdParam.trim()
      : await resolveRequestAcademicYearId(request, tenantId);

    const SORTABLE_FIELDS = new Set(["createdAt", "firstName", "lastName", "rollNumber", "studentId", "status", "gender"]);
    const rawSortBy = searchParams.get("sortBy") || "createdAt";
    const sortBy = SORTABLE_FIELDS.has(rawSortBy) ? rawSortBy : "createdAt";
    const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = { tenantId };

    if (search.trim()) {
      const searchTerms = search.trim().split(/\s+/).filter(Boolean);
      if (searchTerms.length === 1) {
        const s = searchTerms[0];
        where.OR = [
          { firstName: { contains: s, mode: "insensitive" } },
          { lastName: { contains: s, mode: "insensitive" } },
          { firstNameBn: { contains: s, mode: "insensitive" } },
          { lastNameBn: { contains: s, mode: "insensitive" } },
          { studentId: { contains: s, mode: "insensitive" } },
          { rollNumber: { contains: s, mode: "insensitive" } },
          { guardianName: { contains: s, mode: "insensitive" } },
        ];
      } else {
        // Every token must match at least one field
        where.AND = searchTerms.map((s) => ({
          OR: [
            { firstName: { contains: s, mode: "insensitive" } },
            { lastName: { contains: s, mode: "insensitive" } },
            { firstNameBn: { contains: s, mode: "insensitive" } },
            { lastNameBn: { contains: s, mode: "insensitive" } },
            { studentId: { contains: s, mode: "insensitive" } },
            { rollNumber: { contains: s, mode: "insensitive" } },
            { guardianName: { contains: s, mode: "insensitive" } },
          ],
        }));
      }
    }

    if (status) {
      where.status = status;
    }

    if (gender) {
      where.gender = gender;
    }

    // If an academic year is active and class hierarchy filters are present,
    // filter students whose academic session for that year matches the class/section/group.
    //
    // Two invariants this block has to hold:
    //
    //  1. The placement clause is appended to `AND`, never assigned to `OR`.
    //     Assigning to `OR` used to clobber the single-term search filter set
    //     above, so searching inside a class silently returned the whole class.
    //
    //  2. The profile fallback is guarded by `academicSessions.none`. Without
    //     that guard a promoted student matches BOTH their new placement (via
    //     the session) and their old one (via the still-stale profile), and is
    //     listed twice in the roster.
    if (resolvedAcademicYearId && (classId || sectionId || groupId)) {
      const profileFields = {
        ...(classId ? { classId } : {}),
        ...(sectionId ? { sectionId } : {}),
        ...(groupId ? { groupId } : {}),
      };

      where.AND = [
        ...(where.AND ?? []),
        {
          OR: [
            // Authoritative: the placement recorded for this academic year.
            {
              academicSessions: {
                some: {
                  academicYearId: resolvedAcademicYearId,
                  ...profileFields,
                },
              },
            },
            // Legacy fallback for rows written before sessions existed, or for
            // students not yet enrolled for the requested year.
            {
              academicSessions: { none: { academicYearId: resolvedAcademicYearId } },
              ...profileFields,
            },
          ],
        },
      ];
    } else {
      if (classId) {
        where.classId = classId;
      }
      if (sectionId) {
        where.sectionId = sectionId;
      }
      if (groupId) {
        where.groupId = groupId;
      }
    }

    const cacheKey = `students:${tenantId}:${resolvedAcademicYearId}:${page}:${limit}:${search}:${status}:${gender}:${classId}:${sectionId}:${groupId}:${sortBy}:${sortOrder}`;
    const cachedResponse = fastCache.get<{ mappedStudents: any[]; totalCount: number; totalPages: number }>(cacheKey);
    if (cachedResponse) {
      return paginatedResponse(cachedResponse.mappedStudents, {
        totalCount: cachedResponse.totalCount,
        currentPage: page,
        pageSize: limit,
        totalPages: cachedResponse.totalPages,
        hasNextPage: page < cachedResponse.totalPages,
        hasPreviousPage: page > 1,
      });
    }

    // Get total count and students
    const [totalCount, students] = await Promise.all([
      prisma.studentProfile.count({ where }),
      prisma.studentProfile.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        select: {
          id: true,
          studentId: true,
          rollNumber: true,
          firstName: true,
          lastName: true,
          firstNameBn: true,
          lastNameBn: true,
          guardianName: true,
          guardianContact: true,
          guardianEmail: true,
          gender: true,
          status: true,
          profilePictureUrl: true,
          admissionDate: true,
          classId: true,
          groupId: true,
          sectionId: true,
          createdAt: true,
          class: {
            select: {
              id: true,
              name: true,
              classNumber: true,
            },
          },
          group: {
            select: {
              id: true,
              name: true,
            },
          },
          section: {
            select: {
              id: true,
              name: true,
            },
          },
          academicSessions: resolvedAcademicYearId
            ? {
                where: { academicYearId: resolvedAcademicYearId },
                take: 1,
                select: {
                  id: true,
                  academicYearId: true,
                  rollNumber: true,
                  classId: true,
                  sectionId: true,
                  groupId: true,
                  classNumber: true,
                  promotionStatus: true,
                  class: { select: { id: true, name: true, classNumber: true } },
                  section: { select: { id: true, name: true } },
                  group: { select: { id: true, name: true } },
                },
              }
            : false,
        },
      }),
    ]);

    // Map year-scoped session roster fields onto returned student rows
    const mappedStudents = students.map((s: any) => {
      const session = s.academicSessions?.[0];
      if (!session) return s;
      return {
        ...s,
        rollNumber: session.rollNumber || s.rollNumber,
        classId: session.classId || s.classId,
        sectionId: session.sectionId ?? s.sectionId,
        groupId: session.groupId ?? s.groupId,
        class: session.class || s.class,
        section: session.section || s.section,
        group: session.group || s.group,
        promotionStatus: session.promotionStatus,
      };
    });

    const totalPages = Math.ceil(totalCount / limit);
    fastCache.set(cacheKey, { mappedStudents, totalCount, totalPages }, 60);

    return paginatedResponse(mappedStudents, {
      totalCount,
      currentPage: page,
      pageSize: limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    });
  } catch (error) {
    return handleApiError(error, "Failed to retrieve students");
  }
}


/**
 * POST /api/students
 * Create a new student
 */
export async function POST(request: NextRequest) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;

    const bodyResult = await safeParseBody(request, createStudentSchema);
    if (!bodyResult.success) return bodyResult.errorResponse;
    const data = bodyResult.data;
    if (data.profilePictureUrl && !(await verifyInternalFileUrl(data.profilePictureUrl, tenantId))) {
      return badRequest("Invalid profile picture file");
    }

    let studentId = data.studentId;

    if (!studentId) {
      // Auto-generate student ID uniquely with 5-digit sequence number
      const latestStudent = await prisma.studentProfile.findFirst({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
      });

      const currentYear = new Date().getFullYear();
      let nextNumber = 1;

      if (latestStudent && latestStudent.studentId.startsWith(`STU-${currentYear}-`)) {
        const parts = latestStudent.studentId.split("-");
        const lastNum = parseInt(parts[2], 10);
        if (!isNaN(lastNum)) {
          nextNumber = lastNum + 1;
        }
      }

      // Keep incrementing if it randomly collides due to race conditions or manual entry
      let isUnique = false;
      while (!isUnique) {
        studentId = `STU-${currentYear}-${nextNumber.toString().padStart(5, "0")}`;
        const collision = await prisma.studentProfile.findFirst({ where: { tenantId, studentId } });
        if (!collision) isUnique = true;
        else nextNumber++;
      }
    } else {
      // Check if provided student ID already exists
      const existingStudent = await prisma.studentProfile.findFirst({
        where: { tenantId, studentId },
      });

      if (existingStudent) {
        return badRequest("Student already exists", [
          { field: "studentId", code: "duplicate", message: "Student ID already exists" },
        ]);
      }
    }

    // Auto-determine or validate roll number
    let rollNumber = data.rollNumber?.trim();

    if (!rollNumber) {
      let classPrefix = "C1";
      if (data.classId) {
        // Tenant-scoped: an unscoped findUnique leaks another tenant's
        // classNumber through the generated roll number (existence oracle).
        const cls = await prisma.class.findFirst({ where: { id: data.classId, tenantId } });
        if (cls) {
          const num = cls.classNumber > 0 ? cls.classNumber : (parseInt(cls.name.replace(/\D/g, ""), 10) || 1);
          classPrefix = `C${num}`;
        }
      }

      // Count students in this class/section to generate next roll
      const count = await prisma.studentProfile.count({
        where: {
          tenantId,
          ...(data.classId ? { classId: data.classId } : {}),
          ...(data.sectionId ? { sectionId: data.sectionId } : {}),
        },
      });

      let nextRollNum = count + 1;
      let isRollUnique = false;
      while (!isRollUnique) {
        rollNumber = `${classPrefix}-R${nextRollNum}`;
        const collision = await prisma.studentProfile.findFirst({
          where: {
            tenantId,
            rollNumber,
            ...(data.classId ? { classId: data.classId } : {}),
            ...(data.sectionId ? { sectionId: data.sectionId } : {}),
            status: "ACTIVE",
          },
        });
        if (!collision) isRollUnique = true;
        else nextRollNum++;
      }
    } else {
      // Check if provided roll number already exists in the same class/section
      const existingRoll = await prisma.studentProfile.findFirst({
        where: {
          tenantId,
          rollNumber,
          ...(data.classId ? { classId: data.classId } : {}),
          ...(data.sectionId ? { sectionId: data.sectionId } : {}),
          status: "ACTIVE",
        },
      });

      if (existingRoll) {
        return badRequest("Student already exists", [
          { field: "rollNumber", code: "duplicate", message: `Roll number ${rollNumber} already assigned in this class/section` },
        ]);
      }
    }

    // If the frontend passed a driveFileId, rename the R2 object to match the newly generated studentId
    let profilePictureUrl: string | undefined = undefined;

    if (data.driveFileId) {
      try {
        const { createR2FileUrl, renameR2Object } = await import("@/lib/r2-storage");

        const oldKey = data.driveFileId;
        const tenantPrefix = `Tenant_${tenantId.replace(/[^a-zA-Z0-9_-]/g, "_")}/`;
        const relativeKey = oldKey.startsWith(tenantPrefix) ? oldKey.slice(tenantPrefix.length) : "";
        if (!relativeKey || !relativeKey.includes("/temp_") || !/^temp_[a-zA-Z0-9-]+\.(jpg|png|webp|pdf)$/.test(relativeKey.split("/").pop() || "")) {
          throw new Error("Invalid temporary upload key");
        }
        const extension = oldKey.split(".").pop();
        const parts = oldKey.split("/");
        parts.pop();
        const safeStudentId = String(studentId).replace(/[^a-zA-Z0-9_-]/g, "_");
        const newKey = `${parts.join("/")}/${safeStudentId}.${extension}`;

        await renameR2Object(oldKey, newKey);

        profilePictureUrl = await createR2FileUrl(newKey, tenantId);
      } catch (renameErr) {
        console.error("Failed to rename object on Cloudflare R2:", renameErr);
      }
    }

    const { driveFileId, admissionDate, ...prismaData } = data as any;

    const prismaDataWithDates: any = { ...prismaData };
    if (prismaData.dateOfBirth && prismaData.dateOfBirth.trim() !== '') {
      prismaDataWithDates.dateOfBirth = new Date(prismaData.dateOfBirth);
    } else {
      delete prismaDataWithDates.dateOfBirth;
    }

    // Convert empty string foreign keys to null
    if (!prismaDataWithDates.classId) prismaDataWithDates.classId = null;
    if (!prismaDataWithDates.groupId) prismaDataWithDates.groupId = null;
    if (!prismaDataWithDates.sectionId) prismaDataWithDates.sectionId = null;

    // FK-confusion guard: relation targets must belong to the caller's
    // tenant, otherwise tenant A can enroll a student into tenant B's
    // class/section and read B's roster via later includes.
    const [classOk, sectionOk, groupOk] = await Promise.all([
      prismaDataWithDates.classId
        ? prisma.class.findFirst({ where: { id: prismaDataWithDates.classId, tenantId }, select: { id: true } })
        : Promise.resolve({ id: "" }),
      prismaDataWithDates.sectionId
        ? prisma.section.findFirst({ where: { id: prismaDataWithDates.sectionId, tenantId }, select: { id: true } })
        : Promise.resolve({ id: "" }),
      prismaDataWithDates.groupId
        ? prisma.group.findFirst({ where: { id: prismaDataWithDates.groupId, tenantId }, select: { id: true } })
        : Promise.resolve({ id: "" }),
    ]);
    if (!classOk) return badRequest("Selected class does not exist in your institution.");
    if (!sectionOk) return badRequest("Selected section does not exist in your institution.");
    if (!groupOk) return badRequest("Selected group does not exist in your institution.");

    const targetAcademicYearId = (data as any).academicYearId || await resolveRequestAcademicYearId(request, tenantId);

    // Admitting a student is not itself year-scoped — the profile is not owned
    // by any one year — but placing them writes a StudentAcademicSession into
    // the year, and that row is exactly what a closed year protects. Checked
    // before the transaction so a refusal cannot leave a profile behind with no
    // placement in it.
    if (targetAcademicYearId && prismaDataWithDates.classId) {
      await assertAcademicYearOpen(tenantId, targetAcademicYearId);
    }

    const student = await prisma.$transaction(async (tx) => {
      const createdStudent = await tx.studentProfile.create({
        data: {
          tenantId,
          ...prismaDataWithDates,
          studentId: studentId as string,
          rollNumber: rollNumber as string,
          ...(profilePictureUrl && { profilePictureUrl }),
        },
        select: {
          id: true,
          studentId: true,
          rollNumber: true,
          firstName: true,
          lastName: true,
          firstNameBn: true,
          lastNameBn: true,
          guardianName: true,
          guardianContact: true,
          status: true,
          admissionDate: true,
          classId: true,
          groupId: true,
          sectionId: true,
          class: {
            select: {
              id: true,
              name: true,
              classNumber: true,
            },
          },
          group: {
            select: {
              id: true,
              name: true,
            },
          },
          section: {
            select: {
              id: true,
              name: true,
            },
          },
          createdAt: true,
        },
      });

      if (targetAcademicYearId && prismaDataWithDates.classId) {
        const classNumber = createdStudent.class?.classNumber ?? 0;
        await ensureStudentAcademicSession(tx, {
          tenantId,
          studentProfileId: createdStudent.id,
          academicYearId: targetAcademicYearId,
          classId: prismaDataWithDates.classId,
          sectionId: prismaDataWithDates.sectionId ?? null,
          groupId: prismaDataWithDates.groupId ?? null,
          rollNumber: rollNumber as string,
          classNumber,
        });
      }

      return createdStudent;
    });

    fastCache.invalidatePrefix(`students:${tenantId}`);
    fastCache.invalidatePrefix(`dash_summary:${tenantId}`);

    return successResponse(student, "Student created successfully", 201);
  } catch (error) {
    return handleApiError(error, "Failed to create student");
  }
}

