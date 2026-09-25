// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * Route-level guard suite for POST /api/promotions/execute.
 *
 * This is the regression net around the original defect: the old endpoint
 * accepted a client-supplied `toAcademicYearId` and `status`, so every
 * promotion was written with `toAcademicYearId === fromAcademicYearId` and the
 * student's class advanced without them ever being enrolled in the next year.
 *
 * These tests assert the contract the endpoint must now uphold:
 *   - the target year must differ from, and start after, the source year;
 *   - the action is recomputed server-side and never taken from the client;
 *   - a target-year enrollment row is written for every non-graduating student;
 *   - graduates leave the roster and get no target-year enrollment;
 *   - the whole batch is one transaction.
 */

const db = vi.hoisted(() => ({
  academicYear: { findFirst: vi.fn() },
  class: { findFirst: vi.fn(), findMany: vi.fn() },
  promotionRule: { findFirst: vi.fn() },
  classPromotion: { findMany: vi.fn() },
  studentAcademicSession: { findMany: vi.fn() },
  $transaction: vi.fn(),
}));

const tx = vi.hoisted(() => ({
  studentAcademicSession: { upsert: vi.fn() },
  studentProfile: { update: vi.fn(), updateMany: vi.fn() },
  examResult: { updateMany: vi.fn() },
  classPromotion: { createMany: vi.fn(), findMany: vi.fn() },
  auditLog: { create: vi.fn() },
}));

const cohort = vi.hoisted(() => ({ loadPromotionCohort: vi.fn() }));

vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/promotion-roster", () => cohort);
vi.mock("@/lib/academic-year-guards", () => ({
  assertAcademicYearsOpen: vi.fn().mockResolvedValue(undefined),
  assertAcademicYearOpen: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/api-auth", () => ({
  requireApiAccess: vi.fn().mockResolvedValue({
    authContext: { tenantId: "tenant-1", user: { id: "user-1" } },
  }),
}));

import { POST as POST_ROUTE } from "@/app/api/promotions/execute/route";

/**
 * The handler's inferred return type is `NextResponse | undefined` because
 * `requireApiAccess` may short-circuit. In these tests it never does, so pin
 * the signature to what the tests actually exercise.
 */
const POST = POST_ROUTE as unknown as (request: NextRequest) => Promise<Response>;

const FROM_YEAR = { id: "ay-2025", label: "2025-2026", startDate: new Date("2025-04-01") };
const TO_YEAR = { id: "ay-2026", label: "2026-2027", startDate: new Date("2026-04-01") };

const FROM_CLASS = { id: "cls-5", name: "Class 5", classNumber: 5 };
const NEXT_CLASS = { id: "cls-6", name: "Class 6", classNumber: 6 };
/**
 * A class with nothing above it. Only such a class may legitimately have a null
 * `nextClassId`: the pre-flight treats a null next class on a mid-ladder class
 * as a blocker, because the engine reads null as "final class" and would mark
 * the whole cohort GRADUATED.
 */
const TERMINAL_CLASS = { id: "cls-10", name: "Class 10", classNumber: 10 };
const ALL_CLASSES = [FROM_CLASS, NEXT_CLASS, TERMINAL_CLASS];

function rule(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "rule-1",
    classId: "cls-5",
    academicYearId: "ay-2025",
    minimumAttendance: 75,
    minimumOverallPercentage: 40,
    minimumPerSubject: 33,
    maxFailedSubjects: 0,
    allowConditionalPromotion: false,
    autoPromote: true,
    nextClassId: "cls-6",
    isActive: true,
    ...overrides,
  };
}

function cohortEntry(opts: {
  studentProfileId: string;
  studentId?: string;
  name?: string;
  roll?: string;
  percentage?: number;
  status?: string;
  placementSource?: "session" | "profile";
  fromClassId?: string;
  fromClassName?: string;
  fromClassNumber?: number;
}) {
  const {
    studentProfileId,
    studentId = "S001",
    name = "Ali Khan",
    roll = "12",
    percentage = 90,
    status = "PASS",
    placementSource = "session",
    fromClassId = FROM_CLASS.id,
    fromClassName = FROM_CLASS.name,
    fromClassNumber = FROM_CLASS.classNumber,
  } = opts;

  return {
    seed: {
      studentProfileId,
      studentId,
      studentName: name,
      rollNumber: roll,
      sectionId: "sec-a",
      groupId: null,
      placementSource,
      demographics: {
        guardianName: "Karim Khan",
        guardianContact: "03001234567",
        dateOfBirth: new Date("2014-06-01"),
        gender: "MALE",
      },
    },
    candidate: {
      studentProfileId,
      studentId,
      studentName: name,
      rollNumber: roll,
      fromClassId,
      fromClassName,
      fromClassNumber,
      examResults: [
        {
          subjectId: "sub-1",
          subjectName: "Mathematics",
          percentage,
          status,
          grade: status === "PASS" ? "A" : "F",
          createdAt: new Date("2026-01-15"),
        },
      ],
      attendanceRate: null,
      attendancePresentDays: 0,
      attendanceTotalDays: 0,
    },
  };
}

