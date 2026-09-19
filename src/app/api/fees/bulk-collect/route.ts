import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, badRequest, handleApiError, safeParseBody, ApiError } from "@/lib/api-response";
import { requireApiAccess } from "@/lib/api-auth";
import { smartRateLimitAsync, dedupeRequestAsync } from "@/lib/rate-limit";
import { z } from "zod";
import { paymentMethodSchema } from "@/lib/schemas";
import { postLegacyFeeInvoiceAccrual, postLegacyFeePaymentJournal, computeStackedConcession } from "@/lib/fee-service";
import { getNextVoucherNumber } from "@/lib/accounting-sequence";
import { Prisma } from "@prisma/client";

import { getMonthName } from "@/lib/constants";

const bulkFeePaymentSchema = z.object({
  academicYearId: z.string().min(1, "Academic Year is required"),
  classId: z.string().min(1, "Class is required"),
  sectionId: z.string().optional(),
  paymentMethod: paymentMethodSchema.default("CASH"),
  feeType: z.string().default("TUITION"),
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
    const access = await requireApiAccess(request, { permission: "fees:payment:collect" });
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
      select: { id: true, firstName: true, lastName: true, studentId: true },
    });
    const uniqueStudentIds = new Set(data.payments.map((p) => p.studentProfileId));
    if (uniqueStudentIds.size !== data.payments.length || studentsInScope.length !== uniqueStudentIds.size) {
      return badRequest("Each student may appear only once and every payment must target the selected class and section");
    }
    const studentMap = new Map(studentsInScope.map((s) => [s.id, s]));
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

    const currentYear = data.year || new Date().getFullYear();
    const targetMonth = data.month || new Date().getMonth() + 1;
    const monthName = getMonthName(targetMonth);

    // Fetch existing period vouchers and explicit vouchers
    const explicitVoucherIds = data.payments.map((p) => p.feeVoucherId).filter(Boolean) as string[];
    const existingVouchers = await prisma.feeVoucher.findMany({
      where: {
        tenantId,
        studentProfileId: { in: studentIds },
        academicYearId: data.academicYearId,
        OR: [
          { billingMonth: targetMonth, billingYear: currentYear },
          ...(explicitVoucherIds.length > 0 ? [{ id: { in: explicitVoucherIds } }] : []),
          { billingMonth: null, feeType: { contains: "Annual" } },
        ],
      },
      select: {
        id: true,
        voucherId: true,
        studentProfileId: true,
        billingMonth: true,
        billingYear: true,
        status: true,
        balance: true,
        totalDue: true,
        amountPaid: true,
        feeType: true,
      },
    });

    const voucherByStudentAndMonth = new Map(
      existingVouchers
        .filter((v) => v.billingMonth === targetMonth && v.billingYear === currentYear)
        .map((v) => [v.studentProfileId, v])
    );
    const voucherById = new Map(existingVouchers.map((v) => [v.id, v]));
    const legacyVoucherByStudent = new Map(
      existingVouchers
        .filter((v) => v.billingMonth === null && v.feeType?.includes("Annual"))
        .map((v) => [v.studentProfileId, v])
    );

    // Sizing validation: A new monthly voucher must be sized from class structure
    if (standardMonthlyFee.lessThanOrEqualTo(0)) {
      const studentsNeedingNewVoucher = data.payments.filter(
        (p) => !(p.feeVoucherId || voucherByStudentAndMonth.has(p.studentProfileId) || legacyVoucherByStudent.has(p.studentProfileId))
      );
      if (studentsNeedingNewVoucher.length > 0) {
        return badRequest(
          `No active fee structure is configured for ${classRecord.name} in academic year "${academicYear.label}". Set the monthly fee under Fees > Fee Structures, then collect again (${studentsNeedingNewVoucher.length} of ${data.payments.length} selected student(s) need a new fee voucher).`
        );
      }
    }

    let totalCollected = new Prisma.Decimal(0);
    const results: any[] = [];
    const transactionTimeoutMs = Math.min(60_000, Math.max(30_000, data.payments.length * 3_000));

    await prisma.$transaction(async (tx) => {
      for (const item of data.payments) {
        const payDec = new Prisma.Decimal(item.amountPaid);
        totalCollected = totalCollected.add(payDec);

        const studentRec = studentMap.get(item.studentProfileId);
        const studentName = studentRec ? `${studentRec.firstName} ${studentRec.lastName}`.trim() : item.studentProfileId;

        // 1. Check if an explicit voucher was passed
        let existingV: any = item.feeVoucherId ? voucherById.get(item.feeVoucherId) : voucherByStudentAndMonth.get(item.studentProfileId);

        if (existingV) {
          if (existingV.status === "PAID" || existingV.balance <= 0) {
            throw ApiError.badRequest(
              `${studentName} has already paid fees for ${monthName} ${currentYear} (${existingV.voucherId}). Duplicate payment rejected.`
            );
          }
        } else {
          // Check for legacy annual voucher
          const legacyV = legacyVoucherByStudent.get(item.studentProfileId);
          if (legacyV) {
            if (legacyV.status === "PAID" || legacyV.balance <= 0) {
              throw ApiError.badRequest(
                `${studentName} has already cleared the full annual fees for this academic year (${legacyV.voucherId}). Duplicate payment rejected.`
              );
            }
            existingV = legacyV;
          }
        }

        // Lock existing voucher inside transaction if paying down an existing one
        if (existingV) {
          const lockedRows = await tx.$queryRaw<Array<{ id: string; totalDue: number; amountPaid: number; voucherId: string }>>`
            SELECT id, "totalDue", "amountPaid", "voucherId"
            FROM "FeeVoucher"
            WHERE id = ${existingV.id} AND "tenantId" = ${tenantId}
            FOR UPDATE
          `;
          if (lockedRows.length === 0) {
            throw new Error(`FeeVoucher ${existingV.id} not found for tenant ${tenantId}`);
          }
          const lockedV = lockedRows[0];
          const totalDue = new Prisma.Decimal(lockedV.totalDue);
          const amountPaidPrev = new Prisma.Decimal(lockedV.amountPaid);
          const remainingDue = Prisma.Decimal.max(new Prisma.Decimal(0), totalDue.minus(amountPaidPrev));

          if (remainingDue.isZero()) {
            throw ApiError.badRequest(
              `${studentName} has already paid fees for this voucher (${lockedV.voucherId}). Duplicate payment rejected.`
            );
          }

          const appliedToInvoice = Prisma.Decimal.min(payDec, remainingDue);
          const excessToWallet = payDec.minus(appliedToInvoice);
          const newAmountPaid = amountPaidPrev.add(appliedToInvoice);
          const newBalance = Prisma.Decimal.max(new Prisma.Decimal(0), totalDue.minus(newAmountPaid));
          const newStatus = newBalance.isZero() ? "PAID" : "PARTIAL";

          await tx.feeVoucher.update({
            where: { id: existingV.id },
            data: {
              amountPaid: { increment: Number(appliedToInvoice.toFixed(2)) },
              balance: Number(newBalance.toFixed(2)),
              status: newStatus,
            },
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
            appliedToInvoice,
            excessToWallet,
            paymentMethod: data.paymentMethod || "CASH",
            receiptNumber,
            executedById: user.id,
            note: item.note,
          });

          results.push({ studentProfileId: item.studentProfileId, transactionId: t.id, voucherId: existingV.id });
          continue;
        }

        // Initialize discrete monthly voucher for the target month
        const monthlyBase = standardMonthlyFee;
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

        const netMonthlyDue = Prisma.Decimal.max(new Prisma.Decimal(0), monthlyBase.minus(monthlyDiscount));
        const totalDue = netMonthlyDue;
        const appliedToInvoice = Prisma.Decimal.min(payDec, totalDue);
        const excessToWallet = payDec.minus(appliedToInvoice);
        const balance = Prisma.Decimal.max(new Prisma.Decimal(0), totalDue.minus(appliedToInvoice));
        const status = balance.isZero() ? "PAID" : "PARTIAL";
        const voucherId = await getNextVoucherNumber(tx as any, tenantId, "SALES_FEE", currentYear);

        const v = await tx.feeVoucher.create({
          data: {
            tenantId,
            voucherId,
            studentProfileId: item.studentProfileId,
            academicYearId: data.academicYearId,
            feeType: "TUITION",
            billingMonth: targetMonth,
            billingYear: currentYear,
            baseAmount: Number(monthlyBase.toFixed(2)),
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
          studentProfileId: item.studentProfileId,
          feeHeadCode: "TUITION",
          amount: monthlyBase,
          discountAmount: monthlyDiscount,
          executedById: user.id,
          reference: voucherId,
        });

        const receiptNumber = await getNextVoucherNumber(tx as any, tenantId, "RECEIPT");
        const transactionId = `TXN-${receiptNumber}`;

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
            note: item.note || `Bulk Class Collection for ${monthName} ${currentYear} (${data.paymentMethod || "CASH"})`,
          },
        });

        results.push({ studentProfileId: item.studentProfileId, transactionId: t.id, voucherId: v.id });
      }
    }, { timeout: transactionTimeoutMs, maxWait: 10_000 });

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
    if (error instanceof ApiError) {
      return NextResponse.json(error.toJSON(), { status: error.statusCode });
    }
    if (typeof error === "object" && error !== null && "code" in error) {
      return handleApiError(error);
    }
    return badRequest(error instanceof Error ? error.message : "Unable to record bulk fee payments.");
  }
}
