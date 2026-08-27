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
import { requireApiAccess } from "@/lib/api-auth";
import { MAX_PAGE_SIZE } from "@/lib/constants";

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
      where.studentProfile = { classId };
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

      const attendanceDate = new Date(date);
      attendanceDate.setHours(0, 0, 0, 0);
      const nextDate = new Date(attendanceDate);
      nextDate.setDate(nextDate.getDate() + 1);

      let presentCount = 0;
      let absentCount = 0;
      let lateCount = 0;
      let excusedCount = 0;
      const absentees: any[] = [];

      await prisma.$transaction(async (tx) => {
        for (const item of records) {
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
                date: attendanceDate,
                status,
                note: item.note || undefined,
                markedById: user.id,
              },
            });
          }
        }
      });

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

    const attendance = await prisma.attendance.create({
      data: {
        tenantId,
        ...data,
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

    return successResponse(attendance, "Attendance marked successfully", 201);
  } catch (error) {
    return handleApiError(error);
  }
}
