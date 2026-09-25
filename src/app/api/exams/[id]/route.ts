import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  errorResponse,
  unauthorized,
  notFound,
  badRequest,
  validationError,
  handleApiError,
} from "@/lib/api-response";
import { updateExamSchema } from "@/lib/schemas";
import { requireApiAccess } from "@/lib/api-auth";
import { assertAcademicYearOpen } from "@/lib/academic-year-guards";
import { triggerExamResultPublished } from "@/lib/notifications/triggers/exam-result-published";
import {
  buildLockedFieldsDetails,
  getExamUsageCounts,
  integrityViolation,
  lockedDeleteMessage,
  lockedUpdateMessage,
} from "@/lib/data-integrity";
import { fastCache } from "@/lib/fast-memory-cache";
import { validateExamClassFees } from "@/lib/exam-fee-service";

/**
 * GET /api/exams/[id]
 * Get a single exam by ID
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

    const exam = await prisma.exam.findUnique({
      where: { id, tenantId },
      include: {
        academicYear: {
          select: {
            yearId: true,
            label: true,
            startDate: true,
            endDate: true,
          },
        },
        subjects: {
          include: {
            subject: {
              select: {
                subjectId: true,
                name: true,
                code: true,
                maxMarks: true,
                passMarks: true,
              },
            },
          },
        },
        classFees: {
          include: {
            class: { select: { id: true, classId: true, name: true } },
          },
        },
        results: {
          include: {
            studentProfile: {
              select: {
                studentId: true,
                firstName: true,
                lastName: true,
                rollNumber: true,
              },
            },
            subject: {
              select: {
                name: true,
                code: true,
              },
            },
          },
        },
      },
    });

    if (!exam) {
      return notFound("Exam not found");
    }

    // Authoritative class membership, in priority order:
    //   1. `Exam.classId`  — the class the admin actually chose at creation
    //   2. `ExamClass`     — every class the exam bills (incl. combined exams)
    //   3. subject-intersection — legacy fallback for exams predating both
    let classInfo: { id: string; classId: string; name: string } | null = null;
    const primaryClassId = exam.classId ?? exam.classFees[0]?.classId ?? null;
    if (primaryClassId) {
      classInfo = await prisma.class
        .findFirst({
          where: { tenantId, id: primaryClassId },
          select: { id: true, classId: true, name: true },
        });
    }
    if (!classInfo) {
      const subjectIds = exam.subjects.map((s) => s.subjectId);
      if (subjectIds.length > 0) {
        const classSubject = await prisma.classSubject.findFirst({
          where: {
            tenantId,
            subjectId: { in: subjectIds },
          },
          select: {
            class: {
              select: {
                id: true,
                classId: true,
                name: true,
              },
            },
          },
        });
        if (classSubject) {
          classInfo = classSubject.class;
        }
      }
    }

    const examWithClass = {
      ...exam,
      classId: classInfo?.id || null,
      class: classInfo,
      classIds: exam.classFees.length
        ? exam.classFees.map((cf) => cf.classId)
        : classInfo
          ? [classInfo.id]
          : [],
    };

    return successResponse(examWithClass, "Exam retrieved successfully");
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PUT /api/exams/[id]
 * Update an exam
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
    const body = await request.json();
    const validation = updateExamSchema.safeParse(body);

    if (!validation.success) {
      const errors = validation.error.errors.map((err) => ({
        field: err.path.join("."),
        code: err.code,
        message: err.message,
      }));
      return validationError(errors);
    }

    const data = { ...validation.data };
    delete data.subjects;
    // classFees is a relation, not an Exam scalar: it is synced separately so
    // a class can be added/removed/fee-changed without touching locked fields.
    const classFeesInput = data.classFees;
    delete data.classFees;

    const existingExam = await prisma.exam.findUnique({
      where: { id, tenantId },
    });

    if (!existingExam) {
      return notFound("Exam not found");
    }

    await assertAcademicYearOpen(tenantId, existingExam.academicYearId);

    const usageCounts = await getExamUsageCounts(tenantId, id);
    const examLocked = existingExam.isPublished || usageCounts.results > 0;
    const attemptedCoreFields = [
      "examId",
      "academicYearId",
      "name",
      "type",
      "startDate",
      "endDate",
      "totalMarks",
      "passPercentage",
    ].filter((field) => Object.prototype.hasOwnProperty.call(body, field));

    if (examLocked && (attemptedCoreFields.length > 0 || Array.isArray(body.subjects))) {
      const reason = existingExam.isPublished
        ? "the exam has already been published"
        : "results already exist for this exam";
      const details = buildLockedFieldsDetails(
        attemptedCoreFields.length > 0 ? attemptedCoreFields : ["subjects"],
        reason
      );
      if (Array.isArray(body.subjects)) {
        details.push({
          field: "subjects",
          code: "locked",
          message: `subjects cannot be changed because ${reason}.`,
        });
      }

      return integrityViolation(
        lockedUpdateMessage("Exam", reason),
        details
      );
    }

    // A collected exam fee is money already posted to the EXAM revenue head
    // and settled against AR. Re-pricing the schedule afterwards would make
    // the ledger disagree with the configuration, so it is refused outright
    // rather than silently allowed to drift.
    if (classFeesInput !== undefined && usageCounts.feeVouchers > 0) {
      return integrityViolation(
        "Cannot change the exam class fee schedule because exam fee vouchers have already been generated for this exam.",
        [
          {
            field: "classFees",
            code: "locked",
            message: `classFees cannot be changed because ${usageCounts.feeVouchers} exam fee voucher(s) already exist. Void those first, or raise a separate adjustment.`,
          },
        ]
      );
    }

    // Publish transitions are guarded explicitly:
    //  - draft -> published requires at least one result (guardians must
    //    never be notified about an exam with no marks) and is irreversible
    //  - published -> draft is blocked: report cards/transcripts/portal have
    //    already consumed the marks and guardians may have been notified
    if (data.isPublished === true && !existingExam.isPublished) {
      if (usageCounts.results === 0) {
        return integrityViolation(
          "Cannot publish an exam that has no results entered yet.",
          [
            {
              field: "isPublished",
              code: "no_results",
              message: "Enter exam results before publishing; publishing notifies all guardians.",
            },
          ]
        );
      }
    }
    if (data.isPublished === false && existingExam.isPublished) {
      return integrityViolation(
        "Published exams cannot be unpublished because guardians may already have been notified.",
        [
          {
            field: "isPublished",
            code: "locked",
            message: "Publishing is irreversible; marks are frozen once the exam is published.",
          },
        ]
      );
    }

    // Check exam ID uniqueness if changing
    if (data.examId && data.examId !== existingExam.examId) {
      const idExists = await prisma.exam.findFirst({
        where: { tenantId, examId: data.examId, id: { not: id } },
      });

      if (idExists) {
        return badRequest("Exam ID already in use", [
          { field: "examId", code: "duplicate", message: "Exam ID already exists" },
        ]);
      }
    }

    // Verify academic year exists if changing
    if (data.academicYearId) {
      const academicYear = await prisma.academicYear.findUnique({
        where: { id: data.academicYearId, tenantId },
      });

      if (!academicYear) {
        return badRequest("Academic year not found");
      }
    }

    if (data.startDate || data.endDate) {
      const effectiveStart = data.startDate ? new Date(data.startDate) : existingExam.startDate;
      const effectiveEnd = data.endDate ? new Date(data.endDate) : existingExam.endDate;
      if (effectiveStart > effectiveEnd) {
        return badRequest("Invalid exam dates", [
          { field: "endDate", code: "invalid_date", message: "End date cannot be before start date" },
        ]);
      }
    }

    // Per-class exam fees: replace the schedule wholesale. `classFees` is the
    // complete desired set, not a patch, so a class the admin removed is
    // genuinely unlinked instead of lingering at its old amount.
    let normalisedClassFees: ReturnType<typeof validateExamClassFees> = [];
    if (classFeesInput !== undefined) {
      normalisedClassFees = validateExamClassFees(classFeesInput);
      // The originating class stays in the schedule even if the admin
      // removed its fee row, so the exam's class and its billed classes can
      // never drift apart.
      if (data.classId && !normalisedClassFees.some((r) => r.classId === data.classId)) {
        normalisedClassFees.push({
          classId: data.classId,
          feeAmount: new Prisma.Decimal(0),
          isFeeApplicable: false,
        });
      }
      if (normalisedClassFees.length > 0) {
        const wantedIds = normalisedClassFees.map((r) => r.classId);
        const validClasses = await prisma.class.findMany({
          where: { tenantId, id: { in: wantedIds } },
          select: { id: true },
        });
        if (validClasses.length !== wantedIds.length) {
          const found = new Set(validClasses.map((c) => c.id));
          const missing = wantedIds.filter((cid) => !found.has(cid));
          return badRequest("One or more selected classes were not found", [
            { field: "classFees", code: "not_found", message: `Unknown class id(s): ${missing.join(", ")}` },
          ]);
        }
      }
    }

    const updatedExam = await prisma.$transaction(async (tx) => {
      // Typed explicitly rather than spread from the Zod output: an inferred
      // object literal here makes Prisma's Without<Unchecked, Checked> union
      // unresolvable. `subjects`/`classFees` are already stripped above (they
      // are relations, handled separately), so only scalars remain.
      const scalarData: Prisma.ExamUncheckedUpdateInput = {
        ...(data.examId !== undefined ? { examId: data.examId } : {}),
        ...(data.academicYearId !== undefined ? { academicYearId: data.academicYearId } : {}),
        ...(data.classId !== undefined ? { classId: data.classId } : {}),
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.type !== undefined ? { type: data.type } : {}),
        ...(data.totalMarks !== undefined ? { totalMarks: data.totalMarks } : {}),
        ...(data.passPercentage !== undefined ? { passPercentage: data.passPercentage } : {}),
        ...(data.isPublished !== undefined ? { isPublished: data.isPublished } : {}),
        ...(data.startDate ? { startDate: new Date(data.startDate) } : {}),
        ...(data.endDate ? { endDate: new Date(data.endDate) } : {}),
      };

      const updated = await tx.exam.update({
        where: { id },
        data: scalarData,
        include: {
          academicYear: {
            select: {
              yearId: true,
              label: true,
            },
          },
          classFees: {
            include: {
              class: { select: { id: true, classId: true, name: true } },
            },
          },
        },
      });

      if (classFeesInput !== undefined) {
        await tx.examClass.deleteMany({ where: { tenantId, examId: id } });
        if (normalisedClassFees.length > 0) {
          await tx.examClass.createMany({
            data: normalisedClassFees.map((row) => ({
              tenantId,
              examId: id,
              classId: row.classId,
              feeAmount: row.feeAmount,
              isFeeApplicable: row.isFeeApplicable,
            })),
          });
        }
      }

      return updated;
    });

    if (!existingExam.isPublished && data.isPublished === true) {
      void triggerExamResultPublished({ tenantId, examId: id });
    }

    fastCache.invalidatePrefix(`exams:${tenantId}`);

    return successResponse(updatedExam, "Exam updated successfully");
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/exams/[id]
 * Delete an exam
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

    const existingExam = await prisma.exam.findUnique({
      where: { id, tenantId },
    });

    if (!existingExam) {
      return notFound("Exam not found");
    }

    const usageCounts = await getExamUsageCounts(tenantId, id);
    if (existingExam.isPublished || usageCounts.results > 0) {
      return integrityViolation(
        lockedDeleteMessage("Exam", {
          published: existingExam.isPublished ? 1 : 0,
          results: usageCounts.results,
        }),
        [
          {
            field: "id",
            code: "in_use",
            message:
              "Published exams or exams with results cannot be deleted. Archive the exam instead of removing it.",
          },
        ]
      );
    }

    await prisma.$transaction([
      prisma.examSubject.deleteMany({
        where: { tenantId, examId: id },
      }),
      prisma.exam.delete({
        where: { id },
      }),
    ]);

    fastCache.invalidatePrefix(`exams:${tenantId}`);

    return successResponse(null, "Exam deleted successfully");
  } catch (error) {
    return handleApiError(error);
  }
}
