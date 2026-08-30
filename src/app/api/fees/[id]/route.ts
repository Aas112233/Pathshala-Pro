import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import {
  successResponse,
  errorResponse,
  unauthorized,
  notFound,
  badRequest,
  handleApiError,
} from "@/lib/api-response";
import { updateFeeVoucherSchema } from "@/lib/schemas";
import { requireApiAccess } from "@/lib/api-auth";
import {
  buildLockedFieldsDetails,
  integrityViolation,
  lockedDeleteMessage,
  lockedUpdateMessage,
} from "@/lib/data-integrity";
import { assertAcademicYearOpen } from "@/lib/academic-year-guards";

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
    return handleApiError(error);
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

    await assertAcademicYearOpen(tenantId, existingVoucher.academicYearId);

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

    // Calculate new totals — Decimal-safe
    const baseAmount = new Prisma.Decimal((data as any).baseAmount ?? existingVoucher.baseAmount);
    const discountAmount = new Prisma.Decimal((data as any).discountAmount ?? existingVoucher.discountAmount);
    const arrears = new Prisma.Decimal((data as any).arrears ?? existingVoucher.arrears);
    const amountPaid = new Prisma.Decimal(existingVoucher.amountPaid as any);

    if (discountAmount.greaterThan(baseAmount)) {
      return badRequest("Discount cannot exceed base amount");
    }

    const totalDue = Prisma.Decimal.max(
      new Prisma.Decimal(0),
      baseAmount.minus(discountAmount).add(arrears)
    ).toDecimalPlaces(2);
    const balance = Prisma.Decimal.max(
      new Prisma.Decimal(0),
      totalDue.minus(amountPaid)
    ).toDecimalPlaces(2);

    // Determine status — Decimal-safe
    let status = existingVoucher.status;
    if (balance.lessThanOrEqualTo(0)) {
      status = "PAID";
    } else if (amountPaid.greaterThan(0)) {
      status = "PARTIAL";
    } else {
      status = "PENDING";
    }

    const updatedVoucher = await prisma.feeVoucher.update({
      where: { id },
      data: {
        ...data,
        totalDue: Number(totalDue.toFixed(2)),
        balance: Number(balance.toFixed(2)),
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
    return handleApiError(error);
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

    await assertAcademicYearOpen(tenantId, existingVoucher.academicYearId);

    const transactions = await prisma.transaction.count({
      where: { tenantId, feeVoucherId: id },
    });

    const paidAmtDec = new Prisma.Decimal(existingVoucher.amountPaid as any);
    if (transactions > 0 || paidAmtDec.greaterThan(0) || existingVoucher.status !== "PENDING") {
      return integrityViolation(
        lockedDeleteMessage("Fee voucher", {
          transactions,
          payments: paidAmtDec.greaterThan(0) ? 1 : 0,
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
    return handleApiError(error);
  }
}
