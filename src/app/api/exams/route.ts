import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
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
import { validateExamClassFees } from "@/lib/exam-fee-service";

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

    // v4: payload now carries the stored classId plus authoritative per-exam
    // classFees (ExamClass); classIds prefers those over the legacy
    // subject-intersection heuristic. Bumped so no older cached shape is served.
    const cacheKey = `exams:v4:${tenantId}:${resolvedAcademicYearId}:${type}:${isPublished}`;
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
        classFees: {
          select: {
            id: true,
            classId: true,
            feeAmount: true,
            isFeeApplicable: true,
          },
        },
      },
      orderBy: { startDate: "desc" },
    });

    // Class membership per exam.
    //
    // Priority: the stored `classId` (the admin's explicit choice) wins; then
    // the `ExamClass` schedule (which may list more classes for a combined
    // exam); then the subject-intersection heuristic, kept ONLY as a fallback
    // for legacy exams that predate both.
    const examsNeedingHeuristic = exams.filter(
      (e) => !e.classId && e.classFees.length === 0
    );

    // Only legacy exams need the curriculum intersection.
    const legacySubjectIds = [
      ...new Set(examsNeedingHeuristic.flatMap((e) => e.subjects.map((s) => s.subjectId))),
    ];
    const classSubjects = legacySubjectIds.length > 0
      ? await prisma.classSubject.findMany({
          where: { tenantId, subjectId: { in: legacySubjectIds } },
          select: { classId: true, subjectId: true },
        })
      : [];
    const subjectToClasses = new Map<string, Set<string>>();
    for (const cs of classSubjects) {
      const set = subjectToClasses.get(cs.subjectId) ?? new Set<string>();
      set.add(cs.classId);
      subjectToClasses.set(cs.subjectId, set);
    }
    const legacyClassMap = new Map<string, string[]>();
    for (const e of examsNeedingHeuristic) {
      const examSubjectIds = [...new Set(e.subjects.map((s) => s.subjectId))];
      if (examSubjectIds.length === 0) continue;
      const taughtCount = new Map<string, number>();
      for (const sid of examSubjectIds) {
        for (const cid of subjectToClasses.get(sid) ?? []) {
          taughtCount.set(cid, (taughtCount.get(cid) ?? 0) + 1);
        }
      }
      legacyClassMap.set(
        e.id,
        [...taughtCount.entries()]
          .filter(([, n]) => n === examSubjectIds.length)
          .map(([cid]) => cid),
      );
    }

    const examsWithClasses = exams.map((e) => {
      if (e.classFees.length > 0) {
        // Explicit schedule: expose the classes the exam really is billed to.
        // `classIds` stays a flat list for existing consumers; `classFees`
        // carries the per-class amount for the fee-aware ones.
        return { ...e, classIds: e.classFees.map((cf) => cf.classId) };
      }
      if (e.classId) {
        return { ...e, classIds: [e.classId] };
      }
      return { ...e, classIds: legacyClassMap.get(e.id) ?? [] };
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

    // Per-class exam fees. Normalised and range-checked server-side (never
    // trusted from the client) and written inside the same transaction as the
    // exam, so an exam can never exist with a half-written fee schedule.
    const classFeeRows = data.classFees ? validateExamClassFees(data.classFees) : [];

    // The originating class must exist, and must be represented in the fee
    // schedule. Auto-adding a blank (not-charged) row here means the admin's
    // class selection can never end up invisible on the exam — the class is
    // always recorded, even if they never set a fee for it.
    const originClass = await prisma.class.findFirst({
      where: { tenantId, id: data.classId },
      select: { id: true },
    });
    if (!originClass) {
      return badRequest("Class not found", [
        { field: "classId", code: "not_found", message: "The selected class does not exist." },
      ]);
    }
    if (!classFeeRows.some((r) => r.classId === data.classId)) {
      classFeeRows.push({
        classId: data.classId,
        feeAmount: new Prisma.Decimal(0),
        isFeeApplicable: false,
      });
    }

    if (classFeeRows.length > 0) {
      const classIds = classFeeRows.map((r) => r.classId);
      const validClasses = await prisma.class.findMany({
        where: { tenantId, id: { in: classIds } },
        select: { id: true },
      });
      if (validClasses.length !== classIds.length) {
        const found = new Set(validClasses.map((c) => c.id));
        const missing = classIds.filter((id) => !found.has(id));
        return badRequest("One or more selected classes were not found", [
          { field: "classFees", code: "not_found", message: `Unknown class id(s): ${missing.join(", ")}` },
        ]);
      }
    }

    const exam = await prisma.$transaction(async (tx) => {
      const created = await tx.exam.create({
        data: {
          tenantId,
          examId,
          academicYearId: data.academicYearId,
          name: data.name,
          classId: data.classId,
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
          classFees: {
            include: {
              class: { select: { id: true, name: true, classId: true } },
            },
          },
        },
      });

      if (classFeeRows.length > 0) {
        await tx.examClass.createMany({
          data: classFeeRows.map((row) => ({
            tenantId,
            examId: created.id,
            classId: row.classId,
            feeAmount: row.feeAmount,
            isFeeApplicable: row.isFeeApplicable,
          })),
        });
      }

      return created;
    });

    fastCache.invalidatePrefix(`exams:${tenantId}`);

    return successResponse(exam, "Exam created successfully", 201);
  } catch (error) {
    return handleApiError(error);
  }
}
