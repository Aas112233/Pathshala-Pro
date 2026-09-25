// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * Route-level suite for the two read-only pre-flight endpoints.
 *
 * These are the surfaces an operator sees before they try anything destructive.
 * The point of the suite is not the happy path — it is that a blocked report
 * comes back as a *successful* read with `canProceed: false`, so the UI can
 * render findings, rather than as an HTTP error the UI would show as a failure.
 */

const db = vi.hoisted(() => ({
  academicYear: { findFirst: vi.fn(), findMany: vi.fn() },
  class: { findFirst: vi.fn(), findMany: vi.fn() },
  promotionRule: { findFirst: vi.fn(), findMany: vi.fn() },
  studentAcademicSession: { findMany: vi.fn() },
  studentProfile: { findMany: vi.fn() },
  classPromotion: { findMany: vi.fn() },
  examResult: { groupBy: vi.fn() },
  certificate: { findMany: vi.fn() },
  attendance: { groupBy: vi.fn() },
}));

const cohort = vi.hoisted(() => ({ loadPromotionCohort: vi.fn() }));

vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/promotion-roster", () => cohort);
vi.mock("@/lib/api-auth", () => ({
  requireApiAccess: vi.fn().mockResolvedValue({
    authContext: { tenantId: "tenant-1", user: { id: "user-1" } },
  }),
}));

import { GET as PROMOTION_PREFLIGHT_ROUTE } from "@/app/api/promotions/preflight/route";
import { GET as YEAR_PREFLIGHT_ROUTE } from "@/app/api/academic-years/[id]/preflight/route";

const promotionPreflight = PROMOTION_PREFLIGHT_ROUTE as unknown as (
  request: NextRequest
) => Promise<Response>;

const yearPreflight = YEAR_PREFLIGHT_ROUTE as unknown as (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => Promise<Response>;

const FROM_YEAR = {
  id: "ay-2025",
  label: "2025-2026",
  startDate: new Date("2025-04-01"),
  isClosed: false,
};
const TO_YEAR = {
  id: "ay-2026",
  label: "2026-2027",
  startDate: new Date("2026-04-01"),
  isClosed: false,
};

const CLASS_5 = { id: "cls-5", name: "Class 5", classNumber: 5 };
const CLASS_6 = { id: "cls-6", name: "Class 6", classNumber: 6 };

function cohortEntry(studentProfileId = "stu-1") {
  return {
    seed: {
      studentProfileId,
      studentId: "S001",
      studentName: "Ali Khan",
      rollNumber: "12",
      sectionId: "sec-a",
      groupId: null,
      placementSource: "session" as const,
      demographics: {
        guardianName: "Karim Khan",
        guardianContact: "03001234567",
        dateOfBirth: new Date("2014-06-01"),
        gender: "MALE",
      },
    },
    candidate: {
      studentProfileId,
      studentId: "S001",
      studentName: "Ali Khan",
      rollNumber: "12",
      fromClassId: CLASS_5.id,
      fromClassName: CLASS_5.name,
      fromClassNumber: CLASS_5.classNumber,
      examResults: [
        {
          subjectId: "sub-1",
          subjectName: "Mathematics",
          percentage: 90,
          status: "PASS",
          grade: "A",
          createdAt: new Date("2026-01-15"),
        },
      ],
      attendanceRate: null,
      attendancePresentDays: 0,
      attendanceTotalDays: 0,
    },
  };
}

function promotionRequest(query: Record<string, string> = {}) {
  const params = new URLSearchParams({
    classId: CLASS_5.id,
    academicYearId: FROM_YEAR.id,
    toAcademicYearId: TO_YEAR.id,
    ...query,
  });
  return new NextRequest(`http://localhost:3000/api/promotions/preflight?${params}`);
}

function yearRequest(id = FROM_YEAR.id) {
  return new NextRequest(`http://localhost:3000/api/academic-years/${id}/preflight`);
}

const yearParams = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();

  db.academicYear.findFirst.mockImplementation(async ({ where }: any) =>
    where.id === FROM_YEAR.id ? FROM_YEAR : TO_YEAR
  );
  db.academicYear.findMany.mockResolvedValue([]);
  db.class.findFirst.mockResolvedValue(CLASS_5);
  db.class.findMany.mockResolvedValue([CLASS_5, CLASS_6]);
  db.promotionRule.findFirst.mockResolvedValue({
    classId: CLASS_5.id,
    nextClassId: CLASS_6.id,
    isActive: true,
    minimumAttendance: 75,
  });
  db.promotionRule.findMany.mockResolvedValue([
    { classId: CLASS_5.id, nextClassId: CLASS_6.id, isActive: true, minimumAttendance: 75 },
  ]);
  db.studentAcademicSession.findMany.mockImplementation(async ({ where }: any) =>
    // Every cohort student holds a source-year enrollment row: that is the
    // healthy state, and the probe is asked by student id.
    (where?.studentProfileId?.in ?? []).map((id: string) => ({
      studentProfileId: id,
      academicYearId: FROM_YEAR.id,
    }))
  );
  db.studentProfile.findMany.mockResolvedValue([]);
  db.classPromotion.findMany.mockResolvedValue([]);
  db.examResult.groupBy.mockResolvedValue([]);
  db.certificate.findMany.mockResolvedValue([]);
  // No attendance on file: the gate must treat this as "not tracked" and never
  // enforce a requirement against it.
  db.attendance.groupBy.mockResolvedValue([]);

  cohort.loadPromotionCohort.mockResolvedValue({
    entries: [cohortEntry()],
    nameByStudent: new Map([["stu-1", "Ali Khan"]]),
    legacyPlacementIds: [],
  });
});

