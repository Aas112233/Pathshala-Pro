import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  paginatedResponse,
  errorResponse,
  badRequest,
  validationError,
  handleApiError,
} from "@/lib/api-response";
import { createSalaryLedgerSchema } from "@/lib/schemas";
import { requireApiAccess } from "@/lib/api-auth";
import { smartRateLimitAsync, dedupeRequestAsync } from "@/lib/rate-limit";
import { MAX_PAGE_SIZE } from "@/lib/constants";
import { assertAcademicYearOpen, resolveRequestAcademicYearId } from "@/lib/academic-year-guards";
import { calculateEmployeePayroll, postPayrollAccrual } from "@/lib/salary-payslip";
import { Prisma } from "@prisma/client";

/**
 * GET /api/salary
 * Get all salary ledgers with pagination
 */
export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), MAX_PAGE_SIZE);
    const staffId = searchParams.get("staffId") || "";
    const month = searchParams.get("month");
    const year = searchParams.get("year");
    const status = searchParams.get("status") || "";

    const skip = (page - 1) * limit;

    const where: any = { tenantId };

    if (staffId) {
      where.staffProfileId = staffId;
    }

    if (month) {
      where.month = parseInt(month);
    }

    if (year) {
      where.year = parseInt(year);
    }

    if (status) {
      where.status = status;
    }

    const academicYearIdParam = searchParams.get("academicYearId") || "";
    const academicYearId =
      academicYearIdParam ||
      (await resolveRequestAcademicYearId(request, tenantId)) ||
      "";
    if (academicYearId && academicYearId !== "ALL") where.academicYearId = academicYearId;

    const [totalCount, salaryLedgers] = await Promise.all([
      prisma.salaryLedger.count({ where }),
      prisma.salaryLedger.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ year: "desc" }, { month: "desc" }],
      include: {
        staffProfile: {
          select: {
            staffId: true,
            firstName: true,
            lastName: true,
            designation: true,
            department: true,
          },
        },
        academicYear: {
          select: {
            yearId: true,
            label: true,
          },
        },
      },
    })
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return paginatedResponse(salaryLedgers, {
      totalCount,
      currentPage: page,
      pageSize: limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/salary
 * Create a new salary ledger entry
 */
export async function POST(request: NextRequest) {
  try {
    const access = await requireApiAccess(request, { permission: "payroll:process" });
    if ("response" in access) return access.response;

    const { tenantId, user } = access.authContext as any;

    const body = await request.json();
    const validation = createSalaryLedgerSchema.safeParse(body);

    if (!validation.success) {
      const errors = validation.error.errors.map((err) => ({
        field: err.path.join("."),
        code: err.code,
        message: err.message,
      }));
      return validationError(errors);
    }

    const data = validation.data;

    // 1. Server-side duplicate prevention (distributed)
    const dedupeKey = `SALARY_POST_${tenantId}_${data.staffProfileId}_${data.month}_${data.year}`;
    if (!(await dedupeRequestAsync(dedupeKey, 3000))) {
      return errorResponse("Duplicate salary record request detected. Please wait a moment.", 409);
    }

    // 2. Adaptive rate limiting (distributed)
    const rateCheck = await smartRateLimitAsync(`SALARY_MUT_${tenantId}_${user?.id || "anon"}`, { preset: "mutation" });
    if (!rateCheck.success) {
      return errorResponse("Too many salary ledger operations. Please slow down.", 429);
    }

    // Verify staff exists
    const staff = await prisma.staffProfile.findUnique({
      where: { id: data.staffProfileId, tenantId },
    });

    if (!staff) {
      return badRequest("Staff member not found");
    }

    // Verify academic year exists
    const academicYear = await prisma.academicYear.findUnique({
      where: { id: data.academicYearId, tenantId },
    });

    if (!academicYear) {
      return badRequest("Academic year not found");
    }

    await assertAcademicYearOpen(tenantId, academicYear.id);

    // Check for duplicate entry
    const existing = await prisma.salaryLedger.findFirst({
      where: {
        tenantId,
        staffProfileId: data.staffProfileId,
        academicYearId: data.academicYearId,
        month: data.month,
        year: data.year,
      },
    });

    if (existing) {
      return badRequest("Salary ledger already exists for this month/year", [
        {
          field: "month",
          code: "duplicate",
          message: "Salary already recorded for this period",
        },
      ]);
    }

// Single Decimal engine: run the payroll calculation (attendance/LOP aware)
// so the ledger carries the full breakdown and the accrual journal is
// posted atomically — the same path bulk and batch use.
    const salaryLedger = await prisma.$transaction(async (tx) => {
      const calc = await calculateEmployeePayroll(
        {
          tenantId,
          staffProfileId: data.staffProfileId,
          year: data.year,
          month: data.month,
          academicYearId: data.academicYearId,
          baseSalaryOverride: data.baseSalary,
          deductionsConfig: {
            taxAmount: data.deductions,
            loanInstallment: data.advances,
          },
        },
        tx as any
      );

      const ledger = await tx.salaryLedger.create({
        data: {
          tenantId,
          staffProfileId: data.staffProfileId,
          academicYearId: data.academicYearId,
          month: data.month,
          year: data.year,
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
          status: (data as any).status ?? 'PENDING_APPROVAL',
          paidAmount: (data as any).paidAmount ?? 0,
          paidAt: (data as any).paidAt ? new Date((data as any).paidAt) : null,
          rejectionReason: (data as any).rejectionReason ?? null,
        },
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

      await postPayrollAccrual(tx as any, calc, ledger.id, user?.id);
      return ledger;
    }, { maxWait: 10000, timeout: 30000 });

    return successResponse(salaryLedger, "Salary ledger created successfully", 201);
  } catch (error) {
    return handleApiError(error);
  }
}
