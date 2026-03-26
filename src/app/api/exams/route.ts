import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  errorResponse,
  unauthorized,
  badRequest,
  validationError,
} from "@/lib/api-response";
import { createExamSchema } from "@/lib/schemas";
import { getAuthContext } from "@/lib/auth";

export const runtime = 'edge';

async function generateUniqueExamId(tenantId: string) {
  const latestExam = await prisma.exam.findFirst({
    where: {
      tenantId,
      examId: {
        startsWith: "EXAM-",
      },
    },
    orderBy: { createdAt: "desc" },
    select: { examId: true },
  });

  const latestSequence = latestExam?.examId.match(/^EXAM-(\d+)$/)?.[1];
  let nextNumber = latestSequence ? Number.parseInt(latestSequence, 10) + 1 : 1;

  while (true) {
    const candidate = `EXAM-${nextNumber.toString().padStart(4, "0")}`;
    const existingExam = await prisma.exam.findFirst({
      where: { tenantId, examId: candidate },
      select: { id: true },
    });

    if (!existingExam) {
      return candidate;
    }

    nextNumber += 1;
  }
}

/**
 * GET /api/exams
 * Get all exams
 */
export async function GET(request: NextRequest) {
  try {
    const authContext = await getAuthContext(request);
    if (!authContext) {
      return unauthorized("Authentication required");
    }

    const { tenantId } = authContext;
    const { searchParams } = new URL(request.url);
    const academicYearId = searchParams.get("academicYearId");
    const type = searchParams.get("type");
    const isPublished = searchParams.get("isPublished");

    const where: {
      tenantId: string;
      academicYearId?: string;
      type?: string;
      isPublished?: boolean;
    } = { tenantId };

    if (academicYearId) {
      where.academicYearId = academicYearId;
    }

    if (type) {
      where.type = type;
    }

    if (isPublished !== null) {
      where.isPublished = isPublished === "true";
    }

    const exams = await prisma.exam.findMany({
      where,
      include: {
        academicYear: {
          select: {
            yearId: true,
            label: true,
          },
        },
        subjects: {
          include: {
            subject: {
              select: {
                subjectId: true,
                name: true,
                code: true,
              },
            },
          },
        },
      },
      orderBy: { startDate: "desc" },
    });

    return successResponse(exams, "Exams retrieved successfully");
  } catch (error) {
    console.error("Get exams error:", error);
    return errorResponse("Internal server error", 500);
  }
}

/**
 * POST /api/exams
 * Create a new exam
 */
export async function POST(request: NextRequest) {
  try {
    const authContext = await getAuthContext(request);
    if (!authContext) {
      return unauthorized("Authentication required");
    }

    const { tenantId } = authContext;
    const body = await request.json();
    const validation = createExamSchema.safeParse(body);

    if (!validation.success) {
      const errors = validation.error.errors.map((err) => ({
        field: err.path.join("."),
        code: err.code,
        message: err.message,
      }));
      return validationError(errors);
    }

    const data = validation.data;
    const uniqueSubjectIds = new Set(data.subjects.map((subject) => subject.subjectId));

    if (uniqueSubjectIds.size !== data.subjects.length) {
      return badRequest("Duplicate subjects are not allowed", [
        { field: "subjects", code: "duplicate", message: "Duplicate subjects are not allowed" },
      ]);
    }

    // Verify academic year exists
    const academicYear = await prisma.academicYear.findUnique({
      where: { id: data.academicYearId, tenantId },
    });

    if (!academicYear) {
      return badRequest("Academic year not found");
    }

    const subjectIds = data.subjects.map((subject) => subject.subjectId);
    const existingSubjects = await prisma.subject.findMany({
      where: {
        tenantId,
        id: { in: subjectIds },
      },
      select: { id: true },
    });

    if (existingSubjects.length !== subjectIds.length) {
      return badRequest("One or more selected subjects were not found", [
        { field: "subjects", code: "not_found", message: "One or more selected subjects were not found" },
      ]);
    }

    const examId = await generateUniqueExamId(tenantId);

    const exam = await prisma.exam.create({
      data: {
        tenantId,
        examId,
        academicYearId: data.academicYearId,
        name: data.name,
        type: data.type,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        totalMarks: data.totalMarks,
        passPercentage: data.passPercentage,
        isPublished: data.isPublished,
        subjects: {
          create: data.subjects.map((subject) => ({
            tenantId,
            subjectId: subject.subjectId,
            maxMarks: subject.maxMarks,
            passMarks: subject.passMarks,
          })),
        },
      },
      include: {
        academicYear: {
          select: {
            yearId: true,
            label: true,
          },
        },
        subjects: {
          include: {
            subject: {
              select: {
                subjectId: true,
                name: true,
                code: true,
              },
            },
          },
        },
      },
    });

    return successResponse(exam, "Exam created successfully", 201);
  } catch (error) {
    console.error("Create exam error:", error);
    return errorResponse("Internal server error", 500);
  }
}