describe("GET /api/promotions/preflight", () => {
  it("requires the class, the source year and an explicit target year", async () => {
    const res = await promotionPreflight(
      new NextRequest("http://localhost:3000/api/promotions/preflight?classId=cls-5")
    );

    expect(res.status).toBe(400);
    expect(db.class.findFirst).not.toHaveBeenCalled();
  });

  it("reports a clean cohort as passable, with the context it judged", async () => {
    const res = await promotionPreflight(promotionRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.canProceed).toBe(true);
    expect(json.data.counts).toEqual({ blockers: 0, warnings: 0 });
    expect(json.data.fromAcademicYear.label).toBe(FROM_YEAR.label);
    expect(json.data.toAcademicYear.label).toBe(TO_YEAR.label);
    expect(json.data.class.name).toBe(CLASS_5.name);
    expect(json.data.studentsConsidered).toBe(1);
  });

  /**
   * A blocked report is still a successful read. Returning 409 here would make
   * the UI treat a readiness check as a failure and hide the findings.
   */
  it("returns 200 with canProceed false when a blocker is found", async () => {
    db.promotionRule.findFirst.mockResolvedValue({
      classId: CLASS_5.id,
      nextClassId: null,
      isActive: true,
      minimumAttendance: 75,
    });

    const res = await promotionPreflight(promotionRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.canProceed).toBe(false);
    expect(json.data.blockers.map((b: any) => b.code)).toContain("CLASS_WITHOUT_NEXT_CLASS");
    // Blockers carry a translatable code and the params the UI needs.
    const finding = json.data.blockers.find(
      (b: any) => b.code === "CLASS_WITHOUT_NEXT_CLASS"
    );
    expect(finding.params.higherClassName).toBe(CLASS_6.name);
    expect(finding.subject).toMatchObject({ kind: "class", id: CLASS_5.id });
  });

  it("treats an absent selection as the whole class", async () => {
    const res = await promotionPreflight(promotionRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.studentsConsidered).toBe(1);
  });

  /**
   * An explicitly empty selection is a caller mistake. Widening it to the whole
   * class would turn a failed multi-select into a bulk promotion.
   */
  it("treats a present-but-empty selection as nothing selected", async () => {
    const res = await promotionPreflight(promotionRequest({ studentProfileIds: "" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.canProceed).toBe(false);
    expect(json.data.blockers.map((b: any) => b.code)).toContain("EMPTY_COHORT");
    expect(json.data.studentsConsidered).toBe(0);
  });

  it("narrows the cohort to an explicit selection", async () => {
    cohort.loadPromotionCohort.mockResolvedValue({
      entries: [cohortEntry("stu-1"), cohortEntry("stu-2")],
      nameByStudent: new Map([
        ["stu-1", "Ali Khan"],
        ["stu-2", "Sara"],
      ]),
      legacyPlacementIds: [],
    });

    const res = await promotionPreflight(
      promotionRequest({ studentProfileIds: "stu-2" })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.studentsConsidered).toBe(1);
  });

  it("404s when the source year does not belong to the tenant", async () => {
    db.academicYear.findFirst.mockResolvedValue(null);

    const res = await promotionPreflight(promotionRequest());
    expect(res.status).toBe(404);
  });
});

describe("GET /api/academic-years/[id]/preflight", () => {
  it("reports a clean year as passable and says how much it scanned", async () => {
    const res = await yearPreflight(yearRequest(), yearParams(FROM_YEAR.id));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.scope).toBe("yearClose");
    expect(json.data.year.label).toBe(FROM_YEAR.label);
    expect(json.data.canProceed).toBe(true);
    expect(json.data.scan).toEqual({ students: 0, truncated: false });
  });

  it("reports an unpromoted student as a blocker without failing the read", async () => {
    db.class.findMany.mockResolvedValue([CLASS_5]);
    db.promotionRule.findMany.mockResolvedValue([
      { classId: CLASS_5.id, nextClassId: null, isActive: true, minimumAttendance: 75 },
    ]);
    db.studentAcademicSession.findMany.mockResolvedValue([
      {
        studentProfileId: "stu-1",
        rollNumber: "1",
        classId: CLASS_5.id,
        class: { name: CLASS_5.name },
        studentProfile: {
          studentId: "S001",
          firstName: "Ali",
          lastName: "Khan",
          status: "ACTIVE",
          guardianName: "Karim Khan",
          guardianContact: "03001234567",
          dateOfBirth: new Date("2014-06-01"),
          gender: "MALE",
        },
      },
    ]);

    const res = await yearPreflight(yearRequest(), yearParams(FROM_YEAR.id));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.canProceed).toBe(false);
    expect(json.data.blockers.map((b: any) => b.code)).toContain("UNPROMOTED_STUDENT");
    expect(json.data.scan.students).toBe(1);
  });

  it("counts an exit document that was never issued as a warning, not a blocker", async () => {
    db.class.findMany.mockResolvedValue([CLASS_5]);
    db.promotionRule.findMany.mockResolvedValue([
      { classId: CLASS_5.id, nextClassId: null, isActive: true, minimumAttendance: 75 },
    ]);
    db.studentAcademicSession.findMany.mockResolvedValue([
      {
        studentProfileId: "stu-1",
        rollNumber: "1",
        classId: CLASS_5.id,
        class: { name: CLASS_5.name },
        studentProfile: {
          studentId: "S001",
          firstName: "Ali",
          lastName: "Khan",
          status: "GRADUATED",
          guardianName: "Karim Khan",
          guardianContact: "03001234567",
          dateOfBirth: new Date("2014-06-01"),
          gender: "MALE",
        },
      },
    ]);
    db.classPromotion.findMany.mockResolvedValue([
      { studentProfileId: "stu-1", status: "GRADUATED" },
    ]);

    const res = await yearPreflight(yearRequest(), yearParams(FROM_YEAR.id));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.canProceed).toBe(true);
    expect(json.data.warnings.map((w: any) => w.code)).toContain("UNISSUED_EXIT_DOCUMENT");
  });

  /**
   * The gate's attendance dimension, end to end through the loader: the counts
   * come from a `groupBy`, the rate from the shared `attendance-rate` module,
   * and the bar from the class's own rule rather than a hardcoded default.
   */
  describe("attendance shortfalls", () => {
    function activeSessionRow() {
      return {
        studentProfileId: "stu-1",
        rollNumber: "1",
        classId: CLASS_5.id,
        class: { name: CLASS_5.name },
        studentProfile: {
          studentId: "S001",
          firstName: "Ali",
          lastName: "Khan",
          status: "ACTIVE",
          guardianName: "Karim Khan",
          guardianContact: "03001234567",
          dateOfBirth: new Date("2014-06-01"),
          gender: "MALE",
        },
      };
    }

    function primeYearClose(minimumAttendance = 75) {
      db.class.findMany.mockResolvedValue([CLASS_5]);
      db.promotionRule.findMany.mockResolvedValue([
        { classId: CLASS_5.id, nextClassId: null, isActive: true, minimumAttendance },
      ]);
      db.studentAcademicSession.findMany.mockResolvedValue([activeSessionRow()]);
      // Promoted, so the unpromoted blocker stays out of the way and the
      // attendance warning is what the assertion is actually about.
      db.classPromotion.findMany.mockResolvedValue([
        { studentProfileId: "stu-1", status: "PROMOTED" },
      ]);
    }

    it("warns without blocking, and reads the counts it was given", async () => {
      primeYearClose();
      db.attendance.groupBy.mockResolvedValue([
        { studentProfileId: "stu-1", status: "PRESENT", _count: { _all: 68 } },
        { studentProfileId: "stu-1", status: "ABSENT", _count: { _all: 32 } },
      ]);

      const res = await yearPreflight(yearRequest(), yearParams(FROM_YEAR.id));
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.canProceed).toBe(true);
      const warning = json.data.warnings.find(
        (w: any) => w.code === "ATTENDANCE_BELOW_REQUIREMENT"
      );
      expect(warning.params.actual).toBe(68);
      expect(warning.params.required).toBe(75);
      expect(warning.subject).toMatchObject({ kind: "student", id: "stu-1" });

      // Scoped to the year being closed, exactly as the promotion engine scopes
      // it, so the close-time figure is the one the engine judged with.
      expect(db.attendance.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          by: ["studentProfileId", "status"],
          where: {
            tenantId: "tenant-1",
            academicYearId: FROM_YEAR.id,
            studentProfileId: { in: ["stu-1"] },
          },
        })
      );
    });

    /**
     * Holidays are the reason this figure has one definition. `POST
     * /api/attendance` writes a `HOLIDAY` row for every student when an
     * academic holiday covers the date, so counting them as absences would
     * understate every student by the holiday fraction of the year.
     */
    it("drops holiday rows from the denominator rather than counting them absent", async () => {
      primeYearClose();
      db.attendance.groupBy.mockResolvedValue([
        { studentProfileId: "stu-1", status: "PRESENT", _count: { _all: 80 } },
        { studentProfileId: "stu-1", status: "HOLIDAY", _count: { _all: 20 } },
      ]);

      const res = await yearPreflight(yearRequest(), yearParams(FROM_YEAR.id));
      const json = await res.json();

      // 80 of 80 teaching days, not 80 of 100.
      expect(json.data.canProceed).toBe(true);
      expect(json.data.warnings.map((w: any) => w.code)).not.toContain(
        "ATTENDANCE_BELOW_REQUIREMENT"
      );
    });

    it("takes the bar from the class rule, not from a default", async () => {
      primeYearClose(90);
      db.attendance.groupBy.mockResolvedValue([
        { studentProfileId: "stu-1", status: "PRESENT", _count: { _all: 82 } },
        { studentProfileId: "stu-1", status: "ABSENT", _count: { _all: 18 } },
      ]);

      const res = await yearPreflight(yearRequest(), yearParams(FROM_YEAR.id));
      const json = await res.json();

      const warning = json.data.warnings.find(
        (w: any) => w.code === "ATTENDANCE_BELOW_REQUIREMENT"
      );
      expect(warning.params.actual).toBe(82);
      expect(warning.params.required).toBe(90);
    });
  });

  it("404s for a year outside the tenant", async () => {
    db.academicYear.findFirst.mockResolvedValue(null);

    const res = await yearPreflight(yearRequest("ay-other"), yearParams("ay-other"));
    expect(res.status).toBe(404);
  });
});
