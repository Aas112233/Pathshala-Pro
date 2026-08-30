import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, badRequest, handleApiError, safeParseBody } from "@/lib/api-response";
import { requireApiAccess } from "@/lib/api-auth";
import { smartRateLimitAsync, dedupeRequestAsync } from "@/lib/rate-limit";
import { z } from "zod";
import { paymentMethodSchema } from "@/lib/schemas";
import { postLegacyFeeInvoiceAccrual, postLegacyFeePaymentJournal, computeStackedConcession } from "@/lib/fee-service";
import { getNextVoucherNumber } from "@/lib/accounting-sequence";
import { Prisma } from "@prisma/client";

const bulkFeePaymentSchema = z.object({
  academicYearId: z.string().min(1, "Academic Year is required"),
  classId: z.string().min(1, "Class is required"),
  sectionId: z.string().optional(),
  paymentMethod: paymentMethodSchema.default("CASH"),
  feeType: z.string().default("Annual Tuition (12 Months)"),
  month: z.number().int().min(1).max(12).optional(),
  year: z.number().int().min(2000).max(2100).optional(),
  payments: z.array(z.object({
    studentProfileId: z.string().min(1),
    amountPaid: z.number().finite().positive("Amount paid must be greater than 0"),
    feeVoucherId: z.string().optional(),
    note: z.string().max(1000).optional(),
  })).min(1).max(100),
});

