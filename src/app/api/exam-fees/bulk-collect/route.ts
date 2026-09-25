import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  badRequest,
  notFound,
  handleApiError,
  safeParseBody,
} from "@/lib/api-response";
import { requireApiAccess } from "@/lib/api-auth";
import { z } from "zod";
import {
  getMethodPostingRules,
  validateCollectionMethod,
} from "@/lib/payment-method-routing";
import { collectExamFeePayment } from "@/lib/exam-fee-service";
import { smartRateLimitAsync, dedupeRequestAsync } from "@/lib/rate-limit";
import { assertAcademicYearOpen } from "@/lib/academic-year-guards";

const bulkExamFeeSchema = z.object({
  examId: z.string().min(1, "Exam is required"),
  classId: z.string().min(1, "Class is required"),
  sectionId: z.string().optional(),
  // Explicit, no default (AGENTS rule 15).
  paymentMethod: z.string().trim().min(1, "Select a payment method").max(30),
  chequeNumber: z.string().max(50).optional(),
  reference: z.string().max(100).optional(),
  note: z.string().max(1000).optional(),
  allowAdvanceToWallet: z.boolean().optional().default(false),
  payments: z
    .array(
      z.object({
        studentProfileId: z.string().min(1),
        amountPaid: z.number().finite().positive("Amount paid must be greater than 0"),
      })
    )
    .min(1, "Select at least one student to collect from")
    .max(200),
});

/**
 * POST /api/exam-fees/bulk-collect
 *
 * Class x Section batch collection for a single exam — the exam-fee twin of
 * the existing `fees/bulk-collect` desk.
 *
 * Failure semantics are deliberate: one bad row (a student who paid in full
 * between the grid load and the submit, say) does not roll back the whole
 * batch. Each student's payment is its own transaction, and the response
 * reports per-student success/failure so the cashier sees exactly who is
 * still outstanding rather than an opaque "batch failed". A single atomic
 * transaction over 200 students would also hold row locks on every voucher for
 * the duration and is a worse failure mode at a busy counter.
 */
