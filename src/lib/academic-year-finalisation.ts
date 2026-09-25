import {
  averagePercentage,
  latestResultPerSubject,
  type SubjectResultInput,
} from "@/lib/promotion-engine";

/**
 * Academic-year finalisation — the year-close snapshot.
 *
 * Pure, database-free, like `promotion-engine.ts` and `rollover-preflight.ts`.
 *
 * Why this exists: closing a year is the moment its results stop being
 * provisional. Everything the year meant for a student — the percentage they
 * finished on, their grade point average, the marks they totalled — is written
 * onto their year-scoped `StudentAcademicSession` row so it can be read without
 * re-joining `ExamResult` rows that may later be edited, re-graded, purged or
 * made unreadable by a schema change. Before this module existed, every session
 * row carried `finalGpa: null` and `finalPercentage: null` for the rest of time.
 *
 * The one invariant that matters: **`finalPercentage` is computed by the same
 * code path that decided the promotion.** `decidePromotion` averages the latest
 * result per subject via `latestResultPerSubject` + `averagePercentage`, and
 * this module calls those exact functions over the same rows. A snapshot that
 * disagreed with the promotion it was based on would be worse than no snapshot
 * at all, because it would be trusted.
 *
 * Two definitions worth stating plainly:
 *
 * - `finalPercentage` is the equal-weighted mean of the latest result per
 *   subject — the figure `decidePromotion` used, and therefore the
 *   authoritative one. `domain-math.computeAggregatePercentage` argues for the
 *   ratio of sums instead, and it has a point: the mean weights a 10-mark quiz
 *   the same as a 100-mark final. It is deliberately not used here. That helper
 *   has no production caller, the live promotion path averages percentages, and
 *   a snapshot that scored a student differently from the promotion that closed
 *   their year would be actively misleading. Changing the aggregate changes
 *   promotion outcomes, so it belongs in `promotion-engine.ts`, once, for both.
 * - `finalGpa` is the mean of the per-subject grade points, taken from the
 *   `gradePoint` already persisted on each result by `exam-grading.ts` rather
 *   than recomputed from a band table. It is deliberately **not**
 *   `toGrade(finalPercentage).point`: a board GPA is the average of subject
 *   grade points, not the grade of the average percentage, and the two
 *   legitimately differ (grade points 4.0 and 5.0 average to 4.5, which no band
 *   maps to an 80% average). Storing the band-derived figure instead would
 *   produce a GPA no registrar would recognise. This is also exactly what
 *   `domain-math.computeWeightedGpa` degenerates to, since no credit hours are
 *   configured anywhere in the schema.
 *
 * Note that `board-engines/grading.ts` holds a second, different band table
 * (`DEFAULT_GPA_BANDS`) that no production code path reaches, and that
 * `Tenant.gpaScale` — the intended override for it — is written by the
 * system-admin settings screen and read by nothing. Neither is consulted here;
 * `gradePoint` on the result row is the value the school actually recorded.
 */

/** The year-scoped placement being finalised. */
export interface FinalisationSessionRow {
  sessionId: string;
  studentProfileId: string;
  classId: string;
  rollNumber: string;
}

/**
 * One exam result as read for finalisation.
 *
 * Extends the promotion engine's subject-result shape rather than restating it,
 * so `latestResultPerSubject` resolves the winning attempt for both callers. If
 * a subject was examined more than once, finalisation must not have its own
 * opinion about which sitting counts.
 */
export interface FinalisationResultRow extends SubjectResultInput {
  /** Which student sat it. The engine carries this on the candidate; here the
   *  rows arrive flat, so it has to travel with each one. */
  studentProfileId: string;
  /** Which sitting produced this mark — recorded in the snapshot. */
  examId: string;
  maxMarks: number;
  obtainedMarks: number;
  gradePoint: number;
}

export interface FinalisedSubject {
  subjectId: string;
  subjectName: string;
  examId: string;
  percentage: number;
  grade: string;
  gradePoint: number;
  status: string;
  maxMarks: number;
  obtainedMarks: number;
}

/**
 * The frozen record of a year. Stored on `StudentAcademicSession.snapshot` so
 * the transcript can be reconstructed from the session row alone.
 */
export interface FinalisationSnapshot {
  academicYearId: string;
  finalisedAt: string;
  finalPercentage: number | null;
  finalGpa: number | null;
  totalMarks: number;
  obtainedMarks: number;
  subjects: FinalisedSubject[];
}

