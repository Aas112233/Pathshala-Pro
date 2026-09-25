import { describe, it, expect } from "vitest";
import {
  decidePromotion,
  applyOverride,
  isTerminalClass,
  isSubjectFailed,
  latestResultPerSubject,
  promotionStatusFor,
  studentStatusFor,
  summariseDecisions,
  suggestTargetAcademicYear,
  assignTargetRollNumbers,
  locksSourceYearResults,
  isExitAction,
  PROMOTION_ACTIONS,
  DERIVED_ACTIONS,
  OVERRIDE_ONLY_ACTIONS,
  CONDITIONAL_PROMOTION_MAX_FAILED_SUBJECTS,
  type PromotionRuleInput,
  type PromotionCandidate,
  type PromotionAction,
  type SubjectResultInput,
  type RollAssignmentInput,
} from "./promotion-engine";

function makeRule(overrides: Partial<PromotionRuleInput> = {}): PromotionRuleInput {
  return {
    id: "rule-1",
    classId: "class-1",
    academicYearId: "ay-2025",
    minimumAttendance: 75,
    minimumOverallPercentage: 40,
    minimumPerSubject: 33,
    maxFailedSubjects: 0,
    allowConditionalPromotion: false,
    autoPromote: true,
    nextClassId: "class-2",
    ...overrides,
  };
}

