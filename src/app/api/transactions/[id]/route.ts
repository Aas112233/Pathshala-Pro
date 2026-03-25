import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  errorResponse,
  unauthorized,
  notFound,
} from "@/lib/api-response";
import { getAuthContext } from "@/lib/auth";

/**
 * GET /api/transactions/[id]
 * Get a single transaction by ID
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

    const transaction = await prisma.transaction.findUnique({
      where: { id, tenantId },
      include: {
        feeVoucher: {
          select: {
            voucherId: true,
            feeType: true,
            totalDue: true,
            amountPaid: true,
            balance: true,
            status: true,
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
          },
        },
        collectedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    if (!transaction) {
      return notFound("Transaction not found");
    }

    return successResponse(transaction);
  } catch (error) {
    console.error("Get transaction error:", error);
    return errorResponse("Internal server error", 500);
  }
}

/**
 * DELETE /api/transactions/[id]
 * Delete a transaction (with voucher balance rollback)
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

    // Get transaction and verify it exists
    const transaction = await prisma.transaction.findUnique({
      where: { id, tenantId },
      include: {
        feeVoucher: true,
      },
    });

    if (!transaction) {
      return notFound("Transaction not found");
    }

    const { feeVoucher } = transaction;

    // Atomic transaction: Delete transaction and rollback voucher balance
    await prisma.$transaction([
      // Delete the transaction
      prisma.transaction.delete({
        where: { id },
      }),

      // Rollback the voucher balance
      prisma.feeVoucher.update({
        where: { id: feeVoucher.id },
        data: {
          amountPaid: { decrement: transaction.amountPaid },
          balance: { increment: transaction.amountPaid },
          status:
            feeVoucher.balance + transaction.amountPaid <= 0
              ? "PAID"
              : feeVoucher.amountPaid > 0
              ? "PARTIAL"
              : "PENDING",
        },
      }),
    ]);

    return successResponse(null, "Transaction deleted and balance rolled back");
  } catch (error) {
    console.error("Delete transaction error:", error);
    return errorResponse("Internal server error", 500);
  }
}
