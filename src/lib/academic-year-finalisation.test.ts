// @vitest-environment node
import { describe, it, expect } from "vitest";

import {
  accumulateFinalisation,
  emptyFinalisationTotals,
  finalisationTotalsSummary,
  finaliseSessionResults,
  MAX_REPORTED_WITHOUT_RESULTS,
  type FinalisationInput,
  type FinalisationResultRow,
  type FinalisationSessionRow,
} from "@/lib/academic-year-finalisation";
import { decidePromotion, type PromotionRuleInput } from "@/lib/promotion-engine";

/**
 * The year-close snapshot.
 *
 * The load-bearing test here is "agrees with the promotion engine's overall
 * percentage". Everything else checks that the arithmetic is the arithmetic it
 * claims to be; that one checks the invariant the whole module exists for —
 * that the figure frozen onto a session is the figure the promotion decision
 * was made on, and not merely a similar one.
 */

function result(overrides: Partial<FinalisationResultRow> = {}): FinalisationResultRow {
  return {
    studentProfileId: "stu-1",
    subjectId: "sub-1",
    subjectName: "Bangla",
    percentage: 80,
    status: "PASS",
    grade: "A+",
    gradePoint: 5,
    examId: "exam-annual",
    maxMarks: 100,
    obtainedMarks: 80,
    createdAt: new Date("2027-11-01T00:00:00.000Z"),
    ...overrides,
  };
}

function session(overrides: Partial<FinalisationSessionRow> = {}): FinalisationSessionRow {
  return {
    sessionId: "sess-1",
    studentProfileId: "stu-1",
    classId: "cls-1",
    rollNumber: "01",
    ...overrides,
  };
}

function input(overrides: Partial<FinalisationInput> = {}): FinalisationInput {
  return {
    academicYearId: "ay-2027",
    finalisedAt: "2027-12-31T00:00:00.000Z",
    sessions: [session()],
    results: [result()],
    ...overrides,
  };
}

const RULE: PromotionRuleInput = {
  id: "rule-1",
  classId: "cls-1",
  academicYearId: "ay-2027",
  minimumAttendance: 75,
  minimumOverallPercentage: 33,
  minimumPerSubject: 33,
  maxFailedSubjects: 2,
  allowConditionalPromotion: true,
  autoPromote: true,
  nextClassId: "cls-2",
};

