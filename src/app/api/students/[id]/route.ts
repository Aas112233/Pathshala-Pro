import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  errorResponse,
  unauthorized,
  forbidden,
  notFound,
  badRequest,
} from "@/lib/api-response";
import { updateStudentSchema } from "@/lib/schemas";
import { getAuthContext } from "@/lib/auth";

/**
 * GET /api/students/[id]
 * Get a single student by ID
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

    const student = await prisma.studentProfile.findUnique({
      where: { id, tenantId },
      include: {
        feeVouchers: {
          take: 5,
          orderBy: { createdAt: "desc" },
          select: {
            voucherId: true,
            feeType: true,
            totalDue: true,
            amountPaid: true,
            balance: true,
            status: true,
            dueDate: true,
          },
        },
        attendances: {
          take: 5,
          orderBy: { date: "desc" },
          select: {
            date: true,
            status: true,
            note: true,
          },
        },
        examResults: {
          take: 5,
          orderBy: { createdAt: "desc" },
          select: {
            examName: true,
            subject: true,
            maxMarks: true,
            obtainedMarks: true,
            grade: true,
            remarks: true,
          },
        },
      },
    });

    if (!student) {
      return notFound("Student not found");
    }

    return successResponse(student);
  } catch (error) {
    console.error("Get student error:", error);
    return errorResponse("Internal server error", 500);
  }
}

/**
 * PUT /api/students/[id]
 * Update a student
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
    const validation = updateStudentSchema.safeParse(body);

    if (!validation.success) {
      const errors = validation.error.errors.map((err) => ({
        field: err.path.join("."),
        code: err.code,
        message: err.message,
      }));
      return badRequest("Invalid input", errors);
    }

    const data = validation.data;

    // Check if student exists
    const existingStudent = await prisma.studentProfile.findUnique({
      where: { id, tenantId },
    });

    if (!existingStudent) {
      return notFound("Student not found");
    }

    // Check student ID uniqueness if changing
    if (data.studentId && data.studentId !== existingStudent.studentId) {
      const idExists = await prisma.studentProfile.findFirst({
        where: { tenantId, studentId: data.studentId, id: { not: id } },
      });

      if (idExists) {
        return badRequest("Student ID already in use", [
          { field: "studentId", code: "duplicate", message: "Student ID already exists" },
        ]);
      }
    }

    // Check roll number uniqueness if changing
    if (data.rollNumber && data.rollNumber !== existingStudent.rollNumber) {
      const rollExists = await prisma.studentProfile.findFirst({
        where: { tenantId, rollNumber: data.rollNumber, id: { not: id } },
      });

      if (rollExists) {
        return badRequest("Roll number already in use", [
          { field: "rollNumber", code: "duplicate", message: "Roll number already exists" },
        ]);
      }
    }

    const updatedStudent = await prisma.studentProfile.update({
      where: { id },
      data,
      select: {
        id: true,
        studentId: true,
        rollNumber: true,
        firstName: true,
        lastName: true,
        guardianName: true,
        guardianContact: true,
        status: true,
        updatedAt: true,
      },
    });

    return successResponse(updatedStudent, "Student updated successfully");
  } catch (error) {
    console.error("Update student error:", error);
    return errorResponse("Internal server error", 500);
  }
}

/**
 * DELETE /api/students/[id]
 * Delete a student
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

    // Check if student exists
    const existingStudent = await prisma.studentProfile.findUnique({
      where: { id, tenantId },
    });

    if (!existingStudent) {
      return notFound("Student not found");
    }

    // Check for related records
    const feeVouchers = await prisma.feeVoucher.count({
      where: { studentProfileId: id },
    });

    if (feeVouchers > 0) {
      return badRequest("Cannot delete student with existing fee vouchers");
    }

    await prisma.studentProfile.delete({
      where: { id },
    });

    return successResponse(null, "Student deleted successfully");
  } catch (error) {
    console.error("Delete student error:", error);
    return errorResponse("Internal server error", 500);
  }
}
