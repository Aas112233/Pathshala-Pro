import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  errorResponse,
  unauthorized,
  notFound,
  badRequest,
  validationError,
} from "@/lib/api-response";
import { updateExamSchema } from "@/lib/schemas";
import { getAuthContext } from "@/lib/auth";

/**
 * GET /api/exams/[id]
 * Get a single exam by ID
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

    const exam = await prisma.exam.findUnique({
      where: { id, tenantId },
      include: {
        academicYear: {
          select: {
            yearId: true,
            label: true,
            startDate: true,
            endDate: true,
          },
        },
        subjects: {
          include: {
            subject: {
              select: {
                subjectId: true,
                name: true,
                code: true,
                maxMarks: true,
                passMarks: true,
              },
            },
          },
        },
        results: {
          include: {
            studentProfile: {
              select: {
                studentId: true,
                firstName: true,
                lastName: true,
                rollNumber: true,
              },
            },
            subject: {
              select: {
                name: true,
                code: true,
              },
            },
          },
        },
      },
    });

    if (!exam) {
      return notFound("Exam not found");
    }

    return successResponse(exam, "Exam retrieved successfully");
  } catch (error) {
    console.error("Get exam error:", error);
    return errorResponse("Internal server error", 500);
  }
}

/**
 * PUT /api/exams/[id]
 * Update an exam
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
    const validation = updateExamSchema.safeParse(body);

    if (!validation.success) {
      const errors = validation.error.errors.map((err) => ({
        field: err.path.join("."),
        code: err.code,
        message: err.message,
      }));
      return validationError(errors);
    }

    const data = { ...validation.data };
    delete data.subjects;

    const existingExam = await prisma.exam.findUnique({
      where: { id, tenantId },
    });

    if (!existingExam) {
      return notFound("Exam not found");
    }

    // Check exam ID uniqueness if changing
    if (data.examId && data.examId !== existingExam.examId) {
      const idExists = await prisma.exam.findFirst({
        where: { tenantId, examId: data.examId, id: { not: id } },
      });

      if (idExists) {
        return badRequest("Exam ID already in use", [
          { field: "examId", code: "duplicate", message: "Exam ID already exists" },
        ]);
      }
    }

    // Verify academic year exists if changing
    if (data.academicYearId) {
      const academicYear = await prisma.academicYear.findUnique({
        where: { id: data.academicYearId, tenantId },
      });

      if (!academicYear) {
        return badRequest("Academic year not found");
      }
    }

    const updatedExam = await prisma.exam.update({
      where: { id },
      data: {
        ...data,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
      },
      include: {
        academicYear: {
          select: {
            yearId: true,
            label: true,
          },
        },
      },
    });

    return successResponse(updatedExam, "Exam updated successfully");
  } catch (error) {
    console.error("Update exam error:", error);
    return errorResponse("Internal server error", 500);
  }
}

/**
 * DELETE /api/exams/[id]
 * Delete an exam
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

    const existingExam = await prisma.exam.findUnique({
      where: { id, tenantId },
    });

    if (!existingExam) {
      return notFound("Exam not found");
    }

    // Check if exam has results
    const resultsCount = await prisma.examResult.count({
      where: { examId: id },
    });

    if (resultsCount > 0) {
      return badRequest("Cannot delete exam with existing results", [
        { field: "examId", code: "in_use", message: "Exam has results" },
      ]);
    }

    await prisma.$transaction([
      prisma.examSubject.deleteMany({
        where: { tenantId, examId: id },
      }),
      prisma.exam.delete({
        where: { id },
      }),
    ]);

    return successResponse(null, "Exam deleted successfully");
  } catch (error) {
    console.error("Delete exam error:", error);
    return errorResponse("Internal server error", 500);
  }
}