function post(body: unknown) {
  return new NextRequest("http://localhost:3000/api/promotions/execute", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

const BASE_BODY = {
  fromAcademicYearId: "ay-2025",
  toAcademicYearId: "ay-2026",
  classId: "cls-5",
  rollNumberPolicy: "PRESERVE",
};

/** Wire up the happy-path reads. Individual tests override what they care about. */
function primeHappyPath() {
  db.academicYear.findFirst.mockImplementation(async ({ where }: any) =>
    where.id === FROM_YEAR.id ? FROM_YEAR : TO_YEAR
  );
  db.class.findFirst.mockResolvedValue(FROM_CLASS);
  db.promotionRule.findFirst.mockResolvedValue(rule());
  db.classPromotion.findMany.mockResolvedValue([]);
  db.class.findMany.mockResolvedValue(ALL_CLASSES);
  db.studentAcademicSession.findMany.mockResolvedValue([]);
  tx.classPromotion.createMany.mockResolvedValue({ count: 1 });
  tx.classPromotion.findMany.mockResolvedValue([{ id: "promo-1" }]);
  db.$transaction.mockImplementation(async (fn: any) => fn(tx));
}

/**
 * Point the run at the school's highest class, whose rule correctly has no next
 * class. Using a mid-ladder class with a null next class is now a pre-flight
 * blocker, which is asserted separately below.
 */
function primeTerminalClass() {
  db.class.findFirst.mockResolvedValue(TERMINAL_CLASS);
  db.promotionRule.findFirst.mockResolvedValue(
    rule({ classId: TERMINAL_CLASS.id, nextClassId: null })
  );
}

/** The body a terminal-class run needs: the source class is the final class. */
const TERMINAL_BODY = { ...BASE_BODY, classId: TERMINAL_CLASS.id };

/** A cohort entry that really is sitting in the terminal class. */
function terminalEntry(overrides: Partial<Parameters<typeof cohortEntry>[0]> = {}) {
  return cohortEntry({
    studentProfileId: "stu-1",
    fromClassId: TERMINAL_CLASS.id,
    fromClassName: TERMINAL_CLASS.name,
    fromClassNumber: TERMINAL_CLASS.classNumber,
    ...overrides,
  });
}

describe("POST /api/promotions/execute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    primeHappyPath();
  });

  // -------------------------------------------------------------------------
  // The defect that started all of this.
  // -------------------------------------------------------------------------
  it("refuses a batch whose target year equals its source year", async () => {
    const res = await POST(
      post({ ...BASE_BODY, toAcademicYearId: FROM_YEAR.id })
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe(true);
    expect(json.details?.[0]?.code).toBe("SAME_ACADEMIC_YEAR");

    // Rejected before any database read: the guard is cheap and absolute.
    expect(db.academicYear.findFirst).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("refuses a target year that does not start after the source year", async () => {
    db.academicYear.findFirst.mockImplementation(async ({ where }: any) =>
      where.id === FROM_YEAR.id
        ? { ...FROM_YEAR, startDate: new Date("2026-04-01") }
        : TO_YEAR
    );

    const res = await POST(post(BASE_BODY));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.details?.[0]?.code).toBe("TARGET_YEAR_NOT_AFTER_SOURCE");
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("refuses when the class has no active promotion rule", async () => {
    db.promotionRule.findFirst.mockResolvedValue(null);

    const res = await POST(post(BASE_BODY));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.details?.[0]?.code).toBe("NO_PROMOTION_RULE");
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Server authority: the client cannot dictate the outcome.
  // -------------------------------------------------------------------------
  it("ignores a client-supplied status and recomputes the action server-side", async () => {
    cohort.loadPromotionCohort.mockResolvedValue({
      entries: [cohortEntry({ studentProfileId: "stu-1", percentage: 20, status: "FAIL" })],
      nameByStudent: new Map([["stu-1", "Ali Khan"]]),
      legacyPlacementIds: [],
    });

    const res = await POST(
      // A caller that still believes it can assert the outcome.
      post({ ...BASE_BODY, status: "PROMOTED", studentProfileIds: ["stu-1"] })
    );

    expect(res.status).toBe(201);
    const [createManyArgs] = tx.classPromotion.createMany.mock.calls[0];
    expect(createManyArgs.data[0].status).toBe("RETAINED");
  });

  it("refuses students who are not part of the cohort", async () => {
    cohort.loadPromotionCohort.mockResolvedValue({
      entries: [cohortEntry({ studentProfileId: "stu-1" })],
      nameByStudent: new Map([["stu-1", "Ali Khan"]]),
      legacyPlacementIds: [],
    });

    const res = await POST(
      post({ ...BASE_BODY, studentProfileIds: ["stu-1", "stu-999"] })
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.details?.[0]?.code).toBe("NOT_IN_COHORT");
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("refuses a second promotion for a student already promoted out of the year", async () => {
    cohort.loadPromotionCohort.mockResolvedValue({
      entries: [cohortEntry({ studentProfileId: "stu-1" })],
      nameByStudent: new Map([["stu-1", "Ali Khan"]]),
      legacyPlacementIds: [],
    });
    db.classPromotion.findMany.mockResolvedValue([{ studentProfileId: "stu-1" }]);

    const res = await POST(post(BASE_BODY));
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.details?.[0]?.code).toBe("ALREADY_PROMOTED");
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("refuses a demotion that does not name a target class", async () => {
    cohort.loadPromotionCohort.mockResolvedValue({
      entries: [cohortEntry({ studentProfileId: "stu-1" })],
      nameByStudent: new Map([["stu-1", "Ali Khan"]]),
      legacyPlacementIds: [],
    });

    const res = await POST(
      post({
        ...BASE_BODY,
        overrides: [{ studentProfileId: "stu-1", action: "DEMOTED" }],
      })
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.details?.[0]?.code).toBe("DEMOTION_TARGET_REQUIRED");
  });

  it("refuses a demotion whose target is not below the source class", async () => {
    cohort.loadPromotionCohort.mockResolvedValue({
      entries: [cohortEntry({ studentProfileId: "stu-1" })],
      nameByStudent: new Map([["stu-1", "Ali Khan"]]),
      legacyPlacementIds: [],
    });

    const res = await POST(
      post({
        ...BASE_BODY,
        // cls-6 is the *next* class — a demotion pointing at it is an advance
        // wearing the wrong label.
        overrides: [{ studentProfileId: "stu-1", action: "DEMOTED", toClassId: "cls-6" }],
      })
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.details?.[0]?.code).toBe("INVALID_DEMOTION_TARGET");
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("demotes a student into the lower class for the target year", async () => {
    const LOWER_CLASS = { id: "cls-3", name: "Class 3", classNumber: 3 };
    db.class.findMany.mockResolvedValue([FROM_CLASS, NEXT_CLASS, LOWER_CLASS]);
    cohort.loadPromotionCohort.mockResolvedValue({
      entries: [cohortEntry({ studentProfileId: "stu-1", percentage: 25, status: "FAIL" })],
      nameByStudent: new Map([["stu-1", "Ali Khan"]]),
      legacyPlacementIds: [],
    });

    const res = await POST(
      post({
        ...BASE_BODY,
        overrides: [{ studentProfileId: "stu-1", action: "DEMOTED", toClassId: "cls-3" }],
      })
    );
    expect(res.status).toBe(201);

    // The record crosses the year boundary like any other movement...
    const row = tx.classPromotion.createMany.mock.calls[0][0].data[0];
    expect(row.status).toBe("DEMOTED");
    expect(row.fromClassId).toBe("cls-5");
    expect(row.toClassId).toBe("cls-3");
    expect(row.toAcademicYearId).toBe("ay-2026");

    // ...and the student is enrolled in the LOWER class for the target year,
    // which is the whole point of the action.
    const targetUpsert = tx.studentAcademicSession.upsert.mock.calls.find(
      (call) => call[0].create.academicYearId === "ay-2026"
    )!;
    expect(targetUpsert[0].create.classId).toBe("cls-3");
    expect(targetUpsert[0].create.classNumber).toBe(3);
    expect(targetUpsert[0].create.promotionStatus).toBe("ENROLLED");

    // The profile follows them down, and they stay on the roster.
    expect(tx.studentProfile.update.mock.calls[0][0].data.classId).toBe("cls-3");
    expect(tx.studentProfile.updateMany).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // The write itself.
  // -------------------------------------------------------------------------
  it("writes the promotion against the TARGET year and enrolls the student there", async () => {
    cohort.loadPromotionCohort.mockResolvedValue({
      entries: [cohortEntry({ studentProfileId: "stu-1", percentage: 90 })],
      nameByStudent: new Map([["stu-1", "Ali Khan"]]),
      legacyPlacementIds: [],
    });

    const res = await POST(post(BASE_BODY));
    expect(res.status).toBe(201);

    // 1. The promotion row moves the student into the NEXT year, not its own.
    const [createManyArgs] = tx.classPromotion.createMany.mock.calls[0];
    const row = createManyArgs.data[0];
    expect(row.fromAcademicYearId).toBe("ay-2025");
    expect(row.toAcademicYearId).toBe("ay-2026");
    expect(row.fromClassId).toBe("cls-5");
    expect(row.toClassId).toBe("cls-6");
    expect(row.status).toBe("PROMOTED");
    expect(row.decidedBy).toBe("user-1");

    // 2. Both year-scoped snapshots are written, target year first-class.
    const upsertYears = tx.studentAcademicSession.upsert.mock.calls.map(
      (call) => call[0].create.academicYearId
    );
    expect(upsertYears).toContain("ay-2025");
    expect(upsertYears).toContain("ay-2026");

    const targetUpsert = tx.studentAcademicSession.upsert.mock.calls.find(
      (call) => call[0].create.academicYearId === "ay-2026"
    )!;
    expect(targetUpsert[0].create.classId).toBe("cls-6");
    expect(targetUpsert[0].create.classNumber).toBe(6);
    expect(targetUpsert[0].create.rollNumber).toBe("12");
    expect(targetUpsert[0].create.promotionStatus).toBe("ENROLLED");

    // 3. The profile follows the student into the new class.
    const [profileArgs] = tx.studentProfile.update.mock.calls[0];
    expect(profileArgs.data.classId).toBe("cls-6");
    expect(profileArgs.data.rollNumber).toBe("12");

    // 4. The source year's marks are frozen, because the student has left it.
    const [lockArgs] = tx.examResult.updateMany.mock.calls[0];
    expect(lockArgs.where.academicYearId).toBe("ay-2025");
    expect(lockArgs.data.isLocked).toBe(true);
  });

  it("graduates a terminal class: no target enrollment, roster exit recorded", async () => {
    primeTerminalClass();
    cohort.loadPromotionCohort.mockResolvedValue({
      entries: [terminalEntry({ percentage: 88 })],
      nameByStudent: new Map([["stu-1", "Ali Khan"]]),
      legacyPlacementIds: [],
    });

    const res = await POST(post(TERMINAL_BODY));
    expect(res.status).toBe(201);

    const [createManyArgs] = tx.classPromotion.createMany.mock.calls[0];
    const row = createManyArgs.data[0];
    expect(row.status).toBe("GRADUATED");
    // Still recorded as a transition into the following year for the archive.
    expect(row.toAcademicYearId).toBe("ay-2026");

    // A graduate gets no enrollment row for a year they never attend.
    const upsertYears = tx.studentAcademicSession.upsert.mock.calls.map(
      (call) => call[0].create.academicYearId
    );
    expect(upsertYears).toEqual(["ay-2025"]);

    // The profile leaves the active roster, and no class is re-pointed.
    expect(tx.studentProfile.update).not.toHaveBeenCalled();
    const [updateManyArgs] = tx.studentProfile.updateMany.mock.calls[0];
    expect(updateManyArgs.data.status).toBe("GRADUATED");
    expect(updateManyArgs.data.classId).toBeNull();
  });

  it("keeps a retained student in their class but refreshes their target-year roll number", async () => {
    cohort.loadPromotionCohort.mockResolvedValue({
      entries: [cohortEntry({ studentProfileId: "stu-1", percentage: 20, status: "FAIL" })],
      nameByStudent: new Map([["stu-1", "Ali Khan"]]),
      legacyPlacementIds: [],
    });

    const res = await POST(post(BASE_BODY));
    expect(res.status).toBe(201);

    const [createManyArgs] = tx.classPromotion.createMany.mock.calls[0];
    const row = createManyArgs.data[0];
    expect(row.status).toBe("RETAINED");
    expect(row.fromClassId).toBe("cls-5");
    expect(row.toClassId).toBe("cls-5");
    // Retention still means a new enrollment in the FOLLOWING year.
    expect(row.toAcademicYearId).toBe("ay-2026");

    // Section and group survive because the student never changed class.
    const [profileArgs] = tx.studentProfile.update.mock.calls[0];
    expect(profileArgs.data.classId).toBe("cls-5");
    expect(profileArgs.data.sectionId).toBe("sec-a");

    // Marks stay editable: the student is repeating, not leaving.
    expect(tx.examResult.updateMany).not.toHaveBeenCalled();
  });

  it("blocks roll number collisions in the target year under the preserve policy", async () => {
    cohort.loadPromotionCohort.mockResolvedValue({
      entries: [cohortEntry({ studentProfileId: "stu-1", roll: "12" })],
      nameByStudent: new Map([["stu-1", "Ali Khan"]]),
      legacyPlacementIds: [],
    });
    // Somebody already occupies roll 12 in Class 6 for the target year.
    db.studentAcademicSession.findMany.mockResolvedValue([
      { classId: "cls-6", rollNumber: "12" },
    ]);

    const res = await POST(post(BASE_BODY));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.details?.[0]?.code).toBe("ROLL_NUMBER_CONFLICT");
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("assigns sequential roll numbers when the preserve policy would collide", async () => {
    cohort.loadPromotionCohort.mockResolvedValue({
      entries: [
        cohortEntry({ studentProfileId: "stu-1", roll: "12" }),
        cohortEntry({ studentProfileId: "stu-2", studentId: "S002", name: "Sara", roll: "13" }),
      ],
      nameByStudent: new Map([
        ["stu-1", "Ali Khan"],
        ["stu-2", "Sara"],
      ]),
      legacyPlacementIds: [],
    });
    db.studentAcademicSession.findMany.mockResolvedValue([
      { classId: "cls-6", rollNumber: "12" },
    ]);

    const res = await POST(post({ ...BASE_BODY, rollNumberPolicy: "SEQUENTIAL" }));
    expect(res.status).toBe(201);

    const targetRolls = tx.studentAcademicSession.upsert.mock.calls
      .filter((call) => call[0].create.academicYearId === "ay-2026")
      .map((call) => call[0].create.rollNumber);

    expect(targetRolls).toEqual(["13", "14"]);
  });

  it("surfaces a legacy profile-derived placement as a warning rather than silently trusting it", async () => {
    cohort.loadPromotionCohort.mockResolvedValue({
      entries: [cohortEntry({ studentProfileId: "stu-1", placementSource: "profile" })],
      nameByStudent: new Map([["stu-1", "Ali Khan"]]),
      legacyPlacementIds: ["stu-1"],
    });

    const res = await POST(post(BASE_BODY));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.data.warnings.legacyPlacement).toHaveLength(1);
    expect(json.data.warnings.legacyPlacement[0].studentProfileId).toBe("stu-1");
  });

  it("writes the whole batch inside a single transaction", async () => {
    cohort.loadPromotionCohort.mockResolvedValue({
      entries: [
        cohortEntry({ studentProfileId: "stu-1", roll: "12" }),
        cohortEntry({ studentProfileId: "stu-2", studentId: "S002", name: "Sara", roll: "13" }),
      ],
      nameByStudent: new Map([
        ["stu-1", "Ali Khan"],
        ["stu-2", "Sara"],
      ]),
      legacyPlacementIds: [],
    });

    await POST(post(BASE_BODY));

    expect(db.$transaction).toHaveBeenCalledTimes(1);
    // One batch insert, not one insert per student.
    expect(tx.classPromotion.createMany).toHaveBeenCalledTimes(1);
    expect(tx.classPromotion.createMany.mock.calls[0][0].data).toHaveLength(2);
  });

  it("audits the run inside the transaction, with the year boundary it crossed", async () => {
    cohort.loadPromotionCohort.mockResolvedValue({
      entries: [cohortEntry({ studentProfileId: "stu-1", percentage: 90 })],
      nameByStudent: new Map([["stu-1", "Ali Khan"]]),
      legacyPlacementIds: [],
    });

    await POST(post(BASE_BODY));

    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
    const { data } = tx.auditLog.create.mock.calls[0][0];
    expect(data).toMatchObject({
      tenantId: "tenant-1",
      userId: "user-1",
      action: "PROMOTE",
      entity: "Promotion",
    });
    expect(data.details.fromAcademicYear.id).toBe("ay-2025");
    expect(data.details.toAcademicYear.id).toBe("ay-2026");
    expect(data.details.studentsProcessed).toBe(1);
  });

  it("treats an explicitly empty selection as an error, never as the whole cohort", async () => {
    cohort.loadPromotionCohort.mockResolvedValue({
      entries: [cohortEntry({ studentProfileId: "stu-1" })],
      nameByStudent: new Map([["stu-1", "Ali Khan"]]),
      legacyPlacementIds: [],
    });

    const res = await POST(post({ ...BASE_BODY, studentProfileIds: [] }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.details?.[0]?.code).toBe("EMPTY_SELECTION");
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Exit workflow: graduation and transfer-out are not the same event.
  // -------------------------------------------------------------------------
  it("transfers a student out: no target enrollment, dated exit, TRANSFERRED status", async () => {
    cohort.loadPromotionCohort.mockResolvedValue({
      entries: [cohortEntry({ studentProfileId: "stu-1", percentage: 90 })],
      nameByStudent: new Map([["stu-1", "Ali Khan"]]),
      legacyPlacementIds: [],
    });

    const res = await POST(
      post({
        ...BASE_BODY,
        exitDate: "2026-03-31",
        overrides: [{ studentProfileId: "stu-1", action: "TRANSFERRED" }],
      })
    );

    expect(res.status).toBe(201);

    // The promotion row records the transfer, still crossing the year boundary.
    const [createManyArgs] = tx.classPromotion.createMany.mock.calls[0];
    const row = createManyArgs.data[0];
    expect(row.status).toBe("TRANSFERRED");
    expect(row.toAcademicYearId).toBe("ay-2026");

    // A transferred student gets no enrollment for a year they never attend.
    const upsertYears = tx.studentAcademicSession.upsert.mock.calls.map(
      (call) => call[0].create.academicYearId
    );
    expect(upsertYears).toEqual(["ay-2025"]);

    // The profile leaves the roster with the operator's exit date recorded.
    expect(tx.studentProfile.update).not.toHaveBeenCalled();
    const [updateManyArgs] = tx.studentProfile.updateMany.mock.calls[0];
    expect(updateManyArgs.data.status).toBe("TRANSFERRED");
    expect(updateManyArgs.data.classId).toBeNull();
    expect(updateManyArgs.data.exitDate.toISOString().slice(0, 10)).toBe("2026-03-31");

    // A transcript that has been handed over is frozen.
    const [lockArgs] = tx.examResult.updateMany.mock.calls[0];
    expect(lockArgs.data.isLocked).toBe(true);
  });

  it("refuses a transfer that names a target class inside the school", async () => {
    cohort.loadPromotionCohort.mockResolvedValue({
      entries: [cohortEntry({ studentProfileId: "stu-1" })],
      nameByStudent: new Map([["stu-1", "Ali Khan"]]),
      legacyPlacementIds: [],
    });

    const res = await POST(
      post({
        ...BASE_BODY,
        overrides: [
          { studentProfileId: "stu-1", action: "TRANSFERRED", toClassId: "cls-6" },
        ],
      })
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.details?.[0]?.code).toBe("TRANSFER_TARGET_NOT_ALLOWED");
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("writes graduates and transfers under distinct lifecycle statuses", async () => {
    primeTerminalClass();
    cohort.loadPromotionCohort.mockResolvedValue({
      entries: [
        terminalEntry({ studentProfileId: "stu-1", studentId: "S001", name: "Ali", roll: "1" }),
        terminalEntry({ studentProfileId: "stu-2", studentId: "S002", name: "Sara", roll: "2" }),
      ],
      nameByStudent: new Map([
        ["stu-1", "Ali"],
        ["stu-2", "Sara"],
      ]),
      legacyPlacementIds: [],
    });

    const res = await POST(
      post({
        ...TERMINAL_BODY,
        overrides: [{ studentProfileId: "stu-2", action: "TRANSFERRED" }],
      })
    );

    expect(res.status).toBe(201);

    const byStatus = new Map(
      tx.studentProfile.updateMany.mock.calls.map((call) => [
        call[0].data.status,
        call[0].where.id.in,
      ])
    );

    expect(byStatus.get("GRADUATED")).toEqual(["stu-1"]);
    expect(byStatus.get("TRANSFERRED")).toEqual(["stu-2"]);
    // Neither exit may be left enrolled in the target year.
    expect(tx.studentAcademicSession.upsert).toHaveBeenCalledTimes(2);
  });

  it("defaults the exit date to the commit time when none is given", async () => {
    primeTerminalClass();
    cohort.loadPromotionCohort.mockResolvedValue({
      entries: [terminalEntry({ percentage: 88 })],
      nameByStudent: new Map([["stu-1", "Ali Khan"]]),
      legacyPlacementIds: [],
    });

    const before = Date.now();
    const res = await POST(post(TERMINAL_BODY));
    const json = await res.json();

    expect(res.status).toBe(201);
    const [updateManyArgs] = tx.studentProfile.updateMany.mock.calls[0];
    const exitDate = updateManyArgs.data.exitDate as Date;
    expect(exitDate.getTime()).toBeGreaterThanOrEqual(before);
    expect(json.data.exitDate).toBe(exitDate.toISOString());
  });

  it("reports an empty cohort as a 400 rather than silently succeeding", async () => {
    cohort.loadPromotionCohort.mockResolvedValue({
      entries: [],
      nameByStudent: new Map(),
      legacyPlacementIds: [],
    });

    const res = await POST(post(BASE_BODY));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.details?.[0]?.code).toBe("EMPTY_COHORT");
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Pre-flight gate. The same checks GET /api/promotions/preflight reports are
  // enforced here, because a gate that only exists in the UI is a suggestion.
  // -------------------------------------------------------------------------
  describe("pre-flight gate", () => {
    /**
     * The silent catastrophe: a null `nextClassId` is how the rule spells
     * "final class", so a blank one on Class 5 while Class 6 exists does not
     * error — it marks the whole class GRADUATED and takes them off the roster.
     */
    it("blocks a mid-ladder class whose next class was never configured", async () => {
      db.promotionRule.findFirst.mockResolvedValue(rule({ nextClassId: null }));
      cohort.loadPromotionCohort.mockResolvedValue({
        entries: [cohortEntry({ studentProfileId: "stu-1", percentage: 90 })],
        nameByStudent: new Map([["stu-1", "Ali Khan"]]),
        legacyPlacementIds: [],
      });

      const res = await POST(post(BASE_BODY));
      const json = await res.json();

      expect(res.status).toBe(409);
      expect(json.details.map((d: any) => d.code)).toContain("CLASS_WITHOUT_NEXT_CLASS");
      expect(db.$transaction).not.toHaveBeenCalled();
    });

    it("blocks a student who is already enrolled in the target year", async () => {
      cohort.loadPromotionCohort.mockResolvedValue({
        entries: [cohortEntry({ studentProfileId: "stu-1" })],
        nameByStudent: new Map([["stu-1", "Ali Khan"]]),
        legacyPlacementIds: [],
      });
      // The pre-flight probe selects `studentProfileId`; the roll-number query
      // selects `classId`/`rollNumber`. Answering only the first keeps them
      // distinguishable.
      db.studentAcademicSession.findMany.mockImplementation(async (args: any) =>
        args?.select?.studentProfileId ? [{ studentProfileId: "stu-1" }] : []
      );

      const res = await POST(post(BASE_BODY));
      const json = await res.json();

      expect(res.status).toBe(409);
      expect(json.details.map((d: any) => d.code)).toContain("DUPLICATE_ENROLLMENT");
      expect(db.$transaction).not.toHaveBeenCalled();
    });

    it("proceeds on warnings and hands them back with the result", async () => {
      const entry = cohortEntry({ studentProfileId: "stu-1" });
      entry.candidate.examResults = [];
      cohort.loadPromotionCohort.mockResolvedValue({
        entries: [entry],
        nameByStudent: new Map([["stu-1", "Ali Khan"]]),
        legacyPlacementIds: [],
      });

      const res = await POST(post(BASE_BODY));
      const json = await res.json();

      expect(res.status).toBe(201);
      const codes = json.data.warnings.preflight.map((w: any) => w.code);
      expect(codes).toContain("STUDENT_WITHOUT_RESULTS");
      // Warnings must never be flattened into the blocker path.
      expect(json.data.warnings.legacyPlacement).toEqual([]);
    });
  });
});
