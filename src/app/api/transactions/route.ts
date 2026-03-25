import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  paginatedResponse,
  errorResponse,
  badRequest,
  unauthorized,
  forbidden,
  validationError,
} from "@/lib/api-response";
import { createTransactionSchema, updateTransactionSchema } from "@/lib/schemas";
import { getAuthContext } from "@/lib/auth";
import { MAX_PAGE_SIZE } from "@/lib/constants";

/**
 * GET /api/transactions
 * Get all transactions with pagination
 */
export async function GET(request: NextRequest) {
  try {
    const authContext = await getAuthContext(request);
    if (!authContext) {
      return unauthorized("Authentication required");
    }

    const { tenantId } = authContext;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), MAX_PAGE_SIZE);
    const search = searchParams.get("search") || "";
    const paymentMethod = searchParams.get("paymentMethod") || "";
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = { tenantId };

    if (search) {
      where.OR = [
        { transactionId: { contains: search, mode: "insensitive" } },
        { receiptNumber: { contains: search, mode: "insensitive" } },
      ];
    }

    if (paymentMethod) {
      where.paymentMethod = paymentMethod;
    }

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate);
      if (endDate) where.timestamp.lte = new Date(endDate);
    }

    // Get total count
    const totalCount = await prisma.transaction.count({ where });

    // Get transactions
    const transactions = await prisma.transaction.findMany({
      where,
      skip,
      take: limit,
      orderBy: { timestamp: "desc" },
      include: {
        feeVoucher: {
          select: {
            voucherId: true,
            feeType: true,
            studentProfile: {
              select: {
                firstName: true,
                lastName: true,
                studentId: true,
              },
            },
          },
        },
        collectedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    const totalPages = Math.ceil(totalCount / limit);

    return paginatedResponse(transactions, {
      totalCount,
      currentPage: page,
      pageSize: limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    });
  } catch (error) {
    console.error("Get transactions error:", error);
    return errorResponse("Internal server error", 500);
  }
}

/**
 * POST /api/transactions
 * Create a new transaction (collect fee payment)
 * Uses atomic operations to update fee voucher balance
 */
export async function POST(request: NextRequest) {
  try {
    const authContext = await getAuthContext(request);
    if (!authContext) {
      return unauthorized("Authentication required");
    }

    const { user, tenantId } = authContext;

    const body = await request.json();
    const validation = createTransactionSchema.safeParse(body);

    if (!validation.success) {
      const errors = validation.error.errors.map((err) => ({
        field: err.path.join("."),
        code: err.code,
        message: err.message,
      }));
      return validationError(errors);
    }

    const data = validation.data;

    // Check if transaction ID already exists
    const existingTransaction = await prisma.transaction.findFirst({
      where: { tenantId, transactionId: data.transactionId },
    });

    if (existingTransaction) {
      return badRequest("Transaction already exists", [
        { field: "transactionId", code: "duplicate", message: "Transaction ID already exists" },
      ]);
    }

    // Verify fee voucher exists and get current state
    const feeVoucher = await prisma.feeVoucher.findUnique({
      where: { id: data.feeVoucherId, tenantId },
    });

    if (!feeVoucher) {
      return badRequest("Fee voucher not found");
    }

    // Check if voucher is already paid or cancelled
    if (["PAID", "CANCELLED"].includes(feeVoucher.status)) {
      return badRequest(`Cannot make payment for ${feeVoucher.status} voucher`);
    }

    // Validate payment amount
    if (data.amountPaid <= 0) {
      return badRequest("Payment amount must be positive");
    }

    if (data.amountPaid > feeVoucher.balance) {
      return badRequest(
        `Payment amount (${data.amountPaid}) exceeds balance due (${feeVoucher.balance})`
      );
    }

    // Atomic transaction: Create transaction and update voucher
    const [transaction, updatedVoucher] = await prisma.$transaction([
      // Create transaction record
      prisma.transaction.create({
        data: {
          tenantId,
          transactionId: data.transactionId,
          feeVoucherId: data.feeVoucherId,
          amountPaid: data.amountPaid,
          paymentMethod: data.paymentMethod,
          receiptNumber: data.receiptNumber,
          collectedById: user.id,
          note: data.note,
        },
        include: {
          feeVoucher: {
            select: {
              voucherId: true,
              studentProfile: {
                select: {
                  firstName: true,
                  lastName: true,
                  studentId: true,
                },
              },
            },
          },
          collectedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),

      // Update fee voucher
      prisma.feeVoucher.update({
        where: { id: data.feeVoucherId },
        data: {
          amountPaid: { increment: data.amountPaid },
          balance: { decrement: data.amountPaid },
          status: "PAID", // Will be recalculated below
        },
      }),
    ]);

    // Recalculate voucher status
    const finalStatus = updatedVoucher.balance <= 0 ? "PAID" : "PARTIAL";

    const finalVoucher = await prisma.feeVoucher.update({
      where: { id: data.feeVoucherId },
      data: { status: finalStatus },
    });

    return successResponse(
      {
        transaction,
        voucher: {
          ...finalVoucher,
          status: finalStatus,
        },
      },
      "Payment recorded successfully",
      201
    );
  } catch (error) {
    console.error("Create transaction error:", error);
    return errorResponse("Internal server error", 500);
  }
}
