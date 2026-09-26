import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  errorResponse,
  unauthorized,
  notFound,
  badRequest,
  handleApiError,
} from "@/lib/api-response";
import { updateSalaryLedgerSchema } from "@/lib/schemas";
import { requireApiAccess } from "@/lib/api-auth";
import { Prisma } from "@prisma/client";
import { disburseSalaryLedger } from "@/lib/salary-payslip";
import {
  integrityViolation,
  lockedDeleteMessage,
  lockedUpdateMessage,
} from "@/lib/data-integrity";

/**
 * GET /api/salary/[id]
 * Get a single salary ledger entry by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;
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
    return handleApiError(error);
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
    const access = await requireApiAccess(request, { permission: "payroll:process" });
    if ("response" in access) return access.response;

    const { tenantId, user } = access.authContext as any;
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

    // Payment intent (paidAmount increased) goes through the disbursement
    // engine — it validates against the outstanding balance, posts the Stage 2
    // journal (debit payable / credit bank), and advances PAID/PARTIAL. The
    // old path wrote paidAmount directly with no journal.
    const nextPaid = (data as any).paidAmount;
    const alreadyPaid = new Prisma.Decimal(existingLedger.paidAmount ?? 0);
    if (nextPaid != null && new Prisma.Decimal(nextPaid).greaterThan(alreadyPaid)) {
      if (existingLedger.status === 'PENDING' || existingLedger.status === 'PENDING_APPROVAL') {
        return badRequest(`Cannot record payment on a ${existingLedger.status} ledger — approve it first`);
      }
      if (existingLedger.status === 'REJECTED') {
        return badRequest('Cannot record payment on a REJECTED ledger');
      }
      const delta = new Prisma.Decimal(nextPaid).sub(alreadyPaid);
      await disburseSalaryLedger({
        tenantId,
        salaryLedgerId: id,
        amount: delta,
        executedById: user?.id,
      });
      const paid = await prisma.salaryLedger.findUnique({
        where: { id },
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
      return successResponse(paid, "Salary payment recorded successfully");
    }

    if (existingLedger.paidAmount > 0 || ["PAID", "PARTIAL", "APPROVED"].includes(existingLedger.status)) {
      return integrityViolation(
        lockedUpdateMessage("Salary ledger", existingLedger.status === "APPROVED" ? "record is already approved" : "payment activity already exists"),
        [
          {
            field: "id",
            code: "locked",
            message:
              existingLedger.status === "APPROVED"
                ? "Approved salary records cannot be edited. Reject the record first to make changes."
                : "Salary records with paid or partially paid amounts cannot be edited. Create an adjustment workflow instead.",
          },
        ]
      );
    }

    // Calculate net payable if amounts are being updated (Decimal precision)
    const baseSalary = data.baseSalary ?? existingLedger.baseSalary;
    const deductions = data.deductions ?? existingLedger.deductions;
    const advances = data.advances ?? existingLedger.advances;
    const netPayable = new Prisma.Decimal(baseSalary)
      .sub(new Prisma.Decimal(deductions))
      .sub(new Prisma.Decimal(advances));

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
    return handleApiError(error);
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
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;
    const { id } = await params;

    const existingLedger = await prisma.salaryLedger.findUnique({
      where: { id, tenantId },
    });

    if (!existingLedger) {
      return notFound("Salary ledger not found");
    }

    if (existingLedger.paidAmount > 0 || ["PAID", "PARTIAL", "APPROVED"].includes(existingLedger.status)) {
      return integrityViolation(
        lockedDeleteMessage("Salary ledger", {
          payments: existingLedger.paidAmount > 0 ? 1 : 0,
          paidStatus: ["PAID", "PARTIAL", "APPROVED"].includes(existingLedger.status) ? 1 : 0,
        }),
        [
          {
            field: "id",
            code: "locked",
            message:
              existingLedger.status === "APPROVED"
                ? "Approved salary records cannot be deleted. Reject the record first."
                : "Salary records with payment history cannot be deleted. Use a payroll adjustment workflow instead.",
          },
        ]
      );
    }

    await prisma.salaryLedger.delete({
      where: { id },
    });

    return successResponse(null, "Salary ledger deleted successfully");
  } catch (error) {
    return handleApiError(error);
  }
}
