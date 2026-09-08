import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  notFound,
  forbidden,
  safeParseBody,
  handleApiError,
} from "@/lib/api-response";
import { updateQuestionPaperSchema } from "@/lib/schemas";
import { requireApiAccess } from "@/lib/api-auth";

/**
 * Check if the question paper is locked due to published exam results
 */
async function checkQuestionPaperLockStatus(
  tenantId: string,
  examId?: string | null,
  subjectId?: string | null
): Promise<{ isLocked: boolean; lockReason?: string }> {
  if (!examId || !subjectId) {
    return { isLocked: false };
  }

  // 1. Check if the parent Exam is published
  const exam = await prisma.exam.findFirst({
    where: { id: examId, tenantId },
    select: { id: true, name: true, isPublished: true },
  });

  if (exam?.isPublished) {
    return {
      isLocked: true,
      lockReason: "পরীক্ষার ফলাফল প্রকাশিত হওয়ায় এই প্রশ্নপত্রটি লক করা হয়েছে (Exam Results are Published)",
    };
  }

  // 2. Check if any locked or published ExamResult exists for this exam and subject
  const lockedResult = await prisma.examResult.findFirst({
    where: {
      tenantId,
      examId,
      subjectId,
      isLocked: true,
    },
    select: { id: true },
  });

  if (lockedResult) {
    return {
      isLocked: true,
      lockReason: "এই বিষয়ের ফলাফল ডাটাবেজে লক করা হয়েছে (Exam Results for this subject are locked)",
    };
  }

  return { isLocked: false };
}

/**
 * GET /api/question-papers/[id]
 * Returns question paper details, hydrated questions, and lock status
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

    const paper = await (prisma as any).questionPaper.findFirst({
      where: { id, tenantId },
      include: {
        class: { select: { id: true, name: true, classNumber: true } },
        subject: { select: { id: true, name: true, code: true } },
        academicYear: { select: { id: true, label: true } },
        exam: { select: { id: true, name: true, type: true, isPublished: true } },
        tenant: {
          select: {
            name: true,
            address: true,
            logoUrl: true,
            phone: true,
            email: true,
            website: true,
          },
        },
      },
    });

    if (!paper) {
      return notFound("Question paper not found");
    }

    // Check lock status
    const lockInfo = await checkQuestionPaperLockStatus(
      tenantId,
      paper.examId,
      paper.subjectId
    );

    // Extract all question IDs from sections
    const sections = Array.isArray(paper.sections) ? paper.sections : [];
    const allQuestionIds = sections.flatMap((sec: any) => sec.questionIds || []);

    // Fetch questions from Question Bank
    const questions = allQuestionIds.length > 0
      ? await (prisma as any).question.findMany({
          where: {
            id: { in: allQuestionIds },
            tenantId,
          },
        })
      : [];

    const questionMap = new Map(questions.map((q: any) => [q.id, q]));

    // Hydrate each section with full question objects
    const hydratedSections = sections.map((sec: any) => ({
      ...sec,
      sectionId: sec.sectionId || sec.id,
      questions: Array.isArray(sec.questions) && sec.questions.length > 0
        ? sec.questions
        : (sec.questionIds || [])
            .map((qid: string) => questionMap.get(qid))
            .filter(Boolean),
    }));

    return successResponse(
      {
        ...paper,
        hydratedSections,
        isLocked: lockInfo.isLocked,
        lockReason: lockInfo.lockReason,
      },
      "Question paper retrieved successfully"
    );
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PUT /api/question-papers/[id]
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
    const bodyParsed = await safeParseBody(request, updateQuestionPaperSchema);
    if (!bodyParsed.success) return bodyParsed.errorResponse;

    const existing = await (prisma as any).questionPaper.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return notFound("Question paper not found");
    }

    // Lock check: If exam results published, reject edits
    const lockInfo = await checkQuestionPaperLockStatus(
      tenantId,
      existing.examId,
      existing.subjectId
    );

    if (lockInfo.isLocked) {
      return forbidden(
        lockInfo.lockReason ||
          "Cannot modify question paper: Exam results have already been published for this exam and subject."
      );
    }

    // Status transition guard — PUBLISHED is locked (only ARCHIVED allowed)
    const newStatus = (bodyParsed.data as any).status as string | undefined;
    if (newStatus && newStatus !== existing.status) {
      const allowed: Record<string, string[]> = {
        DRAFT: ["READY", "ARCHIVED"],
        READY: ["PUBLISHED", "DRAFT", "ARCHIVED"],
        PUBLISHED: ["ARCHIVED"],
        ARCHIVED: ["DRAFT"],
      };
      const ok = (allowed[existing.status] || []).includes(newStatus);
      if (!ok) {
        return forbidden(`Status transition ${existing.status} → ${newStatus} not allowed. Allowed: ${(allowed[existing.status] || []).join(", ") || "none"}`);
      }
      if (existing.status === "PUBLISHED") {
        return forbidden("Published papers are locked. Only ARCHIVED transition is allowed.");
      }
    }
    if (existing.status === "PUBLISHED" && !newStatus) {
      return forbidden("Published paper is locked. Archive it before editing.");
    }

    // Version snapshot — keep audit trail (best-effort, ignore if table not yet migrated)
    try {
      const curVer = (existing as any).version ?? 1;
      await (prisma as any).questionPaperVersion?.create?.({
        data: {
          tenantId,
          paperId: id,
          version: curVer,
          snapshot: existing,
          changedBy: (access as any).authContext?.userId || null,
          note: `Snapshot before v${curVer + 1}`,
        },
      });
    } catch {}

    const toUpdate: any = { ...bodyParsed.data };
    // Auto-bump version & publishedAt
    toUpdate.version = ((existing as any).version ?? 1) + 1;
    if (newStatus === "PUBLISHED") toUpdate.publishedAt = new Date();

    const updated = await (prisma as any).questionPaper.update({
      where: { id },
      data: toUpdate,
      include: {
        class: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true, code: true } },
        academicYear: { select: { id: true, label: true } },
        exam: { select: { id: true, name: true } },
      },
    });

    return successResponse(updated, "Question paper updated successfully");
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/question-papers/[id]
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

    const existing = await (prisma as any).questionPaper.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return notFound("Question paper not found");
    }

    // Lock check: If exam results published, reject deletion
    const lockInfo = await checkQuestionPaperLockStatus(
      tenantId,
      existing.examId,
      existing.subjectId
    );

    if (lockInfo.isLocked) {
      return forbidden(
        lockInfo.lockReason ||
          "Cannot delete question paper: Exam results have already been published for this exam and subject."
      );
    }
    if ((existing as any).status === "PUBLISHED") {
      return forbidden("Published papers cannot be deleted. Archive it first.");
    }

    await (prisma as any).questionPaper.delete({
      where: { id },
    });

    return successResponse(null, "Question paper deleted successfully");
  } catch (error) {
    return handleApiError(error);
  }
}
