import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  paginatedResponse,
  safeParseBody,
  handleApiError,
} from "@/lib/api-response";
import { createQuestionSchema } from "@/lib/schemas";
import { requireApiAccess } from "@/lib/api-auth";
import { createHash } from "crypto";

function normalizeForHash(html: string): string {
  const stripped = html.replace(/<[^>]*>/g, " ").toLowerCase();
  return stripped.replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ").trim().slice(0, 500);
}
function similarityHash(text: string): string {
  const norm = normalizeForHash(text);
  return createHash("sha256").update(norm).digest("hex").slice(0, 16);
}

/**
 * GET /api/questions
 * List and search questions in the Question Bank
 */
export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;
    const { searchParams } = new URL(request.url);

    const classId = searchParams.get("classId");
    const subjectId = searchParams.get("subjectId");
    const type = searchParams.get("type");
    const difficulty = searchParams.get("difficulty");
    const chapter = searchParams.get("chapter");
    const search = searchParams.get("search");
    const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, Number.parseInt(searchParams.get("limit") || "50", 10)));
    const skip = (page - 1) * limit;

    const where: any = {
      tenantId,
      isActive: true,
    };

    if (classId) where.classId = classId;
    if (subjectId) where.subjectId = subjectId;
    if (type) where.type = type;
    if (difficulty) where.difficulty = difficulty;
    if (chapter) where.chapter = { contains: chapter, mode: "insensitive" };
    if (search) {
      where.OR = [
        { questionText: { contains: search, mode: "insensitive" } },
        { chapter: { contains: search, mode: "insensitive" } },
        { topic: { contains: search, mode: "insensitive" } },
      ];
    }

    const [questions, totalCount] = await Promise.all([
      (prisma as any).question.findMany({
        where,
        include: {
          class: { select: { id: true, name: true, classNumber: true } },
          subject: { select: { id: true, name: true, code: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      (prisma as any).question.count({ where }),
    ]);

    return paginatedResponse(questions, {
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
 * POST /api/questions
 * Create a new question in the Question Bank
 */
export async function POST(request: NextRequest) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;
    const bodyParsed = await safeParseBody(request, createQuestionSchema);
    if (!bodyParsed.success) return bodyParsed.errorResponse;

    const data = bodyParsed.data;
    const hash = similarityHash(data.questionText || "");
    // Dedup check — same class/subject/type with identical normalized text
    const dup = await (prisma as any).question.findFirst({
      where: { tenantId, classId: data.classId, subjectId: data.subjectId, similarityHash: hash },
      select: { id: true, questionText: true },
    });

    const question = await (prisma as any).question.create({
      data: {
        tenantId,
        classId: data.classId,
        subjectId: data.subjectId,
        chapter: data.chapter || null,
        topic: data.topic || null,
        type: data.type,
        difficulty: data.difficulty,
        bloomLevel: data.bloomLevel || null,
        questionText: data.questionText,
        stimulus: data.stimulus || null,
        options: data.options || undefined,
        subQuestions: data.subQuestions || undefined,
        correctAnswer: data.correctAnswer || null,
        explanation: data.explanation || null,
        marks: data.marks,
        isActive: data.isActive !== undefined ? data.isActive : true,
        similarityHash: hash,
        usageCount: 0,
      },
      include: {
        class: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true, code: true } },
      },
    });

    if (dup) {
      return successResponse({ ...question, _duplicateWarning: `Similar question already exists (${dup.id.slice(-6)}) — possible duplicate` }, "Question created with duplicate warning", 201);
    }
    return successResponse(question, "Question created successfully", 201);
  } catch (error) {
    return handleApiError(error);
  }
}

