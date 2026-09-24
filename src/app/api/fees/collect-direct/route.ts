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
import {
  getMethodPostingRules,
  validateCollectionMethod,
  WALLET_CREDIT_METHOD,
} from "@/lib/payment-method-routing";
import {
  postLegacyFeeInvoiceAccrual,
  postCollectionJournal,
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
  paymentMethod: z.string().trim().min(1).max(30).default("CASH"),
  receiptNumber: z.string().optional(),
  note: z.string().optional(),
  chequeNumber: z.string().max(50).optional(),
  reference: z.string().max(100).optional(),
  academicYearId: z.string().optional(),
  feeVoucherId: z.string().optional(),
  feeVoucherIds: z.array(z.string()).optional(),
  billingMonth: z.number().int().min(1).max(12).optional(),
  billingMonths: z.array(z.number().int().min(1).max(12)).optional(),
  billingYear: z.number().int().min(2000).max(2100).optional(),
  allowAdvanceToWallet: z.boolean().optional().default(false),
  walletAmount: z.number().min(0, "Wallet amount cannot be negative").optional().default(0),
  autoApplyWallet: z.boolean().optional().default(false),
}).superRefine((data, ctx) => {
  // Cheque/reference traceability is enforced server-side against the
  // tenant's method config (type-aware); only wallet-shape rules live here.
  if (data.walletAmount > 0 && data.paymentMethod === WALLET_CREDIT_METHOD) {
    ctx.addIssue({ code: "custom", message: "walletAmount is only for split payments; use WALLET_CREDIT alone for full-wallet payment.", path: ["walletAmount"] });
  }
  if (data.walletAmount > 0 && data.paymentMethod === "CHEQUE") {
    ctx.addIssue({ code: "custom", message: "Split wallet payment is not supported with CHEQUE.", path: ["walletAmount"] });
  }
  if (data.walletAmount >= data.amountPaid && data.amountPaid > 0) {
    ctx.addIssue({ code: "custom", message: "Split wallet amount must be less than the total payment (otherwise use WALLET_CREDIT).", path: ["walletAmount"] });
  }
});

