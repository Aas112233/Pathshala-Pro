import { describe, expect, it } from "vitest";
import { decidePromotion, isExitAction, type PromotionCandidate } from "@/lib/promotion-engine";
import { runPromotionPreflight } from "@/lib/rollover-preflight";
import { planRollover, type RolloverTimetable } from "@/lib/rollover-plan";

/**
 * The seam between promotion and the academic-year rollover.
 *
 * Each module has its own suite. This one exists because the two features are
 * used together in one afternoon by one operator, and the interesting failures
 * live in the seam: a rollover that copies no rule leaves a year that cannot
 * promote; a promotion run before the rollover puts students in a year whose
 * configuration has not arrived yet; a mid-ladder class with no next class
 * graduates a cohort silently.
 *
 * Everything here runs the real decision modules. No fixture stands in for the
 * planner or the engine, because a fixture would agree with whatever this test
 * assumed.
 */

// ---------------------------------------------------------------------------
// One school: Class 5 -> 6 -> 7 -> 10, 2026-27 rolling into 2027-28.
// ---------------------------------------------------------------------------

const CLASSES = [
  { id: "cls-5", name: "Class 5", classNumber: 5 },
  { id: "cls-6", name: "Class 6", classNumber: 6 },
  { id: "cls-7", name: "Class 7", classNumber: 7 },
  { id: "cls-10", name: "Class 10", classNumber: 10 },
];

const CLASS_5 = CLASSES[0];
const CLASS_6 = CLASSES[1];

const SOURCE_YEAR = {
  id: "ay-2026",
  label: "2026-2027",
  startDate: "2026-04-01T00:00:00.000Z",
  endDate: "2027-03-31T00:00:00.000Z",
  isClosed: false,
  nonWorkingWeekdays: [5, 6] as unknown,
};

function ruleFor(classId: string, nextClassId: string | null) {
  return {
    id: `rule-${classId}`,
    classId,
    academicYearId: SOURCE_YEAR.id,
    minimumAttendance: 75,
    minimumOverallPercentage: 40,
    minimumPerSubject: 33,
    maxFailedSubjects: 0,
    allowConditionalPromotion: true,
    autoPromote: true,
    nextClassId,
    isActive: true,
  };
}

/** The rules the source year holds, one per class in the ladder. */
const SOURCE_RULES = [
  ruleFor("cls-5", "cls-6"),
  ruleFor("cls-6", "cls-7"),
  ruleFor("cls-7", "cls-10"),
  ruleFor("cls-10", null),
];

function candidate(overrides: Partial<PromotionCandidate> = {}): PromotionCandidate {
  return {
    studentProfileId: "sp-1",
    studentId: "STU-0001",
    studentName: "Ayaan Rahman",
    rollNumber: "01",
    fromClassId: "cls-5",
    fromClassName: "Class 5",
    fromClassNumber: 5,
    attendanceRate: 92,
    attendancePresentDays: 184,
    attendanceTotalDays: 200,
    examResults: [
      { subjectId: "s1", subjectName: "Mathematics", percentage: 78, status: "PASS", grade: "A", createdAt: "2027-03-01" },
      { subjectId: "s2", subjectName: "Science", percentage: 71, status: "PASS", grade: "A", createdAt: "2027-03-01" },
      { subjectId: "s3", subjectName: "English", percentage: 66, status: "PASS", grade: "B", createdAt: "2027-03-01" },
    ],
    ...overrides,
  };
}

/**
 * The pre-flight reads a narrower student shape than the engine does, and it
 * carries the demographics itself — a missing guardian name is one of the
 * things it is checking for.
 */
function preflightStudent() {
  const base = candidate();
  return {
    studentProfileId: base.studentProfileId,
    studentId: base.studentId,
    studentName: base.studentName,
    rollNumber: base.rollNumber,
    hasExamResults: base.examResults.length > 0,
    demographics: {
      guardianName: "Md Rahman",
      guardianContact: "01700000000",
      dateOfBirth: "2015-01-01",
      gender: "MALE",
    },
    enrolledAcademicYearIds: [SOURCE_YEAR.id],
  };
}

function timetable(overrides: Partial<RolloverTimetable> = {}): RolloverTimetable {
  return {
    classId: "cls-5",
    sectionId: null,
    dayOfWeek: "MONDAY",
    periodNumber: 1,
    startTime: "08:00",
    endTime: "08:45",
    subjectId: "sub-1",
    staffProfileId: "staff-1",
    roomNumber: "204",
    isBreak: false,
    breakLabel: null,
    needsReview: false,
    ...overrides,
  };
}

