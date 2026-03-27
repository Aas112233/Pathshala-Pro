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
import { requireApiAccess } from "@/lib/api-auth";
import {
  buildLockedFieldsDetails,
  integrityViolation,
  lockedDeleteMessage,
  lockedUpdateMessage,
} from "@/lib/data-integrity";

/**
 * GET /api/fees/[id]
 * Get a single fee voucher by ID
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
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;
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

    const transactionsCount = await prisma.transaction.count({
      where: { tenantId, feeVoucherId: id },
    });

    // Don't allow updating if voucher is paid or cancelled
    if (["PAID", "CANCELLED"].includes(existingVoucher.status)) {
      return badRequest(`Cannot update ${existingVoucher.status} voucher`);
    }

    const lockedFields = [
      "studentProfileId",
      "academicYearId",
      "feeType",
      "baseAmount",
      "discountAmount",
      "arrears",
      "dueDate",
    ].filter((field) => transactionsCount > 0 && Object.prototype.hasOwnProperty.call(body, field));

    if (lockedFields.length > 0) {
      return integrityViolation(
        lockedUpdateMessage("Fee voucher", "payments have already been collected against it"),
        buildLockedFieldsDetails(
          lockedFields,
          "payments have already been collected against this voucher"
        )
      );
    }

    // Calculate new totals if amounts are being updated
    const baseAmount = (data as any).baseAmount ?? existingVoucher.baseAmount;
    const discountAmount = (data as any).discountAmount ?? existingVoucher.discountAmount;
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
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;
    const { id } = await params;

    // Check if fee voucher exists
    const existingVoucher = await prisma.feeVoucher.findUnique({
      where: { id, tenantId },
    });

    if (!existingVoucher) {
      return notFound("Fee voucher not found");
    }

    const transactions = await prisma.transaction.count({
      where: { tenantId, feeVoucherId: id },
    });

    if (transactions > 0 || existingVoucher.amountPaid > 0 || existingVoucher.status !== "PENDING") {
      return integrityViolation(
        lockedDeleteMessage("Fee voucher", {
          transactions,
          payments: existingVoucher.amountPaid > 0 ? 1 : 0,
          nonPendingStatus: existingVoucher.status !== "PENDING" ? 1 : 0,
        }),
        [
          {
            field: "id",
            code: "in_use",
            message:
              "Issued or paid fee vouchers cannot be deleted. Use cancellation or an adjustment workflow instead.",
          },
        ]
      );
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
