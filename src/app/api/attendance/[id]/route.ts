import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  errorResponse,
  unauthorized,
  notFound,
  badRequest,
} from "@/lib/api-response";
import { updateAttendanceSchema } from "@/lib/schemas";
import { getAuthContext } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

export const runtime = 'edge';

/**
 * GET /api/attendance/[id]
 * Get a single attendance record by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = await getAuthContext(request);
    if (!authContext) {
      return unauthorized("Authentication required");
    }

    const { tenantId } = authContext;
    const { id } = await params;

    const attendance = await prisma.attendance.findUnique({
      where: { id, tenantId },
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

    if (!attendance) {
      return notFound("Attendance record not found");
    }

    return successResponse(attendance);
  } catch (error) {
    console.error("Get attendance error:", error);
    return errorResponse("Internal server error", 500);
  }
}

/**
 * PUT /api/attendance/[id]
 * Update an attendance record
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = await getAuthContext(request);
    if (!authContext) {
      return unauthorized("Authentication required");
    }

    const { tenantId } = authContext;
    const { id } = await params;

    const body = await request.json();
    const validation = updateAttendanceSchema.safeParse(body);

    if (!validation.success) {
      const errors = validation.error.errors.map((err: any) => ({
        field: err.path.join("."),
        code: err.code,
        message: err.message,
      }));
      return badRequest("Invalid input", errors);
    }

    const data = validation.data;

    const existingAttendance = await prisma.attendance.findUnique({
      where: { id, tenantId },
    });

    if (!existingAttendance) {
      return notFound("Attendance record not found");
    }

    const updatedAttendance = await prisma.attendance.update({
      where: { id },
      data,
      include: {
        studentProfile: {
          select: {
            studentId: true,
            firstName: true,
            lastName: true,
          },
        },
        staffProfile: {
          select: {
            staffId: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return successResponse(updatedAttendance, "Attendance updated successfully");
  } catch (error) {
    console.error("Update attendance error:", error);
    return errorResponse("Internal server error", 500);
  }
}

/**
 * DELETE /api/attendance/[id]
 * Delete an attendance record
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = await getAuthContext(request);
    if (!authContext) {
      return unauthorized("Authentication required");
    }

    const { tenantId } = authContext;
    const { id } = await params;

    const existingAttendance = await prisma.attendance.findUnique({
      where: { id, tenantId },
    });

    if (!existingAttendance) {
      return notFound("Attendance record not found");
    }

    await prisma.attendance.delete({
      where: { id },
    });

    return successResponse(null, "Attendance record deleted successfully");
  } catch (error) {
    console.error("Delete attendance error:", error);
    return errorResponse("Internal server error", 500);
  }
}
