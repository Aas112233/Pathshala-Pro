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

/**
 * GET /api/students
 * Get all students with pagination
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
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") || "desc";

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = { tenantId };

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { firstNameBn: { contains: search, mode: "insensitive" } },
        { lastNameBn: { contains: search, mode: "insensitive" } },
        { studentId: { contains: search, mode: "insensitive" } },
        { rollNumber: { contains: search, mode: "insensitive" } },
        { guardianName: { contains: search, mode: "insensitive" } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (gender) {
      where.gender = gender;
    }

    if (classId) {
      where.classId = classId;
    }

    if (sectionId) {
      where.sectionId = sectionId;
    }

    if (groupId) {
      where.groupId = groupId;
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
        },
      }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return paginatedResponse(students, {
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

    // Check if roll number already exists in the same class/section
    const existingRoll = await prisma.studentProfile.findFirst({
      where: {
        tenantId,
        rollNumber: data.rollNumber,
        ...(data.classId ? { classId: data.classId } : {}),
        ...(data.sectionId ? { sectionId: data.sectionId } : {}),
        status: "ACTIVE",
      },
    });

    if (existingRoll) {
      return badRequest("Student already exists", [
        { field: "rollNumber", code: "duplicate", message: `Roll number ${data.rollNumber} already assigned in this class/section` },
      ]);
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

    const student = await prisma.studentProfile.create({
      data: {
        tenantId,
        ...prismaDataWithDates,
        studentId: studentId as string,
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

    return successResponse(student, "Student created successfully", 201);
  } catch (error) {
    return handleApiError(error, "Failed to create student");
  }
}
