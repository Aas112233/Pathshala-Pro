import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  errorResponse,
  unauthorized,
  notFound,
} from "@/lib/api-response";
import { requireApiAccess } from "@/lib/api-auth";
import { integrityViolation } from "@/lib/data-integrity";

/**
 * GET /api/transactions/[id]
 * Get a single transaction by ID
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
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;
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

    return integrityViolation(
      "Transactions cannot be deleted once recorded.",
      [
        {
          field: "id",
          code: "locked",
          message:
            "Payment history is audit-sensitive. Create a reversal or refund entry instead of deleting the transaction.",
        },
      ]
    );
  } catch (error) {
    console.error("Delete transaction error:", error);
    return errorResponse("Internal server error", 500);
  }
}
