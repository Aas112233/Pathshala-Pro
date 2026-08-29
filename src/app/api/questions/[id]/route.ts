import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  notFound,
  safeParseBody,
  handleApiError,
} from "@/lib/api-response";
import { updateQuestionSchema } from "@/lib/schemas";
import { requireApiAccess } from "@/lib/api-auth";

/**
 * GET /api/questions/[id]
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

    const question = await (prisma as any).question.findFirst({
      where: { id, tenantId },
      include: {
        class: { select: { id: true, name: true, classNumber: true } },
        subject: { select: { id: true, name: true, code: true } },
      },
    });

    if (!question) {
      return notFound("Question not found");
    }

    return successResponse(question, "Question retrieved successfully");
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PUT /api/questions/[id]
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
    const bodyParsed = await safeParseBody(request, updateQuestionSchema);
    if (!bodyParsed.success) return bodyParsed.errorResponse;

    const existing = await (prisma as any).question.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return notFound("Question not found");
    }

    const updated = await (prisma as any).question.update({
      where: { id },
      data: bodyParsed.data,
      include: {
        class: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true, code: true } },
      },
    });

    return successResponse(updated, "Question updated successfully");
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/questions/[id]
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

    const existing = await (prisma as any).question.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return notFound("Question not found");
    }

    await (prisma as any).question.delete({
      where: { id },
    });

    return successResponse(null, "Question deleted successfully");
  } catch (error) {
    return handleApiError(error);
  }
}
