import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  badRequest,
  handleApiError,
  safeParseBody,
} from "@/lib/api-response";
import { batchFeeInvoicingSchema } from "@/lib/schemas";
import { requireApiAccess } from "@/lib/api-auth";
import { postLegacyFeeInvoiceAccrual } from "@/lib/fee-service";
import { assertAcademicYearOpen } from "@/lib/academic-year-guards";
import { getNextVoucherNumber } from "@/lib/accounting-sequence";
import { Prisma } from "@prisma/client";
import { computeStackedConcession, prorateMonthlyFee } from "@/lib/fee-service";

/**
 * POST /api/fees/batch
 * Generate batch fee invoices — Decimal-safe, tuition-capped, prorated, idempotent.
 */
export async function POST(request: NextRequest) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;

    const bodyResult = await safeParseBody(request, batchFeeInvoicingSchema);
    if (!bodyResult.success) return bodyResult.errorResponse;
    const data = bodyResult.data;
    const normalizedFeeType = (data.feeType || "TUITION").toUpperCase();
    const feeHeadCode = ["TUITION", "ADMISSION", "EXAM", "TRANSPORT", "HOSTEL", "LAB"]
      .find((code) => normalizedFeeType.includes(code)) || "TUITION";
    const academicYear = await prisma.academicYear.findUnique({
      where: { id: data.academicYearId, tenantId },
    });

    if (!academicYear) {
      return badRequest("Selected Academic Year was not found.");
    }

    await assertAcademicYearOpen(tenantId, academicYear.id);

    const studentWhere: any = {
      tenantId,
      status: "ACTIVE",
    };

    if (data.target === "CLASS" && data.classId) {
      studentWhere.classId = data.classId;
    } else if (data.target === "SECTION" && data.sectionId) {
      studentWhere.sectionId = data.sectionId;
    }

    const students = await prisma.studentProfile.findMany({
      where: studentWhere,
      select: {
        id: true,
        studentId: true,
        rollNumber: true,
        firstName: true,
        lastName: true,
        classId: true,
        sectionId: true,
        admissionDate: true,
      },
    });

    if (students.length === 0) {
      return badRequest("No active students found matching the selected target criteria.");
    }

    const feeStructures = await prisma.classFeeStructure.findMany({
      where: {
        tenantId,
        academicYearId: data.academicYearId,
        isActive: true,
      },
    });
    const structureMap = new Map(feeStructures.map((s) => [s.classId, s]));

    const studentIds = students.map((s) => s.id);
    // Fetch ALL active concessions — now supports stacking per student
    const concessions = await prisma.studentFeeConcession.findMany({
      where: {
        tenantId,
        studentProfileId: { in: studentIds },
        isActive: true,
      },
    });
    // Group by student
    const concessionsByStudent = new Map<string, typeof concessions>();
    for (const c of concessions) {
      const arr = concessionsByStudent.get(c.studentProfileId) || [];
      arr.push(c as any);
      concessionsByStudent.set(c.studentProfileId, arr);
    }

    const currentYear = data.year || new Date().getFullYear();
    const billingMonth = data.month || new Date().getMonth() + 1;
    const billingYear = data.year || new Date().getFullYear();
    const dueDate = new Date(data.dueDate);

    let totalGeneratedDue = new Prisma.Decimal(0);
    let totalArrearsRolled = new Prisma.Decimal(0);
    let totalConcessionsApplied = new Prisma.Decimal(0);
    let createdCount = 0;
    let skippedDuplicate = 0;

    // Pre-lock existing vouchers for idempotency check: fetch all relevant FeeVouchers with billingMonth/Year
    const existingForPeriod = await prisma.feeVoucher.findMany({
      where: {
        tenantId,
        academicYearId: data.academicYearId,
        feeType: data.feeType || "TUITION",
        billingYear,
        billingMonth,
        studentProfileId: { in: studentIds },
      },
      select: { studentProfileId: true },
    });
    const alreadyInvoiced = new Set(existingForPeriod.map((v) => v.studentProfileId));

    // For arrears, we need to compute once outside loop via map to avoid N+1
    const arrearsMap = new Map<string, Prisma.Decimal>();
    if (data.carryForwardArrears) {
      // Single query for all students' pending balances. Only vouchers from a
      // period strictly before the one we're about to generate are counted:
      // otherwise every re-run of batch invoicing would re-sum balances that
      // were already rolled into a later voucher's `arrears`, compounding
      // the same shortfall every cycle. Vouchers without a billing period
      // (e.g. one-off ADMISSION/TERM fees) have no period to compare against
      // and are always treated as prior-period arrears.
      const unpaid = await prisma.feeVoucher.findMany({
        where: {
          tenantId,
          studentProfileId: { in: studentIds },
          status: { in: ["PENDING", "PARTIAL", "OVERDUE"] },
          OR: [
            { billingYear: null },
            { billingYear: { lt: billingYear } },
            { billingYear, billingMonth: { lt: billingMonth } },
          ],
        },
        select: { studentProfileId: true, balance: true },
      });
      for (const v of unpaid) {
        const cur = arrearsMap.get(v.studentProfileId) || new Prisma.Decimal(0);
        arrearsMap.set(v.studentProfileId, cur.add(new Prisma.Decimal(v.balance as any)));
      }
    }

    await prisma.$transaction(async (tx) => {
      for (const student of students) {
        if (alreadyInvoiced.has(student.id)) {
          skippedDuplicate++;
          continue;
        }

        const arrears = arrearsMap.get(student.id) || new Prisma.Decimal(0);
        if (arrears.greaterThan(0)) totalArrearsRolled = totalArrearsRolled.add(arrears);

        // Determine base fee from class structure or fallback, with billing cycle multiplier
        let baseAmount = new Prisma.Decimal(data.baseAmount || 0);
        const struct = student.classId ? structureMap.get(student.classId) : undefined;
        if (data.useClassFeeStructure !== false && struct) {
          // Use Decimal values — totalMonthlyFee is Decimal now
          const monthly = new Prisma.Decimal((struct as any).totalMonthlyFee ?? (struct as any).tuitionFee ?? 0);
          // Apply billing cycle multiplier
          let cycleBase = monthly;
          const cycle = (struct as any).billingCycle || "MONTHLY";
          if (cycle === "QUARTERLY") cycleBase = monthly.mul(3);
          else if (cycle === "BI_ANNUAL") cycleBase = monthly.mul(6);
          else if (cycle === "ANNUAL") cycleBase = monthly.mul(12);
          // Prorate if mid-term admission
          if ((struct as any).prorateOnAdmission !== false && student.admissionDate) {
            cycleBase = prorateMonthlyFee(cycleBase, new Date(student.admissionDate), billingYear, billingMonth);
          }
          baseAmount = cycleBase;
        }
        // Fallback if still zero — use provided baseAmount
        if (baseAmount.isZero() && data.baseAmount) baseAmount = new Prisma.Decimal(data.baseAmount);

        // Determine concession via stacking, tuition-only cap
        let discountAmount = new Prisma.Decimal(0);
        const studentConcessions = concessionsByStudent.get(student.id) || [];
        if (studentConcessions.length > 0) {
          // For tuition-only cap, need tuition component separately
          const tuitionOnly = struct ? new Prisma.Decimal((struct as any).tuitionFee ?? 0) : baseAmount;
          // If billing cycle multiplies, tuitionOnly should scale similarly
          let tuitionEligible = tuitionOnly;
          if (struct) {
            const cycle = (struct as any).billingCycle || "MONTHLY";
            if (cycle === "QUARTERLY") tuitionEligible = tuitionOnly.mul(3);
            else if (cycle === "BI_ANNUAL") tuitionEligible = tuitionOnly.mul(6);
            else if (cycle === "ANNUAL") tuitionEligible = tuitionOnly.mul(12);
            if ((struct as any).prorateOnAdmission !== false && student.admissionDate) {
              tuitionEligible = prorateMonthlyFee(tuitionEligible, new Date(student.admissionDate), billingYear, billingMonth);
            }
          }
          discountAmount = computeStackedConcession(tuitionEligible, studentConcessions.map(c=>({
            discountType: c.discountType,
            discountValue: new Prisma.Decimal(c.discountValue as any),
            appliesToHead: (c as any).appliesToHead || "TUITION",
            priority: (c as any).priority,
            validFrom: (c as any).validFrom,
            validUntil: (c as any).validUntil,
          })), baseAmount);
        }
        totalConcessionsApplied = totalConcessionsApplied.add(discountAmount);

        const netBase = Prisma.Decimal.max(new Prisma.Decimal(0), baseAmount.minus(discountAmount));
        const totalDue = netBase.add(arrears);
        totalGeneratedDue = totalGeneratedDue.add(totalDue);

        const voucherId = await getNextVoucherNumber(tx, tenantId, "SALES_FEE", currentYear);

        // Idempotent upsert via natural key (student + period + feeType) — Decimal calc, Float store (2dp)
        try {
          await tx.feeVoucher.create({
            data: {
              tenantId,
              voucherId,
              studentProfileId: student.id,
              academicYearId: data.academicYearId,
              feeType: data.feeType || "TUITION",
              billingMonth,
              billingYear,
              baseAmount: Number(baseAmount.toFixed(2)),
              discountAmount: Number(discountAmount.toFixed(2)),
              arrears: Number(arrears.toFixed(2)),
              lateFine: 0,
              totalDue: Number(totalDue.toFixed(2)),
              amountPaid: 0,
              balance: Number(totalDue.toFixed(2)),
              dueDate,
              status: "PENDING",
            },
          });
        } catch (e:any) {
          if (e?.code === "P2002") {
            skippedDuplicate++;
            continue;
          }
          throw e;
        }

        await postLegacyFeeInvoiceAccrual(tx as any, {
          tenantId,
          studentProfileId: student.id,
          feeHeadCode,
          amount: baseAmount,
          discountAmount,
          executedById: access.authContext.user.id,
          reference: voucherId,
          dueDate,
        });
        createdCount++;
      }
    });

    return successResponse(
      {
        totalVouchersCreated: createdCount,
        skippedDuplicates: skippedDuplicate,
        totalInvoiceAmount: totalGeneratedDue.toFixed(2),
        totalArrearsIncluded: totalArrearsRolled.toFixed(2),
        totalConcessionsApplied: totalConcessionsApplied.toFixed(2),
        dueDate: data.dueDate,
        target: data.target,
      },
      `Successfully generated ${createdCount} individualized fee vouchers!${skippedDuplicate? ` Skipped ${skippedDuplicate} duplicates.` : ""}`,
      201
    );
  } catch (error) {
    return handleApiError(error, "Failed to generate batch fee invoices");
  }
}
