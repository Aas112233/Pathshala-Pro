import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  errorResponse,
  unauthorized,
  notFound,
  badRequest,
} from "@/lib/api-response";
import { updateSalaryLedgerSchema } from "@/lib/schemas";
import { getAuthContext } from "@/lib/auth";

/**
 * GET /api/salary/[id]
 * Get a single salary ledger entry by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = await getAuthContext(request);
    if (!authContext) {
      return unauthorized("Authentication required");
    }

    const { tenantId } = authContext;
    const { id } = await params;

    const salaryLedger = await prisma.salaryLedger.findUnique({
      where: { id, tenantId },
      include: {
        staffProfile: {
          select: {
            staffId: true,
            firstName: true,
            lastName: true,
            designation: true,
            department: true,
            baseSalary: true,
          },
        },
        academicYear: {
          select: {
            yearId: true,
            label: true,
            startDate: true,
            endDate: true,
          },
        },
      },
    });

    if (!salaryLedger) {
      return notFound("Salary ledger not found");
    }

    return successResponse(salaryLedger);
  } catch (error) {
    console.error("Get salary ledger error:", error);
    return errorResponse("Internal server error", 500);
  }
}

/**
 * PUT /api/salary/[id]
 * Update a salary ledger entry
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = await getAuthContext(request);
    if (!authContext) {
      return unauthorized("Authentication required");
    }

    const { tenantId } = authContext;
    const { id } = await params;

    const body = await request.json();
    const validation = updateSalaryLedgerSchema.safeParse(body);

    if (!validation.success) {
      const errors = validation.error.errors.map((err) => ({
        field: err.path.join("."),
        code: err.code,
        message: err.message,
      }));
      return badRequest("Invalid input", errors);
    }

    const data = validation.data;

    const existingLedger = await prisma.salaryLedger.findUnique({
      where: { id, tenantId },
    });

    if (!existingLedger) {
      return notFound("Salary ledger not found");
    }

    // Calculate net payable if amounts are being updated
    const baseSalary = data.baseSalary ?? existingLedger.baseSalary;
    const deductions = data.deductions ?? existingLedger.deductions;
    const advances = data.advances ?? existingLedger.advances;
    const netPayable = baseSalary - deductions - advances;

    const updatedLedger = await prisma.salaryLedger.update({
      where: { id },
      data: {
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

    return successResponse(updatedLedger, "Salary ledger updated successfully");
  } catch (error) {
    console.error("Update salary ledger error:", error);
    return errorResponse("Internal server error", 500);
  }
}

/**
 * DELETE /api/salary/[id]
 * Delete a salary ledger entry
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = await getAuthContext(request);
    if (!authContext) {
      return unauthorized("Authentication required");
    }

    const { tenantId } = authContext;
    const { id } = await params;

    const existingLedger = await prisma.salaryLedger.findUnique({
      where: { id, tenantId },
    });

    if (!existingLedger) {
      return notFound("Salary ledger not found");
    }

    await prisma.salaryLedger.delete({
      where: { id },
    });

    return successResponse(null, "Salary ledger deleted successfully");
  } catch (error) {
    console.error("Delete salary ledger error:", error);
    return errorResponse("Internal server error", 500);
  }
}
