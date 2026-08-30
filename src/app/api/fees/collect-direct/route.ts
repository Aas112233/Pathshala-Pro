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
  computeStackedConcession,
} from "@/lib/fee-service";
import { getNextVoucherNumber } from "@/lib/accounting-sequence";
import { Prisma } from "@prisma/client";

const directFeeCollectionSchema = z.object({
  studentProfileId: z.string().min(1, "Student ID is required"),
  amountPaid: z.number().positive("Payment amount must be greater than 0"),
  paymentMethod: paymentMethodSchema.default("CASH"),
  receiptNumber: z.string().optional(),
  note: z.string().optional(),
  academicYearId: z.string().optional(),
  feeVoucherId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { user, tenantId } = access.authContext;

    const bodyResult = await safeParseBody(request, directFeeCollectionSchema);
    if (!bodyResult.success) return bodyResult.errorResponse;
    const data = bodyResult.data;

    const student = await prisma.studentProfile.findUnique({
      where: { id: data.studentProfileId, tenantId },
      include: { class: true, section: true },
    });

    if (!student) {
      return badRequest("Student profile not found");
    }

    let academicYearId = data.academicYearId;
    if (!academicYearId) {
      const activeAy = await prisma.academicYear.findFirst({
        where: { tenantId, isClosed: false },
        orderBy: { createdAt: "desc" },
      });
      academicYearId = activeAy?.id;
    }
    if (!academicYearId) {
      const anyAy = await prisma.academicYear.findFirst({ where: { tenantId } });
      academicYearId = anyAy?.id;
    }
    if (!academicYearId) {
      return badRequest("No active academic year found in the system.");
    }

    const targetVoucherId = data.feeVoucherId
      ? (await prisma.feeVoucher.findUnique({ where: { id: data.feeVoucherId, tenantId }, select: { id: true } }))?.id
      : (await prisma.feeVoucher.findFirst({
          where: { tenantId, studentProfileId: student.id, academicYearId: academicYearId! },
          orderBy: { createdAt: "desc" },
          select: { id: true },
        }))?.id;

    const paymentDecimal = new Prisma.Decimal(data.amountPaid);

    // Use Decimal-safe math for existing voucher
    if (targetVoucherId) {
      const [transaction, updatedVoucher] = await prisma.$transaction(async (tx) => {
        // Lock the voucher row inside the transaction so its totalDue/amountPaid
        // are read fresh (not the stale pre-transaction snapshot), preventing a
        // lost update when two payments race against the same voucher.
        const lockedRows = await tx.$queryRaw<Array<{ id: string; totalDue: number; amountPaid: number }>>`
          SELECT id, "totalDue", "amountPaid"
          FROM "FeeVoucher"
          WHERE id = ${targetVoucherId} AND "tenantId" = ${tenantId}
          FOR UPDATE
        `;
        if (lockedRows.length === 0) {
          throw new Error(`FeeVoucher ${targetVoucherId} not found for tenant ${tenantId}`);
        }
        const lockedVoucher = lockedRows[0];
        const totalDue = new Prisma.Decimal(lockedVoucher.totalDue);
        const amountPaid = new Prisma.Decimal(lockedVoucher.amountPaid);

        const appliedToInvoice = Prisma.Decimal.min(paymentDecimal, Prisma.Decimal.max(new Prisma.Decimal(0), totalDue.minus(amountPaid)));
        const excessToWallet = paymentDecimal.minus(appliedToInvoice);
        const newAmountPaid = amountPaid.add(appliedToInvoice);
        const newBalance = Prisma.Decimal.max(new Prisma.Decimal(0), totalDue.minus(newAmountPaid));
        const newStatus = newBalance.isZero() ? "PAID" : "PARTIAL";

        const receiptNumber = data.receiptNumber || await getNextVoucherNumber(tx as any, tenantId, "RECEIPT");
        const transactionId = await getNextVoucherNumber(tx as any, tenantId, "RECEIPT");
        // Use tx-sequential IDs: transactionId is RECEIPT sequence, receiptNumber is same or provided
        const txnId = `TXN-${transactionId}`;
        const rcpt = receiptNumber.startsWith("REC-") ? receiptNumber : `REC-${receiptNumber}`;

        const transaction = await tx.transaction.create({
          data: {
            tenantId,
            transactionId: txnId,
            feeVoucherId: targetVoucherId,
            amountPaid: Number(paymentDecimal.toFixed(2)),
            appliedToInvoice: Number(appliedToInvoice.toFixed(2)),
            excessToWallet: Number(excessToWallet.toFixed(2)),
            paymentMethod: data.paymentMethod || "CASH",
            receiptNumber: rcpt,
            collectedById: user.id,
            note: data.note || `Annual Fee Payment (${data.paymentMethod || "CASH"}) - Total Paid: ${newAmountPaid.toFixed(2)}/${totalDue.toFixed(2)}`,
          },
          include: {
            feeVoucher: {
              select: {
                voucherId: true,
                feeType: true,
                studentProfile: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    studentId: true,
                    rollNumber: true,
                    class: { select: { name: true } },
                    section: { select: { name: true } },
                  },
                },
              },
            },
          },
        });
        const updatedVoucher = await tx.feeVoucher.update({
          where: { id: targetVoucherId },
          data: { amountPaid: { increment: Number(appliedToInvoice.toFixed(2)) }, balance: Number(newBalance.toFixed(2)), status: newStatus },
        });
        await postLegacyFeePaymentJournal(tx as any, {
          tenantId,
          studentProfileId: student.id,
          feeVoucherId: targetVoucherId,
          amount: paymentDecimal,
          appliedToInvoice,
          excessToWallet,
          paymentMethod: data.paymentMethod || "CASH",
          receiptNumber: rcpt,
          executedById: user.id,
          note: data.note,
        });
        return [transaction, updatedVoucher] as const;
      });

      return successResponse({ transaction, voucher: updatedVoucher }, "Fee payment collected successfully", 201);
    }

    // No voucher yet: Initialize 12-Month Annual Fee Voucher — Decimal, stacked concessions, tuition cap
    let monthlyBaseFee = paymentDecimal; // fallback
    if (student.classId) {
      const classStructure = await prisma.classFeeStructure.findFirst({
        where: { tenantId, classId: student.classId, academicYearId, isActive: true },
      });
      if (classStructure) {
        const total = new Prisma.Decimal((classStructure as any).totalMonthlyFee ?? (classStructure as any).tuitionFee ?? 0);
        if (!total.isZero()) monthlyBaseFee = total;
      }
    }

    // Stacked concessions — tuition-only
    const concessions = await prisma.studentFeeConcession.findMany({
      where: { tenantId, studentProfileId: student.id, isActive: true },
    });
    let monthlyDiscount = new Prisma.Decimal(0);
    if (concessions.length > 0) {
      // Need tuition component separately for cap
      let tuitionMonthly = monthlyBaseFee;
      if (student.classId) {
        const struct = await prisma.classFeeStructure.findFirst({ where: { tenantId, classId: student.classId, academicYearId, isActive: true } });
        if (struct) tuitionMonthly = new Prisma.Decimal((struct as any).tuitionFee ?? monthlyBaseFee);
      }
      monthlyDiscount = computeStackedConcession(tuitionMonthly, concessions.map(c=>({
        discountType: c.discountType,
        discountValue: new Prisma.Decimal(c.discountValue as any),
        appliesToHead: (c as any).appliesToHead || "TUITION",
        priority: (c as any).priority,
        validFrom: (c as any).validFrom,
        validUntil: (c as any).validUntil,
      })), monthlyBaseFee);
    }

    const annualBase = monthlyBaseFee.mul(12);
    const annualDiscount = monthlyDiscount.mul(12);
    const netAnnualDue = Prisma.Decimal.max(new Prisma.Decimal(0), annualBase.minus(annualDiscount));
    const totalDue = netAnnualDue;
    const balance = Prisma.Decimal.max(new Prisma.Decimal(0), totalDue.minus(paymentDecimal));
    const status = balance.isZero() ? "PAID" : "PARTIAL";

    const [newVoucher, transaction] = await prisma.$transaction(async (tx) => {
      const voucherId = await getNextVoucherNumber(tx as any, tenantId, "SALES_FEE");
      const receiptNumber = data.receiptNumber || await getNextVoucherNumber(tx as any, tenantId, "RECEIPT");
      const transactionId = `TXN-${await getNextVoucherNumber(tx as any, tenantId, "RECEIPT")}`;
      const rcpt = receiptNumber.startsWith("REC-") ? receiptNumber : `REC-${receiptNumber}`;

      const v = await tx.feeVoucher.create({
        data: {
          tenantId,
          voucherId,
          studentProfileId: student.id,
          academicYearId: academicYearId!,
          feeType: "Annual Tuition (12 Months)",
          baseAmount: Number(annualBase.toFixed(2)),
          discountAmount: Number(annualDiscount.toFixed(2)),
          arrears: 0,
          lateFine: 0,
          totalDue: Number(totalDue.toFixed(2)),
          amountPaid: Number(paymentDecimal.toFixed(2)),
          balance: Number(balance.toFixed(2)),
          dueDate: new Date(Date.now() + 30 * 86400000),
          status,
        },
      });

      await postLegacyFeeInvoiceAccrual(tx as any, {
        tenantId,
        studentProfileId: student.id,
        feeHeadCode: "TUITION",
        amount: annualBase,
        discountAmount: annualDiscount,
        executedById: user.id,
        reference: voucherId,
      });
      const appliedToInvoice = Prisma.Decimal.min(paymentDecimal, totalDue);
      const excessToWallet = paymentDecimal.minus(appliedToInvoice);
      const t = await tx.transaction.create({
        data: {
          tenantId,
          transactionId,
          feeVoucherId: v.id,
          amountPaid: Number(paymentDecimal.toFixed(2)),
          appliedToInvoice: Number(appliedToInvoice.toFixed(2)),
          excessToWallet: Number(excessToWallet.toFixed(2)),
          paymentMethod: data.paymentMethod || "CASH",
          receiptNumber: rcpt,
          collectedById: user.id,
          note: data.note || `Counter Collection (${data.paymentMethod || "CASH"}) - 12 Months Annual Ledger`,
        },
        include: {
          feeVoucher: {
            select: {
              voucherId: true,
              feeType: true,
              studentProfile: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  studentId: true,
                  rollNumber: true,
                  class: { select: { name: true } },
                  section: { select: { name: true } },
                },
              },
            },
          },
        },
      });

      await postLegacyFeePaymentJournal(tx as any, {
        tenantId,
        studentProfileId: student.id,
        feeVoucherId: v.id,
        amount: paymentDecimal,
        appliedToInvoice,
        excessToWallet,
        paymentMethod: data.paymentMethod || "CASH",
        receiptNumber: rcpt,
        executedById: user.id,
        note: data.note,
      });

      return [v, t];
    });

    return successResponse({ transaction, voucher: newVoucher }, "Fee payment collected successfully", 201);
  } catch (error) {
    return handleApiError(error);
  }
}