/** A rollover into a fresh 2027-28, carrying everything. */
function rolloverPlan(overrides: {
  copy?: { promotionRules: boolean; feeStructures: boolean; timetables: boolean };
  targetRules?: typeof SOURCE_RULES;
  source?: Partial<typeof SOURCE_YEAR>;
} = {}) {
  return planRollover({
    source: {
      ...SOURCE_YEAR,
      promotionRules: SOURCE_RULES,
      feeStructures: [],
      timetables: [timetable()],
      ...overrides.source,
    },
    target: {
      mode: "CREATE",
      yearId: "AY2027",
      label: "2027-2028",
      startDate: "2027-04-01T00:00:00.000Z",
      endDate: "2028-03-31T00:00:00.000Z",
    },
    targetPromotionRules: overrides.targetRules ?? [],
    targetFeeStructures: [],
    targetTimetables: [],
    allClasses: CLASSES,
    allSections: [],
    existingYearIds: [],
    copy: overrides.copy ?? { promotionRules: true, feeStructures: true, timetables: true },
    feeBalancePolicy: "CARRY_BALANCE",
    targetFeeBalancePolicy: null,
    sourceOutstanding: { studentCount: 0, totalBalance: 0 },
  });
}

function codesOf(plan: ReturnType<typeof rolloverPlan>) {
  return [...plan.blockers, ...plan.warnings].map((finding) => finding.code);
}

// ---------------------------------------------------------------------------