export async function POST(request: NextRequest) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;
    const { user, tenantId } = access.authContext;
    const bodyResult = await safeParseBody(request, bulkFeePaymentSchema);
    if (!bodyResult.success) return bodyResult.errorResponse;
    const data = bodyResult.data;

    const rateCheck = await smartRateLimitAsync(`BULK_FEE_${tenantId}_${user.id}`, { preset: "mutation", limit: 10 });
    if (!rateCheck.success) return badRequest("Too many bulk payment requests. Please try again later.");
    const requestKey = `BULK_FEE_${tenantId}_${user.id}_${data.academicYearId}_${data.classId}_${data.payments.length}_${data.payments.map(p=>p.studentProfileId).join(",")}`;
    if (!(await dedupeRequestAsync(requestKey, 5000))) return badRequest("Duplicate bulk payment request detected.");

    const classRecord = await prisma.class.findFirst({ where: { id: data.classId, tenantId } });
    if (!classRecord) return badRequest("Selected class not found");
    if (data.sectionId) {
      const section = await prisma.section.findFirst({ where: { id: data.sectionId, tenantId, classId: data.classId } });
      if (!section) return badRequest("Selected section does not belong to the selected class");
    }

    const studentsInScope = await prisma.studentProfile.findMany({
      where: { tenantId, id: { in: data.payments.map((p) => p.studentProfileId) }, classId: data.classId, ...(data.sectionId ? { sectionId: data.sectionId } : {}) },
      select: { id: true },
    });
    const uniqueStudentIds = new Set(data.payments.map((p) => p.studentProfileId));
    if (uniqueStudentIds.size !== data.payments.length || studentsInScope.length !== uniqueStudentIds.size) {
      return badRequest("Each student may appear only once and every payment must target the selected class and section");
    }
    const academicYear = await prisma.academicYear.findUnique({ where: { id: data.academicYearId, tenantId } });
    if (!academicYear) return badRequest("Selected academic year not found");

    const classStructure = await prisma.classFeeStructure.findFirst({
      where: { tenantId, classId: data.classId, academicYearId: data.academicYearId, isActive: true },
    });

    const standardMonthlyFee = classStructure
      ? new Prisma.Decimal((classStructure as any).totalMonthlyFee ?? (classStructure as any).tuitionFee ?? 0)
      : new Prisma.Decimal(0);
    const tuitionMonthly = classStructure ? new Prisma.Decimal((classStructure as any).tuitionFee ?? standardMonthlyFee) : standardMonthlyFee;

    const studentIds = data.payments.map((p) => p.studentProfileId);
    const concessions = await prisma.studentFeeConcession.findMany({
      where: { tenantId, studentProfileId: { in: studentIds }, isActive: true },
    });
    const concessionsByStudent = new Map<string, typeof concessions>();
    for (const c of concessions) {
      const arr = concessionsByStudent.get(c.studentProfileId) || [];
      arr.push(c);
      concessionsByStudent.set(c.studentProfileId, arr);
    }

    const existingVouchers = await prisma.feeVoucher.findMany({
      where: { tenantId, studentProfileId: { in: studentIds }, academicYearId: data.academicYearId },
      select: { id: true, studentProfileId: true },
    });
    // Only used to know *which* voucher (if any) to lock inside the
    // transaction below — never to source totalDue/amountPaid directly,
    // since that snapshot goes stale the moment the transaction starts.
    const voucherMap = new Map(existingVouchers.map((v) => [v.studentProfileId, v]));

    const currentYear = data.year || new Date().getFullYear();
    let totalCollected = new Prisma.Decimal(0);
    const results: any[] = [];

    await prisma.$transaction(async (tx) => {
      for (const item of data.payments) {
        const payDec = new Prisma.Decimal(item.amountPaid);
        totalCollected = totalCollected.add(payDec);

        const existingVoucherId = item.feeVoucherId || voucherMap.get(item.studentProfileId)?.id;

        // Lock the voucher row inside the transaction (instead of trusting the
        // pre-transaction findFirst/voucherMap snapshot) so its totalDue/
        // amountPaid are read fresh and concurrent bulk-collect runs can't
        // race on the same voucher.
        let existingV: { id: string; totalDue: number; amountPaid: number } | undefined;
        if (existingVoucherId) {
          const lockedRows = await tx.$queryRaw<Array<{ id: string; totalDue: number; amountPaid: number }>>`
            SELECT id, "totalDue", "amountPaid"
            FROM "FeeVoucher"
            WHERE id = ${existingVoucherId} AND "tenantId" = ${tenantId} AND "studentProfileId" = ${item.studentProfileId} AND "academicYearId" = ${data.academicYearId}
            FOR UPDATE
          `;
          if (lockedRows.length > 0) existingV = lockedRows[0];
        }

        if (existingV) {
          const totalDue = new Prisma.Decimal(existingV.totalDue);
          const amountPaidPrev = new Prisma.Decimal(existingV.amountPaid);
          const appliedToInvoice = Prisma.Decimal.min(payDec, Prisma.Decimal.max(new Prisma.Decimal(0), totalDue.minus(amountPaidPrev)));
          const excessToWallet = payDec.minus(appliedToInvoice);
          const newAmountPaid = amountPaidPrev.add(appliedToInvoice);
          const newBalance = Prisma.Decimal.max(new Prisma.Decimal(0), totalDue.minus(newAmountPaid));
          const newStatus = newBalance.isZero() ? "PAID" : "PARTIAL";

          await tx.feeVoucher.update({
            where: { id: existingV.id },
            data: { amountPaid: { increment: Number(appliedToInvoice.toFixed(2)) }, balance: Number(newBalance.toFixed(2)), status: newStatus },
          });

          const receiptNumber = await getNextVoucherNumber(tx as any, tenantId, "RECEIPT");
          const transactionId = `TXN-${receiptNumber}`;

          const t = await tx.transaction.create({
            data: {
              tenantId,
              transactionId,
              feeVoucherId: existingV.id,
              amountPaid: Number(payDec.toFixed(2)),
              appliedToInvoice: Number(appliedToInvoice.toFixed(2)),
              excessToWallet: Number(excessToWallet.toFixed(2)),
              paymentMethod: data.paymentMethod || "CASH",
              receiptNumber,
              collectedById: user.id,
              note: item.note || `Bulk Class Collection (${data.paymentMethod || "CASH"}) - Paid: ${newAmountPaid.toFixed(2)}/${totalDue.toFixed(2)}`,
            },
          });

          await postLegacyFeePaymentJournal(tx as any, {
            tenantId,
            studentProfileId: item.studentProfileId,
            feeVoucherId: existingV.id,
            amount: payDec,
            appliedToInvoice: Number(appliedToInvoice.toFixed(2)),
            excessToWallet: Number(excessToWallet.toFixed(2)),
            paymentMethod: data.paymentMethod || "CASH",
            receiptNumber,
            executedById: user.id,
            note: item.note,
          });

          results.push({ studentProfileId: item.studentProfileId, transactionId: t.id, voucherId: existingV.id });
          continue;
        }

        // Initialize new annual voucher — Decimal, stacked cap
        const monthlyBase = standardMonthlyFee.isZero() ? payDec : standardMonthlyFee;
        // Compute stacked discount capped at tuition
        let monthlyDiscount = new Prisma.Decimal(0);
        const studConcessions = concessionsByStudent.get(item.studentProfileId) || [];
        if (studConcessions.length > 0) {
          monthlyDiscount = computeStackedConcession(tuitionMonthly, studConcessions.map(c=>({
            discountType: c.discountType,
            discountValue: new Prisma.Decimal(c.discountValue as any),
            appliesToHead: (c as any).appliesToHead || "TUITION",
            priority: (c as any).priority,
            validFrom: (c as any).validFrom,
            validUntil: (c as any).validUntil,
          })), monthlyBase);
        }

        const annualBase = monthlyBase.mul(12);
        const annualDiscount = monthlyDiscount.mul(12);
        const netAnnualDue = Prisma.Decimal.max(new Prisma.Decimal(0), annualBase.minus(annualDiscount));
        const totalDue = netAnnualDue;
        const balance = Prisma.Decimal.max(new Prisma.Decimal(0), totalDue.minus(payDec));
        const status = balance.isZero() ? "PAID" : "PARTIAL";
        const voucherId = await getNextVoucherNumber(tx as any, tenantId, "SALES_FEE", currentYear);

        const v = await tx.feeVoucher.create({
          data: {
            tenantId,
            voucherId,
            studentProfileId: item.studentProfileId,
            academicYearId: data.academicYearId,
            feeType: "Annual Tuition (12 Months)",
            baseAmount: Number(annualBase.toFixed(2)),
            discountAmount: Number(annualDiscount.toFixed(2)),
            arrears: 0,
            lateFine: 0,
            totalDue: Number(totalDue.toFixed(2)),
            amountPaid: Number(payDec.toFixed(2)),
            balance: Number(balance.toFixed(2)),
            dueDate: new Date(Date.now() + 30 * 86400000),
            status,
          },
        });

        await postLegacyFeeInvoiceAccrual(tx as any, {
          tenantId,
          studentProfileId: item.studentProfileId,
          feeHeadCode: "TUITION",
          amount: annualBase,
          discountAmount: annualDiscount,
          executedById: user.id,
          reference: voucherId,
        });

        const receiptNumber = await getNextVoucherNumber(tx as any, tenantId, "RECEIPT");
        const transactionId = `TXN-${receiptNumber}`;
        const appliedToInvoice = Prisma.Decimal.min(payDec, totalDue);
        const excessToWallet = payDec.minus(appliedToInvoice);

        await postLegacyFeePaymentJournal(tx as any, {
          tenantId,
          studentProfileId: item.studentProfileId,
          feeVoucherId: v.id,
          amount: payDec,
          appliedToInvoice,
          excessToWallet,
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
            amountPaid: Number(payDec.toFixed(2)),
            appliedToInvoice: Number(appliedToInvoice.toFixed(2)),
            excessToWallet: Number(excessToWallet.toFixed(2)),
            paymentMethod: data.paymentMethod || "CASH",
            receiptNumber,
            collectedById: user.id,
            note: item.note || `Bulk Class Entry (${data.paymentMethod || "CASH"}) - 12 Months Ledger`,
          },
        });

        results.push({ studentProfileId: item.studentProfileId, transactionId: t.id, voucherId: v.id });
      }
    });

    return successResponse(
      {
        totalCollected: totalCollected.toFixed(2),
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
