import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  paginatedResponse,
  errorResponse,
  badRequest,
  validationError,
  handleApiError,
} from "@/lib/api-response";
import { createTransactionSchema } from "@/lib/schemas";
import { requireApiAccess } from "@/lib/api-auth";
import { smartRateLimitAsync, dedupeRequestAsync } from "@/lib/rate-limit";
import { MAX_PAGE_SIZE } from "@/lib/constants";

/**
 * GET /api/transactions
 * Get all transactions with pagination
 */
export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;

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
    const [totalCount, transactions] = await Promise.all([
      prisma.transaction.count({ where }),
      prisma.transaction.findMany({
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
    })
    ]);

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
    return handleApiError(error);
  }
}

/**
 * POST /api/transactions
 * Create a new transaction (collect fee payment)
 * Uses atomic operations to update fee voucher balance
 */
export async function POST(request: NextRequest) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { user, tenantId } = access.authContext;

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

    // 1. Server-side duplicate prevention (3-second re-entry guard, distributed)
    const dedupeKey = `TX_PAY_${tenantId}_${data.feeVoucherId}_${data.amountPaid}`;
    if (!(await dedupeRequestAsync(dedupeKey, 3000))) {
      return errorResponse("Duplicate payment request detected. Please wait a moment.", 409);
    }

    // 2. Adaptive rate limiting on payment operations (distributed)
    const rateCheck = await smartRateLimitAsync(`TX_MUT_${tenantId}_${user.id}`, { preset: "mutation" });
    if (!rateCheck.success) {
      return errorResponse("Too many payment transactions. Please slow down.", 429);
    }

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

    const [transaction, finalVoucher] = await prisma.$transaction(async (tx) => {
      const updatedVoucher = await tx.feeVoucher.updateMany({
        where: {
          id: data.feeVoucherId,
          tenantId,
          status: { notIn: ["PAID", "CANCELLED"] },
          balance: { gte: data.amountPaid },
        },
        data: {
          amountPaid: { increment: data.amountPaid },
          balance: { decrement: data.amountPaid },
        },
      });
      if (updatedVoucher.count !== 1) throw new Error("Payment exceeds the current voucher balance");
      const voucher = await tx.feeVoucher.findUniqueOrThrow({ where: { id: data.feeVoucherId, tenantId } });
      const transaction = await tx.transaction.create({
        data: {
          tenantId,
          transactionId: data.transactionId,
          feeVoucherId: data.feeVoucherId,
          amountPaid: data.amountPaid,
          paymentMethod: data.paymentMethod,
          receiptNumber: data.receiptNumber,
          collectedById: user.id,
          note: data.note || undefined,
        },
        include: {
          feeVoucher: { select: { voucherId: true, studentProfile: { select: { firstName: true, lastName: true, studentId: true } } } },
          collectedBy: { select: { id: true, name: true, email: true } },
        },
      });
      const finalStatus = voucher.balance <= 0 ? "PAID" : "PARTIAL";
      const finalVoucher = await tx.feeVoucher.update({
        where: { id: data.feeVoucherId, tenantId },
        data: { status: finalStatus },
      });
      return [transaction, finalVoucher] as const;
    });

    return successResponse(
      {
        transaction,
        voucher: finalVoucher,
      },
      "Payment recorded successfully",
      201
    );
  } catch (error) {
    return handleApiError(error);
  }
}