export interface FinalisedSession {
  sessionId: string;
  studentProfileId: string;
  /**
   * Null — never 0 — when the student has no results for the year. Zero is a
   * real mark; "no examination sat" is not the same thing, and conflating the
   * two would invent a failing grade for a student who was never examined.
   */
  finalPercentage: number | null;
  finalGpa: number | null;
  totalMarks: number;
  obtainedMarks: number;
  subjectCount: number;
  snapshot: FinalisationSnapshot | null;
}

export interface FinalisationInput {
  academicYearId: string;
  /**
   * ISO timestamp supplied by the caller. Passed in rather than read from the
   * clock so this stays a pure function and its output is reproducible.
   */
  finalisedAt: string;
  sessions: FinalisationSessionRow[];
  results: FinalisationResultRow[];
  /** Cap on how many "no results" entries are echoed back. */
  perCodeLimit?: number;
}

export interface FinalisationReport {
  sessions: FinalisedSession[];
  counts: {
    sessions: number;
    withResults: number;
    withoutResults: number;
    /** Subject rows that actually contributed to a final figure. */
    resultsConsidered: number;
  };
  /**
   * A bounded sample of the sessions that receive null finals for want of
   * results. `counts.withoutResults` always carries the true total, so
   * truncation hides only how many are listed, never how many exist.
   */
  withoutResults: Array<{
    sessionId: string;
    studentProfileId: string;
    rollNumber: string;
  }>;
  withoutResultsTruncated: boolean;
}

export const MAX_REPORTED_WITHOUT_RESULTS = 50;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Deterministic ordering. A repeated run must produce byte-identical output,
 * and the truncated "no results" sample must name the same students each time
 * rather than whichever rows the planner happened to return first.
 */
function compareSessions(a: FinalisationSessionRow, b: FinalisationSessionRow): number {
  if (a.classId !== b.classId) return a.classId.localeCompare(b.classId);
  const byRoll = a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true });
  if (byRoll !== 0) return byRoll;
  return a.studentProfileId.localeCompare(b.studentProfileId);
}

function compareSubjects(a: FinalisedSubject, b: FinalisedSubject): number {
  const byName = a.subjectName.localeCompare(b.subjectName);
  return byName !== 0 ? byName : a.subjectId.localeCompare(b.subjectId);
}

/**
 * Freeze the year's results onto each session.
 *
 * Pure: same input, same output, no I/O. The caller supplies the year's
 * sessions and its exam results; everything else is arithmetic.
 */
export function finaliseSessionResults(input: FinalisationInput): FinalisationReport {
  const { academicYearId, finalisedAt, sessions, results } = input;
  const perCodeLimit = input.perCodeLimit ?? MAX_REPORTED_WITHOUT_RESULTS;

  const resultsByStudent = new Map<string, FinalisationResultRow[]>();
  for (const row of results) {
    const list = resultsByStudent.get(row.studentProfileId);
    if (list) list.push(row);
    else resultsByStudent.set(row.studentProfileId, [row]);
  }

  const finalised: FinalisedSession[] = [];
  const withoutResults: FinalisationReport["withoutResults"] = [];
  let withResults = 0;
  let resultsConsidered = 0;

  for (const session of [...sessions].sort(compareSessions)) {
    const latest = latestResultPerSubject(resultsByStudent.get(session.studentProfileId) ?? []);

    if (latest.size === 0) {
      if (withoutResults.length < perCodeLimit) {
        withoutResults.push({
          sessionId: session.sessionId,
          studentProfileId: session.studentProfileId,
          rollNumber: session.rollNumber,
        });
      }

      finalised.push({
        sessionId: session.sessionId,
        studentProfileId: session.studentProfileId,
        finalPercentage: null,
        finalGpa: null,
        totalMarks: 0,
        obtainedMarks: 0,
        subjectCount: 0,
        snapshot: null,
      });
      continue;
    }

    withResults += 1;
    resultsConsidered += latest.size;

    // The same two functions `decidePromotion` uses, over the same rows.
    const { totalSubjects, overallPercentage } = averagePercentage(latest);

    const subjects: FinalisedSubject[] = [];
    let totalMarks = 0;
    let obtainedMarks = 0;
    let gradePointSum = 0;

    for (const row of latest.values()) {
      totalMarks += row.maxMarks;
      obtainedMarks += row.obtainedMarks;
      gradePointSum += row.gradePoint;
      subjects.push({
        subjectId: row.subjectId,
        subjectName: row.subjectName,
        examId: row.examId,
        percentage: row.percentage,
        grade: row.grade,
        gradePoint: row.gradePoint,
        status: row.status,
        maxMarks: row.maxMarks,
        obtainedMarks: row.obtainedMarks,
      });
    }

    subjects.sort(compareSubjects);

    const finalGpa = round2(gradePointSum / totalSubjects);

    finalised.push({
      sessionId: session.sessionId,
      studentProfileId: session.studentProfileId,
      finalPercentage: overallPercentage,
      finalGpa,
      totalMarks: round2(totalMarks),
      obtainedMarks: round2(obtainedMarks),
      subjectCount: totalSubjects,
      snapshot: {
        academicYearId,
        finalisedAt,
        finalPercentage: overallPercentage,
        finalGpa,
        totalMarks: round2(totalMarks),
        obtainedMarks: round2(obtainedMarks),
        subjects,
      },
    });
  }

  return {
    sessions: finalised,
    counts: {
      sessions: finalised.length,
      withResults,
      withoutResults: finalised.length - withResults,
      resultsConsidered,
    },
    withoutResults,
    withoutResultsTruncated: finalised.length - withResults > withoutResults.length,
  };
}

