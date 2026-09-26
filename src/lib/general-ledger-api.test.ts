// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

const db = vi.hoisted(() => ({
  journalEntry: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
  },
  chartOfAccount: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  fiscalYear: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
  },
  financialPeriod: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
  },
  auditLog: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  $transaction: vi.fn(),
  $queryRaw: vi.fn(),
  $executeRaw: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: db }));

vi.mock("@/lib/api-auth", () => ({
  requireApiAccess: vi.fn().mockResolvedValue({
    authContext: {
      tenantId: "school-gl",
      user: { id: "user-acc-1", email: "accountant@school.test", role: "ACCOUNTANT" },
    },
  }),
}));

import { GET as listJournalsRoute, POST as createJournalRoute } from "@/app/api/accounting/journals/route";
import { GET as getJournalByIdRoute } from "@/app/api/accounting/journals/[id]/route";
import { GET as getTrialBalanceRoute } from "@/app/api/accounting/trial-balance/route";
import { GET as getBalanceSheetRoute } from "@/app/api/accounting/balance-sheet/route";

const listJournals = listJournalsRoute as unknown as (request: NextRequest) => Promise<Response>;
const createJournal = createJournalRoute as unknown as (request: NextRequest) => Promise<Response>;
const getJournalById = getJournalByIdRoute as unknown as (request: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
const getTrialBalance = getTrialBalanceRoute as unknown as (request: NextRequest) => Promise<Response>;
const getBalanceSheet = getBalanceSheetRoute as unknown as (request: NextRequest) => Promise<Response>;

describe("General Ledger API Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.$transaction.mockImplementation((cb: (tx: any) => any) => cb(db));
  });

  describe("POST /api/accounting/journals", () => {
    it("creates a balanced manual journal entry successfully (201)", async () => {
      db.chartOfAccount.findMany.mockResolvedValue([
        { id: "acc-5010", code: "5010", name: "Printing Expense", accountType: "EXPENSE", isActive: true },
        { id: "acc-1010", code: "1010", name: "Cash Register", accountType: "ASSET", isActive: true },
      ]);
      db.fiscalYear.findFirst.mockResolvedValue({ id: "fy-2026", isClosed: false });
      db.financialPeriod.findFirst.mockResolvedValue({ id: "fp-2026-03", isClosed: false });
      db.journalEntry.findFirst.mockResolvedValue(null);
      db.auditLog.findFirst.mockResolvedValue(null);
      db.auditLog.create.mockResolvedValue({ id: "audit-1" });
      db.$queryRaw.mockResolvedValue([{ id: "seq-1", current_number: 10, prefix: "JV" }]);
      db.$executeRaw.mockResolvedValue(1);

      db.journalEntry.create.mockImplementation((args: any) => ({
        id: "jv-manual-1",
        entryNumber: args.data.entryNumber,
        ...args.data,
      }));

      const req = new NextRequest("http://localhost/api/accounting/journals", {
        method: "POST",
        body: JSON.stringify({
          voucherType: "JOURNAL",
          narration: "Purchase of exam answer sheets",
          reference: "INV-PAPER-01",
          lines: [
            { accountCode: "5010", side: "DEBIT", amount: 250.0 },
            { accountCode: "1010", side: "CREDIT", amount: 250.0 },
          ],
        }),
      });

      const res = await createJournal(req);
      const json = await res.json();

      expect(res.status).toBe(201);
      expect(json.success).toBe(true);
      expect(json.data.journalId).toBe("jv-manual-1");
      expect(db.journalEntry.create).toHaveBeenCalled();
    });

    it("rejects an unbalanced journal entry with 400 Bad Request", async () => {
      const req = new NextRequest("http://localhost/api/accounting/journals", {
        method: "POST",
        body: JSON.stringify({
          narration: "Unbalanced manual entry attempt",
          lines: [
            { accountCode: "5010", side: "DEBIT", amount: 250.0 },
            { accountCode: "1010", side: "CREDIT", amount: 200.0 },
          ],
        }),
      });

      const res = await createJournal(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe(true);
      expect(json.message).toMatch(/Double-entry imbalance/);
    });

    it("rejects a journal entry with fewer than 2 lines with 422 Validation Error", async () => {
      const req = new NextRequest("http://localhost/api/accounting/journals", {
        method: "POST",
        body: JSON.stringify({
          narration: "Single line entry",
          lines: [
            { accountCode: "5010", side: "DEBIT", amount: 250.0 },
          ],
        }),
      });

      const res = await createJournal(req);
      const json = await res.json();

      expect(res.status).toBe(422);
      expect(json.error).toBe(true);
      expect(json.message).toMatch(/Validation failed/);
    });
  });

  describe("GET /api/accounting/journals", () => {
    it("returns paginated list of journals with line items", async () => {
      db.journalEntry.count.mockResolvedValue(1);
      db.journalEntry.findMany.mockResolvedValue([
        {
          id: "jv-1",
          entryNumber: "JV-2026-000001",
          voucherType: "JOURNAL",
          postingDate: new Date("2026-03-01"),
          narration: "Test journal",
          totalDebit: "100.00",
          totalCredit: "100.00",
          lineItems: [],
        },
      ]);

      const req = new NextRequest("http://localhost/api/accounting/journals?page=1&limit=10");
      const res = await listJournals(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.length).toBe(1);
      expect(json.pagination.totalCount).toBe(1);
    });
  });

  describe("GET /api/accounting/journals/[id]", () => {
    it("returns a specific journal entry by id", async () => {
      db.journalEntry.findFirst.mockResolvedValue({
        id: "jv-101",
        entryNumber: "JV-2026-000101",
        narration: "Office supplies payment",
        lineItems: [
          { id: "line-1", debitAmount: "100.00", creditAmount: "0.00", account: { code: "5010", name: "Supplies" } },
          { id: "line-2", debitAmount: "0.00", creditAmount: "100.00", account: { code: "1010", name: "Cash" } },
        ],
      });

      const req = new NextRequest("http://localhost/api/accounting/journals/jv-101");
      const res = await getJournalById(req, { params: Promise.resolve({ id: "jv-101" }) });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.id).toBe("jv-101");
      expect(json.data.lineItems.length).toBe(2);
    });

    it("returns 404 when journal is not found", async () => {
      db.journalEntry.findFirst.mockResolvedValue(null);

      const req = new NextRequest("http://localhost/api/accounting/journals/non-existent");
      const res = await getJournalById(req, { params: Promise.resolve({ id: "non-existent" }) });

      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/accounting/trial-balance", () => {
    it("computes and returns trial balance report", async () => {
      db.chartOfAccount.findMany.mockResolvedValue([
        {
          id: "acc-1",
          code: "1010",
          name: "Cash",
          accountType: "ASSET",
          normalBalance: "DEBIT",
          isActive: true,
          journalLines: [{ debitAmount: new Prisma.Decimal(500), creditAmount: new Prisma.Decimal(0) }],
        },
        {
          id: "acc-2",
          code: "4010",
          name: "Fees",
          accountType: "REVENUE",
          normalBalance: "CREDIT",
          isActive: true,
          journalLines: [{ debitAmount: new Prisma.Decimal(0), creditAmount: new Prisma.Decimal(500) }],
        },
      ]);

      const req = new NextRequest("http://localhost/api/accounting/trial-balance");
      const res = await getTrialBalance(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.isBalanced).toBe(true);
      expect(json.data.totalDebit).toBe("500.00");
      expect(json.data.totalCredit).toBe("500.00");
    });
  });

  describe("GET /api/accounting/balance-sheet", () => {
    it("computes and returns balance sheet report verifying A = L + E", async () => {
      db.fiscalYear.findFirst.mockResolvedValue({
        id: "fy-2026",
        startDate: new Date("2026-01-01"),
      });

      db.chartOfAccount.findMany.mockImplementation((query: any) => {
        const types = query.where.accountType?.in || [];
        const all = [
          {
            id: "acc-1010",
            code: "1010",
            name: "Cash",
            accountType: "ASSET",
            isActive: true,
            journalLines: [{ debitAmount: new Prisma.Decimal(1000), creditAmount: new Prisma.Decimal(0) }],
          },
          {
            id: "acc-3010",
            code: "3010",
            name: "Capital",
            accountType: "EQUITY",
            isActive: true,
            journalLines: [{ debitAmount: new Prisma.Decimal(0), creditAmount: new Prisma.Decimal(1000) }],
          },
          {
            id: "acc-4010",
            code: "4010",
            name: "Fees",
            accountType: "REVENUE",
            isActive: true,
            journalLines: [],
          },
          {
            id: "acc-5010",
            code: "5010",
            name: "Salaries",
            accountType: "EXPENSE",
            isActive: true,
            journalLines: [],
          },
        ];
        return all.filter((a) => types.includes(a.accountType));
      });

      const req = new NextRequest("http://localhost/api/accounting/balance-sheet?asOfDate=2026-12-31");
      const res = await getBalanceSheet(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.isBalanced).toBe(true);
      expect(json.data.totalAssets).toBe("1000.00");
      expect(json.data.totalLiabilitiesAndEquity).toBe("1000.00");
    });
  });
});
