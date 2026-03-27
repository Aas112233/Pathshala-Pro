import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  paginatedResponse,
  errorResponse,
  badRequest,
  unauthorized,
  validationError,
} from "@/lib/api-response";
import { createSalaryLedgerSchema, updateSalaryLedgerSchema } from "@/lib/schemas";
import { requireApiAccess } from "@/lib/api-auth";
import { MAX_PAGE_SIZE } from "@/lib/constants";

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
    console.error("Get salary error:", error);
    return errorResponse("Internal server error", 500);
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

    const { tenantId } = access.authContext;

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

    // Check for duplicate entry
    const existing = await prisma.salaryLedger.findFirst({
      where: {
        tenantId,
        staffProfileId: data.staffProfileId,
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

    // Calculate net payable
    const netPayable = data.baseSalary - data.deductions - data.advances;

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
    console.error("Create salary error:", error);
    return errorResponse("Internal server error", 500);
  }
}
