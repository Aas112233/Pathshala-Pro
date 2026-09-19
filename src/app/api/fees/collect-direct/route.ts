import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  badRequest,
  handleApiError,
  safeParseBody,
  ApiError,
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

import { dedupeRequestAsync } from "@/lib/rate-limit";
import { getMonthName } from "@/lib/constants";
import { resolveRequestAcademicYearId } from "@/lib/academic-year-guards";

const directFeeCollectionSchema = z.object({
  studentProfileId: z.string().min(1, "Student ID is required"),
  amountPaid: z.number().positive("Payment amount must be greater than 0"),
  paymentMethod: paymentMethodSchema.default("CASH"),
  receiptNumber: z.string().optional(),
  note: z.string().optional(),
  academicYearId: z.string().optional(),
  feeVoucherId: z.string().optional(),
  feeVoucherIds: z.array(z.string()).optional(),
  billingMonth: z.number().int().min(1).max(12).optional(),
  billingMonths: z.array(z.number().int().min(1).max(12)).optional(),
  billingYear: z.number().int().min(2000).max(2100).optional(),
  allowAdvanceToWallet: z.boolean().optional().default(false),
});

export async function POST(request: NextRequest) {
  try {
    // Cash-box gate. The module tier cannot express it: PRINCIPAL legitimately
    // holds fees:{manage} (waiver approval), which would otherwise let the
    // academic head take payments. `fees:payment:collect` is the capability
    // the role matrix actually defines for that.
    const access = await requireApiAccess(request, { permission: "fees:payment:collect" });
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
      academicYearId = await resolveRequestAcademicYearId(request, tenantId);
    }
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

    const now = new Date();
    const targetYear = data.billingYear || now.getFullYear();
    const paymentDecimal = new Prisma.Decimal(data.amountPaid);

    // ──────────────── Multi-Month Collection Branch ────────────────
    if (data.billingMonths && data.billingMonths.length > 1) {
      const targetMonths = Array.from(new Set(data.billingMonths)).sort((a, b) => a - b);

      // 1. Check duplicate lock
      const dedupeKey = `COLLECT_DIRECT_${tenantId}_${student.id}_${targetYear}_${targetMonths.join("-")}_${data.amountPaid}`;
      if (!(await dedupeRequestAsync(dedupeKey, 3000))) {
        return badRequest("Duplicate payment request detected. Please wait a moment.");
      }

      // 2. Check for any already-paid vouchers for these months
      const existingPeriodVouchers = await prisma.feeVoucher.findMany({
        where: {
          tenantId,
          studentProfileId: student.id,
          academicYearId,
          billingYear: targetYear,
          billingMonth: { in: targetMonths },
        },
        select: { id: true, voucherId: true, status: true, balance: true, totalDue: true, billingMonth: true },
      });

      for (const ev of existingPeriodVouchers) {
        if (ev.status === "PAID" || ev.balance <= 0) {
          return badRequest(
            `Fee for ${getMonthName(ev.billingMonth!)} ${targetYear} has already been paid in full (${ev.voucherId}). Duplicate payment rejected.`
          );
        }
      }

      // 3. Compute base monthly fee & concessions
      let monthlyBaseFee = paymentDecimal;
      if (student.classId) {
        const classStructure = await prisma.classFeeStructure.findFirst({
          where: { tenantId, classId: student.classId, academicYearId, isActive: true },
        });
        if (classStructure) {
          const total = new Prisma.Decimal((classStructure as any).totalMonthlyFee ?? (classStructure as any).tuitionFee ?? 0);
          if (!total.isZero()) monthlyBaseFee = total;
        }
      }

      const concessions = await prisma.studentFeeConcession.findMany({
        where: { tenantId, studentProfileId: student.id, isActive: true },
      });
      let monthlyDiscount = new Prisma.Decimal(0);
      if (concessions.length > 0) {
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

      const netMonthlyDue = Prisma.Decimal.max(new Prisma.Decimal(0), monthlyBaseFee.minus(monthlyDiscount));

      // 4. Verify total due
      let totalDueAllMonths = new Prisma.Decimal(0);
      for (const m of targetMonths) {
        const existingV = existingPeriodVouchers.find((v) => v.billingMonth === m);
        if (existingV) {
          totalDueAllMonths = totalDueAllMonths.plus(new Prisma.Decimal(existingV.balance));
        } else {
          totalDueAllMonths = totalDueAllMonths.plus(netMonthlyDue);
        }
      }

      if (!data.allowAdvanceToWallet && paymentDecimal.greaterThan(totalDueAllMonths)) {
        return badRequest(
          `Payment amount (${paymentDecimal.toFixed(2)}) exceeds total fee due for selected months (${totalDueAllMonths.toFixed(2)}).`
        );
      }

      // 5. Atomic multi-month execution
      const [allTransactions, allVouchers] = await prisma.$transaction(async (tx) => {
        let remainingPayment = paymentDecimal;
        const createdTransactions: any[] = [];
        const processedVouchers: any[] = [];

        for (let i = 0; i < targetMonths.length; i++) {
          const m = targetMonths[i];
          const isLastMonth = i === targetMonths.length - 1;
          if (remainingPayment.isZero() && !isLastMonth) break;

          const existingV = existingPeriodVouchers.find((v) => v.billingMonth === m);
          let vId: string;
          let vDue: Prisma.Decimal;
          let applied: Prisma.Decimal;
          let excess: Prisma.Decimal = new Prisma.Decimal(0);

          if (existingV) {
            vId = existingV.id;
            vDue = new Prisma.Decimal(existingV.balance);
            applied = Prisma.Decimal.min(remainingPayment, vDue);
            if (isLastMonth && data.allowAdvanceToWallet && remainingPayment.greaterThan(vDue)) {
              excess = remainingPayment.minus(applied);
            }
            remainingPayment = remainingPayment.minus(applied).minus(excess);
            const newBal = vDue.minus(applied);
            const newStatus = newBal.isZero() ? "PAID" : "PARTIAL";

            const updatedV = await tx.feeVoucher.update({
              where: { id: vId },
              data: {
                amountPaid: { increment: Number(applied.toFixed(2)) },
                balance: Number(newBal.toFixed(2)),
                status: newStatus,
              },
            });
            processedVouchers.push(updatedV);
          } else {
            vDue = netMonthlyDue;
            applied = Prisma.Decimal.min(remainingPayment, vDue);
            if (isLastMonth && data.allowAdvanceToWallet && remainingPayment.greaterThan(vDue)) {
              excess = remainingPayment.minus(applied);
            }
            remainingPayment = remainingPayment.minus(applied).minus(excess);
            const newBal = vDue.minus(applied);
            const newStatus = newBal.isZero() ? "PAID" : "PARTIAL";
            const voucherId = await getNextVoucherNumber(tx as any, tenantId, "SALES_FEE", targetYear);

            const newV = await tx.feeVoucher.create({
              data: {
                tenantId,
                voucherId,
                studentProfileId: student.id,
                academicYearId: academicYearId!,
                feeType: "TUITION",
                billingMonth: m,
                billingYear: targetYear,
                baseAmount: Number(monthlyBaseFee.toFixed(2)),
                discountAmount: Number(monthlyDiscount.toFixed(2)),
                arrears: 0,
                lateFine: 0,
                totalDue: Number(vDue.toFixed(2)),
                amountPaid: Number(applied.toFixed(2)),
                balance: Number(newBal.toFixed(2)),
                dueDate: new Date(Date.now() + 30 * 86400000),
                status: newStatus,
              },
            });
            await postLegacyFeeInvoiceAccrual(tx as any, {
              tenantId,
              studentProfileId: student.id,
              feeHeadCode: "TUITION",
              amount: monthlyBaseFee,
              discountAmount: monthlyDiscount,
              executedById: user.id,
              reference: voucherId,
            });
            vId = newV.id;
            processedVouchers.push(newV);
          }

          const receiptNumber = await getNextVoucherNumber(tx as any, tenantId, "RECEIPT");
          const rcpt = receiptNumber.startsWith("REC-") ? receiptNumber : `REC-${receiptNumber}`;
          const transactionId = `TXN-${rcpt}`;
          const monthName = getMonthName(m);

          const t = await tx.transaction.create({
            data: {
              tenantId,
              transactionId,
              feeVoucherId: vId,
              amountPaid: Number(applied.plus(excess).toFixed(2)),
              appliedToInvoice: Number(applied.toFixed(2)),
              excessToWallet: Number(excess.toFixed(2)),
              paymentMethod: data.paymentMethod || "CASH",
              receiptNumber: rcpt,
              collectedById: user.id,
              note: data.note || `Monthly Fee Payment for ${monthName} ${targetYear} (${data.paymentMethod || "CASH"})`,
            },
            include: {
              feeVoucher: {
                select: {
                  voucherId: true,
                  feeType: true,
                  billingMonth: true,
                  billingYear: true,
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
            feeVoucherId: vId,
            amount: applied.plus(excess),
            appliedToInvoice: applied,
            excessToWallet: excess,
            paymentMethod: data.paymentMethod || "CASH",
            receiptNumber: rcpt,
            executedById: user.id,
            note: data.note,
          });

          createdTransactions.push(t);
        }

        return [createdTransactions, processedVouchers];
      }, { timeout: 30_000, maxWait: 10_000 });

      return successResponse({
        transaction: allTransactions[0],
        transactions: allTransactions,
        voucher: allVouchers[0],
        vouchers: allVouchers,
      }, "Multi-month fee payment collected successfully", 201);
    }

    const targetMonth = (data.billingMonths && data.billingMonths.length === 1 ? data.billingMonths[0] : data.billingMonth) || now.getMonth() + 1;

    // 1. Server-side duplicate prevention (3-second re-entry guard, distributed)
    const dedupeKey = `COLLECT_DIRECT_${tenantId}_${student.id}_${data.feeVoucherId || `${targetYear}_${targetMonth}`}_${data.amountPaid}`;
    if (!(await dedupeRequestAsync(dedupeKey, 3000))) {
      return badRequest("Duplicate payment request detected. Please wait a moment.");
    }

    // Resolve target voucher if specified or if an existing voucher exists for the period
    let targetVoucherId = data.feeVoucherId;

    if (targetVoucherId) {
      const explicitVoucher = await prisma.feeVoucher.findUnique({
        where: { id: targetVoucherId, tenantId },
        select: { id: true, voucherId: true, status: true, balance: true, totalDue: true, feeType: true, billingMonth: true, billingYear: true },
      });
      if (!explicitVoucher) {
        return badRequest("Selected fee voucher not found.");
      }
      if (explicitVoucher.status === "PAID" || explicitVoucher.balance <= 0) {
        return badRequest(`Fee voucher ${explicitVoucher.voucherId} is already paid in full. Duplicate payment rejected.`);
      }
      if (["CANCELLED", "VOID"].includes(explicitVoucher.status)) {
        return badRequest(`Cannot make payment for ${explicitVoucher.status} voucher.`);
      }
      if (!data.allowAdvanceToWallet && paymentDecimal.greaterThan(new Prisma.Decimal(explicitVoucher.balance))) {
        return badRequest(
          `Payment amount (${data.amountPaid}) exceeds voucher balance due (${explicitVoucher.balance}).`
        );
      }
    } else {
      // Check if a discrete monthly voucher already exists for this student for the target period
      const existingPeriodVoucher = await prisma.feeVoucher.findFirst({
        where: {
          tenantId,
          studentProfileId: student.id,
          academicYearId,
          billingYear: targetYear,
          billingMonth: targetMonth,
        },
        select: { id: true, voucherId: true, status: true, balance: true, totalDue: true },
      });

      if (existingPeriodVoucher) {
        if (existingPeriodVoucher.status === "PAID" || existingPeriodVoucher.balance <= 0) {
          return badRequest(
            `Fee for ${getMonthName(targetMonth)} ${targetYear} has already been paid in full (${existingPeriodVoucher.voucherId}). Duplicate payment rejected.`
          );
        }
        if (!data.allowAdvanceToWallet && paymentDecimal.greaterThan(new Prisma.Decimal(existingPeriodVoucher.balance))) {
          return badRequest(
            `Payment amount (${data.amountPaid}) exceeds voucher balance due (${existingPeriodVoucher.balance}).`
          );
        }
        targetVoucherId = existingPeriodVoucher.id;
      } else {
        // Fallback check for open unpaid legacy vouchers if no month was explicitly supplied
        if (!data.billingMonth) {
          const openVoucher = await prisma.feeVoucher.findFirst({
            where: {
              tenantId,
              studentProfileId: student.id,
              academicYearId,
              status: { notIn: ["PAID", "CANCELLED", "VOID"] },
              balance: { gt: 0 },
            },
            orderBy: { createdAt: "desc" },
            select: { id: true, voucherId: true, balance: true },
          });
          if (openVoucher) {
            targetVoucherId = openVoucher.id;
          }
        }
      }
    }

    // Process payment on existing target voucher
    if (targetVoucherId) {
      const [transaction, updatedVoucher] = await prisma.$transaction(async (tx) => {
        // Lock the voucher row inside the transaction so its totalDue/amountPaid
        // are read fresh (not the stale pre-transaction snapshot), preventing a
        // lost update when two payments race against the same voucher.
        const lockedRows = await tx.$queryRaw<Array<{ id: string; totalDue: number; amountPaid: number; voucherId: string; feeType: string; billingMonth: number | null; billingYear: number | null }>>`
          SELECT id, "totalDue", "amountPaid", "voucherId", "feeType", "billingMonth", "billingYear"
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
        const remainingDue = Prisma.Decimal.max(new Prisma.Decimal(0), totalDue.minus(amountPaid));

        if (remainingDue.isZero()) {
          throw new Error(`Fee voucher ${lockedVoucher.voucherId} is already paid in full. Duplicate payment rejected.`);
        }

        if (!data.allowAdvanceToWallet && paymentDecimal.greaterThan(remainingDue)) {
          throw new Error(`Payment amount (${paymentDecimal.toFixed(2)}) exceeds remaining balance due (${remainingDue.toFixed(2)}).`);
        }

        const appliedToInvoice = Prisma.Decimal.min(paymentDecimal, remainingDue);
        const excessToWallet = paymentDecimal.minus(appliedToInvoice);
        const newAmountPaid = amountPaid.add(appliedToInvoice);
        const newBalance = Prisma.Decimal.max(new Prisma.Decimal(0), totalDue.minus(newAmountPaid));
        const newStatus = newBalance.isZero() ? "PAID" : "PARTIAL";

        const receiptNumber = data.receiptNumber || await getNextVoucherNumber(tx as any, tenantId, "RECEIPT");
        const rcpt = receiptNumber.startsWith("REC-") ? receiptNumber : `REC-${receiptNumber}`;
        const txnId = `TXN-${rcpt}`;

        const periodDesc = lockedVoucher.billingMonth ? ` for ${getMonthName(lockedVoucher.billingMonth)} ${lockedVoucher.billingYear || targetYear}` : "";
        const defaultNote = `Fee Payment${periodDesc} (${data.paymentMethod || "CASH"}) - Total Paid: ${newAmountPaid.toFixed(2)}/${totalDue.toFixed(2)}`;

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
            note: data.note || defaultNote,
          },
          include: {
            feeVoucher: {
              select: {
                voucherId: true,
                feeType: true,
                billingMonth: true,
                billingYear: true,
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
      }, { timeout: 30_000, maxWait: 10_000 });

      return successResponse({ transaction, voucher: updatedVoucher }, "Fee payment collected successfully", 201);
    }

    // No existing voucher: Create discrete monthly voucher for the target month/year
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

    const netMonthlyDue = Prisma.Decimal.max(new Prisma.Decimal(0), monthlyBaseFee.minus(monthlyDiscount));
    const totalDue = netMonthlyDue;
    const appliedToInvoice = Prisma.Decimal.min(paymentDecimal, totalDue);
    const excessToWallet = paymentDecimal.minus(appliedToInvoice);

    if (!data.allowAdvanceToWallet && excessToWallet.greaterThan(0)) {
      return badRequest(
        `Payment amount (${paymentDecimal.toFixed(2)}) exceeds monthly fee due (${totalDue.toFixed(2)}).`
      );
    }

    const balance = Prisma.Decimal.max(new Prisma.Decimal(0), totalDue.minus(appliedToInvoice));
    const status = balance.isZero() ? "PAID" : "PARTIAL";

    const [newVoucher, transaction] = await prisma.$transaction(async (tx) => {
      const voucherId = await getNextVoucherNumber(tx as any, tenantId, "SALES_FEE", targetYear);
      const receiptNumber = data.receiptNumber || await getNextVoucherNumber(tx as any, tenantId, "RECEIPT");
      const rcpt = receiptNumber.startsWith("REC-") ? receiptNumber : `REC-${receiptNumber}`;
      const transactionId = `TXN-${rcpt}`;

      const v = await tx.feeVoucher.create({
        data: {
          tenantId,
          voucherId,
          studentProfileId: student.id,
          academicYearId: academicYearId!,
          feeType: "TUITION",
          billingMonth: targetMonth,
          billingYear: targetYear,
          baseAmount: Number(monthlyBaseFee.toFixed(2)),
          discountAmount: Number(monthlyDiscount.toFixed(2)),
          arrears: 0,
          lateFine: 0,
          totalDue: Number(totalDue.toFixed(2)),
          amountPaid: Number(appliedToInvoice.toFixed(2)),
          balance: Number(balance.toFixed(2)),
          dueDate: new Date(Date.now() + 30 * 86400000),
          status,
        },
      });

      await postLegacyFeeInvoiceAccrual(tx as any, {
        tenantId,
        studentProfileId: student.id,
        feeHeadCode: "TUITION",
        amount: monthlyBaseFee,
        discountAmount: monthlyDiscount,
        executedById: user.id,
        reference: voucherId,
      });

      const monthName = getMonthName(targetMonth);
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
          note: data.note || `Monthly Fee Payment for ${monthName} ${targetYear} (${data.paymentMethod || "CASH"})`,
        },
        include: {
          feeVoucher: {
            select: {
              voucherId: true,
              feeType: true,
              billingMonth: true,
              billingYear: true,
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
    }, { timeout: 30_000, maxWait: 10_000 });

    return successResponse({ transaction, voucher: newVoucher }, "Fee payment collected successfully", 201);
  } catch (error) {
    // Never mask a recoverable business-rule failure (e.g. a missing
    // chart-of-accounts code or unbalanced journal amounts) behind a generic
    // 500. The fee-service raises plain Errors for domain failures; surface
    // the real message so the cashier can act. ApiError instances and
    // Prisma-known errors keep their existing handling.
    if (error instanceof ApiError) {
      return NextResponse.json(error.toJSON(), { status: error.statusCode });
    }
    if (typeof error === "object" && error !== null && "code" in error) {
      return handleApiError(error);
    }
    return badRequest(error instanceof Error ? error.message : "Unable to record fee payment.");
  }
}
