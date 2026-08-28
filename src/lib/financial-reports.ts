import { Prisma } from "@prisma/client";

export interface DateRangeFilter {
  tenantId: string;
  startDate?: Date;
  endDate?: Date;
}

export interface TrialBalanceItem {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  normalBalance: string;
  totalDebit: string;
  totalCredit: string;
  netDebit: string;
  netCredit: string;
}

export interface TrialBalanceReport {
  tenantId: string;
  asOfDate: Date;
  items: TrialBalanceItem[];
  totalDebit: string;
  totalCredit: string;
  isBalanced: boolean;
}

export interface ProfitAndLossReport {
  tenantId: string;
  startDate: Date;
  endDate: Date;
  revenues: Array<{ accountCode: string; accountName: string; amount: string }>;
  totalRevenue: string;
  expenses: Array<{ accountCode: string; accountName: string; amount: string }>;
  totalExpense: string;
  netSurplus: string; // Net Profit / (Loss)
}

export interface BalanceSheetReport {
  tenantId: string;
  asOfDate: Date;
  assets: Array<{ accountCode: string; accountName: string; amount: string }>;
  totalAssets: string;
  liabilities: Array<{ accountCode: string; accountName: string; amount: string }>;
  totalLiabilities: string;
  equity: Array<{ accountCode: string; accountName: string; amount: string }>;
  currentPeriodSurplus: string;
  totalEquity: string;
  totalLiabilitiesAndEquity: string;
  isBalanced: boolean; // Assets === Liabilities + Equity
}

/**
 * 1. Generates a Trial Balance report verifying sum(Debits) === sum(Credits).
 */
export async function generateTrialBalanceReport(
  tx: Prisma.TransactionClient,
  params: DateRangeFilter
): Promise<TrialBalanceReport> {
  const { tenantId, startDate, endDate = new Date() } = params;

  const accounts = await tx.chartOfAccount.findMany({
    where: { tenantId, isActive: true },
    orderBy: { code: "asc" },
    include: {
      journalLines: {
        where: {
          journalEntry: {
            tenantId,
            postingStatus: "POSTED",
            postingDate: {
              ...(startDate ? { gte: startDate } : {}),
              lte: endDate,
            },
          },
        },
      },
    },
  });

  let grandDebit = new Prisma.Decimal(0);
  let grandCredit = new Prisma.Decimal(0);

  const items: TrialBalanceItem[] = [];

  for (const acc of accounts) {
    const sumDebit = acc.journalLines.reduce(
      (sum, line) => sum.plus(line.debitAmount),
      new Prisma.Decimal(0)
    );
    const sumCredit = acc.journalLines.reduce(
      (sum, line) => sum.plus(line.creditAmount),
      new Prisma.Decimal(0)
    );

    if (sumDebit.isZero() && sumCredit.isZero()) continue;

    grandDebit = grandDebit.plus(sumDebit);
    grandCredit = grandCredit.plus(sumCredit);

    let netDebit = new Prisma.Decimal(0);
    let netCredit = new Prisma.Decimal(0);

    if (sumDebit.greaterThan(sumCredit)) {
      netDebit = sumDebit.minus(sumCredit);
    } else {
      netCredit = sumCredit.minus(sumDebit);
    }

    items.push({
      accountId: acc.id,
      accountCode: acc.code,
      accountName: acc.name,
      accountType: acc.accountType,
      normalBalance: acc.normalBalance,
      totalDebit: sumDebit.toFixed(2),
      totalCredit: sumCredit.toFixed(2),
      netDebit: netDebit.toFixed(2),
      netCredit: netCredit.toFixed(2),
    });
  }

  return {
    tenantId,
    asOfDate: endDate,
    items,
    totalDebit: grandDebit.toFixed(2),
    totalCredit: grandCredit.toFixed(2),
    isBalanced: grandDebit.equals(grandCredit),
  };
}

/**
 * 2. Generates an Income Statement / Profit & Loss (P&L) Report.
 */
