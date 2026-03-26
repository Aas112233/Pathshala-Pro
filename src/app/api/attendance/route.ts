import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  paginatedResponse,
  errorResponse,
  badRequest,
  unauthorized,
  validationError,
} from "@/lib/api-response";
import { createAttendanceSchema, updateAttendanceSchema } from "@/lib/schemas";
import { getAuthContext } from "@/lib/auth";
import { MAX_PAGE_SIZE } from "@/lib/constants";
import { hasPermission } from "@/lib/permissions";

/**
 * GET /api/attendance
 * Get all attendance records with pagination
 */
export async function GET(request: NextRequest) {
  try {
    const authContext = await getAuthContext(request);
    if (!authContext) {
      return unauthorized("Authentication required");
    }

    const { tenantId } = authContext;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), MAX_PAGE_SIZE);
    const date = searchParams.get("date");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const studentId = searchParams.get("studentId") || "";
    const staffId = searchParams.get("staffId") || "";
    const status = searchParams.get("status") || "";

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

    const totalCount = await prisma.attendance.count({ where });

    const attendance = await prisma.attendance.findMany({
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
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

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
    console.error("Get attendance error:", error);
    return errorResponse("Internal server error", 500);
  }
}

/**
 * POST /api/attendance
 * Mark attendance (student or staff)
 */
export async function POST(request: NextRequest) {
  try {
    const authContext = await getAuthContext(request);
    if (!authContext) {
      return unauthorized("Authentication required");
    }

    const { user, tenantId } = authContext;

    const body = await request.json();
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

    // Verify student or staff exists
    if (data.studentProfileId) {
      const student = await prisma.studentProfile.findUnique({
        where: { id: data.studentProfileId, tenantId },
      });

      if (!student) {
        return badRequest("Student not found");
      }
    }

    if (data.staffProfileId) {
      const staff = await prisma.staffProfile.findUnique({
        where: { id: data.staffProfileId, tenantId },
      });

      if (!staff) {
        return badRequest("Staff member not found");
      }
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
    console.error("Create attendance error:", error);
    return errorResponse("Internal server error", 500);
  }
}
