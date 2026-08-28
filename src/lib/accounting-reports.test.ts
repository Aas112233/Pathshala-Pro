import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import {
  generateTrialBalanceReport,
  generateProfitAndLossReport,
  generateBalanceSheetReport,
} from "@/lib/financial-reports";
import { closeFiscalYear } from "@/lib/period-closing";

describe("General Ledger Reporting & Fiscal Period Closing", () => {
  const mockChartOfAccounts = [
    // Assets (1000s)
    {
      id: "acc-bank",
      code: "1010",
      name: "Main Bank Account",
      accountType: "ASSET",
      normalBalance: "DEBIT",
      isActive: true,
      journalLines: [
        { debitAmount: new Prisma.Decimal(100000), creditAmount: new Prisma.Decimal(20000) }, // Net Dr. 80,000
      ],
    },
    {
      id: "acc-ar",
      code: "1030",
      name: "Accounts Receivable",
      accountType: "ASSET",
      normalBalance: "DEBIT",
      isActive: true,
      journalLines: [
        { debitAmount: new Prisma.Decimal(50000), creditAmount: new Prisma.Decimal(30000) }, // Net Dr. 20,000
      ],
    },
    // Liabilities (2000s)
    {
      id: "acc-ap",
      code: "2010",
      name: "Accounts Payable",
      accountType: "LIABILITY",
      normalBalance: "CREDIT",
      isActive: true,
      journalLines: [
        { debitAmount: new Prisma.Decimal(5000), creditAmount: new Prisma.Decimal(25000) }, // Net Cr. 20,000
      ],
    },
    // Equity (3000s)
    {
      id: "acc-equity",
      code: "3010",
      name: "Initial Capital",
      accountType: "EQUITY",
      normalBalance: "CREDIT",
      isActive: true,
      journalLines: [
        { debitAmount: new Prisma.Decimal(0), creditAmount: new Prisma.Decimal(50000) }, // Net Cr. 50,000
      ],
    },
    {
      id: "acc-retained",
      code: "3020",
      name: "Retained Earnings",
      accountType: "EQUITY",
      normalBalance: "CREDIT",
      isActive: true,
      journalLines: [],
    },
    // Revenues (4000s)
    {
      id: "acc-tuition",
      code: "4010",
      name: "Tuition Fee Revenue",
      accountType: "REVENUE",
      normalBalance: "CREDIT",
      isActive: true,
      journalLines: [
        { debitAmount: new Prisma.Decimal(0), creditAmount: new Prisma.Decimal(60000) }, // Net Cr. 60,000
      ],
    },
    // Expenses (5000s)
    {
      id: "acc-salaries",
      code: "5010",
      name: "Teacher Salary Expense",
      accountType: "EXPENSE",
      normalBalance: "DEBIT",
      isActive: true,
      journalLines: [
        { debitAmount: new Prisma.Decimal(30000), creditAmount: new Prisma.Decimal(0) }, // Net Dr. 30,000
      ],
    },
  ];

  describe("Trial Balance Report", () => {
    it("generates a balanced trial balance where sum(Debit) === sum(Credit)", async () => {
      const mockTx: any = {
        chartOfAccount: {
          findMany: async () => mockChartOfAccounts,
        },
      };

      const tb = await generateTrialBalanceReport(mockTx, {
        tenantId: "school-01",
        endDate: new Date("2026-12-31"),
      });

      expect(tb.isBalanced).toBe(true);
      expect(tb.totalDebit).toBe("185000.00");
      expect(tb.totalCredit).toBe("185000.00");
    });
  });

  describe("Profit & Loss Statement", () => {
    it("computes operating revenue, operating expenses, and net surplus correctly", async () => {
      const mockTx: any = {
        chartOfAccount: {
          findMany: async () =>
            mockChartOfAccounts.filter((a) => a.accountType === "REVENUE" || a.accountType === "EXPENSE"),
        },
      };

      const pnl = await generateProfitAndLossReport(mockTx, {
        tenantId: "school-01",
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-12-31"),
      });

      expect(pnl.totalRevenue).toBe("60000.00");
      expect(pnl.totalExpense).toBe("30000.00");
      expect(pnl.netSurplus).toBe("30000.00");
    });
  });

  describe("Balance Sheet Report", () => {
    it("verifies the Fundamental Accounting Equation: Assets === Liabilities + Equity", async () => {
      const mockTx: any = {
        chartOfAccount: {
          findMany: async (query: any) => {
            const types = query.where.accountType?.in || [];
            return mockChartOfAccounts.filter((a) => types.includes(a.accountType));
          },
        },
      };

      const bs = await generateBalanceSheetReport(mockTx, {
        tenantId: "school-01",
        asOfDate: new Date("2026-12-31"),
        fiscalYearStartDate: new Date("2026-01-01"),
      });

      // Assets: Bank (80,000) + AR (20,000) = 100,000
      expect(bs.totalAssets).toBe("100000.00");
      // Liabilities: AP (20,000)
      expect(bs.totalLiabilities).toBe("20000.00");
      // Equity: Capital (50,000) + Current Surplus (30,000) = 80,000
      expect(bs.totalEquity).toBe("80000.00");
      // Liabilities + Equity = 100,000
      expect(bs.totalLiabilitiesAndEquity).toBe("100000.00");
      expect(bs.isBalanced).toBe(true);
    });
  });

  describe("Fiscal Year Closing Engine", () => {
    it("rolls forward net profit to Retained Earnings and locks the fiscal year", async () => {
      const createdJournals: any[] = [];
      const updatedFiscalYears: any[] = [];

      const mockTx: any = {
        $queryRaw: async () => [{ id: "seq-close", current_number: 1 }],
        $executeRaw: async () => 1,
        fiscalYear: {
          findUnique: async () => ({
            id: "fy-2026",
            tenantId: "school-01",
            name: "FY 2025-2026",
            startDate: new Date("2025-07-01"),
            endDate: new Date("2026-06-30"),
            isClosed: false,
            periods: [],
          }),
          update: async (payload: any) => {
            updatedFiscalYears.push(payload.data);
            return { id: "fy-2026", ...payload.data };
          },
        },
        financialPeriod: {
          updateMany: async () => ({ count: 12 }),
        },
        chartOfAccount: {
          findUnique: async () => ({
            id: "acc-retained-db",
            code: "3020",
            name: "Retained Earnings",
          }),
          findMany: async () =>
            mockChartOfAccounts.filter((a) => a.accountType === "REVENUE" || a.accountType === "EXPENSE"),
        },
        journalEntry: {
          create: async (payload: any) => {
            createdJournals.push(payload.data);
            return { id: "jv-closing-1", ...payload.data };
          },
        },
      };

      const result = await closeFiscalYear(mockTx, {
        tenantId: "school-01",
        fiscalYearId: "fy-2026",
        closedById: "user-cfo-1",
      });

      expect(result.netSurplus).toBe("30000.00");
      expect(result.isClosed).toBe(true);

      // Verify Closing Journal Entry is Balanced
      const jv = createdJournals[0];
      expect(jv.voucherType).toBe("CLOSING");
      expect(jv.totalDebit.equals(jv.totalCredit)).toBe(true);
      expect(jv.totalDebit.toString()).toBe("60000");
    });
  });
});
