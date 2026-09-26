import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  errorResponse,
  badRequest,
  validationError,
  handleApiError,
} from "@/lib/api-response";
import { bulkPayrollSchema } from "@/lib/schemas";
import { requireApiAccess } from "@/lib/api-auth";
import { assertAcademicYearOpen } from "@/lib/academic-year-guards";
import { calculateEmployeePayroll, postPayrollAccrual } from "@/lib/salary-payslip";

/**
 * POST /api/salary/bulk
 * Process bulk payroll for multiple staff members
 */
export async function POST(request: NextRequest) {
  try {
    const access = await requireApiAccess(request, { permission: "payroll:disburse" });
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;

    const body = await request.json();
    const validation = bulkPayrollSchema.safeParse(body);

    if (!validation.success) {
      const errors = validation.error.errors.map((err) => ({
        field: err.path.join("."),
        code: err.code,
        message: err.message,
      }));
      return validationError(errors);
    }

    const { academicYearId, month, year, entries } = validation.data;

    // Verify academic year exists
    const academicYear = await prisma.academicYear.findUnique({
      where: { id: academicYearId, tenantId },
    });

    if (!academicYear) {
      return badRequest("Academic year not found");
    }

    await assertAcademicYearOpen(tenantId, academicYear.id);

    // Check for duplicates and verify staff
    const existingSalaries = await prisma.salaryLedger.findMany({
      where: {
        tenantId,
        academicYearId,
        month,
        year,
        staffProfileId: { in: entries.map((entry: { staffProfileId: string }) => entry.staffProfileId) },
      },
      select: {
        staffProfileId: true,
        id: true,
      },
    });

    if (existingSalaries.length > 0) {
      const duplicateStaffIds = existingSalaries.map((salary: { staffProfileId: string }) => salary.staffProfileId);
      return badRequest("Salary already exists for some staff members", [
        {
          field: "entries",
          code: "duplicate",
          message: `${duplicateStaffIds.length} staff member(s) already have salary for this month/year`,
        },
      ]);
    }

    // Single Decimal engine for every entry: calc (attendance/LOP aware) →
    // ledger with full breakdown → accrual journal, each in its own short
    // transaction. The legacy float-only create (no journals, no breakdown)
    // is gone — it produced ledgers the approval path could not balance.
    // Mapping: the bulk form's generic "deductions" become TDS/tax payable and
    // "advances" become loan recovery, so every taka is classified in the GL
    // instead of vanishing from the journal.
    const createdIds: string[] = [];
    const failures: Array<{ staffProfileId: string; message: string }> = [];

    for (const entry of entries) {
      try {
        const ledgerId = await prisma.$transaction(async (tx) => {
          const duplicate = await tx.salaryLedger.findFirst({
            where: { tenantId, staffProfileId: entry.staffProfileId, year, month },
            select: { id: true },
          });
          if (duplicate) throw new Error('Salary already exists for this staff member for this month/year');

          const calc = await calculateEmployeePayroll(
            {
              tenantId,
              staffProfileId: entry.staffProfileId,
              year,
              month,
              academicYearId,
              baseSalaryOverride: entry.baseSalary,
              deductionsConfig: {
                taxAmount: entry.deductions,
                loanInstallment: entry.advances,
              },
            },
            tx as any
          );

          const ledger = await tx.salaryLedger.create({
            data: {
              tenantId,
              staffProfileId: entry.staffProfileId,
              academicYearId,
              month,
              year,
              baseSalary: calc.earnings.baseSalary.toNumber(), // legacy Float
              deductions: calc.deductions.totalDeductions.toNumber(),
              advances: calc.deductions.loanRecovery.toNumber(),
              netPayable: calc.netPayable.toNumber(),
              grossSalary: calc.earnings.grossSalary,
              totalEarnings: calc.earnings.grossSalary,
              totalDeductions: calc.deductions.totalDeductions,
              lopDays: calc.deductions.lopDays,
              lopAmount: calc.deductions.lopAmount,
              pfAmount: calc.deductions.pfAmount,
              taxAmount: calc.deductions.taxAmount,
              loanRecovery: calc.deductions.loanRecovery,
              daysInMonth: calc.daysInMonth,
              payableDays: calc.payableDays,
              isProrated: calc.isProrated,
              earningsBreakdown: {
                baseSalary: calc.earnings.baseSalary.toFixed(2),
                hra: calc.earnings.hra.toFixed(2),
                medical: calc.earnings.medical.toFixed(2),
                transport: calc.earnings.transport.toFixed(2),
                special: calc.earnings.special.toFixed(2),
                other: calc.earnings.other.toFixed(2),
                grossSalary: calc.earnings.grossSalary.toFixed(2),
                dailyRate: calc.dailyRate.toFixed(2),
              },
              deductionsBreakdown: {
                lopDays: calc.deductions.lopDays,
                lopAmount: calc.deductions.lopAmount.toFixed(2),
                pfAmount: calc.deductions.pfAmount.toFixed(2),
                taxAmount: calc.deductions.taxAmount.toFixed(2),
                loanRecovery: calc.deductions.loanRecovery.toFixed(2),
                totalDeductions: calc.deductions.totalDeductions.toFixed(2),
                attendance: calc.attendance,
                shortfall: calc.shortfall.toFixed(2),
              },
              status: 'PENDING',
            },
            select: { id: true },
          });

          await postPayrollAccrual(tx as any, calc, ledger.id);
          return ledger.id;
        }, { maxWait: 10000, timeout: 30000 });
        createdIds.push(ledgerId);
      } catch (error: any) {
        failures.push({ staffProfileId: entry.staffProfileId, message: error?.message ?? 'Payroll failed' });
      }
    }

    if (createdIds.length === 0) {
      return badRequest(`Payroll failed for all ${failures.length} staff member(s)`, failures.slice(0, 5).map((f) => ({
        field: 'entries',
        code: 'payroll_failed',
        message: `${f.staffProfileId}: ${f.message}`,
      })));
    }

    const createdSalaries = await prisma.salaryLedger.findMany({
      where: { id: { in: createdIds } },
      include: {
        staffProfile: {
          select: {
            staffId: true,
            firstName: true,
            lastName: true,
            designation: true,
          },
        },
      },
    });

    return successResponse(
      {
        count: createdSalaries.length,
        salaries: createdSalaries,
        failures,
      },
      failures.length > 0
        ? `Processed payroll for ${createdSalaries.length} staff member(s), ${failures.length} failed`
        : `Processed payroll for ${createdSalaries.length} staff member(s)`
    );
  } catch (error) {
    return handleApiError(error);
  }
}
