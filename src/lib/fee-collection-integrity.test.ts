import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST as postCollectDirect } from "@/app/api/fees/collect-direct/route";
import { POST as postBulkCollect } from "@/app/api/fees/bulk-collect/route";

const db = vi.hoisted(() => ({
  studentProfile: { findUnique: vi.fn(), findMany: vi.fn() },
  academicYear: { findFirst: vi.fn(), findUnique: vi.fn() },
  class: { findFirst: vi.fn() },
  section: { findFirst: vi.fn() },
  feeVoucher: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  classFeeStructure: { findFirst: vi.fn() },
  studentFeeConcession: { findMany: vi.fn() },
  transaction: { create: vi.fn() },
  chartOfAccount: { findMany: vi.fn(), findFirst: vi.fn() },
  feeHead: { findUnique: vi.fn() },
  journalEntry: { create: vi.fn() },
  tenant: { findUnique: vi.fn() },
  $transaction: vi.fn(),
  $queryRaw: vi.fn(),
  $executeRaw: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/api-auth", () => ({
  requireApiAccess: vi.fn().mockResolvedValue({
    authContext: { user: { id: "user-cashier-1", role: "ADMIN" }, tenantId: "tenant-test" },
  }),
}));
vi.mock("@/lib/rate-limit", () => ({
  smartRateLimitAsync: vi.fn().mockResolvedValue({ success: true }),
  dedupeRequestAsync: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/lib/accounting-sequence", () => ({
  getNextVoucherNumber: vi.fn().mockResolvedValue("REC-2026-000123"),
}));

