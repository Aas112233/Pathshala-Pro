import { Prisma } from "@prisma/client";
import { getNextVoucherNumber } from "@/lib/accounting-sequence";

export interface CloseFiscalPeriodParams {
  tenantId: string;
  fiscalYearId: string;
  financialPeriodId: string;
  closedById: string;
}

export interface CloseFiscalYearParams {
  tenantId: string;
  fiscalYearId: string;
  retainedEarningsAccountCode?: string; // Default: "3020"
  closedById: string;
}

export interface FiscalYearCloseResult {
  fiscalYearId: string;
  closingVoucherNumber: string;
  totalRevenue: string;
  totalExpense: string;
  netSurplus: string;
  retainedEarningsAccountId: string;
  journalEntryId: string;
  isClosed: boolean;
}

/**
 * Validates whether a transaction is attempting to post into a closed fiscal year or period.
 */
export async function validateFiscalPeriodOpen(
  tx: Prisma.TransactionClient,
  tenantId: string,
  postingDate: Date
): Promise<void> {
  const closedYear = await tx.fiscalYear.findFirst({
    where: {
      tenantId,
      isClosed: true,
      startDate: { lte: postingDate },
      endDate: { gte: postingDate },
    },
  });

  if (closedYear) {
    throw new Error(
      `Cannot post transactions into closed fiscal year '${closedYear.name}' (Date: ${postingDate.toISOString().slice(0, 10)})`
    );
  }

  const closedPeriod = await tx.financialPeriod.findFirst({
    where: {
      tenantId,
      isClosed: true,
      startDate: { lte: postingDate },
      endDate: { gte: postingDate },
    },
  });

  if (closedPeriod) {
    throw new Error(
      `Cannot post transactions into closed financial period '${closedPeriod.name}' (Date: ${postingDate.toISOString().slice(0, 10)})`
    );
  }
}

/**
 * Closes an individual financial monthly period.
 */
export async function closeFinancialPeriod(
  tx: Prisma.TransactionClient,
  params: CloseFiscalPeriodParams
) {
  const { tenantId, fiscalYearId, financialPeriodId } = params;

  const period = await tx.financialPeriod.findUnique({
    where: { id: financialPeriodId },
  });

  if (!period || period.tenantId !== tenantId || period.fiscalYearId !== fiscalYearId) {
    throw new Error("Financial period not found or tenant mismatch.");
  }

  if (period.isClosed) {
    throw new Error(`Financial period '${period.name}' is already closed.`);
  }

  return tx.financialPeriod.update({
    where: { id: financialPeriodId },
    data: {
      isClosed: true,
      closedAt: new Date(),
    },
  });
}

/**
 * Automated Annual Year-End P&L Close & Retained Earnings Roll-Forward:
 * 1. Sums all posted revenues and expenses for the fiscal year.
 * 2. Generates a balanced CLOSING journal voucher (`JV-YYYY-XXXXXX`):
 *    - Debit each Revenue account with its net credit balance (zeroing it).
 *    - Credit each Expense account with its net debit balance (zeroing it).
 *    - Routes net profit/surplus to Equity / Retained Earnings (3020).
 * 3. Sets `isClosed = true` on the FiscalYear and all underlying FinancialPeriods.
 */