export async function POST(request: NextRequest) {
  try {
    // The bulk desk is a separate, per-user grantable capability from working
    // the counter — same tier split as fees/bulk vs fees/collection.
    const access = await requireApiAccess(request, { module: "fee-bulk", action: "write" });
    if ("response" in access) return access.response;
    const { user, tenantId } = access.authContext;

    const rateCheck = await smartRateLimitAsync(`EXAM_FEE_BULK_${tenantId}_${user.id}`, { preset: "mutation", limit: 10 });
    if (!rateCheck.success) return badRequest("Too many bulk exam-fee submissions. Please try again later.");

    const bodyResult = await safeParseBody(request, bulkExamFeeSchema);
    if (!bodyResult.success) return bodyResult.errorResponse;
    const data = bodyResult.data;

    const tenantRow = await prisma.tenant.findUnique({
      where: { tenantId },
      select: { featureFlags: true },
    });
    const tenantMethods = (tenantRow?.featureFlags as any)?.paymentMethods;
    const methodCheck = validateCollectionMethod(tenantMethods, data.paymentMethod);
    if (methodCheck.error === "unknown") {
      return badRequest(`Unknown payment method "${data.paymentMethod}" for this tenant.`);
    }
    if (methodCheck.error === "inactive") {
      return badRequest(`Payment method "${data.paymentMethod}" is disabled for this tenant.`);
    }
    const postingRules = getMethodPostingRules(methodCheck.method, data.paymentMethod);
    if (postingRules.isCheque && !data.chequeNumber) {
      return badRequest("Cheque number is required for CHEQUE payments.");
    }
    if (postingRules.requiresReference && !data.reference) {
      return badRequest(
        `External reference (UTR/transaction id) is required for ${data.paymentMethod} payments.`
      );
    }

    const exam = await prisma.exam.findFirst({
      where: { id: data.examId, tenantId },
      select: { id: true, name: true, examId: true, academicYearId: true },
    });
    if (!exam) {
      return notFound("Exam not found");
    }
    await assertAcademicYearOpen(tenantId, exam.academicYearId);

    // The class must be one the exam actually bills. Without this guard a
    // crafted request could collect an "exam fee" from a class the exam was
    // never configured for, and the amount would fall through to an override.
    const examClass = await prisma.examClass.findFirst({
      where: { tenantId, examId: data.examId, classId: data.classId },
      select: { classId: true, feeAmount: true, isFeeApplicable: true },
    });
    if (!examClass) {
      return badRequest(
        "This class is not configured on the selected exam. Add the class and its exam fee on the exam first.",
        [{ field: "classId", code: "not_configured", message: "Class is not part of this exam." }]
      );
    }
    if (!examClass.isFeeApplicable || new Prisma.Decimal(examClass.feeAmount).lessThanOrEqualTo(0)) {
      return badRequest(
        "The selected class has no exam fee configured for this exam, so there is nothing to collect.",
        [{ field: "classId", code: "no_fee", message: "This class is listed but not charged for this exam." }]
      );
    }

    const requestKey = `EXAM_FEE_BULK_${tenantId}_${user.id}_${data.examId}_${data.classId}_${data.payments.length}_${data.payments.map((p) => p.studentProfileId).join(",")}`;
    if (!(await dedupeRequestAsync(requestKey, 5000))) {
      return badRequest("Duplicate bulk submission detected. Please wait a moment.");
    }

    // Scope every submitted student to the chosen class/section. Trusting the
    // posted ids alone would let a bulk payload collect from students outside
    // the visible grid.
    const validStudents = await prisma.studentProfile.findMany({
      where: {
        tenantId,
        id: { in: data.payments.map((p) => p.studentProfileId) },
        classId: data.classId,
        ...(data.sectionId ? { sectionId: data.sectionId } : {}),
        status: "ACTIVE",
      },
      select: { id: true },
    });
    const allowedIds = new Set(validStudents.map((s) => s.id));
    const rejected = data.payments.filter((p) => !allowedIds.has(p.studentProfileId));
    if (rejected.length > 0) {
      return badRequest(
        "Some students are not in the selected class and section.",
        rejected.map((p) => ({
          field: `payments.${p.studentProfileId}`,
          code: "out_of_scope",
          message: "Student does not belong to the selected class and section.",
        }))
      );
    }

    const successes: any[] = [];
    const failures: any[] = [];
    let totalCollected = new Prisma.Decimal(0);

    for (const payment of data.payments) {
      try {
        const result = await prisma.$transaction(async (tx) =>
          collectExamFeePayment(tx, {
            tenantId,
            examId: data.examId,
            studentProfileId: payment.studentProfileId,
            academicYearId: exam.academicYearId,
            amountPaid: payment.amountPaid,
            paymentMethod: data.paymentMethod,
            chequeNumber: data.chequeNumber,
            reference: data.reference,
            note: data.note,
            executedById: user.id,
            allowAdvanceToWallet: data.allowAdvanceToWallet,
          })
        );
        successes.push(result);
        totalCollected = totalCollected.plus(result.appliedToInvoice);
      } catch (error: any) {
        // A per-row failure must not abort the batch, but it must be loud:
        // the raw reason is surfaced verbatim, never masked as a generic
        // "an error occurred" (AGENTS rule 11).
        failures.push({
          studentProfileId: payment.studentProfileId,
          amountPaid: payment.amountPaid,
          reason: error?.message || "Unknown error",
        });
      }
    }

    return successResponse(
      {
        exam: { id: exam.id, name: exam.name, examId: exam.examId },
        classId: data.classId,
        totalRequested: data.payments.length,
        succeededCount: successes.length,
        failedCount: failures.length,
        totalCollected: totalCollected.toFixed(2),
        receipts: successes,
        failures,
      },
      failures.length > 0
        ? `Exam fee collected for ${successes.length} of ${data.payments.length} students. ${failures.length} failed.`
        : `Exam fee collected for all ${successes.length} students.`
    );
  } catch (error) {
    return handleApiError(error);
  }
}
