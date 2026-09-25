// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

/**
 * Route-level suite for POST /api/academic-years/rollover (roadmap item 16).
 *
 * `@/lib/permissions` is deliberately **not** mocked: the route's capability
 * check is the only thing standing between "manage the academic module" and
 * "open the next year", and stubbing it would assert nothing. The real
 * `hasRolePermission` runs against real role tables.
 *
 * `@/lib/rollover-roster` and `@/lib/rollover-plan` are real too. The plan is
 * covered by its own suite; here the point is that the route loads evidence,
 * refuses on blockers, and writes exactly the diff it showed.
 */

const db = vi.hoisted(() => ({
  academicYear: { findFirst: vi.fn(), findMany: vi.fn() },
  class: { findMany: vi.fn() },
  promotionRule: { findMany: vi.fn() },
  classFeeStructure: { findMany: vi.fn() },
  studentAcademicSession: { count: vi.fn() },
  $transaction: vi.fn(),
}));

const tx = vi.hoisted(() => ({
  academicYear: { create: vi.fn() },
  promotionRule: { createMany: vi.fn(), update: vi.fn() },
  classFeeStructure: { createMany: vi.fn(), update: vi.fn() },
  academicYearRollover: { create: vi.fn() },
  auditLog: { create: vi.fn() },
}));

const auth = vi.hoisted(() => ({ requireApiAccess: vi.fn() }));

vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/api-auth", () => ({ requireApiAccess: auth.requireApiAccess }));

import { POST as POST_ROUTE } from "@/app/api/academic-years/rollover/route";

const POST = POST_ROUTE as unknown as (request: NextRequest) => Promise<Response>;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const RULE = {
  classId: "cls-1",
  minimumAttendance: 75,
  minimumOverallPercentage: 40,
  minimumPerSubject: 33,
  maxFailedSubjects: 0,
  allowConditionalPromotion: false,
  autoPromote: true,
  nextClassId: "cls-2",
  isActive: true,
};

const FEE = {
  classId: "cls-1",
  tuitionFee: 1000,
  labFee: 100,
  computerFee: 50,
  examFee: 200,
  sportsFee: 0,
  libraryFee: 0,
  otherFee: 0,
  totalMonthlyFee: 1350,
  billingCycle: "MONTHLY",
  notes: null,
  isActive: true,
};

const CLASSES = [
  { id: "cls-1", name: "Class 1", classNumber: 1 },
  { id: "cls-2", name: "Class 2", classNumber: 2 },
];

const SOURCE_YEAR = {
  id: "ay-2025",
  yearId: "AY2025",
  label: "2025-2026",
  startDate: new Date("2025-04-01T00:00:00.000Z"),
  endDate: new Date("2026-03-31T00:00:00.000Z"),
  isClosed: true,
  nonWorkingWeekdays: [0] as unknown,
  promotionRules: [RULE],
  classFeeStructures: [FEE],
};

const TARGET_YEAR = {
  id: "ay-2026",
  yearId: "AY2026",
  label: "2026-2027",
  startDate: new Date("2026-04-01T00:00:00.000Z"),
  endDate: new Date("2027-03-31T00:00:00.000Z"),
  isClosed: false,
  nonWorkingWeekdays: [0] as unknown,
};

