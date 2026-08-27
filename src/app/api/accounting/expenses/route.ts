import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  paginatedResponse,
  badRequest,
  handleApiError,
  safeParseBody,
} from "@/lib/api-response";
import { createExpenseSchema } from "@/lib/schemas";
import { requireApiAccess } from "@/lib/api-auth";
import { logAuditEvent } from "@/lib/audit-logger";
import { MAX_PAGE_SIZE } from "@/lib/constants";

/**
 * GET /api/accounting/expenses
 * List expenses with pagination, search, category, and date filters
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
    const categoryId = searchParams.get("categoryId") || "";
    const paymentMethod = searchParams.get("paymentMethod") || "";
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const skip = (page - 1) * limit;

    const where: any = { tenantId };

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { expenseNumber: { contains: search, mode: "insensitive" } },
        { payeeName: { contains: search, mode: "insensitive" } },
        { receiptNumber: { contains: search, mode: "insensitive" } },
      ];
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (paymentMethod) {
      where.paymentMethod = paymentMethod;
    }

    if (startDate || endDate) {
      where.expenseDate = {};
      if (startDate) where.expenseDate.gte = new Date(startDate);
      if (endDate) where.expenseDate.lte = new Date(endDate);
    }

    const [totalCount, expenses, totalSum] = await Promise.all([
      prisma.expense.count({ where }),
      prisma.expense.findMany({
        where,
        skip,
        take: limit,
        orderBy: { expenseDate: "desc" },
        include: {
          category: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      }),
      prisma.expense.aggregate({
        where: { tenantId },
        _sum: { amount: true },
      }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return paginatedResponse(
      expenses,
      {
        totalCount,
        currentPage: page,
        pageSize: limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      }
    );
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/accounting/expenses
 * Record a new institutional operational expense
 */
export async function POST(request: NextRequest) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { user, tenantId } = access.authContext;

    const bodyResult = await safeParseBody(request, createExpenseSchema);
    if (!bodyResult.success) return bodyResult.errorResponse;
    const data = bodyResult.data;

    // Verify category exists
    const category = await prisma.expenseCategory.findUnique({
      where: { id: data.categoryId, tenantId },
    });

    if (!category) {
      return badRequest("Selected expense category was not found.");
    }

    // Generate sequential expense voucher ID
    const currentYear = new Date(data.expenseDate).getFullYear();
    const latestExpense = await prisma.expense.findFirst({
      where: {
        tenantId,
        expenseNumber: { startsWith: `EXP-${currentYear}-` },
      },
      orderBy: { createdAt: "desc" },
    });

    let nextSequence = 1;
    if (latestExpense) {
      const parts = latestExpense.expenseNumber.split("-");
      const lastNum = parseInt(parts[2], 10);
      if (!isNaN(lastNum)) {
        nextSequence = lastNum + 1;
      }
    }

    const expenseNumber = `EXP-${currentYear}-${nextSequence.toString().padStart(5, "0")}`;

    const expense = await prisma.expense.create({
      data: {
        tenantId,
        expenseNumber,
        title: data.title,
        categoryId: data.categoryId,
        amount: data.amount,
        paymentMethod: data.paymentMethod,
        expenseDate: new Date(data.expenseDate),
        payeeName: data.payeeName,
        receiptNumber: data.receiptNumber,
        notes: data.notes,
        recordedById: user.id,
      },
      include: {
        category: true,
      },
    });

    // Log Audit Event
    await logAuditEvent({
      tenantId,
      userId: user.id,
      userEmail: user.email,
      action: "CREATE",
      entity: "Settings" as any,
      entityId: expense.id,
      details: {
        expenseNumber,
        title: data.title,
        amount: data.amount,
        category: category.name,
      },
    });

    return successResponse(expense, "Expense recorded successfully", 201);
  } catch (error) {
    return handleApiError(error);
  }
}
