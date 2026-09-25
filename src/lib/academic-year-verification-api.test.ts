import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/api-auth", () => ({ requireApiAccess: auth.requireApiAccess }));

const db = vi.hoisted(() => ({
  academicYear: { findFirst: vi.fn() },
  academicYearRollover: { findFirst: vi.fn() },
  promotionRule: { groupBy: vi.fn() },
  classFeeStructure: { count: vi.fn() },
  timetable: { count: vi.fn() },
  studentAcademicSession: { count: vi.fn() },
}));

const auth = vi.hoisted(() => ({ requireApiAccess: vi.fn() }));

import { GET as GET_ROUTE } from "@/app/api/academic-years/[id]/rollover-verification/route";

const GET = GET_ROUTE as unknown as (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => Promise<Response>;

function get(id = "ay-2026") {
  return { request: {} as NextRequest, context: { params: Promise.resolve({ id }) } };
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.requireApiAccess.mockResolvedValue({
    authContext: { tenantId: "tenant-1", user: { id: "user-1" } },
  });
  db.academicYear.findFirst.mockResolvedValue({
    id: "ay-2026",
    label: "2026-2027",
    isClosed: false,
    nonWorkingWeekdays: [5, 6],
    feeBalancePolicy: "CARRY_BALANCE",
    isCurrent: false,
  });
  db.academicYearRollover.findFirst.mockResolvedValue({
    mode: "CREATE",
    copyPromotionRules: true,
    copyFeeStructures: true,
    copyTimetables: true,
    feeBalancePolicy: "CARRY_BALANCE",
    workingDayPolicyCarried: true,
  });
  db.promotionRule.groupBy.mockResolvedValue([
    { isActive: true, _count: { _all: 3 } },
  ]);
  db.classFeeStructure.count.mockResolvedValue(3);
  db.timetable.count.mockImplementation(async ({ where }: { where: { needsReview: boolean } }) =>
    where.needsReview ? 0 : 24
  );
  db.studentAcademicSession.count.mockResolvedValue(120);
});

describe("the post-rollover verification endpoint", () => {
  it("reads only, and never mutates", async () => {
    const res = await GET(get().request, get().context);

    expect(res.status).toBe(200);
    // Every Prisma call the route makes is a read. If a write ever appears
    // here, the checklist has become a form, and a form can be submitted
    // without being read.
    expect(db.academicYear.findFirst).toHaveBeenCalled();
    expect(db.promotionRule.groupBy).toHaveBeenCalled();
  });

  it("derives the checklist from the year's actual state", async () => {
    const res = await GET(get().request, get().context);
    const json = await res.json();

    expect(json.data.verification.targetLabel).toBe("2026-2027");
    const keys = json.data.verification.items.map((item: { key: string }) => item.key);
    expect(keys).toContain("promotionRulesActive");
    expect(keys).toContain("timetableReviewed");
    expect(keys).toContain("feeBalancePolicyStated");
  });

  it("reads the working-day policy through its own module, so SQL NULL is undeclared", async () => {
    db.academicYear.findFirst.mockResolvedValue({
      id: "ay-2026",
      label: "2026-2027",
      isClosed: false,
      nonWorkingWeekdays: null,
      feeBalancePolicy: null,
      isCurrent: false,
    });

    const res = await GET(get().request, get().context);
    const json = await res.json();

    const declared = json.data.verification.items.find(
      (item: { key: string }) => item.key === "workingDayPolicyDeclared"
    );
    // A JSON null would be a different value wearing the same JS null; the
    // module that owns the meaning must be the one that reads it.
    expect(declared.status).toBe("attention");
  });

  it("404s a year that belongs to nobody", async () => {
    db.academicYear.findFirst.mockResolvedValue(null);

    const res = await GET(get().request, get().context);
    expect(res.status).toBe(404);
  });

  it("reports a year whose copied grid is still unreviewed as not ready", async () => {
    db.timetable.count.mockImplementation(async ({ where }: { where: { needsReview: boolean } }) =>
      where.needsReview ? 24 : 0
    );

    const res = await GET(get().request, get().context);
    const json = await res.json();

    expect(json.data.verification.ready).toBe(false);
    expect(json.data.verification.counts.attention).toBeGreaterThan(0);
  });
});