describe("finaliseSessionResults — the frozen figures", () => {
  it("records the mean of the latest result per subject", () => {
    const report = finaliseSessionResults(
      input({
        results: [
          result({ subjectId: "sub-1", subjectName: "Bangla", percentage: 80 }),
          result({ subjectId: "sub-2", subjectName: "English", percentage: 60 }),
          result({ subjectId: "sub-3", subjectName: "Maths", percentage: 40 }),
        ],
      })
    );

    const [finalised] = report.sessions;
    expect(finalised.finalPercentage).toBe(60);
    expect(finalised.subjectCount).toBe(3);
    expect(report.counts.withResults).toBe(1);
    expect(report.counts.resultsConsidered).toBe(3);
  });

  it("uses the most recent sitting for a subject examined twice", () => {
    const report = finaliseSessionResults(
      input({
        results: [
          result({
            subjectId: "sub-1",
            percentage: 40,
            createdAt: new Date("2027-06-01T00:00:00.000Z"),
          }),
          result({
            subjectId: "sub-1",
            percentage: 70,
            createdAt: new Date("2027-12-01T00:00:00.000Z"),
          }),
        ],
      })
    );

    const [finalised] = report.sessions;
    // One subject, so the mean is the later sitting itself — not the average of
    // both attempts, which would be 55 and would understate a re-sit pass.
    expect(finalised.finalPercentage).toBe(70);
    expect(finalised.subjectCount).toBe(1);
    expect(report.counts.resultsConsidered).toBe(1);
  });

  /**
   * The invariant this module exists for. If these two ever diverge, the frozen
   * year contradicts the promotion that closed it — and the snapshot is the
   * artefact people trust.
   */
  it("agrees with the promotion engine's overall percentage", () => {
    const results = [
      result({ subjectId: "sub-1", subjectName: "Bangla", percentage: 78.5 }),
      result({ subjectId: "sub-2", subjectName: "English", percentage: 41.25 }),
      result({ subjectId: "sub-3", subjectName: "Maths", percentage: 29 }),
      result({ subjectId: "sub-4", subjectName: "Science", percentage: 66.75 }),
      result({ subjectId: "sub-5", subjectName: "Religion", percentage: 90.5 }),
    ];

    const [finalised] = finaliseSessionResults(input({ results })).sessions;

    const decision = decidePromotion(
      {
        studentProfileId: "stu-1",
        studentId: "S001",
        studentName: "Ayesha Rahman",
        rollNumber: "01",
        fromClassId: "cls-1",
        fromClassName: "Class 1",
        fromClassNumber: 1,
        examResults: results,
        attendanceRate: 90,
        attendancePresentDays: 180,
        attendanceTotalDays: 200,
      },
      RULE
    );

    expect(finalised.finalPercentage).toBe(decision.metrics.overallPercentage);
    expect(finalised.subjectCount).toBe(decision.metrics.totalSubjects);
  });

  it("derives GPA from the recorded grade points, not from the averaged percentage", () => {
    const report = finaliseSessionResults(
      input({
        results: [
          result({ subjectId: "sub-1", subjectName: "Bangla", percentage: 80, gradePoint: 5 }),
          result({ subjectId: "sub-2", subjectName: "English", percentage: 70, gradePoint: 4.5 }),
        ],
      })
    );

    const [finalised] = report.sessions;
    expect(finalised.finalPercentage).toBe(75);
    // 75% lands in a 4.0-point band, but the mean of the two subject grade
    // points is 4.75 — which is what a GPA actually is.
    expect(finalised.finalGpa).toBe(4.75);
    expect(finalised.finalGpa).not.toBe(4);
  });

  it("sums marks over the latest sitting of each subject", () => {
    const report = finaliseSessionResults(
      input({
        results: [
          result({
            subjectId: "sub-1",
            maxMarks: 100,
            obtainedMarks: 40,
            createdAt: new Date("2027-06-01T00:00:00.000Z"),
          }),
          result({
            subjectId: "sub-1",
            maxMarks: 100,
            obtainedMarks: 70,
            createdAt: new Date("2027-12-01T00:00:00.000Z"),
          }),
          result({
            subjectId: "sub-2",
            subjectName: "English",
            maxMarks: 50,
            obtainedMarks: 25,
            percentage: 50,
            gradePoint: 3.5,
          }),
        ],
      })
    );

    const [finalised] = report.sessions;
    // The superseded 40/100 attempt must not be counted.
    expect(finalised.totalMarks).toBe(150);
    expect(finalised.obtainedMarks).toBe(95);
  });

  it("records the exam each frozen mark came from", () => {
    const report = finaliseSessionResults(
      input({
        results: [
          result({ subjectId: "sub-1", subjectName: "Bangla", examId: "exam-half" }),
          result({ subjectId: "sub-2", subjectName: "English", examId: "exam-annual" }),
        ],
      })
    );

    const subjects = report.sessions[0].snapshot?.subjects ?? [];
    expect(subjects.map((subject) => [subject.subjectName, subject.examId])).toEqual([
      ["Bangla", "exam-half"],
      ["English", "exam-annual"],
    ]);
  });

  it("orders the snapshot's subjects so the same year always serialises the same way", () => {
    const report = finaliseSessionResults(
      input({
        results: [
          result({ subjectId: "sub-3", subjectName: "Science" }),
          result({ subjectId: "sub-1", subjectName: "Bangla" }),
          result({ subjectId: "sub-2", subjectName: "English" }),
        ],
      })
    );

    expect(report.sessions[0].snapshot?.subjects.map((s) => s.subjectName)).toEqual([
      "Bangla",
      "English",
      "Science",
    ]);
  });

  it("carries the year and the finalisation time on the snapshot", () => {
    const report = finaliseSessionResults(input());

    expect(report.sessions[0].snapshot).toMatchObject({
      academicYearId: "ay-2027",
      finalisedAt: "2027-12-31T00:00:00.000Z",
      finalPercentage: 80,
      finalGpa: 5,
    });
  });
});

