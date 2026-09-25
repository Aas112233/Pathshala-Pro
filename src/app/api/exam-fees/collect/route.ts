import { NextRequest } from "next/server";
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
import { dedupeRequestAsync } from "@/lib/rate-limit";
import { assertAcademicYearOpen } from "@/lib/academic-year-guards";

const collectExamFeeSchema = z.object({
  examId: z.string().min(1, "Exam is required"),
  studentProfileId: z.string().min(1, "Student is required"),
  amountPaid: z.number().positive("Payment amount must be greater than 0"),
  // No default: AGENTS rule 15 forbids pre-selecting a payment method. The
  // cashier must choose how the student is paying.
  paymentMethod: z.string().trim().min(1, "Select a payment method").max(30),
  receiptNumber: z.string().max(60).optional(),
  chequeNumber: z.string().max(50).optional(),
  reference: z.string().max(100).optional(),
  note: z.string().max(1000).optional(),
  allowAdvanceToWallet: z.boolean().optional().default(false),
});

/**
 * POST /api/exam-fees/collect
 *
 * Single-student exam-fee counter collection. Mirrors the posture of
 * `collect-direct`: the POS desk is its own capability tier (`fee-pos`), so a
 * role that may manage fee waivers still cannot take money here.
 */
export async function POST(request: NextRequest) {
  try {
    const access = await requireApiAccess(request, { module: "fee-pos", action: "write" });
    if ("response" in access) return access.response;
    const { user, tenantId } = access.authContext;

    const bodyResult = await safeParseBody(request, collectExamFeeSchema);
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

    const student = await prisma.studentProfile.findFirst({
      where: { id: data.studentProfileId, tenantId },
      select: { id: true, classId: true },
    });
    if (!student) {
      return notFound("Student profile not found");
    }

    // Double-submit guard: the same student, exam and amount inside 3s is a
    // double click, not two real payments.
    const dedupeKey = `EXAM_COLLECT_${tenantId}_${data.studentProfileId}_${data.examId}_${data.amountPaid}_${data.paymentMethod}`;
    if (!(await dedupeRequestAsync(dedupeKey, 3000))) {
      return badRequest("Duplicate payment request detected. Please wait a moment.");
    }

    const result = await prisma.$transaction(async (tx) =>
      collectExamFeePayment(tx, {
        tenantId,
        examId: data.examId,
        studentProfileId: data.studentProfileId,
        academicYearId: exam.academicYearId,
        amountPaid: data.amountPaid,
        paymentMethod: data.paymentMethod,
        receiptNumber: data.receiptNumber,
        chequeNumber: data.chequeNumber,
        reference: data.reference,
        note: data.note,
        executedById: user.id,
        allowAdvanceToWallet: data.allowAdvanceToWallet,
      })
    );

    return successResponse(
      { ...result, examName: exam.name },
      "Exam fee collected successfully"
    );
  } catch (error) {
    return handleApiError(error);
  }
}