describe("promotion and the rollover agree with each other", () => {
  it("promotes a passing student into the class the rule names", () => {
    const decision = decidePromotion(candidate(), ruleFor("cls-5", "cls-6"));

    expect(decision.action).toBe("PROMOTED");
    expect(decision.advances).toBe(true);
    expect(decision.exits).toBe(false);
    // The class recorded for the target year is the rule's next class — the
    // same class the rollover's copied rule will point at.
    expect(decision.targetClassId).toBe("cls-6");
  });

  it("leaves a failing student behind, so the rollover's next year holds both groups", () => {
    const decision = decidePromotion(
      candidate({
        examResults: [
          { subjectId: "s1", subjectName: "Mathematics", percentage: 20, status: "FAIL", grade: "F", createdAt: "2027-03-01" },
          { subjectId: "s2", subjectName: "Science", percentage: 22, status: "FAIL", grade: "F", createdAt: "2027-03-01" },
          { subjectId: "s3", subjectName: "English", percentage: 25, status: "FAIL", grade: "F", createdAt: "2027-03-01" },
        ],
      }),
      ruleFor("cls-5", "cls-6")
    );

    expect(decision.action).toBe("RETAINED");
    expect(decision.repeats).toBe(true);
    expect(decision.advances).toBe(false);
  });

  it("graduates a final-class student, who then leaves the roster", () => {
    const decision = decidePromotion(
      candidate({ fromClassId: "cls-10", fromClassName: "Class 10", fromClassNumber: 10 }),
      ruleFor("cls-10", null)
    );

    expect(decision.action).toBe("GRADUATED");
    expect(decision.isTerminalClass).toBe(true);
    expect(decision.exits).toBe(true);
    expect(isExitAction(decision.action)).toBe(true);
  });

  it("blocks a rollover that would leave the next year unable to promote anyone", () => {
    // The operator declined the rule copy. The year opens, students are in it,
    // and nothing in it can ever be promoted — the "looks finished" trap.
    const plan = rolloverPlan({ copy: { promotionRules: false, feeStructures: true, timetables: true } });

    expect(plan.blockers.map((blocker) => blocker.code)).toContain(
      "TARGET_WILL_HAVE_NO_PROMOTION_RULES"
    );
    expect(plan.canProceed).toBe(false);
  });

  it("keeps the promotion chain intact across the rollover", () => {
    const plan = rolloverPlan();

    expect(plan.canProceed).toBe(true);
    // Every class that had a next class still has one, one year later.
    for (const row of plan.promotionRules.created) {
      if (row.classId === "cls-10") continue; // the terminal class ends the chain
      expect(row.values.nextClassId, `${row.classId} lost its next class`).toBeTruthy();
    }
    // And the chain still ends at the terminal class, so nobody is promoted
    // past the top of the school.
    const terminal = plan.promotionRules.created.find((row) => row.classId === "cls-10");
    expect(terminal?.values.nextClassId).toBeNull();
  });

  it("warns when students were promoted before the rollover ran", () => {
    // Promotion first, rollover second is a supported order — but the operator
    // must be told that the configuration arriving now applies to records that
    // already exist, rather than discovering it in a report later.
    const plan = planRollover({
      source: {
        ...SOURCE_YEAR,
        promotionRules: SOURCE_RULES,
        feeStructures: [],
        timetables: [],
      },
      target: {
        mode: "EXISTING",
        academicYearId: "ay-2027",
        label: "2027-2028",
        startDate: "2027-04-01T00:00:00.000Z",
        endDate: "2028-03-31T00:00:00.000Z",
        isClosed: false,
        nonWorkingWeekdays: [5, 6],
        enrolledStudents: 120,
      },
      targetPromotionRules: [],
      targetFeeStructures: [],
      targetTimetables: [],
      allClasses: CLASSES,
      allSections: [],
      existingYearIds: [],
      copy: { promotionRules: true, feeStructures: true, timetables: true },
      feeBalancePolicy: "CARRY_BALANCE",
      targetFeeBalancePolicy: null,
      sourceOutstanding: { studentCount: 0, totalBalance: 0 },
    });

    expect(codesOf(plan)).toContain("TARGET_YEAR_HAS_STUDENTS");
  });

  it("is a no-op when run twice, so a re-run cannot duplicate the setup", () => {
    const first = rolloverPlan();
    const copiedRules = first.promotionRules.created.map((row) => ({
      classId: row.classId,
      ...row.values,
    }));
    const copiedSlots = first.timetables.created.map((row) => ({
      classId: row.classId,
      ...row.values,
    }));

    // Rebuild with the copied state as the target's existing state.
    const rerun = planRollover({
      source: {
        ...SOURCE_YEAR,
        promotionRules: SOURCE_RULES,
        feeStructures: [],
        timetables: [timetable()],
      },
      target: {
        mode: "EXISTING",
        academicYearId: "ay-2027",
        label: "2027-2028",
        startDate: "2027-04-01T00:00:00.000Z",
        endDate: "2028-03-31T00:00:00.000Z",
        isClosed: false,
        nonWorkingWeekdays: [5, 6],
        enrolledStudents: 0,
      },
      targetPromotionRules: copiedRules,
      targetFeeStructures: [],
      targetTimetables: copiedSlots.map((slot) => ({ ...slot, needsReview: true })),
      allClasses: CLASSES,
      allSections: [],
      existingYearIds: [],
      copy: { promotionRules: true, feeStructures: true, timetables: true },
      feeBalancePolicy: "CARRY_BALANCE",
      targetFeeBalancePolicy: "CARRY_BALANCE",
      sourceOutstanding: { studentCount: 0, totalBalance: 0 },
    });

    expect(rerun.promotionRules.counts.created).toBe(0);
    expect(rerun.timetables.counts.created).toBe(0);
    expect(rerun.promotionRules.counts.skipped).toBe(SOURCE_RULES.length);
  });

  it("refuses to promote from a class that has no rule at all", () => {
    // Class 6 was added to the ladder after the year opened and nobody set its
    // rule. The pre-flight is what stands between that and a silent no-op.
    const report = runPromotionPreflight({
      fromYear: { id: SOURCE_YEAR.id, label: SOURCE_YEAR.label, startDate: SOURCE_YEAR.startDate, isClosed: false },
      toYear: { id: "ay-2027", label: "2027-2028", startDate: "2027-04-01", isClosed: false },
      fromClass: CLASS_6,
      allClasses: CLASSES,
      rule: null,
      cohort: [preflightStudent()],
    });

    const codes = report.blockers.map((finding) => finding.code);
    expect(codes).toContain("NO_PROMOTION_RULE");
    expect(report.canProceed).toBe(false);
  });

  it("refuses to promote a mid-ladder class whose next class was never set", () => {
    // This is the worst one: a blank nextClassId means "final class", so the
    // whole cohort would be graduated and taken off the roster with no error.
    const report = runPromotionPreflight({
      fromYear: { id: SOURCE_YEAR.id, label: SOURCE_YEAR.label, startDate: SOURCE_YEAR.startDate, isClosed: false },
      toYear: { id: "ay-2027", label: "2027-2028", startDate: "2027-04-01", isClosed: false },
      fromClass: CLASS_5,
      allClasses: CLASSES,
      rule: { classId: "cls-5", nextClassId: null, isActive: true, minimumAttendance: 75 },
      cohort: [preflightStudent()],
    });

    expect(report.blockers.map((finding) => finding.code)).toContain("CLASS_WITHOUT_NEXT_CLASS");
    expect(report.canProceed).toBe(false);
  });

  it("lets a clean cohort through the pre-flight", () => {
    const report = runPromotionPreflight({
      fromYear: { id: SOURCE_YEAR.id, label: SOURCE_YEAR.label, startDate: SOURCE_YEAR.startDate, isClosed: false },
      toYear: { id: "ay-2027", label: "2027-2028", startDate: "2027-04-01", isClosed: false },
      fromClass: CLASS_5,
      allClasses: CLASSES,
      rule: { classId: "cls-5", nextClassId: "cls-6", isActive: true, minimumAttendance: 75 },
      cohort: [preflightStudent()],
    });

    expect(report.canProceed).toBe(true);
  });
});
