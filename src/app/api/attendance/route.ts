import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  paginatedResponse,
  badRequest,
  handleApiError,
  validationError,
} from "@/lib/api-response";
import { createAttendanceSchema } from "@/lib/schemas";
import { requireApiAccess, getSelfScopedStudentProfileIds } from "@/lib/api-auth";
import { MAX_PAGE_SIZE } from "@/lib/constants";
import { triggerAbsenceAlert } from "@/lib/notifications/triggers/absence-alert";
import { assertAcademicYearOpen, resolveRequestAcademicYearId } from "@/lib/academic-year-guards";
import { ATTENDANCE_STATUSES, isKnownAttendanceStatus } from "@/lib/attendance-rate";

/**
 * GET /api/attendance
 * Get all attendance records with pagination and filters
 */
export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), MAX_PAGE_SIZE);
    const date = searchParams.get("date");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const studentId = searchParams.get("studentId") || "";
    const staffId = searchParams.get("staffId") || "";
    const status = searchParams.get("status") || "";
    const classId = searchParams.get("classId") || "";
    const search = searchParams.get("search")?.trim() || "";
    const academicYearIdParam = searchParams.get("academicYearId");
    const resolvedAcademicYearId = academicYearIdParam
      ? academicYearIdParam.trim()
      : await resolveRequestAcademicYearId(request, tenantId);

    const skip = (page - 1) * limit;

    const where: any = { tenantId };

    if (date) {
      const targetDate = new Date(date);
      targetDate.setHours(0, 0, 0, 0);
      const nextDate = new Date(targetDate);
      nextDate.setDate(nextDate.getDate() + 1);
      where.date = { gte: targetDate, lt: nextDate };
    }

    if (startDate || endDate) {
      where.date = { ...where.date };
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    if (studentId) {
      where.studentProfileId = studentId;
    }

    if (staffId) {
      where.staffProfileId = staffId;
    }

    if (status) {
      where.status = status;
    }

    if (classId) {
    // Text search over student / staff name + ID (the records search box
    // previously sent `search` but it was ignored). Token-based: every token
    // must match at least one person field, so "Karim Abdul" works.
    // Top-level AND avoids clobbering the classId/self-scope relation filters.
    if (search) {
      const searchTerms = search.split(/\s+/).filter(Boolean);
      const perTerm = (s: string) => ({
        OR: [
          { studentProfile: { firstName: { contains: s, mode: "insensitive" } } },
          { studentProfile: { lastName: { contains: s, mode: "insensitive" } } },
          { studentProfile: { studentId: { contains: s, mode: "insensitive" } } },
          { studentProfile: { rollNumber: { contains: s, mode: "insensitive" } } },
          { staffProfile: { firstName: { contains: s, mode: "insensitive" } } },
          { staffProfile: { lastName: { contains: s, mode: "insensitive" } } },
          { staffProfile: { staffId: { contains: s, mode: "insensitive" } } },
        ],
      });
      where.AND = [...(where.AND ?? []), ...searchTerms.map(perTerm)];
    }

    if (resolvedAcademicYearId && resolvedAcademicYearId !== "ALL") {
        where.studentProfile = {
          academicSessions: {
            some: {
              academicYearId: resolvedAcademicYearId,
              classId,
            },
          },
        };
      } else {
        where.studentProfile = { classId };
      }
    }

    if (resolvedAcademicYearId && resolvedAcademicYearId !== "ALL") {
      where.academicYearId = resolvedAcademicYearId;
    }

    // C1 self-scoping: STUDENT/PARENT see only their own linked students.
    // Overwrites any client-supplied studentId so a parent cannot enumerate
    // other students by swapping the query param.
    const selfScope = await getSelfScopedStudentProfileIds(access.authContext);
    if (selfScope) {
      where.studentProfileId = { in: selfScope };
      delete where.staffProfileId;
    }

    const [totalCount, attendance] = await Promise.all([
      prisma.attendance.count({ where }),
      prisma.attendance.findMany({
        where,
        skip,
        take: limit,
        orderBy: { date: "desc" },
        include: {
          studentProfile: {
            select: {
              studentId: true,
              firstName: true,
              lastName: true,
              rollNumber: true,
              class: { select: { name: true } },
              section: { select: { name: true } },
            },
          },
          staffProfile: {
            select: {
              staffId: true,
              firstName: true,
              lastName: true,
              designation: true,
            },
          },
          markedBy: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return paginatedResponse(attendance, {
      totalCount,
      currentPage: page,
      pageSize: limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/attendance
 * Create single or bulk fast-grid attendance records
 */
export async function POST(request: NextRequest) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { user, tenantId } = access.authContext;
    const body = await request.json();

    // 1. Check if bulk fast-grid format
    if (body.records && Array.isArray(body.records)) {
      const { date, records } = body;
      if (!date) return badRequest("Attendance date is required");

      // ---------------------------------------------------------------------
      // Validate before writing anything.
      //
      // This branch used to read `item.status || "PRESENT"` with no check at
      // all, so any string the client sent was persisted verbatim. An
      // unrecognised status is not inert: `attendanceRateFromCounts` scores
      // anything that is neither attended nor non-teaching as a day of
      // absence, so a typo silently becomes an absence in every denominator
      // downstream — including the figure that decides whether a student is
      // promoted. Refusing here is the only place the mistake is cheap.
      // ---------------------------------------------------------------------
      const malformed = records.filter(
        (item: { studentProfileId?: unknown }) => !item?.studentProfileId
      );
      if (malformed.length > 0) {
        return badRequest(
          `${malformed.length} of ${records.length} attendance record(s) have no studentProfileId.`
        );
      }

      const unrecognised = records
        .map((item: { status?: unknown }, index: number): { status: unknown; index: number } => ({
          status: item?.status,
          index,
        }))
        .filter(
          (entry: { status: unknown; index: number }) =>
            entry.status !== undefined &&
            entry.status !== null &&
            !isKnownAttendanceStatus(entry.status)
        );

      if (unrecognised.length > 0) {
        const shown = unrecognised
          .slice(0, 5)
          .map(
            (entry: { status: unknown; index: number }) =>
              `#${entry.index} '${String(entry.status)}'`
          )
          .join(", ");
        return badRequest(
          `Unrecognised attendance status on ${unrecognised.length} record(s): ${shown}. Allowed: ${ATTENDANCE_STATUSES.join(", ")}.`
        );
      }

      const attendanceDate = new Date(date);
      attendanceDate.setHours(0, 0, 0, 0);
      const nextDate = new Date(attendanceDate);
      nextDate.setDate(nextDate.getDate() + 1);
      const academicYear = await prisma.academicYear.findFirst({
        where: { tenantId, startDate: { lte: attendanceDate }, endDate: { gte: attendanceDate } },
        orderBy: { startDate: "desc" },
      });
      if (!academicYear) return badRequest("No academic year covers the attendance date");
      await assertAcademicYearOpen(tenantId, academicYear.id);

      let presentCount = 0;
      let absentCount = 0;
      let lateCount = 0;
      let excusedCount = 0;
      const absentees: any[] = [];

      await prisma.$transaction(async (tx) => {
        for (const item of records) {
          // Only an *omitted* status defaults; a supplied one was validated
          // against the shared vocabulary above and is written as given.
          const status = item.status || "PRESENT";
          if (status === "PRESENT") presentCount++;
          else if (status === "ABSENT") {
            absentCount++;
            absentees.push(item.studentProfileId);
          } else if (status === "LATE") lateCount++;
          else if (status === "EXCUSED") excusedCount++;

          // Check if existing record for this student on this date
          const existing = await tx.attendance.findFirst({
            where: {
              tenantId,
              studentProfileId: item.studentProfileId,
              academicYearId: academicYear.id,
              date: { gte: attendanceDate, lt: nextDate },
            },
          });

          if (existing) {
            await tx.attendance.update({
              where: { id: existing.id },
              data: {
                status,
                note: item.note || undefined,
                markedById: user.id,
              },
            });
          } else {
            await tx.attendance.create({
              data: {
                tenantId,
                studentProfileId: item.studentProfileId,
                academicYearId: academicYear.id,
                date: attendanceDate,
                status,
                note: item.note || undefined,
                markedById: user.id,
              },
            });
          }
        }
      });

      void Promise.all(absentees.map((studentProfileId) => triggerAbsenceAlert({ tenantId, studentProfileId, date: attendanceDate })));

      return successResponse(
        {
          totalMarked: records.length,
          presentCount,
          absentCount,
          lateCount,
          excusedCount,
          attendanceRate: records.length > 0 ? ((presentCount / records.length) * 100).toFixed(1) : "0",
          date: date,
          absenteesCount: absentees.length,
        },
        "Fast-grid attendance saved successfully!",
        201
      );
    }

    // 2. Standard Single Attendance
    const validation = createAttendanceSchema.safeParse(body);
    if (!validation.success) {
      const errors = validation.error.errors.map((err) => ({
        field: err.path.join("."),
        code: err.code,
        message: err.message,
      }));
      return validationError(errors);
    }

    const data = validation.data;

    if (data.studentProfileId) {
      const student = await prisma.studentProfile.findUnique({
        where: { id: data.studentProfileId, tenantId },
      });
      if (!student) return badRequest("Student not found");
    }

    if (data.staffProfileId) {
      const staff = await prisma.staffProfile.findUnique({
        where: { id: data.staffProfileId, tenantId },
      });
      if (!staff) return badRequest("Staff member not found");
    }

    const targetDate = new Date(data.date);
    targetDate.setHours(0, 0, 0, 0);
    const nextDate = new Date(targetDate);
    nextDate.setDate(nextDate.getDate() + 1);
    const academicYear = await prisma.academicYear.findFirst({
      where: { tenantId, startDate: { lte: targetDate }, endDate: { gte: targetDate } },
      orderBy: { startDate: "desc" },
    });
    if (!academicYear) return badRequest("No academic year covers the attendance date");
    await assertAcademicYearOpen(tenantId, academicYear.id);

    const existing = await prisma.attendance.findFirst({
      where: {
        tenantId,
        ...(data.studentProfileId ? { studentProfileId: data.studentProfileId } : {}),
        ...(data.staffProfileId ? { staffProfileId: data.staffProfileId } : {}),
        academicYearId: academicYear.id,
        date: { gte: targetDate, lt: nextDate },
      },
    });

    let attendance;
    if (existing) {
      attendance = await prisma.attendance.update({
        where: { id: existing.id },
        data: {
          ...data,
          academicYearId: academicYear.id,
          date: targetDate,
          markedById: user.id,
        },
        include: {
          studentProfile: {
            select: {
              studentId: true,
              firstName: true,
              lastName: true,
              rollNumber: true,
            },
          },
          staffProfile: {
            select: {
              staffId: true,
              firstName: true,
              lastName: true,
              designation: true,
            },
          },
        },
      });
    } else {
      attendance = await prisma.attendance.create({
        data: {
          tenantId,
          ...data,
          academicYearId: academicYear.id,
          date: targetDate,
          markedById: user.id,
        },
        include: {
          studentProfile: {
            select: {
              studentId: true,
              firstName: true,
              lastName: true,
              rollNumber: true,
            },
          },
          staffProfile: {
            select: {
              staffId: true,
              firstName: true,
              lastName: true,
              designation: true,
            },
          },
        },
      });
    }

    if (data.status === "ABSENT" && data.studentProfileId) {
      void triggerAbsenceAlert({ tenantId, studentProfileId: data.studentProfileId, date: targetDate });
    }

    return successResponse(attendance, "Attendance marked successfully", existing ? 200 : 201);
  } catch (error) {
    return handleApiError(error);
  }
}
