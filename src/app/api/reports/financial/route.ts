import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { getAuthContext } from "@/lib/auth";
import { forbidden, handleApiError, successResponse } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const authContext = await getAuthContext(request);
    if (!authContext) {
      return forbidden();
    }

    const { user } = authContext;
    const searchParams = request.nextUrl.searchParams;
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");
    const categoryId = searchParams.get("categoryId");
    const paymentMethod = searchParams.get("paymentMethod");

    const expenseWhere: Prisma.ExpenseWhereInput = {
      tenantId: user.tenantId,
    };
    const txWhere: Prisma.TransactionWhereInput = {
      tenantId: user.tenantId,
    };

    if (fromDate || toDate) {
      const dateFilter: Prisma.DateTimeFilter = {};
      if (fromDate) dateFilter.gte = new Date(fromDate);
      if (toDate) dateFilter.lte = new Date(toDate);

      expenseWhere.expenseDate = dateFilter;
      txWhere.timestamp = dateFilter;
    }

    if (categoryId && categoryId !== "all") {
      expenseWhere.categoryId = categoryId;
    }
    if (paymentMethod && paymentMethod !== "all") {
      expenseWhere.paymentMethod = paymentMethod;
    }

    const [expenses, txAggregate] = await Promise.all([
      prisma.expense.findMany({
        where: expenseWhere,
        include: {
          category: {
            select: {
              name: true,
              code: true,
            },
          },
          recordedBy: {
            select: {
              name: true,
            },
          },
        },
        orderBy: { expenseDate: "desc" },
      }),
      prisma.transaction.aggregate({
        where: txWhere,
        _sum: {
          amountPaid: true,
        },
      }),
    ]);

    let totalExpenses = 0;
    let cashExpense = 0;
    let bankExpense = 0;
    const categoryMap = new Map<string, number>();

    const transformedExpenses = expenses.map((e) => {
      totalExpenses += e.amount;
      if (e.paymentMethod === "CASH") {
        cashExpense += e.amount;
      } else {
        bankExpense += e.amount;
      }

      const catName = e.category?.name || "Uncategorized";
      categoryMap.set(catName, (categoryMap.get(catName) || 0) + e.amount);

      return {
        id: e.id,
        expenseNumber: e.expenseNumber,
        title: e.title,
        category: catName,
        categoryCode: e.category?.code || "",
        amount: e.amount,
        paymentMethod: e.paymentMethod,
        expenseDate: e.expenseDate.toISOString(),
        payeeName: e.payeeName || "N/A",
        receiptNumber: e.receiptNumber || "N/A",
        notes: e.notes || "",
        recordedByName: e.recordedBy?.name || "System",
      };
    });

    const totalIncome = txAggregate._sum.amountPaid || 0;
    const netBalance = totalIncome - totalExpenses;

    const categoryBreakdown = Array.from(categoryMap.entries()).map(([category, amount]) => ({
      category,
      amount,
      percentage: totalExpenses > 0 ? Math.round((amount / totalExpenses) * 100) : 0,
    }));

    // Find top category
    let topExpenseCategory = "None";
    let maxExpense = 0;
    categoryMap.forEach((amt, cat) => {
      if (amt > maxExpense) {
        maxExpense = amt;
        topExpenseCategory = cat;
      }
    });

    return successResponse({
      metrics: {
        totalIncome,
        totalExpenses,
        netBalance,
        cashExpense,
        bankExpense,
        topExpenseCategory,
        expenseCount: expenses.length,
      },
      categoryBreakdown,
      records: transformedExpenses,
    });
  } catch (error) {
    return handleApiError(error, "Failed to generate financial expenses report");
  }
}