function post(body: unknown) {
  return new NextRequest("http://localhost:3000/api/academic-years/rollover", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

const CREATE_BODY = {
  sourceAcademicYearId: "ay-2025",
  mode: "CREATE",
  // A year id the tenant has not used. `AY2026` belongs to the existing year
  // below, which is what the duplicate-id tests collide with on purpose.
  yearId: "AY2027",
  label: "2026-2027",
  startDate: "2026-04-01",
  endDate: "2027-03-31",
  copy: { promotionRules: true, feeStructures: true },
};

const EXISTING_BODY = {
  sourceAcademicYearId: "ay-2025",
  mode: "EXISTING",
  academicYearId: "ay-2026",
  copy: { promotionRules: true, feeStructures: true },
};

beforeEach(() => {
  vi.clearAllMocks();

  auth.requireApiAccess.mockResolvedValue({
    authContext: {
      tenantId: "tenant-1",
      user: { id: "user-1", email: "admin@school.test", role: "SCHOOL_ADMIN" },
    },
  });

  db.academicYear.findFirst.mockResolvedValue(SOURCE_YEAR);
  // `findMany` feeds both the duplicate-yearId check and the existing-target
  // lookup, so it carries every year the tenant has.
  db.academicYear.findMany.mockResolvedValue([SOURCE_YEAR, TARGET_YEAR]);
  db.class.findMany.mockResolvedValue(CLASSES);
  db.promotionRule.findMany.mockResolvedValue([RULE]);
  db.classFeeStructure.findMany.mockResolvedValue([FEE]);
  db.studentAcademicSession.count.mockResolvedValue(0);

  tx.academicYear.create.mockResolvedValue({ id: "ay-2026-new" });
  tx.promotionRule.createMany.mockResolvedValue({ count: 1 });
  tx.promotionRule.update.mockResolvedValue({});
  tx.classFeeStructure.createMany.mockResolvedValue({ count: 1 });
  tx.classFeeStructure.update.mockResolvedValue({});
  tx.academicYearRollover.create.mockResolvedValue({ id: "rollover-1" });
  tx.auditLog.create.mockResolvedValue({ id: "audit-1" });
  db.$transaction.mockImplementation(async (fn: (client: unknown) => unknown) => fn(tx));
});

// ---------------------------------------------------------------------------

describe("the rollover capability", () => {
  it("refuses a role that may manage academics but may not open a year", async () => {
    auth.requireApiAccess.mockResolvedValue({
      authContext: {
        tenantId: "tenant-1",
        user: { id: "user-9", email: "clerk@school.test", role: "CLERK" },
      },
    });

    const res = await POST(post(CREATE_BODY));
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toBe(true);
    // Refused before anything was read, let alone written.
    expect(db.academicYear.findFirst).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("allows a school administrator", async () => {
    const res = await POST(post({ ...CREATE_BODY, dryRun: true }));

    expect(res.status).toBe(200);
  });
});

describe("the dry run", () => {
  it("writes nothing and says what would happen", async () => {
    const res = await POST(post({ ...CREATE_BODY, dryRun: true }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.dryRun).toBe(true);
    expect(json.data.plan.canProceed).toBe(true);
    expect(json.data.plan.writes).toEqual({ created: 2, updated: 0 });
    expect(json.data.plan.promotionRules.counts).toEqual({
      created: 1,
      updated: 0,
      skipped: 0,
    });

    // The whole point of a preview.
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(tx.academicYear.create).not.toHaveBeenCalled();
    expect(tx.promotionRule.createMany).not.toHaveBeenCalled();
    expect(tx.classFeeStructure.createMany).not.toHaveBeenCalled();
    expect(tx.academicYearRollover.create).not.toHaveBeenCalled();
  });

  it("reports a blocked plan with 200, because a readiness check is not a failure", async () => {
    const res = await POST(
      post({ ...CREATE_BODY, dryRun: true, yearId: "AY2025" })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.plan.canProceed).toBe(false);
    expect(json.data.plan.blockers.map((b: { code: string }) => b.code)).toContain(
      "DUPLICATE_YEAR_ID"
    );
  });

  it("uses the same loader as the commit, so the preview cannot describe another plan", async () => {
    const preview = await (await POST(post({ ...CREATE_BODY, dryRun: true }))).json();
    const commit = await (await POST(post(CREATE_BODY))).json();

    expect(commit.data.plan).toEqual(preview.data.plan);
  });
});

describe("a blocked commit", () => {
  it("refuses with 409, names the blocker, and writes nothing", async () => {
    const res = await POST(post({ ...CREATE_BODY, yearId: "AY2025" }));
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.details.map((d: { code: string }) => d.code)).toContain("DUPLICATE_YEAR_ID");
    expect(json.details[0].field).toBe("yearId");
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("refuses a rollover that would leave the target unable to promote anyone", async () => {
    const res = await POST(
      post({ ...CREATE_BODY, copy: { promotionRules: false, feeStructures: true } })
    );
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.details.map((d: { code: string }) => d.code)).toContain(
      "TARGET_WILL_HAVE_NO_PROMOTION_RULES"
    );
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("refuses a target that starts before the source", async () => {
    const res = await POST(post({ ...CREATE_BODY, startDate: "2025-04-01" }));
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.details.map((d: { code: string }) => d.code)).toContain(
      "TARGET_YEAR_NOT_AFTER_SOURCE"
    );
  });
});

describe("mode CREATE", () => {
  it("opens the year with provenance and the carried working-day policy", async () => {
    const res = await POST(post(CREATE_BODY));

    expect(res.status).toBe(201);
    const { data } = tx.academicYear.create.mock.calls[0][0];
    expect(data).toMatchObject({
      tenantId: "tenant-1",
      yearId: "AY2027",
      label: "2026-2027",
      clonedFromId: "ay-2025",
      nonWorkingWeekdays: [0],
    });
    expect(data.startDate).toEqual(new Date("2026-04-01"));
    expect(data.endDate).toEqual(new Date("2027-03-31"));

    // Switching the operating year is a separate act with its own capability
    // check; it must not ride along on a rollover.
    expect(data).not.toHaveProperty("isCurrent");
  });

  it("stores an undeclared policy as a SQL NULL, not a JSON null", async () => {
    db.academicYear.findFirst.mockResolvedValue({
      ...SOURCE_YEAR,
      nonWorkingWeekdays: null,
    });

    await POST(post(CREATE_BODY));

    const { data } = tx.academicYear.create.mock.calls[0][0];
    expect(data.nonWorkingWeekdays).toBe(Prisma.DbNull);
  });

  it("writes the configuration against the new year's id", async () => {
    await POST(post(CREATE_BODY));

    expect(tx.promotionRule.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          tenantId: "tenant-1",
          academicYearId: "ay-2026-new",
          classId: "cls-1",
          minimumAttendance: 75,
        }),
      ],
    });
    expect(tx.classFeeStructure.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          tenantId: "tenant-1",
          academicYearId: "ay-2026-new",
          classId: "cls-1",
          tuitionFee: 1000,
        }),
      ],
    });
  });

  it("records the run and audits it inside the same transaction", async () => {
    await POST(post(CREATE_BODY));

    expect(db.$transaction).toHaveBeenCalledTimes(1);

    const { data: record } = tx.academicYearRollover.create.mock.calls[0][0];
    expect(record).toMatchObject({
      tenantId: "tenant-1",
      sourceAcademicYearId: "ay-2025",
      targetAcademicYearId: "ay-2026-new",
      mode: "CREATE",
      copyPromotionRules: true,
      copyFeeStructures: true,
      promotionRulesCreated: 1,
      feeStructuresCreated: 1,
      workingDayPolicyCarried: true,
      performedByUserId: "user-1",
    });

    const { data: audit } = tx.auditLog.create.mock.calls[0][0];
    expect(audit).toMatchObject({
      tenantId: "tenant-1",
      userId: "user-1",
      action: "ROLLOVER",
      entity: "AcademicYear",
      entityId: "ay-2026-new",
    });
    expect(audit.details.target.created).toBe(true);
    expect(audit.details.writes).toEqual({ created: 2, updated: 0 });
  });

  it("records what it told the operator it would not do", async () => {
    await POST(post(CREATE_BODY));

    const { data: audit } = tx.auditLog.create.mock.calls[0][0];
    // "Nobody said the timetables were not copied" is otherwise a
    // disagreement with no evidence either way.
    expect(audit.details.notCopied).toContain("timetables");
    expect(audit.details.notCopied).toContain("feeBalancePolicy");
    expect(audit.details.warnings).toEqual([]);
  });

  it("records the warnings the operator was shown", async () => {
    db.academicYear.findFirst.mockResolvedValue({
      ...SOURCE_YEAR,
      isClosed: false,
    });

    await POST(post(CREATE_BODY));

    const { data: audit } = tx.auditLog.create.mock.calls[0][0];
    expect(audit.details.warnings).toContain("SOURCE_YEAR_STILL_OPEN");
  });
});