export async function generateProfitAndLossReport(
  tx: Prisma.TransactionClient,
  params: { tenantId: string; startDate: Date; endDate: Date }
): Promise<ProfitAndLossReport> {
  const { tenantId, startDate, endDate } = params;

  const accounts = await tx.chartOfAccount.findMany({
    where: {
      tenantId,
      accountType: { in: ["REVENUE", "EXPENSE"] },
      isActive: true,
    },
    orderBy: { code: "asc" },
    include: {
      journalLines: {
        where: {
          journalEntry: {
            tenantId,
            postingStatus: "POSTED",
            voucherType: { not: "CLOSING" }, // Exclude year-end closing transfers
            postingDate: {
              gte: startDate,
              lte: endDate,
            },
          },
        },
      },
    },
  });

  const revenues: Array<{ accountCode: string; accountName: string; amount: string }> = [];
  const expenses: Array<{ accountCode: string; accountName: string; amount: string }> = [];

  let totalRevenue = new Prisma.Decimal(0);
  let totalExpense = new Prisma.Decimal(0);

  for (const acc of accounts) {
    const sumDebit = acc.journalLines.reduce((sum, l) => sum.plus(l.debitAmount), new Prisma.Decimal(0));
    const sumCredit = acc.journalLines.reduce((sum, l) => sum.plus(l.creditAmount), new Prisma.Decimal(0));

    if (acc.accountType === "REVENUE") {
      const netRev = sumCredit.minus(sumDebit);
      if (!netRev.isZero()) {
        totalRevenue = totalRevenue.plus(netRev);
        revenues.push({
          accountCode: acc.code,
          accountName: acc.name,
          amount: netRev.toFixed(2),
        });
      }
    } else if (acc.accountType === "EXPENSE") {
      const netExp = sumDebit.minus(sumCredit);
      if (!netExp.isZero()) {
        totalExpense = totalExpense.plus(netExp);
        expenses.push({
          accountCode: acc.code,
          accountName: acc.name,
          amount: netExp.toFixed(2),
        });
      }
    }
  }

  const netSurplus = totalRevenue.minus(totalExpense);

  return {
    tenantId,
    startDate,
    endDate,
    revenues,
    totalRevenue: totalRevenue.toFixed(2),
    expenses,
    totalExpense: totalExpense.toFixed(2),
    netSurplus: netSurplus.toFixed(2),
  };
}

/**
 * 3. Generates a Balance Sheet Report: Assets === Liabilities + Equity.
 */
export async function generateBalanceSheetReport(
  tx: Prisma.TransactionClient,
  params: { tenantId: string; asOfDate: Date; fiscalYearStartDate: Date }
): Promise<BalanceSheetReport> {
  const { tenantId, asOfDate, fiscalYearStartDate } = params;

  const accounts = await tx.chartOfAccount.findMany({
    where: {
      tenantId,
      accountType: { in: ["ASSET", "LIABILITY", "EQUITY"] },
      isActive: true,
    },
    orderBy: { code: "asc" },
    include: {
      journalLines: {
        where: {
          journalEntry: {
            tenantId,
            postingStatus: "POSTED",
            postingDate: { lte: asOfDate },
          },
        },
      },
    },
  });

  const assets: Array<{ accountCode: string; accountName: string; amount: string }> = [];
  const liabilities: Array<{ accountCode: string; accountName: string; amount: string }> = [];
  const equity: Array<{ accountCode: string; accountName: string; amount: string }> = [];

  let totalAssets = new Prisma.Decimal(0);
  let totalLiabilities = new Prisma.Decimal(0);
  let totalEquity = new Prisma.Decimal(0);

  for (const acc of accounts) {
    const sumDebit = acc.journalLines.reduce((sum, l) => sum.plus(l.debitAmount), new Prisma.Decimal(0));
    const sumCredit = acc.journalLines.reduce((sum, l) => sum.plus(l.creditAmount), new Prisma.Decimal(0));

    if (acc.accountType === "ASSET") {
      const netAsset = sumDebit.minus(sumCredit);
      if (!netAsset.isZero()) {
        totalAssets = totalAssets.plus(netAsset);
        assets.push({ accountCode: acc.code, accountName: acc.name, amount: netAsset.toFixed(2) });
      }
    } else if (acc.accountType === "LIABILITY") {
      const netLiab = sumCredit.minus(sumDebit);
      if (!netLiab.isZero()) {
        totalLiabilities = totalLiabilities.plus(netLiab);
        liabilities.push({ accountCode: acc.code, accountName: acc.name, amount: netLiab.toFixed(2) });
      }
    } else if (acc.accountType === "EQUITY") {
      const netEq = sumCredit.minus(sumDebit);
      if (!netEq.isZero()) {
        totalEquity = totalEquity.plus(netEq);
        equity.push({ accountCode: acc.code, accountName: acc.name, amount: netEq.toFixed(2) });
      }
    }
  }

  // Calculate unclosed current year profit to roll into Equity
  const pnl = await generateProfitAndLossReport(tx, {
    tenantId,
    startDate: fiscalYearStartDate,
    endDate: asOfDate,
  });
  const currentPeriodSurplus = new Prisma.Decimal(pnl.netSurplus);
  totalEquity = totalEquity.plus(currentPeriodSurplus);

  const totalLiabilitiesAndEquity = totalLiabilities.plus(totalEquity);

  return {
    tenantId,
    asOfDate,
    assets,
    totalAssets: totalAssets.toFixed(2),
    liabilities,
    totalLiabilities: totalLiabilities.toFixed(2),
    equity,
    currentPeriodSurplus: currentPeriodSurplus.toFixed(2),
    totalEquity: totalEquity.toFixed(2),
    totalLiabilitiesAndEquity: totalLiabilitiesAndEquity.toFixed(2),
    isBalanced: totalAssets.equals(totalLiabilitiesAndEquity),
  };
}
