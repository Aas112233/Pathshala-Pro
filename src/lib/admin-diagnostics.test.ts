import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  $transaction: vi.fn(),
  studentProfile: { count: vi.fn(), findMany: vi.fn() },
  feeVoucher: { count: vi.fn(), findMany: vi.fn() },
  class: { findMany: vi.fn() }, section: { findMany: vi.fn() }, group: { findMany: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
import { checkFeeBalance, diagnosticsQuerySchema, runAdminDiagnostics } from "./admin-diagnostics";

const input = { tenantId: "school-a", check: "placement" as const, page: 1, pageSize: 20, search: "" };
const student = { id: "s1", studentId: "ST-1", classId: "c1", sectionId: "sec1", groupId: "g1" };

beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation((fn) => fn(db));
  db.studentProfile.count.mockResolvedValue(1);
  db.studentProfile.findMany.mockResolvedValue([student]);
  db.class.findMany.mockResolvedValue([{ id: "c1" }]);
  db.section.findMany.mockResolvedValue([{ id: "sec1", classId: "c1", groupId: "g1" }]);
  db.group.findMany.mockResolvedValue([{ id: "g1", classId: "c1" }]);
});

describe("admin diagnostics", () => {
  it("checks consistent placement with every query scoped and bounded", async () => {
    const result = await runAdminDiagnostics(input);
    expect(result.rows).toEqual([{ id: "s1", reference: "ST-1", issues: [] }]);
    expect(result.totalCount).toBe(1);
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "RepeatableRead", timeout: 10000 });
    for (const mock of [db.studentProfile.count, db.studentProfile.findMany, db.class.findMany, db.section.findMany, db.group.findMany]) {
      expect(mock).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenantId: "school-a" }) }));
    }
    expect(db.studentProfile.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 0, take: 20, orderBy: { id: "asc" } }));
    expect(db.feeVoucher.findMany).not.toHaveBeenCalled();
  });

  it("reports missing tenant-owned dependencies without reading other tenants", async () => {
    db.class.findMany.mockResolvedValue([]);
    db.section.findMany.mockResolvedValue([]);
    db.group.findMany.mockResolvedValue([]);
    expect((await runAdminDiagnostics(input)).rows[0].issues).toEqual(["classMissing", "sectionMismatch", "groupMismatch"]);
  });

  it("reports section-group and group-class mismatches", async () => {
    db.section.findMany.mockResolvedValue([{ id: "sec1", classId: "c1", groupId: "other" }]);
    db.group.findMany.mockResolvedValue([{ id: "g1", classId: "other" }]);
    expect((await runAdminDiagnostics(input)).rows[0].issues).toEqual(["sectionMismatch", "groupMismatch"]);
  });

  it("allows schema-optional placement and class-wide sections", async () => {
    db.studentProfile.findMany.mockResolvedValue([{ ...student, classId: null, sectionId: null, groupId: null }]);
    expect((await runAdminDiagnostics(input)).rows[0].issues).toEqual([]);
    db.studentProfile.findMany.mockResolvedValue([student]);
    db.section.findMany.mockResolvedValue([{ id: "sec1", classId: "c1", groupId: null }]);
    expect((await runAdminDiagnostics(input)).rows[0].issues).toEqual([]);
  });

  it("pages fee records, searches references, and excludes voids", async () => {
    db.feeVoucher.count.mockResolvedValue(30);
    db.feeVoucher.findMany.mockResolvedValue([{ id: "v1", voucherId: "V-1", totalDue: 100, amountPaid: 30, balance: 80 }]);
    const result = await runAdminDiagnostics({ ...input, check: "fees", page: 2, search: "V-" });
    expect(result.rows[0].issues).toEqual(["feeBalance"]);
    expect(result.totalCount).toBe(30);
    expect(db.feeVoucher.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 20, take: 20,
      where: { tenantId: "school-a", voidedAt: null, status: { notIn: ["VOID", "VOIDED", "CANCELLED"] }, voucherId: { contains: "V-", mode: "insensitive" } } }));
    expect(db.studentProfile.findMany).not.toHaveBeenCalled();
  });

  it("returns an empty page without inventing findings", async () => {
    db.studentProfile.count.mockResolvedValue(0);
    db.studentProfile.findMany.mockResolvedValue([]);
    expect((await runAdminDiagnostics(input)).rows).toEqual([]);
  });

  it("rejects invalid scope before any database access", async () => {
    await expect(runAdminDiagnostics({ ...input, tenantId: "" })).rejects.toThrow();
    expect(db.$transaction).not.toHaveBeenCalled();
    for (const overrides of [{ page: 0 }, { page: 1.5 }, { pageSize: 1000 }, { check: "sql" }, { tenantId: " " }]) {
      expect(diagnosticsQuerySchema.safeParse({ ...input, ...overrides }).success).toBe(false);
    }
  });

  it("uses cents instead of binary float subtraction", () => {
    expect(checkFeeBalance({ totalDue: 0.3, amountPaid: 0.1, balance: 0.2 })).toEqual([]);
    expect(checkFeeBalance({ totalDue: 1, amountPaid: 0, balance: 0.99 })).toEqual(["feeBalance"]);
  });

  it.each([NaN, Infinity, -0.01, Number.MAX_VALUE])("flags invalid money: %s", (balance) => {
    expect(checkFeeBalance({ totalDue: 10, amountPaid: 0, balance })).toEqual(["invalidAmount"]);
  });
});