export async function closeFiscalYear(
  tx: Prisma.TransactionClient,
  params: CloseFiscalYearParams
): Promise<FiscalYearCloseResult> {
  const {
    tenantId,
    fiscalYearId,
    retainedEarningsAccountCode = "3020",
    closedById,
  } = params;

  const fiscalYear = await tx.fiscalYear.findUnique({
    where: { id: fiscalYearId },
    include: { periods: true },
  });

  if (!fiscalYear || fiscalYear.tenantId !== tenantId) {
    throw new Error("Fiscal year not found or tenant mismatch.");
  }

  if (fiscalYear.isClosed) {
    throw new Error(`Fiscal year '${fiscalYear.name}' is already closed.`);
  }

  // 1. Fetch Retained Earnings account
  const retainedEarningsAccount = await tx.chartOfAccount.findUnique({
    where: {
      tenantId_code: {
        tenantId,
        code: retainedEarningsAccountCode,
      },
    },
  });

  if (!retainedEarningsAccount) {
    throw new Error(
      `Retained Earnings account with code '${retainedEarningsAccountCode}' not found in Chart of Accounts.`
    );
  }

  // 2. Fetch all revenue & expense accounts and compute cumulative activity in the fiscal year
  const accounts = await tx.chartOfAccount.findMany({
    where: {
      tenantId,
      accountType: { in: ["REVENUE", "EXPENSE"] },
      isActive: true,
    },
    include: {
      journalLines: {
        where: {
          journalEntry: {
            tenantId,
            postingStatus: "POSTED",
            postingDate: {
              gte: fiscalYear.startDate,
              lte: fiscalYear.endDate,
            },
          },
        },
      },
    },
  });

  let totalRevenue = new Prisma.Decimal(0);
  let totalExpense = new Prisma.Decimal(0);

  const closingLines: Array<{
    tenantId: string;
    accountId: string;
    debitAmount: Prisma.Decimal;
    creditAmount: Prisma.Decimal;
    narration: string;
  }> = [];

  for (const acc of accounts) {
    const sumDebit = acc.journalLines.reduce(
      (accSum, line) => accSum.plus(line.debitAmount),
      new Prisma.Decimal(0)
    );
    const sumCredit = acc.journalLines.reduce(
      (accSum, line) => accSum.plus(line.creditAmount),
      new Prisma.Decimal(0)
    );

    if (acc.accountType === "REVENUE") {
      // Net Revenue Balance = Credit - Debit
      const netRev = sumCredit.minus(sumDebit);
      if (!netRev.isZero()) {
        totalRevenue = totalRevenue.plus(netRev);
        // To zero out Revenue: Debit it
        closingLines.push({
          tenantId,
          accountId: acc.id,
          debitAmount: netRev,
          creditAmount: new Prisma.Decimal(0),
          narration: `Zero-out Revenue account '${acc.name}' for year-end close`,
        });
      }
    } else if (acc.accountType === "EXPENSE") {
      // Net Expense Balance = Debit - Credit
      const netExp = sumDebit.minus(sumCredit);
      if (!netExp.isZero()) {
        totalExpense = totalExpense.plus(netExp);
        // To zero out Expense: Credit it
        closingLines.push({
          tenantId,
          accountId: acc.id,
          debitAmount: new Prisma.Decimal(0),
          creditAmount: netExp,
          narration: `Zero-out Expense account '${acc.name}' for year-end close`,
        });
      }
    }
  }

  const netSurplus = totalRevenue.minus(totalExpense);

  // Transfer Net Surplus / Deficit to Retained Earnings
  if (netSurplus.greaterThan(0)) {
    // Profit: Credit Retained Earnings
    closingLines.push({
      tenantId,
      accountId: retainedEarningsAccount.id,
      debitAmount: new Prisma.Decimal(0),
      creditAmount: netSurplus,
      narration: `Transfer net operating surplus to Retained Earnings (${fiscalYear.name})`,
    });
  } else if (netSurplus.lessThan(0)) {
    // Loss: Debit Retained Earnings
    closingLines.push({
      tenantId,
      accountId: retainedEarningsAccount.id,
      debitAmount: netSurplus.abs(),
      creditAmount: new Prisma.Decimal(0),
      narration: `Transfer net operating deficit to Retained Earnings (${fiscalYear.name})`,
    });
  }

  const fiscalYearNumber = fiscalYear.endDate.getFullYear();
  const voucherNumber = await getNextVoucherNumber(tx, tenantId, "CLOSING", fiscalYearNumber);

  // 3. Post the Closing Journal Entry
  const totalDebitClosing = closingLines.reduce(
    (sum, line) => sum.plus(line.debitAmount),
    new Prisma.Decimal(0)
  );
  const totalCreditClosing = closingLines.reduce(
    (sum, line) => sum.plus(line.creditAmount),
    new Prisma.Decimal(0)
  );

  if (!totalDebitClosing.equals(totalCreditClosing)) {
    throw new Error(
      `Year-end closing journal is not balanced! Total Debit: ${totalDebitClosing.toString()}, Total Credit: ${totalCreditClosing.toString()}`
    );
  }

  const closingJournal = await tx.journalEntry.create({
    data: {
      tenantId,
      entryNumber: voucherNumber,
      voucherType: "CLOSING",
      postingStatus: "POSTED",
      postingDate: fiscalYear.endDate,
      narration: `Annual Fiscal Year-End Closing Entry for ${fiscalYear.name}`,
      reference: `CLOSE-${fiscalYear.id}`,
      fiscalYearId: fiscalYear.id,
      totalDebit: totalDebitClosing,
      totalCredit: totalCreditClosing,
      createdById: closedById,
      lineItems: {
        create: closingLines,
      },
    },
  });

  // 4. Lock the Fiscal Year and all Monthly Periods
  await tx.fiscalYear.update({
    where: { id: fiscalYearId },
    data: {
      isClosed: true,
      closedAt: new Date(),
      closedById,
    },
  });

  await tx.financialPeriod.updateMany({
    where: { tenantId, fiscalYearId },
    data: {
      isClosed: true,
      closedAt: new Date(),
    },
  });

  return {
    fiscalYearId,
    closingVoucherNumber: voucherNumber,
    totalRevenue: totalRevenue.toFixed(2),
    totalExpense: totalExpense.toFixed(2),
    netSurplus: netSurplus.toFixed(2),
    retainedEarningsAccountId: retainedEarningsAccount.id,
    journalEntryId: closingJournal.id,
    isClosed: true,
  };
}