function subject(
  name: string,
  percentage: number,
  overrides: Partial<SubjectResultInput> = {}
): SubjectResultInput {
  return {
    subjectId: `sub-${name.toLowerCase().replace(/\s+/g, "-")}`,
    subjectName: name,
    percentage,
    status: percentage >= 33 ? "PASS" : "FAIL",
    grade: percentage >= 80 ? "A" : percentage >= 60 ? "B" : percentage >= 40 ? "C" : "F",
    createdAt: "2026-03-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeCandidate(overrides: Partial<PromotionCandidate> = {}): PromotionCandidate {
  return {
    studentProfileId: "stu-1",
    studentId: "STU-001",
    studentName: "Ayesha Khan",
    rollNumber: "001",
    fromClassId: "class-1",
    fromClassName: "Class 1",
    fromClassNumber: 1,
    examResults: [subject("Math", 80), subject("Science", 75), subject("English", 90)],
    attendanceRate: 92,
    attendancePresentDays: 92,
    attendanceTotalDays: 100,
    ...overrides,
  };
}

describe("promotion-engine", () => {
  describe("isTerminalClass", () => {
    it("treats a rule with no next class as terminal", () => {
      expect(isTerminalClass({ nextClassId: null })).toBe(true);
      expect(isTerminalClass({ nextClassId: "class-2" })).toBe(false);
    });
  });

  describe("isSubjectFailed", () => {
    it("fails on a recorded FAIL status even when above the floor", () => {
      expect(isSubjectFailed({ percentage: 60, status: "FAIL" }, 33)).toBe(true);
    });

    it("fails when below the per-subject floor even when status says PASS", () => {
      expect(isSubjectFailed({ percentage: 30, status: "PASS" }, 33)).toBe(true);
    });

    it("passes when both signals agree", () => {
      expect(isSubjectFailed({ percentage: 70, status: "PASS" }, 33)).toBe(false);
    });
  });

  describe("latestResultPerSubject", () => {
    it("keeps only the most recently created result per subject", () => {
      const results = [
        subject("Math", 40, { createdAt: "2026-01-01T00:00:00.000Z" }),
        subject("Math", 88, { createdAt: "2026-06-01T00:00:00.000Z" }),
        subject("Science", 70),
      ];
      const latest = latestResultPerSubject(results);
      expect(latest.size).toBe(2);
      expect(latest.get("sub-math")?.percentage).toBe(88);
    });
  });

  describe("decidePromotion - happy path", () => {
    it("promotes a student who clears every threshold", () => {
      const decision = decidePromotion(makeCandidate(), makeRule());

      expect(decision.action).toBe("PROMOTED");
      expect(decision.meetsCriteria).toBe(true);
      expect(decision.advances).toBe(true);
      expect(decision.repeats).toBe(false);
      expect(decision.exits).toBe(false);
      expect(decision.requiresReExam).toBe(false);
      expect(decision.targetClassId).toBe("class-2");
      expect(decision.metrics.overallPercentage).toBeCloseTo(81.67, 2);
    });

    it("graduates a student who clears every threshold in a terminal class", () => {
      const decision = decidePromotion(makeCandidate(), makeRule({ nextClassId: null }));

      expect(decision.action).toBe("GRADUATED");
      expect(decision.isTerminalClass).toBe(true);
      expect(decision.advances).toBe(false);
      expect(decision.exits).toBe(true);
      expect(decision.targetClassId).toBe("class-1");
      expect(decision.reasons.map((r) => r.code)).toContain("GRADUATED_FINAL_CLASS");
    });
  });

  describe("decidePromotion - retention", () => {
    it("retains a student who exceeds the failed-subject allowance", () => {
      const candidate = makeCandidate({
        examResults: [subject("Math", 20), subject("Science", 25), subject("English", 80)],
      });
      const decision = decidePromotion(candidate, makeRule());

      expect(decision.action).toBe("RETAINED");
      expect(decision.meetsCriteria).toBe(false);
      expect(decision.repeats).toBe(true);
      expect(decision.targetClassId).toBe("class-1");
      expect(decision.metrics.failedSubjectsCount).toBe(2);
      expect(decision.reasons.map((r) => r.code)).toContain("FAILED_SUBJECTS");
    });

    it("retains a student who falls below the overall percentage floor", () => {
      const candidate = makeCandidate({
        examResults: [subject("Math", 35), subject("Science", 36), subject("English", 34)],
      });
      const decision = decidePromotion(
        candidate,
        makeRule({ maxFailedSubjects: 5, minimumOverallPercentage: 50 })
      );

      expect(decision.action).toBe("RETAINED");
      expect(decision.reasons.map((r) => r.code)).toContain("LOW_OVERALL");
    });

    it("retains a student who passes every subject but misses the attendance floor", () => {
      const candidate = makeCandidate({ attendanceRate: 60 });
      const decision = decidePromotion(candidate, makeRule());

      expect(decision.action).toBe("RETAINED");
      expect(decision.meetsCriteria).toBe(false);
      expect(decision.metrics.attendanceTracked).toBe(true);
      expect(decision.reasons.map((r) => r.code)).toContain("LOW_ATTENDANCE");
    });

    it("repeats the final year rather than graduating when criteria are not met", () => {
      const candidate = makeCandidate({
        examResults: [subject("Math", 10), subject("Science", 15), subject("English", 20)],
      });
      const decision = decidePromotion(candidate, makeRule({ nextClassId: null }));

      expect(decision.action).toBe("RETAINED");
      expect(decision.exits).toBe(false);
      expect(decision.reasons.map((r) => r.code)).toContain("RETAINED_FINAL_CLASS");
    });
  });

  describe("decidePromotion - attendance tracking semantics", () => {
    it("does not enforce attendance when the year has no attendance records", () => {
      const candidate = makeCandidate({
        attendanceRate: null,
        attendancePresentDays: 0,
        attendanceTotalDays: 0,
      });
      const decision = decidePromotion(candidate, makeRule({ minimumAttendance: 95 }));

      expect(decision.metrics.attendanceTracked).toBe(false);
      expect(decision.metrics.attendanceRate).toBe(100);
      expect(decision.action).toBe("PROMOTED");
    });
  });

  describe("decidePromotion - per-subject floor", () => {
    it("honours a raised minimumPerSubject over a recorded PASS status", () => {
      const candidate = makeCandidate({
        examResults: [subject("Math", 45, { status: "PASS" }), subject("Science", 80)],
      });
      const decision = decidePromotion(candidate, makeRule({ minimumPerSubject: 50 }));

      expect(decision.metrics.failedSubjects).toContain("Math");
      expect(decision.subjectDetails.find((s) => s.subjectName === "Math")?.isFailed).toBe(true);
    });
  });

  describe("decidePromotion - conditional promotion", () => {
    it("offers conditional promotion within the documented bounds", () => {
      const candidate = makeCandidate({
        examResults: [subject("Math", 30), subject("Science", 45), subject("English", 45)],
      });
      const decision = decidePromotion(candidate, makeRule({ allowConditionalPromotion: true }));

      expect(decision.action).toBe("CONDITIONAL_PROMOTED");
      expect(decision.advances).toBe(true);
      expect(decision.requiresReExam).toBe(true);
      expect(decision.targetClassId).toBe("class-2");
      expect(decision.reasons.map((r) => r.code)).toContain("CONDITIONAL_ELIGIBLE");
    });

    it("refuses conditional promotion when the rule disallows it", () => {
      const candidate = makeCandidate({
        examResults: [subject("Math", 30), subject("Science", 45), subject("English", 45)],
      });
      const decision = decidePromotion(
        candidate,
        makeRule({ allowConditionalPromotion: false })
      );

      expect(decision.action).toBe("RETAINED");
    });

    it("refuses conditional promotion beyond the failed-subject ceiling", () => {
      // Four subjects with three failures: the average still clears the 40%
      // overall floor, so the failed-subject ceiling is the only blocker.
      const candidate = makeCandidate({
        examResults: [
          subject("Math", 20),
          subject("Science", 20),
          subject("English", 20),
          subject("Art", 100),
        ],
      });
      const decision = decidePromotion(candidate, makeRule({ allowConditionalPromotion: true }));

      expect(decision.metrics.failedSubjectsCount).toBe(3);
      expect(decision.metrics.failedSubjectsCount).toBeGreaterThan(
        CONDITIONAL_PROMOTION_MAX_FAILED_SUBJECTS
      );
      expect(decision.metrics.overallPercentage).toBeGreaterThanOrEqual(
        decision.metrics.minimumOverallPercentage
      );
      expect(decision.action).toBe("RETAINED");
    });

    it("refuses conditional promotion below the overall floor", () => {
      const candidate = makeCandidate({
        examResults: [subject("Math", 10), subject("Science", 20), subject("English", 21)],
      });
      const decision = decidePromotion(candidate, makeRule({ allowConditionalPromotion: true }));

      expect(decision.action).toBe("RETAINED");
    });

    it("refuses conditional promotion in a terminal class", () => {
      const candidate = makeCandidate({
        examResults: [subject("Math", 30), subject("Science", 45), subject("English", 45)],
      });
      const decision = decidePromotion(
        candidate,
        makeRule({ allowConditionalPromotion: true, nextClassId: null })
      );

      expect(decision.action).toBe("RETAINED");
    });

    it("refuses conditional promotion when attendance is short", () => {
      const candidate = makeCandidate({
        attendanceRate: 50,
        examResults: [subject("Math", 30), subject("Science", 45), subject("English", 45)],
      });
      const decision = decidePromotion(candidate, makeRule({ allowConditionalPromotion: true }));

      expect(decision.action).toBe("RETAINED");
    });
  });

  describe("decidePromotion - insufficient data", () => {
    it("flags a student with no results and retains rather than promoting blindly", () => {
      const decision = decidePromotion(makeCandidate({ examResults: [] }), makeRule());

      expect(decision.insufficientData).toBe(true);
      expect(decision.action).toBe("RETAINED");
      expect(decision.targetClassId).toBe("class-1");
      expect(decision.reasons.map((r) => r.code)).toContain("NO_EXAM_RESULTS");
    });
  });

  describe("applyOverride", () => {
    it("re-derives every movement flag from the overridden action", () => {
      const base = decidePromotion(makeCandidate(), makeRule());
      const overridden = applyOverride(base, { action: "RETAINED", reason: "Guardian request" });

      expect(overridden.action).toBe("RETAINED");
      expect(overridden.advances).toBe(false);
      expect(overridden.repeats).toBe(true);
      expect(overridden.exits).toBe(false);
      expect(overridden.targetClassId).toBe("class-1");
      expect(overridden.reasons[0].code).toBe("MANUAL_OVERRIDE");
    });

    it("requires an explicit target class for demotion", () => {
      const base = decidePromotion(makeCandidate(), makeRule());
      expect(() => applyOverride(base, { action: "DEMOTED" })).toThrow(
        /demotion requires an explicit target class/i
      );
    });

    it("records a demotion against the supplied lower class", () => {
      const base = decidePromotion(makeCandidate(), makeRule());
      const overridden = applyOverride(base, { action: "DEMOTED", toClassId: "class-0" });

      expect(overridden.action).toBe("DEMOTED");
      expect(overridden.targetClassId).toBe("class-0");
      expect(overridden.repeats).toBe(true);
      expect(overridden.advances).toBe(false);
    });

    it("can force a graduation override", () => {
      const base = decidePromotion(makeCandidate(), makeRule());
      const overridden = applyOverride(base, { action: "GRADUATED" });

      expect(overridden.exits).toBe(true);
      expect(overridden.meetsCriteria).toBe(true);
    });
  });

  describe("status mapping", () => {
    it("maps every action onto a session promotion status", () => {
      expect(promotionStatusFor("PROMOTED")).toBe("PROMOTED");
      expect(promotionStatusFor("RETAINED")).toBe("RETAINED");
      expect(promotionStatusFor("CONDITIONAL_PROMOTED")).toBe("CONDITIONAL");
      expect(promotionStatusFor("GRADUATED")).toBe("GRADUATED");
      expect(promotionStatusFor("DEMOTED")).toBe("DEMOTED");
    });

    it("only graduation changes the student lifecycle status", () => {
      expect(studentStatusFor("GRADUATED")).toBe("GRADUATED");
      expect(studentStatusFor("PROMOTED")).toBe("ACTIVE");
      expect(studentStatusFor("RETAINED")).toBe("ACTIVE");
      expect(studentStatusFor("CONDITIONAL_PROMOTED")).toBe("ACTIVE");
      expect(studentStatusFor("DEMOTED")).toBe("ACTIVE");
    });
  });

  describe("summariseDecisions", () => {
    it("counts each action and the derived movement buckets", () => {
      const rule = makeRule({ allowConditionalPromotion: true });
      const decisions = [
        decidePromotion(makeCandidate(), rule),
        decidePromotion(
          makeCandidate({
            examResults: [subject("Math", 30), subject("Science", 45), subject("English", 45)],
          }),
          rule
        ),
        decidePromotion(
          makeCandidate({
            examResults: [subject("Math", 10), subject("Science", 15), subject("English", 20)],
          }),
          rule
        ),
      ];

      const summary = summariseDecisions(decisions);
      expect(summary.total).toBe(3);
      expect(summary.promoted).toBe(1);
      expect(summary.conditionalPromoted).toBe(1);
      expect(summary.retained).toBe(1);
      expect(summary.advancing).toBe(2);
      expect(summary.requiringReExam).toBe(1);
    });
  });

  describe("suggestTargetAcademicYear", () => {
    const years = [
      { id: "y-2024", startDate: "2024-04-01T00:00:00.000Z" },
      { id: "y-2025", startDate: "2025-04-01T00:00:00.000Z" },
      { id: "y-2026", startDate: "2026-04-01T00:00:00.000Z" },
    ];

    it("returns the earliest year that starts after the source year", () => {
      expect(suggestTargetAcademicYear("y-2024", years)?.id).toBe("y-2025");
      expect(suggestTargetAcademicYear("y-2025", years)?.id).toBe("y-2026");
    });

    it("returns null when no later year exists", () => {
      expect(suggestTargetAcademicYear("y-2026", years)).toBeNull();
    });

    it("returns null when the only available year is the source year itself", () => {
      expect(suggestTargetAcademicYear("y-2025", [years[1]])).toBeNull();
    });

    it("returns null for an unknown source year", () => {
      expect(suggestTargetAcademicYear("does-not-exist", years)).toBeNull();
    });
  });

  describe("locksSourceYearResults", () => {
    it("freezes marks once the student has left the source year's class", () => {
      expect(locksSourceYearResults("PROMOTED")).toBe(true);
      expect(locksSourceYearResults("GRADUATED")).toBe(true);
      expect(locksSourceYearResults("DEMOTED")).toBe(true);
    });

    it("leaves marks editable when repeating or pending a re-examination", () => {
      expect(locksSourceYearResults("RETAINED")).toBe(false);
      expect(locksSourceYearResults("CONDITIONAL_PROMOTED")).toBe(false);
    });
  });

  describe("assignTargetRollNumbers", () => {
    function entry(
      id: string,
      targetClassId: string,
      sourceRollNumber: string,
      exits = false
    ): RollAssignmentInput {
      return { studentProfileId: id, targetClassId, sourceRollNumber, exits };
    }

    describe("PRESERVE policy", () => {
      it("carries source roll numbers into the target class", () => {
        const result = assignTargetRollNumbers(
          [entry("s1", "class-2", "1"), entry("s2", "class-2", "2")],
          {},
          "PRESERVE"
        );
        expect(result.conflicts).toEqual([]);
        expect(result.assignments.get("s1")).toBe("1");
        expect(result.assignments.get("s2")).toBe("2");
      });

      it("reports a collision instead of silently overwriting it", () => {
        const result = assignTargetRollNumbers(
          [entry("s1", "class-2", "1"), entry("s2", "class-2", "1")],
          {},
          "PRESERVE"
        );
        expect(result.conflicts).toHaveLength(1);
        expect(result.conflicts[0].studentProfileId).toBe("s2");
        expect(result.assignments.get("s1")).toBe("1");
        expect(result.assignments.has("s2")).toBe(false);
      });

      it("reports a collision against roll numbers already in the target year", () => {
        const result = assignTargetRollNumbers(
          [entry("s1", "class-2", "7")],
          { "class-2": ["7", "8"] },
          "PRESERVE"
        );
        expect(result.conflicts).toHaveLength(1);
        expect(result.conflicts[0].rollNumber).toBe("7");
      });

      it("does not treat the same roll number in a different class as a collision", () => {
        const result = assignTargetRollNumbers(
          [entry("s1", "class-2", "1"), entry("s2", "class-3", "1")],
          {},
          "PRESERVE"
        );
        expect(result.conflicts).toEqual([]);
        expect(result.assignments.size).toBe(2);
      });
    });

    describe("SEQUENTIAL policy", () => {
      it("assigns unique sequential numbers ordered by source roll", () => {
        const result = assignTargetRollNumbers(
          [
            entry("s3", "class-2", "10"),
            entry("s1", "class-2", "2"),
            entry("s2", "class-2", "3"),
          ],
          {},
          "SEQUENTIAL"
        );
        expect(result.conflicts).toEqual([]);
        expect(result.assignments.get("s1")).toBe("1");
        expect(result.assignments.get("s2")).toBe("2");
        expect(result.assignments.get("s3")).toBe("3");
      });

      it("continues after numbers already present in the target class", () => {
        const result = assignTargetRollNumbers(
          [entry("s1", "class-2", "1"), entry("s2", "class-2", "2")],
          { "class-2": ["1", "2", "3"] },
          "SEQUENTIAL"
        );
        expect(result.assignments.get("s1")).toBe("4");
        expect(result.assignments.get("s2")).toBe("5");
      });

      it("keeps numbering independent per target class", () => {
        const result = assignTargetRollNumbers(
          [entry("s1", "class-2", "1"), entry("s2", "class-3", "1")],
          {},
          "SEQUENTIAL"
        );
        expect(result.assignments.get("s1")).toBe("1");
        expect(result.assignments.get("s2")).toBe("1");
      });

      it("is deterministic regardless of input ordering", () => {
        const entries = [
          entry("s1", "class-2", "2"),
          entry("s2", "class-2", "3"),
          entry("s3", "class-2", "10"),
        ];
        const forward = assignTargetRollNumbers(entries, {}, "SEQUENTIAL");
        const reversed = assignTargetRollNumbers([...entries].reverse(), {}, "SEQUENTIAL");
        expect([...forward.assignments.entries()].sort()).toEqual(
          [...reversed.assignments.entries()].sort()
        );
      });

      it("never collides even when the source rolls are all identical", () => {
        const result = assignTargetRollNumbers(
          [entry("s1", "class-2", "1"), entry("s2", "class-2", "1"), entry("s3", "class-2", "1")],
          {},
          "SEQUENTIAL"
        );
        expect(result.conflicts).toEqual([]);
        expect(new Set(result.assignments.values()).size).toBe(3);
      });
    });

    it("assigns no roll number to students who exit", () => {
      const result = assignTargetRollNumbers(
        [entry("s1", "class-2", "1"), entry("s2", "class-2", "2", true)],
        {},
        "PRESERVE"
      );
      expect(result.assignments.has("s2")).toBe(false);
      expect(result.assignments.get("s1")).toBe("1");
    });
  });

  describe("exit actions (graduation vs transfer-out)", () => {
    it("classifies graduation and transfer-out as exits, and nothing else", () => {
      expect(isExitAction("GRADUATED")).toBe(true);
      expect(isExitAction("TRANSFERRED")).toBe(true);
      expect(isExitAction("PROMOTED")).toBe(false);
      expect(isExitAction("RETAINED")).toBe(false);
      expect(isExitAction("CONDITIONAL_PROMOTED")).toBe(false);
      expect(isExitAction("DEMOTED")).toBe(false);
    });

    it("keeps the derived and override-only action sets in sync with the enum", () => {
      // Every action is either derivable from a rule or reachable by override,
      // never neither — that would be an action no code path can produce.
      for (const action of PROMOTION_ACTIONS) {
        const reachable =
          DERIVED_ACTIONS.includes(action) || OVERRIDE_ONLY_ACTIONS.includes(action);
        expect(reachable, `${action} is unreachable`).toBe(true);
      }

      // A transfer is an external event, so no rule may derive one.
      expect(DERIVED_ACTIONS).not.toContain("TRANSFERRED");
      expect(OVERRIDE_ONLY_ACTIONS).toContain("TRANSFERRED");
    });

    it("maps a transfer onto the TRANSFERRED lifecycle status, not GRADUATED", () => {
      expect(studentStatusFor("TRANSFERRED")).toBe("TRANSFERRED");
      expect(studentStatusFor("GRADUATED")).toBe("GRADUATED");
      expect(studentStatusFor("PROMOTED")).toBe("ACTIVE");
      expect(promotionStatusFor("TRANSFERRED")).toBe("TRANSFERRED");
    });

    it("freezes the source year's marks on transfer-out", () => {
      // The transcript has been handed over; editing it afterwards would make
      // the issued document wrong.
      expect(locksSourceYearResults("TRANSFERRED")).toBe(true);
      expect(locksSourceYearResults("GRADUATED")).toBe(true);
      expect(locksSourceYearResults("RETAINED")).toBe(false);
      expect(locksSourceYearResults("CONDITIONAL_PROMOTED")).toBe(false);
    });

    it("applies a transfer override without inventing a target class", () => {
      const decision = decidePromotion(makeCandidate(), makeRule());
      const transferred = applyOverride(decision, { action: "TRANSFERRED" });

      expect(transferred.action).toBe("TRANSFERRED");
      expect(transferred.exits).toBe(true);
      expect(transferred.advances).toBe(false);
      expect(transferred.repeats).toBe(false);
      expect(transferred.requiresReExam).toBe(false);
      // A transfer has no destination class inside this school.
      expect(transferred.targetClassId).toBe(decision.fromClassId);
      expect(transferred.reasons.some((r) => r.code === "TRANSFERRED_OUT")).toBe(true);
    });

    it("re-derives every movement flag when an advancing student is transferred", () => {
      const decision = decidePromotion(makeCandidate(), makeRule());
      expect(decision.advances).toBe(true);

      const transferred = applyOverride(decision, { action: "TRANSFERRED" });
      // Leaving the class must clear the advancement, not leave it set.
      expect(transferred.advances).toBe(false);
      expect(transferred.exits).toBe(true);
      expect(transferred.targetClassId).toBe(decision.fromClassId);
    });

    it("still requires an explicit target class for a demotion", () => {
      const decision = decidePromotion(makeCandidate(), makeRule());
      expect(() => applyOverride(decision, { action: "DEMOTED" })).toThrow(
        /demotion requires an explicit target class/i
      );
    });

    it("counts transfers separately from graduates in the summary", () => {
      const rule = makeRule();
      const promoted = decidePromotion(makeCandidate({ studentProfileId: "s1" }), rule);
      const graduated = applyOverride(
        decidePromotion(
          makeCandidate({ studentProfileId: "s2" }),
          makeRule({ nextClassId: null })
        ),
        { action: "GRADUATED" }
      );
      const transferred = applyOverride(
        decidePromotion(makeCandidate({ studentProfileId: "s3" }), rule),
        { action: "TRANSFERRED" }
      );

      const summary = summariseDecisions([promoted, graduated, transferred]);

      expect(summary.graduated).toBe(1);
      expect(summary.transferred).toBe(1);
      expect(summary.promoted).toBe(1);
      // Both exits count as leaving, which is what the operator cares about.
      expect(summary.exiting).toBe(2);
      expect(summary.advancing).toBe(1);
    });

    it("never derives an exit from exam results alone", () => {
      // A student who clears every bar in a non-terminal class is promoted, not
      // graduated and not transferred. Exits are never inferred.
      const decision = decidePromotion(makeCandidate(), makeRule());
      expect(decision.action).toBe("PROMOTED");
      expect(decision.exits).toBe(false);
    });

    it("treats a failing student in a terminal class as retained, not exited", () => {
      const decision = decidePromotion(
        makeCandidate({ examResults: [subject("Mathematics", 20)] }),
        makeRule({ nextClassId: null })
      );
      expect(decision.action).toBe("RETAINED");
      expect(decision.exits).toBe(false);
      expect(decision.isTerminalClass).toBe(true);
    });

    it("excludes exit actions from the movement flags an override sets", () => {
      const decision = decidePromotion(makeCandidate(), makeRule());
      const actions: PromotionAction[] = ["GRADUATED", "TRANSFERRED"];

      for (const action of actions) {
        const result = applyOverride(decision, { action });
        expect(result.advances).toBe(false);
        expect(result.repeats).toBe(false);
        expect(result.exits).toBe(true);
      }
    });
  });
});