describe("Fee Collection & POS Duplicate Prevention Audit Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    db.academicYear.findFirst.mockResolvedValue({ id: "ay-2026", label: "2026-2027", isClosed: false });
    db.academicYear.findUnique.mockResolvedValue({ id: "ay-2026", label: "2026-2027" });
    db.studentProfile.findUnique.mockResolvedValue({
      id: "student-1",
      firstName: "Rahim",
      lastName: "Uddin",
      classId: "class-9",
    });
    db.classFeeStructure.findFirst.mockResolvedValue({
      tuitionFee: 1000,
      totalMonthlyFee: 1000,
      isActive: true,
    });
    db.studentFeeConcession.findMany.mockResolvedValue([]);
    db.chartOfAccount.findMany.mockResolvedValue([
      { id: "acc-cash", code: "1020", isActive: true },
      { id: "acc-ar", code: "1030", isActive: true },
      { id: "acc-rev", code: "4010", isActive: true },
    ]);
    db.chartOfAccount.findFirst.mockResolvedValue({ id: "acc-rev", code: "4010", isActive: true });
    db.journalEntry.create.mockResolvedValue({ id: "jv-1" });
    db.transaction.create.mockResolvedValue({ id: "tx-1", transactionId: "TXN-REC-2026-000123" });
    db.feeVoucher.create.mockResolvedValue({
      id: "vouch-new",
      voucherId: "SAL-2026-000123",
      status: "PAID",
      balance: 0,
    });
    db.tenant.findUnique.mockResolvedValue({ featureFlags: {} });
    db.$transaction.mockImplementation(async (cb: any) => cb(db));
  });

  describe("POST /api/fees/collect-direct (POS Cashier)", () => {
    it("rejects payment when an explicit feeVoucherId is already PAID", async () => {
      db.feeVoucher.findUnique.mockResolvedValueOnce({
        id: "vouch-paid",
        voucherId: "VOUCH-PAID-01",
        status: "PAID",
        balance: 0,
        totalDue: 1000,
      });

      const req = new NextRequest("http://localhost:3000/api/fees/collect-direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentProfileId: "student-1",
          feeVoucherId: "vouch-paid",
          amountPaid: 1000,
          paymentMethod: "CASH",
        }),
      });

      const res = (await postCollectDirect(req))!;
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.message).toContain("already paid in full");
      expect(json.message).toContain("Duplicate payment rejected");
    });

    it("rejects payment when student already has a PAID voucher for the requested month", async () => {
      db.feeVoucher.findFirst.mockResolvedValueOnce({
        id: "vouch-sep-paid",
        voucherId: "SAL-2026-SEP",
        status: "PAID",
        balance: 0,
        totalDue: 1000,
      });

      const req = new NextRequest("http://localhost:3000/api/fees/collect-direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentProfileId: "student-1",
          billingMonth: 9, // September
          billingYear: 2026,
          amountPaid: 1000,
          paymentMethod: "CASH",
        }),
      });

      const res = (await postCollectDirect(req))!;
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.message).toContain("September 2026 has already been paid in full");
      expect(json.message).toContain("Duplicate payment rejected");
    });

    it("rejects overpayment beyond voucher balance unless allowAdvanceToWallet is enabled", async () => {
      db.feeVoucher.findUnique.mockResolvedValueOnce({
        id: "vouch-part",
        voucherId: "VOUCH-PART-01",
        status: "PARTIAL",
        balance: 400,
        totalDue: 1000,
      });

      const req = new NextRequest("http://localhost:3000/api/fees/collect-direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentProfileId: "student-1",
          feeVoucherId: "vouch-part",
          amountPaid: 600, // Exceeds balance of 400
          paymentMethod: "CASH",
          allowAdvanceToWallet: false,
        }),
      });

      const res = (await postCollectDirect(req))!;
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.message).toContain("exceeds voucher balance due");
    });

    it("allows paying remaining balance on a PARTIAL voucher and marks it PAID", async () => {
      db.feeVoucher.findUnique.mockResolvedValueOnce({
        id: "vouch-partial",
        voucherId: "SAL-2026-PART",
        status: "PARTIAL",
        balance: 400,
        totalDue: 1000,
      });

      db.$queryRaw.mockResolvedValueOnce([
        {
          id: "vouch-partial",
          totalDue: 1000,
          amountPaid: 600,
          voucherId: "SAL-2026-PART",
          feeType: "TUITION",
          billingMonth: 9,
          billingYear: 2026,
        },
      ]);

      const req = new NextRequest("http://localhost:3000/api/fees/collect-direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentProfileId: "student-1",
          feeVoucherId: "vouch-partial",
          amountPaid: 400, // Exactly remaining balance
          paymentMethod: "CASH",
        }),
      });

      const res = (await postCollectDirect(req))!;
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(db.feeVoucher.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "vouch-partial" },
          data: expect.objectContaining({
            status: "PAID",
            balance: 0,
          }),
        })
      );
    });

    it("successfully collects payments for multiple selected months in a single transaction", async () => {
      db.feeVoucher.findMany.mockResolvedValueOnce([]); // No existing vouchers for target months

      const req = new NextRequest("http://localhost:3000/api/fees/collect-direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentProfileId: "student-1",
          billingMonths: [9, 10], // September and October (2 months)
          billingYear: 2026,
          amountPaid: 2000, // $1,000 * 2
          paymentMethod: "CASH",
        }),
      });

      const res = (await postCollectDirect(req))!;
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(db.feeVoucher.create).toHaveBeenCalledTimes(2);
      expect(db.transaction.create).toHaveBeenCalledTimes(2);
    });
  });

  describe("POST /api/fees/bulk-collect (Bulk Entry)", () => {
    beforeEach(() => {
      db.class.findFirst.mockResolvedValue({ id: "class-9", name: "Class 9" });
      db.studentProfile.findMany.mockImplementation(async (args: any) => {
        const ids = args?.where?.id?.in || [];
        const all = [
          { id: "st-1", firstName: "Ali", lastName: "Khan", studentId: "ST-01" },
          { id: "st-2", firstName: "Sara", lastName: "Ahmed", studentId: "ST-02" },
        ];
        return all.filter((s) => ids.includes(s.id));
      });
    });

    it("rejects bulk collection for a student who already cleared the target month", async () => {
      db.feeVoucher.findMany.mockResolvedValueOnce([
        {
          id: "v-sep-paid",
          voucherId: "SAL-2026-001",
          studentProfileId: "st-1",
          billingMonth: 9,
          billingYear: 2026,
          status: "PAID",
          balance: 0,
          totalDue: 1000,
          amountPaid: 1000,
          feeType: "TUITION",
        },
      ]);

      const req = new NextRequest("http://localhost:3000/api/fees/bulk-collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          academicYearId: "ay-2026",
          classId: "class-9",
          month: 9,
          year: 2026,
          paymentMethod: "CASH",
          payments: [
            { studentProfileId: "st-1", amountPaid: 1000 },
          ],
        }),
      });

      const res = (await postBulkCollect(req))!;
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.message).toContain("Ali Khan has already paid fees for September 2026");
      expect(json.message).toContain("Duplicate payment rejected");
    });

    it("allows paying month 9 even when earlier months have not been paid (non-sequential collection)", async () => {
      // No existing voucher for month 9
      db.feeVoucher.findMany.mockResolvedValueOnce([]);

      const req = new NextRequest("http://localhost:3000/api/fees/bulk-collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          academicYearId: "ay-2026",
          classId: "class-9",
          month: 9,
          year: 2026,
          paymentMethod: "CASH",
          payments: [
            { studentProfileId: "st-2", amountPaid: 1000 },
          ],
        }),
      });

      const res = (await postBulkCollect(req))!;
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(db.feeVoucher.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            billingMonth: 9,
            billingYear: 2026,
            feeType: "TUITION",
            totalDue: 1000,
            amountPaid: 1000,
            status: "PAID",
          }),
        })
      );
    });

    it("identifies and blocks the batch when one student among multiple has already paid", async () => {
      db.feeVoucher.findMany.mockResolvedValueOnce([
        {
          id: "v-st2-paid",
          voucherId: "SAL-2026-002",
          studentProfileId: "st-2",
          billingMonth: 9,
          billingYear: 2026,
          status: "PAID",
          balance: 0,
          totalDue: 1000,
          amountPaid: 1000,
          feeType: "TUITION",
        },
      ]);

      const req = new NextRequest("http://localhost:3000/api/fees/bulk-collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          academicYearId: "ay-2026",
          classId: "class-9",
          month: 9,
          year: 2026,
          paymentMethod: "CASH",
          payments: [
            { studentProfileId: "st-1", amountPaid: 1000 },
            { studentProfileId: "st-2", amountPaid: 1000 },
          ],
        }),
      });

      const res = (await postBulkCollect(req))!;
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.message).toContain("Sara Ahmed has already paid fees for September 2026");
      expect(json.message).toContain("Duplicate payment rejected");
    });
  });
});