/**
 * Running totals across pages.
 *
 * The close path finalises in pages rather than in one pass, because there is
 * no way to reopen a closed year — a student missed by a cap would be missed
 * permanently. Paging keeps memory bounded without ever truncating the work, so
 * the summary has to be accumulated instead of computed from one big array.
 *
 * `percentageSum` and `scoredSessions` are carried separately rather than as a
 * running mean: averaging a set of per-page averages is wrong, and it is wrong
 * in a way nobody notices until the numbers are questioned.
 */
export interface FinalisationTotals {
  sessions: number;
  withResults: number;
  withoutResults: number;
  resultsConsidered: number;
  percentageSum: number;
  scoredSessions: number;
  withoutResultsSample: FinalisationReport["withoutResults"];
}

export function emptyFinalisationTotals(): FinalisationTotals {
  return {
    sessions: 0,
    withResults: 0,
    withoutResults: 0,
    resultsConsidered: 0,
    percentageSum: 0,
    scoredSessions: 0,
    withoutResultsSample: [],
  };
}

export function accumulateFinalisation(
  totals: FinalisationTotals,
  report: FinalisationReport
): FinalisationTotals {
  let percentageSum = totals.percentageSum;
  let scoredSessions = totals.scoredSessions;
  for (const session of report.sessions) {
    if (session.finalPercentage !== null) {
      percentageSum += session.finalPercentage;
      scoredSessions += 1;
    }
  }

  const room = MAX_REPORTED_WITHOUT_RESULTS - totals.withoutResultsSample.length;
  const sample =
    room > 0
      ? [...totals.withoutResultsSample, ...report.withoutResults.slice(0, room)]
      : totals.withoutResultsSample;

  return {
    sessions: totals.sessions + report.counts.sessions,
    withResults: totals.withResults + report.counts.withResults,
    withoutResults: totals.withoutResults + report.counts.withoutResults,
    resultsConsidered: totals.resultsConsidered + report.counts.resultsConsidered,
    percentageSum,
    scoredSessions,
    withoutResultsSample: sample,
  };
}

export interface FinalisationSummary {
  sessions: number;
  withResults: number;
  withoutResults: number;
  resultsConsidered: number;
  /** Mean of the sessions that have a percentage; null when none do. */
  averagePercentage: number | null;
  /** Bounded sample of students who finished the year with no results. */
  withoutResultsSample: FinalisationReport["withoutResults"];
  /** True when the sample is shorter than the true count it stands for. */
  withoutResultsTruncated: boolean;
}

export function finalisationTotalsSummary(totals: FinalisationTotals): FinalisationSummary {
  return {
    sessions: totals.sessions,
    withResults: totals.withResults,
    withoutResults: totals.withoutResults,
    resultsConsidered: totals.resultsConsidered,
    averagePercentage:
      totals.scoredSessions > 0 ? round2(totals.percentageSum / totals.scoredSessions) : null,
    withoutResultsSample: totals.withoutResultsSample,
    withoutResultsTruncated: totals.withoutResults > totals.withoutResultsSample.length,
  };
}
