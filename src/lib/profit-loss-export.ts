import { addCurrency, roundCurrency, safePercentage } from "@/lib/math-utils";

/**
 * Row-builder for the Profit & Loss statement export.
 *
 * PDF and Excel both render from this one function so the two files can never
 * disagree about a figure, and so the printed section subtotals are the same
 * integer-cent sums the API returned rather than a re-derived float.
 */

export interface ProfitLossExportSummary {
  totalIncome: number;
  totalExpenses: number;
  payrollExpenses: number;
  operationalExpenses: number;
  netSurplus: number;
  profitMargin: number;
}

export interface ProfitLossExportInput {
  summary: ProfitLossExportSummary;
  incomeBreakdown: Array<{ type: string; amount: number; percentage?: number }>;
  expenseBreakdown: Array<{ category: string; amount: number; percentage?: number }>;
  /** Localized section and total labels, so exports honour the 4-locale rule. */
  labels: {
    revenue: string;
    expenses: string;
    payroll: string;
    totalRevenue: string;
    totalExpenses: string;
    netSurplus: string;
    netDeficit: string;
    section: string;
    lineItem: string;
    amount: string;
    share: string;
  };
}

export interface ProfitLossStatementRow extends Record<string, string | number> {
  section: string;
  lineItem: string;
  amount: number;
  share: string;
  /** "total" rows are emphasised by the renderers. */
  kind: "line" | "total" | "net";
}

/**
 * Build an ordered P&L statement: revenue lines, revenue subtotal, expense
 * lines (payroll first — it is the largest and is not an `Expense` row),
 * expense subtotal, then the net result.
 */
export function buildProfitLossStatement(input: ProfitLossExportInput): ProfitLossStatementRow[] {
  const { summary, incomeBreakdown, expenseBreakdown, labels } = input;
  const rows: ProfitLossStatementRow[] = [];

  const share = (amount: number, base: number) =>
    base > 0 ? `${safePercentage(amount, base, 1).toFixed(1)}%` : "—";

  for (const income of incomeBreakdown) {
    rows.push({
      section: labels.revenue,
      lineItem: income.type,
      amount: roundCurrency(income.amount),
      share: share(income.amount, summary.totalIncome),
      kind: "line",
    });
  }
  rows.push({
    section: labels.revenue,
    lineItem: labels.totalRevenue,
    amount: roundCurrency(summary.totalIncome),
    share: summary.totalIncome > 0 ? "100.0%" : "—",
    kind: "total",
  });

  if (summary.payrollExpenses > 0 || expenseBreakdown.length === 0) {
    rows.push({
      section: labels.expenses,
      lineItem: labels.payroll,
      amount: roundCurrency(summary.payrollExpenses),
      share: share(summary.payrollExpenses, summary.totalExpenses),
      kind: "line",
    });
  }
  for (const expense of expenseBreakdown) {
    rows.push({
      section: labels.expenses,
      lineItem: expense.category,
      amount: roundCurrency(expense.amount),
      share: share(expense.amount, summary.totalExpenses),
      kind: "line",
    });
  }
  rows.push({
    section: labels.expenses,
    lineItem: labels.totalExpenses,
    amount: roundCurrency(summary.totalExpenses),
    share: summary.totalExpenses > 0 ? "100.0%" : "—",
    kind: "total",
  });

  rows.push({
    section: "",
    lineItem: summary.netSurplus >= 0 ? labels.netSurplus : labels.netDeficit,
    amount: roundCurrency(summary.netSurplus),
    share: `${summary.profitMargin.toFixed(1)}%`,
    kind: "net",
  });

  return rows;
}

/**
 * Re-add the statement's own line items and assert they reconcile with the
 * summary the API reported. A statement whose sections do not sum to their
 * printed subtotal must not be exported at all — silently shipping one is how
 * an unbalanced report reaches a trustee.
 */
export function assertProfitLossReconciles(input: ProfitLossExportInput): void {
  const { summary, incomeBreakdown, expenseBreakdown } = input;

  const incomeSum = incomeBreakdown.reduce((sum, row) => addCurrency(sum, row.amount), 0);
  if (roundCurrency(incomeSum) !== roundCurrency(summary.totalIncome)) {
    throw new Error(
      `P&L revenue lines sum to ${incomeSum.toFixed(2)} but total revenue is ${summary.totalIncome.toFixed(2)}`,
    );
  }

  const expenseSum = expenseBreakdown.reduce(
    (sum, row) => addCurrency(sum, row.amount),
    roundCurrency(summary.payrollExpenses),
  );
  if (roundCurrency(expenseSum) !== roundCurrency(summary.totalExpenses)) {
    throw new Error(
      `P&L expense lines sum to ${expenseSum.toFixed(2)} but total expenses is ${summary.totalExpenses.toFixed(2)}`,
    );
  }

  const net = roundCurrency(summary.totalIncome - summary.totalExpenses);
  if (net !== roundCurrency(summary.netSurplus)) {
    throw new Error(
      `P&L net surplus ${summary.netSurplus.toFixed(2)} does not equal revenue minus expenses (${net.toFixed(2)})`,
    );
  }
}