describe("mode EXISTING", () => {
  it("rolls into the year that is there rather than opening another", async () => {
    // The target already holds its own rule, different from the source's.
    db.promotionRule.findMany.mockResolvedValue([{ ...RULE, minimumAttendance: 60 }]);
    db.classFeeStructure.findMany.mockResolvedValue([]);
    db.studentAcademicSession.count.mockResolvedValue(120);

    const res = await POST(post(EXISTING_BODY));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(tx.academicYear.create).not.toHaveBeenCalled();

    // Updated, not inserted — the unique key is what makes this idempotent.
    expect(tx.promotionRule.createMany).not.toHaveBeenCalled();
    expect(tx.promotionRule.update).toHaveBeenCalledWith({
      where: {
        tenantId_academicYearId_classId: {
          tenantId: "tenant-1",
          academicYearId: "ay-2026",
          classId: "cls-1",
        },
      },
      data: expect.objectContaining({ minimumAttendance: 75 }),
    });

    const { data: record } = tx.academicYearRollover.create.mock.calls[0][0];
    expect(record.mode).toBe("EXISTING");
    expect(record.targetAcademicYearId).toBe("ay-2026");
    expect(record.promotionRulesUpdated).toBe(1);
    expect(record.promotionRulesCreated).toBe(0);
    // A year that already existed was not cloned from anything.
    expect(record.workingDayPolicyCarried).toBe(false);

    // And the operator is told the year already holds students.
    expect(json.data.plan.warnings.map((w: { code: string }) => w.code)).toContain(
      "TARGET_YEAR_HAS_STUDENTS"
    );
  });

  it("writes nothing on a re-run, which is what makes it safe to run again", async () => {
    // The target already holds exactly what the source holds.
    db.promotionRule.findMany.mockResolvedValue([RULE]);
    db.classFeeStructure.findMany.mockResolvedValue([FEE]);

    const res = await POST(post(EXISTING_BODY));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(tx.promotionRule.createMany).not.toHaveBeenCalled();
    expect(tx.promotionRule.update).not.toHaveBeenCalled();
    expect(tx.classFeeStructure.createMany).not.toHaveBeenCalled();
    expect(tx.classFeeStructure.update).not.toHaveBeenCalled();

    expect(json.data.plan.writes).toEqual({ created: 0, updated: 0 });
    expect(json.message).toContain("No configuration was carried");

    // The run is still recorded: "we ran it and it was a no-op" is a fact worth
    // having, and it is what distinguishes a re-run from a year nobody touched.
    const { data: record } = tx.academicYearRollover.create.mock.calls[0][0];
    expect(record.promotionRulesCreated).toBe(0);
    expect(record.promotionRulesUpdated).toBe(0);
  });

  it("refuses to roll into a closed year", async () => {
    db.academicYear.findMany.mockResolvedValue([
      SOURCE_YEAR,
      { ...TARGET_YEAR, isClosed: true },
    ]);

    const res = await POST(post(EXISTING_BODY));
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.details.map((d: { code: string }) => d.code)).toContain("TARGET_YEAR_CLOSED");
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("refuses to roll a year into itself", async () => {
    const res = await POST(post({ ...EXISTING_BODY, academicYearId: "ay-2025" }));
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.details.map((d: { code: string }) => d.code)).toContain("TARGET_IS_SOURCE");
  });
});

