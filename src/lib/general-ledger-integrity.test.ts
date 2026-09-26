import { describe, it, expect, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { postDoubleEntryJournal } from "@/lib/accounting-engine";
import { getNextVoucherNumber } from "@/lib/accounting-sequence";
import { postCashDeposit } from "@/lib/fee-service";
import { resolveOpenPeriod } from "@/lib/period-closing";

describe("General Ledger & Double-Entry Integrity", () => {
  const tenantId = "tenant-gl-01";

  const mockChartOfAccounts = [
    { id: "acc-1010", code: "1010", name: "Cash on Hand", accountType: "ASSET", isActive: true },
    { id: "acc-1020", code: "1020", name: "Main Bank Account", accountType: "ASSET", isActive: true },
    { id: "acc-1030", code: "1030", name: "Accounts Receivable", accountType: "ASSET", isActive: true },
    { id: "acc-2010", code: "2010", name: "Accounts Payable", accountType: "LIABILITY", isActive: true },
    { id: "acc-2020", code: "2020", name: "Salary Payable", accountType: "LIABILITY", isActive: true },
    { id: "acc-3010", code: "3010", name: "Capital", accountType: "EQUITY", isActive: true },
    { id: "acc-4010", code: "4010", name: "Tuition Revenue", accountType: "REVENUE", isActive: true },
    { id: "acc-5010", code: "5010", name: "Office Supplies", accountType: "EXPENSE", isActive: true },
  ];

  describe("postDoubleEntryJournal - Fiscal Period Linkage & Verification", () => {
    it("attaches fiscalYearId and financialPeriodId when posting into an open period", async () => {
      let createdJournalData: any = null;

      const mockTx: any = {
        fiscalYear: {
          findFirst: vi.fn().mockResolvedValue({
            id: "fy-2026",
            isClosed: false,
          }),
        },
        financialPeriod: {
          findFirst: vi.fn().mockResolvedValue({
            id: "fp-2026-03",
            isClosed: false,
          }),
        },
        chartOfAccount: {
          findMany: vi.fn().mockResolvedValue(mockChartOfAccounts),
        },
        journalEntry: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockImplementation((args) => {
            createdJournalData = args.data;
            return {
              id: "jv-test-1",
              entryNumber: args.data.entryNumber,
            };
          }),
        },
        auditLog: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({ id: "audit-1" }),
        },
      };

      const result = await postDoubleEntryJournal(mockTx, {
        tenantId,
        voucherType: "JOURNAL",
        reference: "ADJ-2026-001",
        narration: "Adjustment entry for office supplies",
        postingDate: new Date("2026-03-15"),
        lines: [
          { accountCode: "5010", side: "DEBIT", amount: new Prisma.Decimal("150.00") },
          { accountCode: "1010", side: "CREDIT", amount: new Prisma.Decimal("150.00") },
        ],
      });

      expect(result.journalId).toBe("jv-test-1");
      expect(createdJournalData).toBeDefined();
      expect(createdJournalData.fiscalYearId).toBe("fy-2026");
      expect(createdJournalData.financialPeriodId).toBe("fp-2026-03");
      expect(createdJournalData.reference).toBe("ADJ-2026-001");
      expect(createdJournalData.totalDebit.toString()).toBe("150");
      expect(createdJournalData.totalCredit.toString()).toBe("150");
    });

    it("rejects posting when the fiscal year is closed", async () => {
      const mockTx: any = {
        fiscalYear: {
          findFirst: vi.fn().mockResolvedValue({
            id: "fy-2025",
            isClosed: true,
          }),
        },
        financialPeriod: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
        chartOfAccount: {
          findMany: vi.fn().mockResolvedValue(mockChartOfAccounts),
        },
        journalEntry: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      };

      await expect(
        postDoubleEntryJournal(mockTx, {
          tenantId,
          voucherType: "JOURNAL",
          reference: "CLOSED-POST-1",
          narration: "Attempting to post to closed year",
          postingDate: new Date("2025-12-15"),
          lines: [
            { accountCode: "5010", side: "DEBIT", amount: new Prisma.Decimal("100.00") },
            { accountCode: "1010", side: "CREDIT", amount: new Prisma.Decimal("100.00") },
          ],
        })
      ).rejects.toThrow(/Fiscal year is closed/);
    });

    it("rejects posting when the financial period is closed", async () => {
      const mockTx: any = {
        fiscalYear: {
          findFirst: vi.fn().mockResolvedValue({
            id: "fy-2026",
            isClosed: false,
          }),
        },
        financialPeriod: {
          findFirst: vi.fn().mockResolvedValue({
            id: "fp-2026-01",
            isClosed: true,
          }),
        },
        chartOfAccount: {
          findMany: vi.fn().mockResolvedValue(mockChartOfAccounts),
        },
        journalEntry: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      };

      await expect(
        postDoubleEntryJournal(mockTx, {
          tenantId,
          voucherType: "JOURNAL",
          reference: "CLOSED-PERIOD-1",
          narration: "Attempting to post to closed period",
          postingDate: new Date("2026-01-15"),
          lines: [
            { accountCode: "5010", side: "DEBIT", amount: new Prisma.Decimal("100.00") },
            { accountCode: "1010", side: "CREDIT", amount: new Prisma.Decimal("100.00") },
          ],
        })
      ).rejects.toThrow(/Financial period is closed/);
    });

    it("enforces idempotency via idempotencyKey without creating duplicate journals", async () => {
      const mockTx: any = {
        journalEntry: {
          findFirst: vi.fn().mockResolvedValue({
            id: "jv-existing-99",
            entryNumber: "JV-2026-000099",
            reference: "idem-key-abc",
          }),
        },
        chartOfAccount: {
          findMany: vi.fn(),
        },
      };

      const result = await postDoubleEntryJournal(mockTx, {
        tenantId,
        voucherType: "JOURNAL",
        reference: "ORIGINAL-REF-1",
        narration: "Duplicate idempotent call",
        idempotencyKey: "idem-key-abc",
        lines: [
          { accountCode: "5010", side: "DEBIT", amount: new Prisma.Decimal("50.00") },
          { accountCode: "1010", side: "CREDIT", amount: new Prisma.Decimal("50.00") },
        ],
      });

      expect(result.journalId).toBe("jv-existing-99");
      expect(result.entryNumber).toBe("JV-2026-000099");
      // DB create must NOT have been called
      expect(mockTx.chartOfAccount.findMany).not.toHaveBeenCalled();
    });

    it("rejects unbalanced journals (debit != credit)", async () => {
      const mockTx: any = {};

      await expect(
        postDoubleEntryJournal(mockTx, {
          tenantId,
          voucherType: "JOURNAL",
          reference: "UNBALANCED-1",
          narration: "Unbalanced journal test",
          lines: [
            { accountCode: "5010", side: "DEBIT", amount: new Prisma.Decimal("100.00") },
            { accountCode: "1010", side: "CREDIT", amount: new Prisma.Decimal("90.00") },
          ],
        })
      ).rejects.toThrow(/Double-entry imbalance/);
    });
  });

  describe("getNextVoucherNumber - Custom Prefix & Fiscal Year Handling", () => {
    it("respects sequence table custom prefix when locked row has customized prefix", async () => {
      const mockTx: any = {
        $queryRaw: vi.fn().mockResolvedValue([
          { id: "seq-1", current_number: 42, prefix: "REC-CUSTOM" },
        ]),
        $executeRaw: vi.fn().mockResolvedValue(1),
      };

      const voucherNumber = await getNextVoucherNumber(mockTx, tenantId, "RECEIPT", 2026);
      expect(voucherNumber).toBe("REC-CUSTOM-2026-000043");
    });

    it("calculates fiscal year using tenant.fiscalYearStart if omitted", async () => {
      const mockTx: any = {
        tenant: {
          findUnique: vi.fn().mockResolvedValue({
            fiscalYearStart: 7, // July
          }),
        },
        $queryRaw: vi.fn().mockImplementation((query) => {
          return [{ id: "seq-2", current_number: 10, prefix: "JV" }];
        }),
        $executeRaw: vi.fn().mockResolvedValue(1),
      };

      const voucherNumber = await getNextVoucherNumber(mockTx, tenantId, "JOURNAL");
      expect(voucherNumber).toMatch(/^JV-\d{4}-000011$/);
    });
  });

  describe("postCashDeposit - Posting Date & Period Validation", () => {
    it("passes postingDate to resolveOpenPeriod and journalEntry", async () => {
      let createdJournal: any = null;

      const mockTx: any = {
        chartOfAccount: {
          findMany: vi.fn().mockResolvedValue([
            { id: "acc-1010", code: "1010" },
            { id: "acc-1020", code: "1020" },
          ]),
        },
        fiscalYear: {
          findFirst: vi.fn().mockResolvedValue({ id: "fy-2026", isClosed: false }),
        },
        financialPeriod: {
          findFirst: vi.fn().mockResolvedValue({ id: "fp-2026-02", isClosed: false }),
        },
        journalEntry: {
          create: vi.fn().mockImplementation((args) => {
            createdJournal = args.data;
            return { id: "jv-deposit-1" };
          }),
        },
        bankAccount: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
      };

      const targetDate = new Date("2026-02-20");
      const result = await postCashDeposit(mockTx, {
        tenantId,
        fromCode: "1010",
        toCode: "1020",
        amount: 5000,
        executedById: "user-cashier-1",
        note: "Daily cash vault deposit",
        postingDate: targetDate,
      });

      expect(result.journalEntryId).toBe("jv-deposit-1");
      expect(createdJournal.postingDate).toEqual(targetDate);
      expect(createdJournal.fiscalYearId).toBe("fy-2026");
      expect(createdJournal.financialPeriodId).toBe("fp-2026-02");
    });
  });
});
