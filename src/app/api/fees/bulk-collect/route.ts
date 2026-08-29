import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  badRequest,
  handleApiError,
  safeParseBody,
} from "@/lib/api-response";
import { requireApiAccess } from "@/lib/api-auth";
import { z } from "zod";
import { paymentMethodSchema } from "@/lib/schemas";
import {
  postLegacyFeeInvoiceAccrual,
  postLegacyFeePaymentJournal,
} from "@/lib/fee-service";

const bulkFeePaymentSchema = z.object({
  academicYearId: z.string().min(1, "Academic Year is required"),
  classId: z.string().min(1, "Class is required"),
  sectionId: z.string().optional(),
  paymentMethod: paymentMethodSchema.default("CASH"),
  feeType: z.string().default("Annual Tuition (12 Months)"),
  month: z.number().int().min(1).max(12).optional(),
  year: z.number().int().min(2000).max(2100).optional(),
  payments: z
    .array(
      z.object({
        studentProfileId: z.string().min(1),
        amountPaid: z.number().positive("Amount paid must be greater than 0"),
        feeVoucherId: z.string().optional(),
        note: z.string().optional(),
      })
    )
    .min(1, "At least one student payment is required"),
});

/**
 * POST /api/fees/bulk-collect
 * Bulk fee collection for an entire class based on 12-month annual academic year fee obligation.
 */