describe("the request itself", () => {
  it.each([
    ["no body", null, "MISSING_BODY"],
    ["no source year", { ...CREATE_BODY, sourceAcademicYearId: "" }, "MISSING_SOURCE_YEAR"],
    ["an unknown mode", { ...CREATE_BODY, mode: "CLONE" }, "INVALID_MODE"],
    ["no target label", { ...CREATE_BODY, label: "  " }, "MISSING_TARGET_FIELDS"],
    ["an unparseable date", { ...CREATE_BODY, startDate: "next april" }, "INVALID_TARGET_DATE"],
    ["no target year for EXISTING", { ...EXISTING_BODY, academicYearId: "" }, "MISSING_TARGET_YEAR"],
    ["no copy options", { ...CREATE_BODY, copy: undefined }, "MISSING_COPY_OPTIONS"],
    [
      "a copy option that is not a boolean",
      { ...CREATE_BODY, copy: { promotionRules: "yes", feeStructures: true } },
      "INVALID_COPY_OPTION",
    ],
    [
      "a missing copy option",
      { ...CREATE_BODY, copy: { promotionRules: true } },
      "INVALID_COPY_OPTION",
    ],
  ])("refuses %s with a 400", async (_label, body, code) => {
    const res = await POST(post(body));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.details[0].code).toBe(code);
    // Rejected before any evidence was read.
    expect(db.academicYear.findFirst).not.toHaveBeenCalled();
  });

  it("404s an unknown source year", async () => {
    db.academicYear.findFirst.mockResolvedValue(null);

    const res = await POST(post(CREATE_BODY));

    expect(res.status).toBe(404);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("404s an unknown existing target year", async () => {
    db.academicYear.findMany.mockResolvedValue([SOURCE_YEAR]);

    const res = await POST(post(EXISTING_BODY));

    expect(res.status).toBe(404);
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});

describe("the response", () => {
  it("hands back the plan and the applied counts", async () => {
    const res = await POST(post(CREATE_BODY));
    const json = await res.json();

    expect(json.data.application).toEqual({
      targetAcademicYearId: "ay-2026-new",
      targetCreated: true,
      promotionRulesCreated: 1,
      promotionRulesUpdated: 0,
      feeStructuresCreated: 1,
      feeStructuresUpdated: 0,
      workingDayPolicyCarried: true,
    });
    expect(json.data.plan.notCopied.length).toBeGreaterThan(0);
    expect(json.message).toContain("2026-2027");
    expect(json.message).toContain("2025-2026");
  });
});
