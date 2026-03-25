import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  errorResponse,
  unauthorized,
  notFound,
  badRequest,
} from "@/lib/api-response";
import { updateExamResultSchema } from "@/lib/schemas";
import { getAuthContext } from "@/lib/auth";

/**
 * GET /api/exams/[id]
 * Get a single exam result by ID
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

    const examResult = await prisma.examResult.findUnique({
      where: { id, tenantId },
      include: {
        studentProfile: {
          select: {
            id: true,
            studentId: true,
            firstName: true,
            lastName: true,
            rollNumber: true,
            guardianName: true,
            guardianContact: true,
          },
        },
        academicYear: {
          select: {
            yearId: true,
            label: true,
            startDate: true,
            endDate: true,
          },
        },
      },
    });

    if (!examResult) {
      return notFound("Exam result not found");
    }

    return successResponse(examResult);
  } catch (error) {
    console.error("Get exam result error:", error);
    return errorResponse("Internal server error", 500);
  }
}

/**
 * PUT /api/exams/[id]
 * Update an exam result
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
    const validation = updateExamResultSchema.safeParse(body);

    if (!validation.success) {
      const errors = validation.error.errors.map((err: any) => ({
        field: err.path.join("."),
        code: err.code,
        message: err.message,
      }));
      return badRequest("Invalid input", errors);
    }

    const data = validation.data;

    const existingResult = await prisma.examResult.findUnique({
      where: { id, tenantId },
    });

    if (!existingResult) {
      return notFound("Exam result not found");
    }

    // Validate marks if both are provided
    if (data.obtainedMarks !== undefined && data.maxMarks !== undefined) {
      if (data.obtainedMarks > data.maxMarks) {
        return badRequest("Obtained marks cannot exceed max marks", [
          {
            field: "obtainedMarks",
            code: "invalid",
            message: "Obtained marks must be less than or equal to max marks",
          },
        ]);
      }
    }

    // Auto-calculate grade if marks are being updated
    const obtainedMarks = data.obtainedMarks ?? existingResult.obtainedMarks;
    const maxMarks = data.maxMarks ?? existingResult.maxMarks;
    const percentage = (obtainedMarks / maxMarks) * 100;

    const updateData: any = { ...data };

    if (!data.grade) {
      if (percentage >= 80) updateData.grade = "A+";
      else if (percentage >= 70) updateData.grade = "A";
      else if (percentage >= 60) updateData.grade = "B";
      else if (percentage >= 50) updateData.grade = "C";
      else if (percentage >= 40) updateData.grade = "D";
      else updateData.grade = "F";
    }

    if (!data.remarks) {
      if (percentage >= 80) updateData.remarks = "Excellent";
      else if (percentage >= 60) updateData.remarks = "Good";
      else if (percentage >= 40) updateData.remarks = "Satisfactory";
      else updateData.remarks = "Needs Improvement";
    }

    const updatedResult = await prisma.examResult.update({
      where: { id },
      data: updateData,
      include: {
        studentProfile: {
          select: {
            studentId: true,
            firstName: true,
            lastName: true,
            rollNumber: true,
          },
        },
      },
    });

    return successResponse(updatedResult, "Exam result updated successfully");
  } catch (error) {
    console.error("Update exam result error:", error);
    return errorResponse("Internal server error", 500);
  }
}

/**
 * DELETE /api/exams/[id]
 * Delete an exam result
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

    const existingResult = await prisma.examResult.findUnique({
      where: { id, tenantId },
    });

    if (!existingResult) {
      return notFound("Exam result not found");
    }

    await prisma.examResult.delete({
      where: { id },
    });

    return successResponse(null, "Exam result deleted successfully");
  } catch (error) {
    console.error("Delete exam result error:", error);
    return errorResponse("Internal server error", 500);
  }
}