export async function POST(request: NextRequest) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { user, tenantId } = access.authContext;

    const bodyResult = await safeParseBody(request, bulkFeePaymentSchema);
    if (!bodyResult.success) return bodyResult.errorResponse;
    const data = bodyResult.data;

    // Verify Academic Year
    const academicYear = await prisma.academicYear.findUnique({
      where: { id: data.academicYearId, tenantId },
    });
    if (!academicYear) {
      return badRequest("Selected academic year not found");
    }

    // Get Class Fee Structure
    const classStructure = await prisma.classFeeStructure.findFirst({
      where: {
        tenantId,
        classId: data.classId,
        academicYearId: data.academicYearId,
        isActive: true,
      },
    });

    const standardMonthlyFee =
      classStructure?.totalMonthlyFee || classStructure?.tuitionFee || 0;

    const studentIds = data.payments.map((p) => p.studentProfileId);

    // Fetch Concessions for these students
    const concessions = await prisma.studentFeeConcession.findMany({
      where: {
        tenantId,
        studentProfileId: { in: studentIds },
        isActive: true,
      },
    });
    const concessionMap = new Map(
      concessions.map((c) => [c.studentProfileId, c])
    );

    // Fetch existing vouchers for these students in this academic year
    const existingVouchers = await prisma.feeVoucher.findMany({
      where: {
        tenantId,
        studentProfileId: { in: studentIds },
        academicYearId: data.academicYearId,
      },
    });
    const voucherMap = new Map(
      existingVouchers.map((v) => [v.studentProfileId, v])
    );

    const currentYear = data.year || new Date().getFullYear();
    let totalCollected = 0;
    const results: any[] = [];

    await prisma.$transaction(async (tx) => {
      for (const item of data.payments) {
        totalCollected += item.amountPaid;
        const receiptNumber = `REC-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 100)}`;
        const transactionId = `TXN-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        const existingV = item.feeVoucherId
          ? await tx.feeVoucher.findUnique({ where: { id: item.feeVoucherId, tenantId } })
          : voucherMap.get(item.studentProfileId);

        // 1. If voucher exists, accumulate payment towards 12-month annual ledger
        if (existingV) {
          const newAmountPaid = (existingV.amountPaid || 0) + item.amountPaid;
          const newBalance = Math.max(0, existingV.totalDue - newAmountPaid);
          const newStatus = newBalance === 0 ? "PAID" : "PARTIAL";

          await tx.feeVoucher.update({
            where: { id: existingV.id },
            data: {
              amountPaid: newAmountPaid,
              balance: newBalance,
              status: newStatus,
            },
          });

          const t = await tx.transaction.create({
            data: {
              tenantId,
              transactionId,
              feeVoucherId: existingV.id,
              amountPaid: item.amountPaid,
              paymentMethod: data.paymentMethod || "CASH",
              receiptNumber,
              collectedById: user.id,
              note:
                item.note ||
                `Bulk Class Collection (${data.paymentMethod || "CASH"}) - Paid: ${newAmountPaid}/${existingV.totalDue}`,
            },
          });

          const appliedToInvoice = Math.min(
            item.amountPaid,
            Math.max(0, existingV.totalDue - (existingV.amountPaid || 0))
          );
          const excessToWallet = item.amountPaid - appliedToInvoice;
          await postLegacyFeePaymentJournal(tx, {
            tenantId,
            studentProfileId: item.studentProfileId,
            feeVoucherId: existingV.id,
            amount: item.amountPaid,
            appliedToInvoice,
            excessToWallet,
            paymentMethod: data.paymentMethod || "CASH",
            receiptNumber,
            executedById: user.id,
            note: item.note,
          });

          results.push({
            studentProfileId: item.studentProfileId,
            transactionId: t.id,
            voucherId: existingV.id,
          });
          continue;
        }

        // 2. Initialize 12-Month Annual Voucher for the Student
        const monthlyBase =
          standardMonthlyFee > 0 ? standardMonthlyFee : item.amountPaid;
        let monthlyDiscount = 0;

        if (concessionMap.has(item.studentProfileId)) {
          const conc = concessionMap.get(item.studentProfileId)!;
          if (conc.discountType === "PERCENTAGE") {
            monthlyDiscount =
              Math.round(((monthlyBase * conc.discountValue) / 100) * 100) /
              100;
          } else {
            monthlyDiscount = Math.min(conc.discountValue, monthlyBase);
          }
        }

        const annualBase = monthlyBase * 12;
        const annualDiscount = monthlyDiscount * 12;
    const netAnnualDue = Math.max(0, annualBase - annualDiscount);
    const totalDue = netAnnualDue;
    const balance = Math.max(0, totalDue - item.amountPaid);
        const status = balance === 0 ? "PAID" : "PARTIAL";
        const voucherId = `VCH-${currentYear}-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 100)}`;

        const v = await tx.feeVoucher.create({
          data: {
            tenantId,
            voucherId,
            studentProfileId: item.studentProfileId,
            academicYearId: data.academicYearId,
            feeType: "Annual Tuition (12 Months)",
            baseAmount: annualBase,
            discountAmount: annualDiscount,
            arrears: 0,
            totalDue,
            amountPaid: item.amountPaid,
            balance,
            dueDate: new Date(Date.now() + 30 * 86400000),
            status,
          },
        });

        await postLegacyFeeInvoiceAccrual(tx, {
          tenantId,
          studentProfileId: item.studentProfileId,
          feeHeadCode: "TUITION",
          amount: annualBase,
          discountAmount: annualDiscount,
          executedById: user.id,
          reference: voucherId,
        });

        const appliedToInvoice = Math.min(item.amountPaid, totalDue);
        await postLegacyFeePaymentJournal(tx, {
          tenantId,
          studentProfileId: item.studentProfileId,
          feeVoucherId: v.id,
          amount: item.amountPaid,
          appliedToInvoice,
          excessToWallet: item.amountPaid - appliedToInvoice,
          paymentMethod: data.paymentMethod || "CASH",
          receiptNumber,
          executedById: user.id,
          note: item.note,
        });

        const t = await tx.transaction.create({
          data: {
            tenantId,
            transactionId,
            feeVoucherId: v.id,
            amountPaid: item.amountPaid,
            paymentMethod: data.paymentMethod || "CASH",
            receiptNumber,
            collectedById: user.id,
            note:
              item.note ||
              `Bulk Class Entry (${data.paymentMethod || "CASH"}) - 12 Months Ledger`,
          },
        });

        results.push({
          studentProfileId: item.studentProfileId,
          transactionId: t.id,
          voucherId: v.id,
        });
      }
    });

    return successResponse(
      {
        totalCollected,
        studentsCount: data.payments.length,
        processed: results,
      },
      `Successfully recorded bulk payments for ${data.payments.length} students!`,
      201
    );
  } catch (error) {
    return handleApiError(error);
  }
}
