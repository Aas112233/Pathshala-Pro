import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  errorResponse,
  unauthorized,
  badRequest,
  validationError,
  handleApiError,
} from "@/lib/api-response";
import { createExamSchema } from "@/lib/schemas";
import { requireApiAccess } from "@/lib/api-auth";
import { assertAcademicYearOpen, resolveRequestAcademicYearId } from "@/lib/academic-year-guards";
import { fastCache } from "@/lib/fast-memory-cache";

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
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;
    const { searchParams } = new URL(request.url);
    const academicYearIdParam = searchParams.get("academicYearId");
    const resolvedAcademicYearId = academicYearIdParam
      ? academicYearIdParam.trim()
      : await resolveRequestAcademicYearId(request, tenantId);
    const type = searchParams.get("type");
    const isPublished = searchParams.get("isPublished");

    const where: {
      tenantId: string;
      academicYearId?: string;
      type?: string;
      isPublished?: boolean;
    } = { tenantId };

    if (resolvedAcademicYearId && resolvedAcademicYearId !== "ALL") {
      where.academicYearId = resolvedAcademicYearId;
    }

    if (type) {
      where.type = type;
    }

    if (isPublished !== null) {
      where.isPublished = isPublished === "true";
    }

    // v2: payload now carries per-exam classIds (bumped so pre-existing
    // cached entries without classIds are never served).
    const cacheKey = `exams:v2:${tenantId}:${resolvedAcademicYearId}:${type}:${isPublished}`;
    const cachedExams = fastCache.get<any[]>(cacheKey);
    if (cachedExams) {
      return successResponse(cachedExams, "Exams retrieved successfully");
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

    // Derive eligible classes per exam via curriculum intersection:
    // Exam has no direct classId, but at creation its subjects are picked from
    // one class's ClassSubject roster, so the originating class teaches ALL of
    // the exam's subjects. Requiring ALL (not just ANY) keeps the cascade
    // narrow when core subjects are shared across classes.
    const allSubjectIds = [...new Set(exams.flatMap((e) => e.subjects.map((s) => s.subjectId)))];
    const classSubjects = allSubjectIds.length > 0
      ? await prisma.classSubject.findMany({
          where: { tenantId, subjectId: { in: allSubjectIds } },
          select: { classId: true, subjectId: true },
        })
      : [];
    const subjectToClasses = new Map<string, Set<string>>();
    for (const cs of classSubjects) {
      const set = subjectToClasses.get(cs.subjectId) ?? new Set<string>();
      set.add(cs.classId);
      subjectToClasses.set(cs.subjectId, set);
    }
    const examsWithClasses = exams.map((e) => {
      const examSubjectIds = [...new Set(e.subjects.map((s) => s.subjectId))];
      if (examSubjectIds.length === 0) return { ...e, classIds: [] as string[] };
      const taughtCount = new Map<string, number>();
      for (const sid of examSubjectIds) {
        for (const cid of subjectToClasses.get(sid) ?? []) {
          taughtCount.set(cid, (taughtCount.get(cid) ?? 0) + 1);
        }
      }
      return {
        ...e,
        classIds: [...taughtCount.entries()]
          .filter(([, n]) => n === examSubjectIds.length)
          .map(([cid]) => cid),
      };
    });

    fastCache.set(cacheKey, examsWithClasses, 60);

    return successResponse(examsWithClasses, "Exams retrieved successfully");
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/exams
 * Create a new exam
 */
export async function POST(request: NextRequest) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;
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

    // Validate date range
    if (new Date(data.startDate) > new Date(data.endDate)) {
      return badRequest("Invalid exam dates", [
        { field: "endDate", code: "invalid_date", message: "End date cannot be before start date" },
      ]);
    }

    // Validate subject marks
    for (const sub of data.subjects) {
      if (sub.passMarks > sub.maxMarks) {
        return badRequest("Invalid subject marks", [
          { field: "subjects", code: "invalid_marks", message: `Pass marks (${sub.passMarks}) cannot exceed max marks (${sub.maxMarks})` },
        ]);
      }
    }

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

    await assertAcademicYearOpen(tenantId, academicYear.id);

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
        // Exams always start as drafts. Publishing is a guarded, irreversible
        // transition enforced in PUT /api/exams/[id] (requires results to
        // exist, cannot be undone, and notifies guardians) — it must never be
        // reachable through the create endpoint.
        isPublished: false,
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
    return handleApiError(error);
  }
}