export async function POST(request: NextRequest) {
  try {
    // Cash-box gate on the POS desk tier, not the parent `fees` module:
    // PRINCIPAL legitimately holds fees:{manage} (waiver approval), which
    // would otherwise let the academic head take payments. The desk tier is
    // also the only form that carries per-user grants — `fees:payment:collect`
    // is a role-only list, so it can neither hand a desk to a CLERK nor take
    // one away from an ACCOUNTANT.
    const access = await requireApiAccess(request, { module: "fee-pos", action: "write" });
    if ("response" in access) return access.response;

    const { user, tenantId } = access.authContext;

    const bodyResult = await safeParseBody(request, directFeeCollectionSchema);
    if (!bodyResult.success) return bodyResult.errorResponse;
    const data = bodyResult.data;

    // Tenant-aware method gate: custom codes and the active toggle live in
    // featureFlags.paymentMethods, which the transport schema cannot enumerate.
    const tenantRow = await prisma.tenant.findUnique({
      where: { tenantId },
      select: { featureFlags: true },
    });
    const tenantMethods = (tenantRow?.featureFlags as any)?.paymentMethods;
    // Schema default fills "CASH" at runtime; the ?? only satisfies the type.
    const paymentMethod = data.paymentMethod ?? "CASH";
    const methodCheck = validateCollectionMethod(tenantMethods, paymentMethod);
    if (methodCheck.error === "unknown") {
      return badRequest(
        `Unknown payment method "${paymentMethod}" for this tenant.`
      );
    }
    if (methodCheck.error === "inactive") {
      return badRequest(`Payment method "${paymentMethod}" is disabled for this tenant.`);
    }
    const postingRules = getMethodPostingRules(methodCheck.method, paymentMethod);
    if (postingRules.isCheque && !data.chequeNumber) {
      return badRequest("Cheque number is required for CHEQUE payments.");
    }
    if (postingRules.requiresReference && !data.reference) {
      return badRequest(
        `External reference (UTR/transaction id) is required for ${paymentMethod} payments.`
      );
    }

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

    // Split tender (cash + wallet) lives on the single-collection path only.
    if (data.billingMonths && data.billingMonths.length > 1 && ((data.walletAmount ?? 0) > 0 || data.autoApplyWallet)) {
      return badRequest("Split wallet payment is only supported for single collection. Pay each month separately or use WALLET_CREDIT.");
    }

    // Auto-apply: cover as much of this payment from the wallet as possible.
    let walletBudget = new Prisma.Decimal(data.walletAmount || 0);
    if (data.autoApplyWallet && walletBudget.isZero() && data.paymentMethod !== "WALLET_CREDIT") {
      const lastLedger = await prisma.studentWalletLedger.findFirst({
        where: { tenantId, studentProfileId: student.id },
        orderBy: { createdAt: "desc" },
        select: { balanceAfter: true },
      });
      const walletBal = new Prisma.Decimal((lastLedger as any)?.balanceAfter ?? 0);
      if (walletBal.greaterThan(0)) {
        walletBudget = Prisma.Decimal.min(walletBal, paymentDecimal);
        if (walletBudget.greaterThanOrEqualTo(paymentDecimal)) {
          return badRequest("Wallet covers this payment in full — use payment method WALLET_CREDIT instead of auto-apply.");
        }
      }
    }

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
        if (ev.status === "PAID" || new Prisma.Decimal(ev.balance).lessThanOrEqualTo(0)) {
          return badRequest(
            `Fee for ${getMonthName(ev.billingMonth!)} ${targetYear} has already been paid in full (${ev.voucherId}). Duplicate payment rejected.`
          );
        }
      }

      // 3. Compute base monthly fee & concessions
      const unbilledMonths = targetMonths.filter(
        (m) => !existingPeriodVouchers.some((ev) => ev.billingMonth === m)
      );

      let classStructure = null;
      if (student.classId) {
        classStructure = await prisma.classFeeStructure.findFirst({
          where: { tenantId, classId: student.classId, academicYearId, isActive: true },
        });
      }

      if (unbilledMonths.length > 0) {
        if (!classStructure) {
          return badRequest(
            "No active fee structure is configured for this class in the selected academic year. Configure the fee structure under Fees > Fee Structures before collecting fees for unbilled months."
          );
        }
        const structTotal = new Prisma.Decimal((classStructure as any).totalMonthlyFee ?? (classStructure as any).tuitionFee ?? 0);
        if (structTotal.isZero()) {
          return badRequest(
            "The active fee structure for this class has a 0 monthly fee. Configure fee heads under Fees > Fee Structures before collecting fees for unbilled months."
          );
        }
      }

      let monthlyBaseFee = classStructure
        ? new Prisma.Decimal((classStructure as any).totalMonthlyFee ?? (classStructure as any).tuitionFee ?? 0)
        : paymentDecimal;

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
                amountPaid: { increment: applied.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP) },
                balance: newBal.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
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
                baseAmount: monthlyBaseFee.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
                discountAmount: monthlyDiscount.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
                arrears: 0,
                lateFine: 0,
                totalDue: vDue.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
                amountPaid: applied.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
                balance: newBal.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
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
              amountPaid: applied.plus(excess).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
              appliedToInvoice: applied.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
              excessToWallet: excess.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
              paymentMethod: data.paymentMethod || "CASH",
              receiptNumber: rcpt,
              collectedById: user.id,
              chequeNumber: data.chequeNumber || undefined,
              chequeStatus: data.paymentMethod === "CHEQUE" ? "PENDING" : undefined,
              reference: data.reference || undefined,
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

          await postCollectionJournal(tx as any, {
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
            transactionId: t.id,
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
      if (explicitVoucher.status === "PAID" || new Prisma.Decimal(explicitVoucher.balance).lessThanOrEqualTo(0)) {
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
        if (existingPeriodVoucher.status === "PAID" || new Prisma.Decimal(existingPeriodVoucher.balance).lessThanOrEqualTo(0)) {
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

    // Process payment on existing target voucher(s) — FIFO across open dues
    if (targetVoucherId) {
      const [transactions, updatedVouchers] = await prisma.$transaction(async (tx) => {
        // FIFO settlement: an explicit voucher selection pays that voucher
        // only; otherwise the payment cascades across all open dues
        // oldest-first, so arrears never linger while current months close.
        let voucherIds: string[];
        if (data.feeVoucherId) {
          voucherIds = [targetVoucherId];
        } else {
          const openAll = await tx.feeVoucher.findMany({
            where: {
              tenantId,
              studentProfileId: student.id,
              academicYearId,
              status: { notIn: ["PAID", "CANCELLED", "VOID"] },
              balance: { gt: new Prisma.Decimal(0) },
            },
            orderBy: { dueDate: "asc" },
            select: { id: true },
          });
          voucherIds = openAll.map((v) => v.id);
          if (!voucherIds.includes(targetVoucherId)) voucherIds.unshift(targetVoucherId);
          if (voucherIds.length === 0) voucherIds = [targetVoucherId];
        }

        let remainingPayment = paymentDecimal;
        let walletRemaining = walletBudget;
        const createdTransactions: any[] = [];
        const processedVouchers: any[] = [];
        const txnInclude = {
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
        };

        for (let i = 0; i < voucherIds.length; i++) {
          const vId = voucherIds[i];
          const isLast = i === voucherIds.length - 1;
          if (remainingPayment.isZero() && !isLast) continue;
          if (remainingPayment.isZero()) break;
          // Lock the voucher row inside the transaction so its totalDue/amountPaid
          // are read fresh (not the stale pre-transaction snapshot), preventing a
          // lost update when two payments race against the same voucher.
          const lockedRows = await tx.$queryRaw<Array<{ id: string; totalDue: Prisma.Decimal; amountPaid: Prisma.Decimal; voucherId: string; feeType: string; billingMonth: number | null; billingYear: number | null }>>`
            SELECT id, "totalDue", "amountPaid", "voucherId", "feeType", "billingMonth", "billingYear"
            FROM "FeeVoucher"
            WHERE id = ${vId} AND "tenantId" = ${tenantId}
            FOR UPDATE
          `;
          if (lockedRows.length === 0) {
            throw new Error(`FeeVoucher ${vId} not found for tenant ${tenantId}`);
          }
          const lockedVoucher = lockedRows[0];
          const totalDue = new Prisma.Decimal(lockedVoucher.totalDue);
          const amountPaid = new Prisma.Decimal(lockedVoucher.amountPaid);
          const remainingDue = Prisma.Decimal.max(new Prisma.Decimal(0), totalDue.minus(amountPaid));

          if (remainingDue.isZero()) {
            if (voucherIds.length === 1) {
              throw new Error(`Fee voucher ${lockedVoucher.voucherId} is already paid in full. Duplicate payment rejected.`);
            }
            continue;
          }

          const appliedToInvoice = Prisma.Decimal.min(remainingPayment, remainingDue);
          let excessToWallet = new Prisma.Decimal(0);
          if (isLast) {
            excessToWallet = remainingPayment.minus(appliedToInvoice);
            if (!data.allowAdvanceToWallet && excessToWallet.greaterThan(0)) {
              throw new Error(`Payment amount (${paymentDecimal.toFixed(2)}) exceeds total open dues (${paymentDecimal.minus(excessToWallet).toFixed(2)}).`);
            }
          }
          remainingPayment = remainingPayment.minus(appliedToInvoice).minus(excessToWallet);
          const newAmountPaid = amountPaid.add(appliedToInvoice);
          const newBalance = Prisma.Decimal.max(new Prisma.Decimal(0), totalDue.minus(newAmountPaid));
          const newStatus = newBalance.isZero() ? "PAID" : "PARTIAL";

          const receiptNumber = (i === 0 && data.receiptNumber) || await getNextVoucherNumber(tx as any, tenantId, "RECEIPT");
          const rcpt = receiptNumber.startsWith("REC-") ? receiptNumber : `REC-${receiptNumber}`;
          const txnId = `TXN-${rcpt}`;

          const periodDesc = lockedVoucher.billingMonth ? ` for ${getMonthName(lockedVoucher.billingMonth)} ${lockedVoucher.billingYear || targetYear}` : "";
          const defaultNote = `Fee Payment${periodDesc} (${data.paymentMethod || "CASH"}) - Total Paid: ${newAmountPaid.toFixed(2)}/${totalDue.toFixed(2)}`;

          // Split tender: wallet covers the oldest dues first, bank settles the rest.
          const walletLeg = Prisma.Decimal.min(walletRemaining, appliedToInvoice);
          walletRemaining = walletRemaining.minus(walletLeg);
          const bankApplied = appliedToInvoice.minus(walletLeg);
          const bankAmount = bankApplied.plus(excessToWallet);
          if (walletLeg.greaterThan(0)) {
            const wTxn = await tx.transaction.create({
              data: {
                tenantId,
                transactionId: `TXN-WLT-${rcpt}`,
                feeVoucherId: vId,
                amountPaid: walletLeg.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
                appliedToInvoice: walletLeg.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
                excessToWallet: new Prisma.Decimal(0),
                paymentMethod: "WALLET_CREDIT",
                receiptNumber: rcpt,
                collectedById: user.id,
                note: data.note || defaultNote,
              },
              include: txnInclude,
            });
            await postCollectionJournal(tx as any, {
              tenantId,
              studentProfileId: student.id,
              feeVoucherId: vId,
              amount: walletLeg,
              appliedToInvoice: walletLeg,
              excessToWallet: new Prisma.Decimal(0),
              paymentMethod: "WALLET_CREDIT",
              receiptNumber: rcpt,
              executedById: user.id,
              note: data.note,
              transactionId: wTxn.id,
            });
            createdTransactions.push(wTxn);
          }
          if (bankAmount.greaterThan(0)) {
            const transaction = await tx.transaction.create({
              data: {
                tenantId,
                transactionId: txnId,
                feeVoucherId: vId,
                amountPaid: bankAmount.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
                appliedToInvoice: bankApplied.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
                excessToWallet: excessToWallet.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
                paymentMethod: data.paymentMethod || "CASH",
                receiptNumber: rcpt,
                collectedById: user.id,
                chequeNumber: data.chequeNumber || undefined,
                chequeStatus: data.paymentMethod === "CHEQUE" ? "PENDING" : undefined,
                reference: data.reference || undefined,
                note: data.note || defaultNote,
              },
              include: txnInclude,
            });
            const updatedVoucher = await tx.feeVoucher.update({
              where: { id: vId },
              data: { amountPaid: { increment: appliedToInvoice.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP) }, balance: newBalance.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP), status: newStatus },
            });
            await postCollectionJournal(tx as any, {
              tenantId,
              studentProfileId: student.id,
              feeVoucherId: vId,
              amount: bankAmount,
              appliedToInvoice: bankApplied,
              excessToWallet,
              paymentMethod: data.paymentMethod || "CASH",
              receiptNumber: rcpt,
              executedById: user.id,
              note: data.note,
              transactionId: transaction.id,
            });
            createdTransactions.push(transaction);
            processedVouchers.push(updatedVoucher);
          } else {
            const updatedVoucher = await tx.feeVoucher.update({
              where: { id: vId },
              data: { amountPaid: { increment: appliedToInvoice.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP) }, balance: newBalance.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP), status: newStatus },
            });
            processedVouchers.push(updatedVoucher);
          }
        }
        if (createdTransactions.length === 0) {
          throw new Error("No open dues found to apply this payment to.");
        }
        return [createdTransactions, processedVouchers] as const;
      }, { timeout: 30_000, maxWait: 10_000 });

      return successResponse({ transaction: transactions[0], transactions, voucher: updatedVouchers[0], vouchers: updatedVouchers }, "Fee payment collected successfully", 201);
    }

    // No existing voucher: Create discrete monthly voucher for the target month/year
    if (!student.classId) {
      return badRequest("Student has no class assigned. Cannot determine fee structure.");
    }
    const classStructure = await prisma.classFeeStructure.findFirst({
      where: { tenantId, classId: student.classId, academicYearId, isActive: true },
    });
    if (!classStructure) {
      return badRequest(
        "No active fee structure is configured for this class in the selected academic year. Configure the fee structure under Fees > Fee Structures before collecting fees for unbilled months."
      );
    }
    const totalStructFee = new Prisma.Decimal((classStructure as any).totalMonthlyFee ?? (classStructure as any).tuitionFee ?? 0);
    if (totalStructFee.isZero()) {
      return badRequest(
        "The active fee structure for this class has a 0 monthly fee. Configure fee heads under Fees > Fee Structures."
      );
    }
    const monthlyBaseFee = totalStructFee;

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

    const [newVoucher, transaction, legTransactions] = await prisma.$transaction(async (tx) => {
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
          baseAmount: monthlyBaseFee.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
          discountAmount: monthlyDiscount.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
          arrears: 0,
          lateFine: 0,
          totalDue: totalDue.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
          amountPaid: appliedToInvoice.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
          balance: balance.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
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
      const walletLeg = Prisma.Decimal.min(walletBudget, appliedToInvoice);
      const bankApplied = appliedToInvoice.minus(walletLeg);
      const bankAmount = bankApplied.plus(excessToWallet);
      const legTransactions: any[] = [];
      if (walletLeg.greaterThan(0)) {
        const wTxn = await tx.transaction.create({
          data: {
            tenantId,
            transactionId: `TXN-WLT-${rcpt}`,
            feeVoucherId: v.id,
            amountPaid: walletLeg.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
            appliedToInvoice: walletLeg.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
            excessToWallet: new Prisma.Decimal(0),
            paymentMethod: "WALLET_CREDIT",
            receiptNumber: rcpt,
            collectedById: user.id,
            note: data.note || `Monthly Fee Payment for ${monthName} ${targetYear} (WALLET_CREDIT)`,
          },
        });
        await postCollectionJournal(tx as any, {
          tenantId,
          studentProfileId: student.id,
          feeVoucherId: v.id,
          amount: walletLeg,
          appliedToInvoice: walletLeg,
          excessToWallet: new Prisma.Decimal(0),
          paymentMethod: "WALLET_CREDIT",
          receiptNumber: rcpt,
          executedById: user.id,
          note: data.note,
          transactionId: wTxn.id,
        });
        legTransactions.push(wTxn);
      }
      const t = await tx.transaction.create({
        data: {
          tenantId,
          transactionId,
          feeVoucherId: v.id,
          amountPaid: bankAmount.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
          appliedToInvoice: bankApplied.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
          excessToWallet: excessToWallet.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
          paymentMethod: data.paymentMethod || "CASH",
          receiptNumber: rcpt,
          collectedById: user.id,
          chequeNumber: data.chequeNumber || undefined,
          chequeStatus: data.paymentMethod === "CHEQUE" ? "PENDING" : undefined,
          reference: data.reference || undefined,
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

      await postCollectionJournal(tx as any, {
        tenantId,
        studentProfileId: student.id,
        feeVoucherId: v.id,
        amount: bankAmount,
        appliedToInvoice: bankApplied,
        excessToWallet,
        paymentMethod: data.paymentMethod || "CASH",
        receiptNumber: rcpt,
        executedById: user.id,
        note: data.note,
        transactionId: t.id,
      });
      legTransactions.push(t);

      return [v, t, legTransactions];
    }, { timeout: 30_000, maxWait: 10_000 });

    return successResponse({ transaction, transactions: legTransactions ?? [transaction], voucher: newVoucher }, "Fee payment collected successfully", 201);
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
