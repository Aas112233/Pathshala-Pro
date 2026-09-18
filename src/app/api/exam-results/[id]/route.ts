import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  notFound,
  badRequest,
  handleApiError,
} from "@/lib/api-response";
import { requireApiAccess } from "@/lib/api-auth";
import { assertAcademicYearOpen } from "@/lib/academic-year-guards";
import { integrityViolation } from "@/lib/data-integrity";
import { gradeExamResult } from "@/lib/exam-grading";

/**
 * GET /api/exam-results/[id]
 * Get a single exam result by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;
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
    return handleApiError(error);
  }
}

/**
 * PUT /api/exam-results/[id]
 * Update a single exam result.
 *
 * Guards (in order): tenant ownership, closed academic year, promotion lock
 * (self-healing), published exam (marks are read-only once published), and
 * server-authoritative grade derivation from the ExamSubject mapping — the
 * client-provided maxMarks is validated against the mapping, never trusted.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;
    const { id } = await params;
    const body = await request.json().catch(() => null);

    // Verify result exists
    const existingResult = await prisma.examResult.findUnique({
      where: { id, tenantId },
      include: {
        exam: {
          select: {
            isPublished: true,
            name: true,
          },
        },
      },
    });

    if (!existingResult) {
      return notFound("Exam result not found");
    }

    await assertAcademicYearOpen(tenantId, existingResult.academicYearId);

    if (existingResult.isLocked) {
      return badRequest("Cannot modify this exam result. Marks are locked because the student has already been promoted.");
    }

    const isPromoted = await prisma.classPromotion.findFirst({
      where: {
        tenantId,
        studentProfileId: existingResult.studentProfileId,
        fromAcademicYearId: existingResult.academicYearId,
        status: "PROMOTED",
      },
    });

    if (isPromoted) {
      // Self-heal the lock flag so future writes are blocked at the door.
      await prisma.examResult.update({
        where: { id },
        data: { isLocked: true },
      });
      return badRequest("Cannot modify this exam result. Marks are permanently locked due to student promotion.");
    }

    // Published exams are immutable: report cards, transcripts, and the
    // guardian portal have already consumed these marks.
    if (existingResult.exam.isPublished) {
      return integrityViolation(
        "Exam result cannot be modified because the parent exam has already been published.",
        [
          {
            field: "id",
            code: "locked",
            message:
              "Published marks are read-only. Use the controlled correction workflow instead of direct edits.",
          },
        ]
      );
    }

    const obtainedMarks = body?.obtainedMarks;
    const maxMarks = body?.maxMarks;
    const reExamAllowed = body?.reExamAllowed === true;
    const absent = body?.absent === true;

    if (typeof maxMarks !== "number" || maxMarks <= 0) {
      return badRequest("maxMarks must be a positive number");
    }

    if (!absent && (typeof obtainedMarks !== "number" || obtainedMarks < 0 || obtainedMarks > maxMarks)) {
      return badRequest("obtainedMarks must be between 0 and maxMarks");
    }

    // The exam-subject mapping owns the marks ceiling and pass threshold.
    const examSubject = await prisma.examSubject.findUnique({
      where: {
        tenantId_examId_subjectId: {
          tenantId,
          examId: existingResult.examId,
          subjectId: existingResult.subjectId,
        },
      },
      select: { maxMarks: true, passMarks: true },
    });

    if (!examSubject) {
      return badRequest("Subject is not part of this exam");
    }

    if (maxMarks !== examSubject.maxMarks) {
      return badRequest("maxMarks does not match the exam configuration", [
        {
          field: "maxMarks",
          code: "max_marks_mismatch",
          message: `Expected ${examSubject.maxMarks} marks for this exam subject`,
        },
      ]);
    }

    const effectiveMarks = absent ? 0 : obtainedMarks;
    const graded = gradeExamResult({
      obtainedMarks: effectiveMarks,
      maxMarks: examSubject.maxMarks,
      passMarks: examSubject.passMarks,
      status: absent ? "ABSENT" : null,
    });

    // Update result
    const updated = await prisma.examResult.update({
      where: { id },
      data: {
        maxMarks: examSubject.maxMarks,
        obtainedMarks: effectiveMarks,
        percentage: graded.percentage,
        grade: graded.grade,
        gradePoint: graded.gradePoint,
        status: graded.status,
        reExamAllowed: !absent && reExamAllowed && graded.status === "FAIL",
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
    return handleApiError(error);
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
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;
    const { id } = await params;

    // Verify result exists
    const existingResult = await prisma.examResult.findUnique({
      where: { id, tenantId },
      include: {
        exam: {
          select: {
            isPublished: true,
          },
        },
      },
    });

    if (!existingResult) {
      return notFound("Exam result not found");
    }

    await assertAcademicYearOpen(tenantId, existingResult.academicYearId);

    if (existingResult.isLocked) {
      return badRequest("Cannot delete this exam result. Marks are locked because the student has already been promoted.");
    }

    const isPromoted = await prisma.classPromotion.findFirst({
      where: {
        tenantId,
        studentProfileId: existingResult.studentProfileId,
        fromAcademicYearId: existingResult.academicYearId,
        status: "PROMOTED",
      },
    });

    if (isPromoted) {
      return badRequest("Cannot delete this exam result. Student has already been promoted.");
    }

    if (existingResult.exam.isPublished) {
      return integrityViolation(
        "Exam result cannot be deleted because the parent exam has already been published.",
        [
          {
            field: "id",
            code: "locked",
            message:
              "Published exam results must remain for historical consistency. Use a controlled correction workflow instead of deletion.",
          },
        ]
      );
    }

    await prisma.examResult.delete({
      where: { id },
    });

    return successResponse(null, "Exam result deleted successfully");
  } catch (error) {
    return handleApiError(error);
  }
}