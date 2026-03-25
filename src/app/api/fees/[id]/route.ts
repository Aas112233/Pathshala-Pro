import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  errorResponse,
  unauthorized,
  notFound,
  badRequest,
} from "@/lib/api-response";
import { updateFeeVoucherSchema } from "@/lib/schemas";
import { getAuthContext } from "@/lib/auth";

/**
 * GET /api/fees/[id]
 * Get a single fee voucher by ID
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

    const feeVoucher = await prisma.feeVoucher.findUnique({
      where: { id, tenantId },
      include: {
        studentProfile: {
          select: {
            id: true,
            studentId: true,
            firstName: true,
            lastName: true,
            rollNumber: true,
            guardianName: true,
            guardianContact: true,
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
        transactions: {
          orderBy: { timestamp: "desc" },
          include: {
            collectedBy: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!feeVoucher) {
      return notFound("Fee voucher not found");
    }

    return successResponse(feeVoucher);
  } catch (error) {
    console.error("Get fee voucher error:", error);
    return errorResponse("Internal server error", 500);
  }
}

/**
 * PUT /api/fees/[id]
 * Update a fee voucher
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
    const validation = updateFeeVoucherSchema.safeParse(body);

    if (!validation.success) {
      const errors = validation.error.errors.map((err) => ({
        field: err.path.join("."),
        code: err.code,
        message: err.message,
      }));
      return badRequest("Invalid input", errors);
    }

    const data = validation.data;

    // Check if fee voucher exists
    const existingVoucher = await prisma.feeVoucher.findUnique({
      where: { id, tenantId },
    });

    if (!existingVoucher) {
      return notFound("Fee voucher not found");
    }

    // Don't allow updating if voucher is paid or cancelled
    if (["PAID", "CANCELLED"].includes(existingVoucher.status)) {
      return badRequest(`Cannot update ${existingVoucher.status} voucher`);
    }

    // Calculate new totals if amounts are being updated
    const baseAmount = data.baseAmount ?? existingVoucher.baseAmount;
    const discountAmount = data.discountAmount ?? existingVoucher.discountAmount;
    const arrears = data.arrears ?? existingVoucher.arrears;
    const amountPaid = existingVoucher.amountPaid;

    const totalDue = baseAmount - discountAmount + arrears;
    const balance = totalDue - amountPaid;

    // Determine status
    let status = existingVoucher.status;
    if (balance <= 0) {
      status = "PAID";
    } else if (amountPaid > 0) {
      status = "PARTIAL";
    } else {
      status = "PENDING";
    }

    const updatedVoucher = await prisma.feeVoucher.update({
      where: { id },
      data: {
        ...data,
        totalDue,
        balance,
        status,
      },
      include: {
        studentProfile: {
          select: {
            studentId: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return successResponse(updatedVoucher, "Fee voucher updated successfully");
  } catch (error) {
    console.error("Update fee voucher error:", error);
    return errorResponse("Internal server error", 500);
  }
}

/**
 * DELETE /api/fees/[id]
 * Delete a fee voucher
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

    // Check if fee voucher exists
    const existingVoucher = await prisma.feeVoucher.findUnique({
      where: { id, tenantId },
    });

    if (!existingVoucher) {
      return notFound("Fee voucher not found");
    }

    // Check for related transactions
    const transactions = await prisma.transaction.count({
      where: { feeVoucherId: id },
    });

    if (transactions > 0) {
      return badRequest("Cannot delete fee voucher with existing transactions");
    }

    await prisma.feeVoucher.delete({
      where: { id },
    });

    return successResponse(null, "Fee voucher deleted successfully");
  } catch (error) {
    console.error("Delete fee voucher error:", error);
    return errorResponse("Internal server error", 500);
  }
}
