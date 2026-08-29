import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  notFound,
  handleApiError,
} from "@/lib/api-response";
import { requireApiAccess } from "@/lib/api-auth";

async function generateUniquePaperId(tenantId: string) {
  const latest = await (prisma as any).questionPaper.findFirst({
    where: { tenantId, paperId: { startsWith: "QP-" } },
    orderBy: { createdAt: "desc" },
    select: { paperId: true },
  });

  const latestSeq = latest?.paperId.match(/^QP-(\d+)$/)?.[1];
  let nextNum = latestSeq ? Number.parseInt(latestSeq, 10) + 1 : 1;

  while (true) {
    const candidate = `QP-${nextNum.toString().padStart(4, "0")}`;
    const exists = await (prisma as any).questionPaper.findFirst({
      where: { tenantId, paperId: candidate },
      select: { id: true },
    });
    if (!exists) return candidate;
    nextNum += 1;
  }
}

/**
 * POST /api/question-papers/[id]/duplicate
 * Clones an existing question paper as a new variant
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;
    const { id } = await params;

    const source = await (prisma as any).questionPaper.findFirst({
      where: { id, tenantId },
    });

    if (!source) {
      return notFound("Original question paper not found");
    }

    const newPaperId = await generateUniquePaperId(tenantId);

    const duplicated = await (prisma as any).questionPaper.create({
      data: {
        tenantId,
        paperId: newPaperId,
        title: `${source.title} (Copy)`,
        code: source.code ? `${source.code}-B` : null,
        academicYearId: source.academicYearId,
        classId: source.classId,
        subjectId: source.subjectId,
        examId: source.examId,
        totalMarks: source.totalMarks,
        durationMinutes: source.durationMinutes,
        instructions: source.instructions,
        sections: source.sections,
        status: "DRAFT",
      },
      include: {
        class: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true, code: true } },
        academicYear: { select: { id: true, label: true } },
      },
    });

    return successResponse(duplicated, "Question paper duplicated successfully", 201);
  } catch (error) {
    return handleApiError(error);
  }
}
