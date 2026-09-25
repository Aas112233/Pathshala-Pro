import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/api-auth", () => ({ requireApiAccess: auth.requireApiAccess }));
vi.mock("@/lib/academic-year-guards", () => ({
  assertAcademicYearsOpen: guards.assertAcademicYearsOpen,
}));

const db = vi.hoisted(() => ({
  feeVoucher: { findMany: vi.fn() },
  chartOfAccount: { findMany: vi.fn() },
  journalEntry: { create: vi.fn() },
  feeVoucherOverride: {} as Record<string, unknown>,
  $transaction: vi.fn(),
}));

const tx = vi.hoisted(() => ({
  chartOfAccount: { findMany: vi.fn() },
  journalEntry: { create: vi.fn() },
  feeVoucher: { update: vi.fn() },
  $queryRaw: vi.fn(),
  tenantVoucherSequence: { upsert: vi.fn() },
  auditLog: { create: vi.fn() },
}));

const auth = vi.hoisted(() => ({ requireApiAccess: vi.fn() }));
const guards = vi.hoisted(() => ({ assertAcademicYearsOpen: vi.fn() }));
const audit = vi.hoisted(() => ({ logAuditEvent: vi.fn() }));

vi.mock("@/lib/audit-logger", () => ({ logAuditEvent: audit.logAuditEvent }));

import { POST as POST_ROUTE } from "@/app/api/academic-years/[id]/write-off-sweep/route";

const POST = POST_ROUTE as unknown as (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => Promise<Response>;

function post(body: unknown, id = "ay-2025") {
  return {
    request: { json: async () => body } as unknown as NextRequest,
    context: { params: Promise.resolve({ id }) },
  };
}

// ---------------------------------------------------------------------------

const VOUCHER = {
  id: "v-1",
  voucherId: "FV-000001",
  studentProfileId: "sp-1",
  feeType: "TUITION",
  billingMonth: 3,
  status: "OVERDUE",
  balance: 1500,
  studentProfile: { firstName: "Ayaan", lastName: "Rahman" },
};

const ACCOUNTS = [
  { code: "1030", id: "acc-ar" },
  { code: "5070", id: "acc-write-off" },
];

beforeEach(() => {
  vi.clearAllMocks();

  auth.requireApiAccess.mockResolvedValue({
    authContext: { tenantId: "tenant-1", user: { id: "user-1" } },
  });
  guards.assertAcademicYearsOpen.mockResolvedValue(undefined);
  db.feeVoucher.findMany.mockResolvedValue([VOUCHER]);
  db.$transaction.mockImplementation(async (fn: (client: unknown) => unknown) => fn(tx));

  tx.chartOfAccount.findMany.mockResolvedValue(ACCOUNTS);
  tx.$queryRaw.mockResolvedValue([
    { id: "v-1", balance: 1500, totalDue: 1500, amountPaid: 0 },
  ]);
  tx.journalEntry.create.mockResolvedValue({ id: "journal-1" });
  tx.tenantVoucherSequence.upsert.mockResolvedValue({ lastNumber: 1 });
  audit.logAuditEvent.mockResolvedValue(undefined);
});

describe("the outstanding-fee sweep", () => {
  it("is gated on the waiver-approval permission, not on generic write access", async () => {
    await POST(post({ dryRun: true }).request, post({}).context);

    expect(auth.requireApiAccess).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ permission: "fees:waiver:approve" })
    );
  });

  it("refuses to touch a closed year before it reads anything", async () => {
    guards.assertAcademicYearsOpen.mockRejectedValue(new Error("closed"));

    const res = await POST(post({ dryRun: true }).request, post({}).context);

    expect(res.status).toBeGreaterThanOrEqual(400);
    // The guard runs before the loader, so a closed year leaks nothing.
    expect(db.feeVoucher.findMany).not.toHaveBeenCalled();
  });

  it("returns the plan and writes nothing on a dry run", async () => {
    const res = await POST(post({ dryRun: true }).request, post({}).context);
    const json = await res.json();

    expect(json.data.dryRun).toBe(true);
    expect(json.data.plan.canProceed).toBe(true);
    expect(json.data.plan.counts.written).toBe(1);
    expect(json.data.plan.total).toBe(1500);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("posts one balanced journal per voucher and brings the balance down", async () => {
    const res = await POST(post({}).request, post({}).context);
    const json = await res.json();

    expect(json.data.application.writtenCount).toBe(1);
    expect(json.data.application.total).toBe(1500);

    // Prisma's create is called with `{ data }`, so the entry sits one level down.
    const entry = tx.journalEntry.create.mock.calls[0][0].data;
    expect(entry.totalDebit.toFixed(2)).toBe(entry.totalCredit.toFixed(2));
    const [debit, credit] = entry.lineItems.create;
    expect(debit.accountId).toBe("acc-write-off");
    expect(credit.accountId).toBe("acc-ar");
    expect(tx.feeVoucher.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "v-1" },
        data: expect.objectContaining({ status: "PAID" }),
      })
    );
  });

  it("audits the sweep inside the same transaction", async () => {
    await POST(post({ reason: "Year-end disposal" }).request, post({}).context);

    expect(audit.logAuditEvent).toHaveBeenCalledTimes(1);
    const [event, client] = audit.logAuditEvent.mock.calls[0];
    expect(event.action).toBe("WRITE_OFF");
    expect(event.entity).toBe("AcademicYear");
    expect(event.details).toMatchObject({
      vouchers: 1,
      total: 1500,
      students: 1,
      reason: "Year-end disposal",
    });
    expect(client).toBe(tx);
  });

  it("refuses to post when the write-off expense account is not configured", async () => {
    tx.chartOfAccount.findMany.mockResolvedValue([{ code: "1030", id: "acc-ar" }]);

    const res = await POST(post({}).request, post({}).context);
    const json = await res.json();

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(tx.journalEntry.create).not.toHaveBeenCalled();
    // ApiError serialises as `{ error: true, message }`, not `{ error: { message } }`.
    expect(json.error).toBe(true);
    expect(json.message).toContain("not configured");
  });

  it("writes the lesser of the approved figure and what is actually owed", async () => {
    // A payment landed between the preview and the confirm, so the voucher now
    // owes less than the plan said. Over-writing it would clear debt that was
    // actually paid.
    tx.$queryRaw.mockResolvedValue([
      { id: "v-1", balance: 400, totalDue: 1500, amountPaid: 1100 },
    ]);

    await POST(post({}).request, post({}).context);

    const entry = tx.journalEntry.create.mock.calls[0][0].data;
    expect(entry.totalDebit.toFixed(2)).toBe("400.00");
    expect(tx.feeVoucher.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "PAID" }),
      })
    );
  });

  it("reports a blocked plan with 200 and writes nothing", async () => {
    db.feeVoucher.findMany.mockResolvedValue([]);

    const res = await POST(post({}).request, post({}).context);
    const json = await res.json();

    expect(json.data.blocked).toBe(true);
    expect(json.data.plan.canProceed).toBe(false);
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});
