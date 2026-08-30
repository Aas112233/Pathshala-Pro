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
import { assertAcademicYearOpen } from "@/lib/academic-year-guards";
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

    const academicYearId = searchParams.get("academicYearId") || "";
    if (academicYearId) where.academicYearId = academicYearId;

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
    const access = await requireApiAccess(request);
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

// Calculate net payable using Decimal precision to avoid floating-point drift
    const netPayable = new Prisma.Decimal(data.baseSalary)
      .sub(new Prisma.Decimal(data.deductions))
      .sub(new Prisma.Decimal(data.advances));

    const salaryLedger = await prisma.salaryLedger.create({
      data: {
        tenantId,
        ...data,
        netPayable,
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

    return successResponse(salaryLedger, "Salary ledger created successfully", 201);
  } catch (error) {
    return handleApiError(error);
  }
}
