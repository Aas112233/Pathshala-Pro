import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  handleApiError,
} from "@/lib/api-response";
import { requireApiAccess } from "@/lib/api-auth";

/**
 * GET /api/accounting/profit-loss
 * Computes institutional Income vs Expenses, Net Surplus, and Category Breakdowns
 */
export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;

    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get("year");
    const currentYear = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();

    const startOfYear = new Date(currentYear, 0, 1);
    const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59);

    // 1. Fetch all payment receipts in this year
    const transactions = await prisma.transaction.findMany({
      where: {
        tenantId,
        timestamp: { gte: startOfYear, lte: endOfYear },
      },
      include: {
        feeVoucher: {
          select: { feeType: true },
        },
      },
    });

    // 2. Fetch all staff salary payments in this year
    const salaryLedgers = await prisma.salaryLedger.findMany({
      where: {
        tenantId,
        year: currentYear,
        status: { in: ["PAID", "PARTIAL"] },
      },
    });

    // 3. Fetch all operational expenses in this year
    const expenses = await prisma.expense.findMany({
      where: {
        tenantId,
        expenseDate: { gte: startOfYear, lte: endOfYear },
      },
      include: {
        category: {
          select: { name: true, code: true },
        },
      },
    });

    // Income breakdown by Fee Type
    let totalFeeRevenue = 0;
    const incomeByType: Record<string, number> = {};

    transactions.forEach((tx) => {
      totalFeeRevenue += tx.amountPaid;
      const type = tx.feeVoucher?.feeType || "TUITION";
      incomeByType[type] = (incomeByType[type] || 0) + tx.amountPaid;
    });

    // Payroll expenses
    const totalPayrollPaid = salaryLedgers.reduce((acc, s) => acc + (s.paidAmount || s.baseSalary || 0), 0);

    // Operational expenses breakdown by Category
    let totalOperationalExpenses = 0;
    const expenseByCategory: Record<string, number> = {};

    expenses.forEach((exp) => {
      totalOperationalExpenses += exp.amount;
      const catName = exp.category?.name || "General Expenses";
      expenseByCategory[catName] = (expenseByCategory[catName] || 0) + exp.amount;
    });

    const totalExpenses = totalPayrollPaid + totalOperationalExpenses;
    const netSurplus = totalFeeRevenue - totalExpenses;
    const profitMargin = totalFeeRevenue > 0 ? Number(((netSurplus / totalFeeRevenue) * 100).toFixed(1)) : 0;

    // Monthly Trend Map (Jan - Dec)
    const monthlyTrends = Array.from({ length: 12 }, (_, i) => {
      const monthNum = i + 1;
      const monthName = new Date(currentYear, i, 1).toLocaleString("en", { month: "short" });

      // Incomes in this month
      const monthIncome = transactions
        .filter((tx) => new Date(tx.timestamp).getMonth() === i)
        .reduce((sum, tx) => sum + tx.amountPaid, 0);

      // Salaries in this month
      const monthSalary = salaryLedgers
        .filter((s) => s.month === monthNum)
        .reduce((sum, s) => sum + (s.paidAmount || s.baseSalary || 0), 0);

      // Expenses in this month
      const monthExp = expenses
        .filter((e) => new Date(e.expenseDate).getMonth() === i)
        .reduce((sum, e) => sum + e.amount, 0);

      const monthTotalExp = monthSalary + monthExp;
      const monthNet = monthIncome - monthTotalExp;

      return {
        month: monthName,
        monthIndex: monthNum,
        income: monthIncome,
        expenses: monthTotalExp,
        payroll: monthSalary,
        operational: monthExp,
        netSurplus: monthNet,
      };
    });

    return successResponse(
      {
        fiscalYear: currentYear,
        summary: {
          totalIncome: totalFeeRevenue,
          totalExpenses,
          payrollExpenses: totalPayrollPaid,
          operationalExpenses: totalOperationalExpenses,
          netSurplus,
          profitMargin,
          isProfit: netSurplus >= 0,
        },
        incomeBreakdown: Object.entries(incomeByType).map(([type, amount]) => ({
          type,
          amount,
          percentage: totalFeeRevenue > 0 ? Number(((amount / totalFeeRevenue) * 100).toFixed(1)) : 0,
        })),
        expenseBreakdown: Object.entries(expenseByCategory).map(([category, amount]) => ({
          category,
          amount,
          percentage: totalOperationalExpenses > 0 ? Number(((amount / totalOperationalExpenses) * 100).toFixed(1)) : 0,
        })),
        monthlyTrends,
      },
      "Profit & Loss statement generated successfully"
    );
  } catch (error) {
    return handleApiError(error);
  }
}
