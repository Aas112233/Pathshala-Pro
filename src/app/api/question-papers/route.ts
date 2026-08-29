import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  paginatedResponse,
  safeParseBody,
  handleApiError,
} from "@/lib/api-response";
import { createQuestionPaperSchema } from "@/lib/schemas";
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
 * GET /api/question-papers
 * List question papers in the repository
 */
export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;
    const { searchParams } = new URL(request.url);

    const classId = searchParams.get("classId");
    const subjectId = searchParams.get("subjectId");
    const academicYearId = searchParams.get("academicYearId");
    const examId = searchParams.get("examId");
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, Number.parseInt(searchParams.get("limit") || "20", 10)));
    const skip = (page - 1) * limit;

    const where: any = { tenantId };

    if (classId) where.classId = classId;
    if (subjectId) where.subjectId = subjectId;
    if (academicYearId) where.academicYearId = academicYearId;
    if (examId) where.examId = examId;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { code: { contains: search, mode: "insensitive" } },
        { paperId: { contains: search, mode: "insensitive" } },
      ];
    }

    const [papers, totalCount] = await Promise.all([
      (prisma as any).questionPaper.findMany({
        where,
        include: {
          class: { select: { id: true, name: true, classNumber: true } },
          subject: { select: { id: true, name: true, code: true } },
          academicYear: { select: { id: true, label: true } },
          exam: { select: { id: true, name: true, type: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      (prisma as any).questionPaper.count({ where }),
    ]);

    return paginatedResponse(papers, {
      totalCount,
      currentPage: page,
      pageSize: limit,
      totalPages: Math.ceil(totalCount / limit),
      hasNextPage: page * limit < totalCount,
      hasPreviousPage: page > 1,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/question-papers
 * Create a new question paper
 */
export async function POST(request: NextRequest) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;
    const bodyParsed = await safeParseBody(request, createQuestionPaperSchema);
    if (!bodyParsed.success) return bodyParsed.errorResponse;

    const data = bodyParsed.data;
    const paperId = await generateUniquePaperId(tenantId);

    const paper = await (prisma as any).questionPaper.create({
      data: {
        tenantId,
        paperId,
        title: data.title,
        code: data.code || null,
        academicYearId: data.academicYearId,
        classId: data.classId,
        subjectId: data.subjectId,
        examId: data.examId || null,
        totalMarks: data.totalMarks,
        durationMinutes: data.durationMinutes,
        instructions: data.instructions || null,
        sections: data.sections,
        status: data.status || "DRAFT",
      },
      include: {
        class: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true, code: true } },
        academicYear: { select: { id: true, label: true } },
        exam: { select: { id: true, name: true } },
      },
    });

    return successResponse(paper, "Question paper created successfully", 201);
  } catch (error) {
    return handleApiError(error);
  }
}
