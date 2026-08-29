import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  notFound,
  safeParseBody,
  handleApiError,
} from "@/lib/api-response";
import { updateQuestionPaperSchema } from "@/lib/schemas";
import { requireApiAccess } from "@/lib/api-auth";

/**
 * GET /api/question-papers/[id]
 * Returns question paper details and fully hydrated questions for each section
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
        exam: { select: { id: true, name: true, type: true } },
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
      questions: (sec.questionIds || [])
        .map((qid: string) => questionMap.get(qid))
        .filter(Boolean),
    }));

    return successResponse(
      {
        ...paper,
        hydratedSections,
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

    const updated = await (prisma as any).questionPaper.update({
      where: { id },
      data: bodyParsed.data,
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

    await (prisma as any).questionPaper.delete({
      where: { id },
    });

    return successResponse(null, "Question paper deleted successfully");
  } catch (error) {
    return handleApiError(error);
  }
}