describe("finaliseSessionResults — absence of results", () => {
  /**
   * Zero is a real mark. A student who was never examined has no percentage, and
   * writing 0 would invent a failing grade for them — on a row that can never be
   * corrected, because the year is closed and nothing reopens it.
   */
  it("leaves the finals null rather than zero when the student sat nothing", () => {
    const report = finaliseSessionResults(input({ results: [] }));

    const [finalised] = report.sessions;
    expect(finalised.finalPercentage).toBeNull();
    expect(finalised.finalGpa).toBeNull();
    expect(finalised.snapshot).toBeNull();
    expect(finalised.subjectCount).toBe(0);
    expect(finalised.totalMarks).toBe(0);
    expect(finalised.obtainedMarks).toBe(0);

    expect(report.counts).toEqual({
      sessions: 1,
      withResults: 0,
      withoutResults: 1,
      resultsConsidered: 0,
    });
  });

  it("does not let one student's results leak into another's session", () => {
    const report = finaliseSessionResults(
      input({
        sessions: [session(), session({ sessionId: "sess-2", studentProfileId: "stu-2", rollNumber: "02" })],
        results: [result({ studentProfileId: "stu-1", percentage: 90 })],
      })
    );

    const byId = new Map(report.sessions.map((s) => [s.sessionId, s]));
    expect(byId.get("sess-1")?.finalPercentage).toBe(90);
    expect(byId.get("sess-2")?.finalPercentage).toBeNull();
    expect(report.counts.withoutResults).toBe(1);
  });

  it("caps the reported sample but still counts every student", () => {
    const report = finaliseSessionResults(
      input({
        sessions: ["01", "02", "03", "04", "05"].map((rollNumber, index) =>
          session({
            sessionId: `sess-${index + 1}`,
            studentProfileId: `stu-${index + 1}`,
            rollNumber,
          })
        ),
        results: [],
        perCodeLimit: 2,
      })
    );

    expect(report.withoutResults).toHaveLength(2);
    expect(report.withoutResultsTruncated).toBe(true);
    // The true total is never truncated — only how many are listed.
    expect(report.counts.withoutResults).toBe(5);
    expect(report.sessions).toHaveLength(5);
  });

  it("reports the sample in a stable order across runs", () => {
    const build = () =>
      finaliseSessionResults(
        input({
          sessions: [
            session({ sessionId: "sess-b", studentProfileId: "stu-b", rollNumber: "2" }),
            session({ sessionId: "sess-a", studentProfileId: "stu-a", rollNumber: "10" }),
            session({ sessionId: "sess-c", studentProfileId: "stu-c", rollNumber: "1" }),
          ],
          results: [],
        })
      );

    // Numeric roll ordering, so "10" does not sort before "2".
    expect(build().sessions.map((s) => s.sessionId)).toEqual(["sess-c", "sess-b", "sess-a"]);
    expect(build()).toEqual(build());
  });
});

describe("accumulateFinalisation", () => {
  function page(percentages: Array<number | null>) {
    return finaliseSessionResults({
      academicYearId: "ay-2027",
      finalisedAt: "2027-12-31T00:00:00.000Z",
      sessions: percentages.map((_, index) =>
        session({
          sessionId: `sess-${index}`,
          studentProfileId: `stu-${index}`,
          rollNumber: String(index).padStart(2, "0"),
        })
      ),
      results: percentages.flatMap((percentage, index) =>
        percentage === null
          ? []
          : [result({ studentProfileId: `stu-${index}`, percentage })]
      ),
    });
  }

  it("sums counts across pages", () => {
    let totals = emptyFinalisationTotals();
    totals = accumulateFinalisation(totals, page([80, null]));
    totals = accumulateFinalisation(totals, page([60]));

    const summary = finalisationTotalsSummary(totals);
    expect(summary.sessions).toBe(3);
    expect(summary.withResults).toBe(2);
    expect(summary.withoutResults).toBe(1);
    expect(summary.resultsConsidered).toBe(2);
  });

  /**
   * Averaging per-page averages is wrong, and wrong in a way that only shows up
   * when the pages are uneven — which is exactly what a paged close produces.
   * Page A averages 50%, page B averages 100%; the school's mean is 66.67%, not
   * 75%.
   */
  it("averages every session rather than averaging the page averages", () => {
    let totals = emptyFinalisationTotals();
    totals = accumulateFinalisation(totals, page([100, 0]));
    totals = accumulateFinalisation(totals, page([100]));

    const summary = finalisationTotalsSummary(totals);
    expect(summary.averagePercentage).toBe(66.67);
    expect(summary.averagePercentage).not.toBe(75);
  });

  it("reports a null average when no session was scored", () => {
    const totals = accumulateFinalisation(emptyFinalisationTotals(), page([null, null]));
    expect(finalisationTotalsSummary(totals).averagePercentage).toBeNull();
  });

  it("caps the accumulated sample across pages, not per page", () => {
    let totals = emptyFinalisationTotals();
    for (let index = 0; index < MAX_REPORTED_WITHOUT_RESULTS; index += 1) {
      totals = accumulateFinalisation(totals, page([null]));
    }

    const summary = finalisationTotalsSummary(totals);
    expect(summary.withoutResultsSample).toHaveLength(MAX_REPORTED_WITHOUT_RESULTS);
    expect(summary.withoutResults).toBe(MAX_REPORTED_WITHOUT_RESULTS);
    expect(summary.withoutResultsTruncated).toBe(false);
  });

  it("flags truncation once the true count outruns the sample", () => {
    let totals = emptyFinalisationTotals();
    for (let index = 0; index < MAX_REPORTED_WITHOUT_RESULTS + 5; index += 1) {
      totals = accumulateFinalisation(totals, page([null]));
    }

    const summary = finalisationTotalsSummary(totals);
    expect(summary.withoutResultsSample).toHaveLength(MAX_REPORTED_WITHOUT_RESULTS);
    expect(summary.withoutResults).toBe(MAX_REPORTED_WITHOUT_RESULTS + 5);
    expect(summary.withoutResultsTruncated).toBe(true);
  });
});
