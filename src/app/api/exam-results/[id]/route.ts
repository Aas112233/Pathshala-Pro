import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  errorResponse,
  unauthorized,
  notFound,
  badRequest,
} from "@/lib/api-response";
import { getAuthContext } from "@/lib/auth";

export const runtime = 'edge';

// Grading scale configuration
const GRADING_SCALE = [
  { minPercentage: 80, grade: "A+", point: 5.0, remark: "Excellent" },
  { minPercentage: 70, grade: "A", point: 4.5, remark: "Very Good" },
  { minPercentage: 60, grade: "A-", point: 4.0, remark: "Good" },
  { minPercentage: 50, grade: "B", point: 3.5, remark: "Average" },
  { minPercentage: 40, grade: "C", point: 3.0, remark: "Satisfactory" },
  { minPercentage: 33, grade: "D", point: 2.0, remark: "Pass" },
  { minPercentage: 0, grade: "F", point: 0.0, remark: "Fail" },
];

function calculateGrade(marks: number, maxMarks: number) {
  const percentage = (marks / maxMarks) * 100;
  const gradeInfo = GRADING_SCALE.find((g) => percentage >= g.minPercentage) || GRADING_SCALE[GRADING_SCALE.length - 1];
  return {
    grade: gradeInfo.grade,
    gradePoint: gradeInfo.point,
    percentage,
    status: percentage >= 33 ? "PASS" : "FAIL",
  };
}

/**
 * GET /api/exam-results/[id]
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

    const result = await prisma.examResult.findUnique({
      where: { id, tenantId },
      include: {
        studentProfile: {
          select: {
            studentId: true,
            firstName: true,
            lastName: true,
            rollNumber: true,
            classId: true,
          },
        },
        exam: {
          select: {
            id: true,
            examId: true,
            name: true,
            type: true,
          },
        },
        subject: {
          select: {
            id: true,
            subjectId: true,
            name: true,
            code: true,
          },
        },
        academicYear: {
          select: {
            yearId: true,
            label: true,
          },
        },
      },
    });

    if (!result) {
      return notFound("Exam result not found");
    }

    return successResponse(result);
  } catch (error) {
    console.error("Get exam result error:", error);
    return errorResponse("Internal server error", 500);
  }
}

/**
 * PUT /api/exam-results/[id]
 * Update a single exam result
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

    // Verify result exists
    const existingResult = await prisma.examResult.findUnique({
      where: { id, tenantId },
    });

    if (!existingResult) {
      return notFound("Exam result not found");
    }

    // Validate required fields
    const { obtainedMarks, maxMarks, reExamAllowed } = body;

    if (obtainedMarks === undefined || maxMarks === undefined) {
      return badRequest("obtainedMarks and maxMarks are required");
    }

    // Validate marks
    if (typeof obtainedMarks !== "number" || obtainedMarks < 0 || obtainedMarks > maxMarks) {
      return badRequest("obtainedMarks must be between 0 and maxMarks");
    }

    if (typeof maxMarks !== "number" || maxMarks <= 0) {
      return badRequest("maxMarks must be a positive number");
    }

    // Calculate grade and status
    const { grade, gradePoint, percentage, status } = calculateGrade(
      obtainedMarks,
      maxMarks
    );

    // Update result
    const updated = await prisma.examResult.update({
      where: { id },
      data: {
        obtainedMarks,
        maxMarks,
        percentage,
        grade,
        gradePoint,
        status,
        reExamAllowed: reExamAllowed && status === "FAIL",
      },
      include: {
        studentProfile: {
          select: {
            studentId: true,
            firstName: true,
            lastName: true,
            rollNumber: true,
            classId: true,
          },
        },
        subject: {
          select: {
            name: true,
            code: true,
          },
        },
      },
    });

    return successResponse(updated, "Exam result updated successfully");
  } catch (error) {
    console.error("Update exam result error:", error);
    return errorResponse("Internal server error", 500);
  }
}

/**
 * DELETE /api/exam-results/[id]
 * Delete a single exam result
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

    // Verify result exists
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
