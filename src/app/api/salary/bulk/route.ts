import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  errorResponse,
  badRequest,
  validationError,
} from "@/lib/api-response";
import { bulkPayrollSchema } from "@/lib/schemas";
import { requireApiAccess } from "@/lib/api-auth";

/**
 * POST /api/salary/bulk
 * Process bulk payroll for multiple staff members
 */
export async function POST(request: NextRequest) {
  try {
    const access = await requireApiAccess(request);
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

    // Check for duplicates and verify staff
    const existingSalaries = await prisma.salaryLedger.findMany({
      where: {
        tenantId,
        academicYearId,
        month,
        year,
        staffProfileId: { in: entries.map(e => e.staffProfileId) },
      },
      select: {
        staffProfileId: true,
        id: true,
      },
    });

    if (existingSalaries.length > 0) {
      const duplicateStaffIds = existingSalaries.map(s => s.staffProfileId);
      return badRequest("Salary already exists for some staff members", [
        {
          field: "entries",
          code: "duplicate",
          message: `${duplicateStaffIds.length} staff member(s) already have salary for this month/year`,
        },
      ]);
    }

    // Create salary ledgers in transaction
    const createdSalaries = await prisma.$transaction(
      entries.map((entry) =>
        prisma.salaryLedger.create({
          data: {
            tenantId,
            staffProfileId: entry.staffProfileId,
            academicYearId,
            month,
            year,
            baseSalary: entry.baseSalary,
            deductions: entry.deductions,
            advances: entry.advances,
            netPayable: entry.baseSalary - entry.deductions - entry.advances,
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
        })
      )
    );

    return successResponse(
      {
        count: createdSalaries.length,
        salaries: createdSalaries,
      },
      `Processed payroll for ${createdSalaries.length} staff member(s)`
    );
  } catch (error) {
    console.error("Bulk payroll error:", error);
    return errorResponse("Internal server error", 500);
  }
}
