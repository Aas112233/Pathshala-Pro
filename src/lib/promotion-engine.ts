/**
 * Promotion decision engine.
 *
 * Pure, database-free domain logic shared by:
 *   - GET  /api/promotions/calculate  (preview)
 *   - POST /api/promotions/execute    (authoritative write)
 *
 * The execute route MUST recompute every decision through this module rather
 * than trusting a client-supplied action. The preview is a courtesy; this
 * engine is the source of truth.
 *
 * Design invariants:
 *   - No Prisma / no I/O. Everything is a pure function of its inputs.
 *   - The preview and the write call the same function, so they cannot drift.
 *   - Reasons are returned as structured codes, never as pre-baked English.
 *     The UI translates them; `message` exists only as a log/API fallback.
 */

export const PROMOTION_ACTIONS = [
  "PROMOTED",
  "RETAINED",
  "CONDITIONAL_PROMOTED",
  "GRADUATED",
  "DEMOTED",
  "TRANSFERRED",
] as const;

export type PromotionAction = (typeof PROMOTION_ACTIONS)[number];

/**
 * Actions this engine can derive from a rule + results.
 * DEMOTED and TRANSFERRED are deliberately excluded: demotion is a human
 * academic judgement, and a transfer is an external event (the family is
 * leaving), neither of which an algorithm should decide on its own.
 */
export const DERIVED_ACTIONS: readonly PromotionAction[] = [
  "PROMOTED",
  "RETAINED",
  "CONDITIONAL_PROMOTED",
  "GRADUATED",
];

/** Actions reachable only through an explicit operator override. */
export const OVERRIDE_ONLY_ACTIONS: readonly PromotionAction[] = [
  "DEMOTED",
  "TRANSFERRED",
];

/**
 * The single definition of "this student leaves the active roster". Graduation
 * and transfer-out are both exits; everything else keeps the student enrolled.
 * Centralised because three call sites must agree, and drift between them is
 * how a graduate ends up with an enrollment row for a year they never attend.
 */
export function isExitAction(action: PromotionAction): boolean {
  return action === "GRADUATED" || action === "TRANSFERRED";
}

/**
 * Bounds for conditional promotion. Previously magic numbers buried inside the
 * calculate route; hoisted here so the rule is auditable in one place.
 */
export const CONDITIONAL_PROMOTION_MAX_FAILED_SUBJECTS = 2;
export const CONDITIONAL_PROMOTION_MIN_OVERALL_PERCENTAGE = 30;

/**
 * Every reason this engine can return, as a runtime list.
 *
 * The union below is *derived* from the list rather than written out twice, so
 * the two cannot drift: a code that is not in the list fails to compile at the
 * `reasons.push(...)` sites, and a code that is in the list without a
 * `promotions.reasons.<code>` message in all four locales fails the guard in
 * `promotion-reason-i18n.test.ts`. Adding a reason therefore requires both
 * halves or it does not build.
 */
export const PROMOTION_REASON_CODES = [
  "MEETS_CRITERIA",
  "FAILED_SUBJECTS",
  "LOW_OVERALL",
  "LOW_ATTENDANCE",
  "NO_EXAM_RESULTS",
  "CONDITIONAL_ELIGIBLE",
  "GRADUATED_FINAL_CLASS",
  "RETAINED_FINAL_CLASS",
  "MANUAL_OVERRIDE",
  "TRANSFERRED_OUT",
] as const;

export type PromotionReasonCode = (typeof PROMOTION_REASON_CODES)[number];

export interface PromotionReason {
  code: PromotionReasonCode;
  /**
   * The values the UI interpolates into the translated message. This is the
   * only display channel for a reason — `message` is English and exists for
   * logs and non-UI consumers — so anything an operator must see belongs here,
   * and nothing here should be a raw database id.
   */
  params: Record<string, string | number>;
  /** English fallback for logs and non-UI API consumers. Not for display. */
  message: string;
}

export interface PromotionRuleInput {
  id: string;
  classId: string;
  academicYearId: string;
  minimumAttendance: number;
  minimumOverallPercentage: number;
  minimumPerSubject: number;
  maxFailedSubjects: number;
  allowConditionalPromotion: boolean;
  autoPromote: boolean;
  nextClassId: string | null;
}

export interface SubjectResultInput {
  subjectId: string;
  subjectName: string;
  percentage: number;
  status: string;
  grade: string;
  createdAt: Date | string;
}

export interface PromotionCandidate {
  studentProfileId: string;
  studentId: string;
  studentName: string;
  rollNumber: string;
  fromClassId: string;
  fromClassName: string;
  fromClassNumber: number;
  examResults: SubjectResultInput[];
  /**
   * Percentage of days attended, or null when the school records no attendance
   * for this year. Null means "not tracked" and attendance is NOT enforced —
   * this mirrors the convention in attendance-service (zero records => 100%),
   * so institutions that do not use the attendance module are never blocked.
   */
  attendanceRate: number | null;
  attendancePresentDays: number;
  attendanceTotalDays: number;
}

export interface PromotionSubjectDetail {
  subjectId: string;
  subjectName: string;
  percentage: number;
  status: string;
  grade: string;
  isFailed: boolean;
}

export interface PromotionMetrics {
  overallPercentage: number;
  totalSubjects: number;
  failedSubjectsCount: number;
  failedSubjects: string[];
  attendanceRate: number;
  attendanceTracked: boolean;
  attendancePresentDays: number;
  attendanceTotalDays: number;
  minimumAttendance: number;
  minimumOverallPercentage: number;
  minimumPerSubject: number;
  maxFailedSubjects: number;
}

export interface PromotionDecision {
  studentProfileId: string;
  studentId: string;
  studentName: string;
  rollNumber: string;
  fromClassId: string;
  fromClassName: string;
  fromClassNumber: number;
  isTerminalClass: boolean;
  action: PromotionAction;
  /** Cleared the bar outright (no conditional, no override). */
  meetsCriteria: boolean;
  /** Moves into a higher class in the target year. */
  advances: boolean;
  /** Stays in the same class (retained or demoted). */
  repeats: boolean;
  /** Leaves the active roster (graduated). */
  exits: boolean;
  requiresReExam: boolean;
  /** No exam results were found, so the decision rests on absence of data. */
  insufficientData: boolean;
  /** Class recorded for this student in the TARGET year. Never null. */
  targetClassId: string;
  reasons: PromotionReason[];
  metrics: PromotionMetrics;
  subjectDetails: PromotionSubjectDetail[];
}

export interface PromotionOverride {
  action: PromotionAction;
  /** Required when action is DEMOTED; ignored otherwise. */
  toClassId?: string | null;
  reason?: string;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function isTerminalClass(rule: Pick<PromotionRuleInput, "nextClassId">): boolean {
  return !rule.nextClassId;
}

/**
 * Latest result per subject. A subject examined more than once within the year
 * resolves to its most recently created record.
 */
export function latestResultPerSubject<T extends SubjectResultInput>(
  results: T[]
): Map<string, T> {
  const latest = new Map<string, T>();
  for (const result of results) {
    const existing = latest.get(result.subjectId);
    if (!existing || new Date(result.createdAt) > new Date(existing.createdAt)) {
      latest.set(result.subjectId, result);
    }
  }
  return latest;
}

/**
 * The year's overall percentage, from the latest result per subject.
 *
 * Extracted from {@link decidePromotion} so the promotion decision and the
 * year-close snapshot compute this number the same way, from the same rows. The
 * snapshot records what the decision was based on; if the two averaged
 * differently the frozen year would contradict the promotion that closed it.
 *
 * Subjects carry equal weight, matching `decidePromotion`. An empty map reports
 * `totalSubjects: 0` with a percentage of 0 — callers must read that as "no
 * results recorded", never as a genuine score of zero.
 */
export function averagePercentage<T extends SubjectResultInput>(
  latest: Map<string, T>
): { totalSubjects: number; overallPercentage: number } {
  const totalSubjects = latest.size;
  if (totalSubjects === 0) return { totalSubjects: 0, overallPercentage: 0 };

  let sum = 0;
  for (const result of latest.values()) sum += result.percentage;

  return { totalSubjects, overallPercentage: round2(sum / totalSubjects) };
}

/**
 * A subject counts as failed when either signal fires: the recorded status says
 * FAIL, or the percentage falls below the configured per-subject floor. The two
 * normally agree (status is derived from the same floor), but taking the union
 * means a school that raises `minimumPerSubject` gets that floor enforced even
 * on results graded before the change.
 */
export function isSubjectFailed(
  result: Pick<SubjectResultInput, "percentage" | "status">,
  minimumPerSubject: number
): boolean {
  return result.status === "FAIL" || result.percentage < minimumPerSubject;
}

export function decidePromotion(
  candidate: PromotionCandidate,
  rule: PromotionRuleInput
): PromotionDecision {
  const latest = latestResultPerSubject(candidate.examResults);
  const terminal = isTerminalClass(rule);

  const subjectDetails: PromotionSubjectDetail[] = [];
  const failedSubjects: string[] = [];

  for (const result of latest.values()) {
    const failed = isSubjectFailed(result, rule.minimumPerSubject);
    subjectDetails.push({
      subjectId: result.subjectId,
      subjectName: result.subjectName,
      percentage: result.percentage,
      status: result.status,
      grade: result.grade,
      isFailed: failed,
    });
    if (failed) failedSubjects.push(result.subjectName);
  }

  subjectDetails.sort((a, b) => a.subjectName.localeCompare(b.subjectName));

  const { totalSubjects, overallPercentage } = averagePercentage(latest);
  const insufficientData = totalSubjects === 0;

  const attendanceTracked = candidate.attendanceRate !== null;
  const attendanceRate = attendanceTracked ? candidate.attendanceRate! : 100;

  const tooManyFailures = failedSubjects.length > rule.maxFailedSubjects;
  const belowOverall = overallPercentage < rule.minimumOverallPercentage;
  const belowAttendance = attendanceTracked && attendanceRate < rule.minimumAttendance;

  const reasons: PromotionReason[] = [];
  const meetsCriteria = !tooManyFailures && !belowOverall && !belowAttendance;

  let action: PromotionAction;
  let targetClassId: string;

  if (insufficientData) {
    action = "RETAINED";
    targetClassId = candidate.fromClassId;
    reasons.push({
      code: "NO_EXAM_RESULTS",
      params: { academicYear: rule.academicYearId },
      message: "No examination results recorded for this academic year.",
    });
  } else if (meetsCriteria) {
    action = terminal ? "GRADUATED" : "PROMOTED";
    targetClassId = terminal ? candidate.fromClassId : rule.nextClassId!;
    reasons.push({
      code: "MEETS_CRITERIA",
      params: { overall: overallPercentage },
      message: `Met all promotion criteria with ${overallPercentage}%.`,
    });
    if (terminal) {
      reasons.push({
        code: "GRADUATED_FINAL_CLASS",
        params: { className: candidate.fromClassName },
        message: "Final class - student graduates.",
      });
    }
  } else {
    if (tooManyFailures) {
      reasons.push({
        code: "FAILED_SUBJECTS",
        params: {
          count: failedSubjects.length,
          allowed: rule.maxFailedSubjects,
          subjects: failedSubjects.join(", "),
        },
        message: `Failed ${failedSubjects.length} subject(s): ${failedSubjects.join(", ")}.`,
      });
    }
    if (belowOverall) {
      reasons.push({
        code: "LOW_OVERALL",
        params: { actual: overallPercentage, required: rule.minimumOverallPercentage },
        message: `Overall ${overallPercentage}% is below the required ${rule.minimumOverallPercentage}%.`,
      });
    }
    if (belowAttendance) {
      reasons.push({
        code: "LOW_ATTENDANCE",
        params: { actual: attendanceRate, required: rule.minimumAttendance },
        message: `Attendance ${attendanceRate}% is below the required ${rule.minimumAttendance}%.`,
      });
    }

    const conditionalEligible =
      rule.allowConditionalPromotion &&
      !terminal &&
      failedSubjects.length > 0 &&
      failedSubjects.length <= CONDITIONAL_PROMOTION_MAX_FAILED_SUBJECTS &&
      overallPercentage >= CONDITIONAL_PROMOTION_MIN_OVERALL_PERCENTAGE &&
      !belowAttendance;

    if (conditionalEligible) {
      action = "CONDITIONAL_PROMOTED";
      targetClassId = rule.nextClassId!;
      reasons.push({
        code: "CONDITIONAL_ELIGIBLE",
        params: {
          count: failedSubjects.length,
          overall: overallPercentage,
        },
        message: "Eligible for conditional promotion pending a re-examination.",
      });
    } else {
      action = "RETAINED";
      targetClassId = candidate.fromClassId;
      if (terminal) {
        reasons.push({
          code: "RETAINED_FINAL_CLASS",
          params: { className: candidate.fromClassName },
          message: "Final class - criteria not met, student repeats.",
        });
      }
    }
  }

  return {
    studentProfileId: candidate.studentProfileId,
    studentId: candidate.studentId,
    studentName: candidate.studentName,
    rollNumber: candidate.rollNumber,
    fromClassId: candidate.fromClassId,
    fromClassName: candidate.fromClassName,
    fromClassNumber: candidate.fromClassNumber,
    isTerminalClass: terminal,
    action,
    meetsCriteria,
    advances: action === "PROMOTED" || action === "CONDITIONAL_PROMOTED",
    repeats: action === "RETAINED" || (action as PromotionAction) === "DEMOTED",
    exits: isExitAction(action),
    requiresReExam: action === "CONDITIONAL_PROMOTED",
    insufficientData,
    targetClassId,
    reasons,
    metrics: {
      overallPercentage,
      totalSubjects,
      failedSubjectsCount: failedSubjects.length,
      failedSubjects,
      attendanceRate,
      attendanceTracked,
      attendancePresentDays: candidate.attendancePresentDays,
      attendanceTotalDays: candidate.attendanceTotalDays,
      minimumAttendance: rule.minimumAttendance,
      minimumOverallPercentage: rule.minimumOverallPercentage,
      minimumPerSubject: rule.minimumPerSubject,
      maxFailedSubjects: rule.maxFailedSubjects,
    },
    subjectDetails,
  };
}

/**
 * Apply an operator override. Re-derives every movement flag from the new
 * action so the decision can never be left in a self-contradictory state
 * (e.g. action PROMOTED with repeats still true).
 *
 * DEMOTED requires an explicit target class; the caller validates that the
 * target is genuinely a lower class before persisting.
 */
export function applyOverride(
  decision: PromotionDecision,
  override: PromotionOverride
): PromotionDecision {
  const { action } = override;

  if (action === "DEMOTED" && !override.toClassId) {
    throw new Error("A demotion requires an explicit target class.");
  }

  let targetClassId: string;
  switch (action) {
    case "PROMOTED":
    case "CONDITIONAL_PROMOTED":
      targetClassId = decision.isTerminalClass
        ? decision.fromClassId
        : override.toClassId || decision.targetClassId;
      break;
    case "DEMOTED":
      targetClassId = override.toClassId!;
      break;
    case "GRADUATED":
    case "TRANSFERRED":
    case "RETAINED":
    default:
      // The student leaves or stays put; either way there is no new class to
      // move them into. A transfer has no target class inside this school.
      targetClassId = decision.fromClassId;
      break;
  }

  const overrideReason: PromotionReason[] = override.reason
    ? [
        {
          code: "MANUAL_OVERRIDE",
          params: { action },
          message: override.reason,
        },
      ]
    : action === "TRANSFERRED"
      ? [
          {
            code: "TRANSFERRED_OUT",
            params: { studentName: decision.studentName },
            message: "Student transferred out of the school.",
          },
        ]
      : [];

  const reasons: PromotionReason[] = [...overrideReason, ...decision.reasons];

  return {
    ...decision,
    action,
    targetClassId,
    advances: action === "PROMOTED" || action === "CONDITIONAL_PROMOTED",
    repeats: action === "RETAINED" || action === "DEMOTED",
    exits: isExitAction(action),
    requiresReExam: action === "CONDITIONAL_PROMOTED",
    meetsCriteria: action === "PROMOTED" || action === "GRADUATED",
    reasons,
  };
}

/**
 * Maps an action onto StudentAcademicSession.promotionStatus.
 * The schema documents these as PROMOTED | RETAINED | CONDITIONAL | GRADUATED.
 */
export function promotionStatusFor(action: PromotionAction): string {
  switch (action) {
    case "CONDITIONAL_PROMOTED":
      return "CONDITIONAL";
    case "PROMOTED":
      return "PROMOTED";
    case "RETAINED":
      return "RETAINED";
    case "GRADUATED":
      return "GRADUATED";
    case "DEMOTED":
      return "DEMOTED";
    case "TRANSFERRED":
      return "TRANSFERRED";
    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}

/**
 * Maps an action onto StudentProfile.status. Only an exit changes the profile
 * lifecycle state; everything else leaves the student ACTIVE. The distinction
 * between GRADUATED and TRANSFERRED matters for reporting and for whether a
 * transfer certificate is owed.
 */
export function studentStatusFor(
  action: PromotionAction
): "ACTIVE" | "GRADUATED" | "TRANSFERRED" {
  switch (action) {
    case "GRADUATED":
      return "GRADUATED";
    case "TRANSFERRED":
      return "TRANSFERRED";
    default:
      return "ACTIVE";
  }
}

export interface PromotionSummary {
  total: number;
  promoted: number;
  conditionalPromoted: number;
  retained: number;
  graduated: number;
  demoted: number;
  transferred: number;
  advancing: number;
  exiting: number;
  requiringReExam: number;
  insufficientData: number;
}

export function summariseDecisions(decisions: PromotionDecision[]): PromotionSummary {
  return {
    total: decisions.length,
    promoted: decisions.filter((d) => d.action === "PROMOTED").length,
    conditionalPromoted: decisions.filter((d) => d.action === "CONDITIONAL_PROMOTED").length,
    retained: decisions.filter((d) => d.action === "RETAINED").length,
    graduated: decisions.filter((d) => d.action === "GRADUATED").length,
    demoted: decisions.filter((d) => d.action === "DEMOTED").length,
    transferred: decisions.filter((d) => d.action === "TRANSFERRED").length,
    advancing: decisions.filter((d) => d.advances).length,
    exiting: decisions.filter((d) => d.exits).length,
    requiringReExam: decisions.filter((d) => d.requiresReExam).length,
    insufficientData: decisions.filter((d) => d.insufficientData).length,
  };
}

/**
 * Suggests the natural next academic year: the earliest year that starts after
 * the source year begins. Returns null when no later year exists, which the
 * caller must surface as a blocking error rather than silently defaulting to
 * the source year (the original defect this module exists to prevent).
 */
export function suggestTargetAcademicYear<
  T extends { id: string; startDate: Date | string }
>(sourceYearId: string, years: T[]): T | null {
  const source = years.find((y) => y.id === sourceYearId);
  if (!source) return null;

  const sourceStart = new Date(source.startDate).getTime();
  const later = years
    .filter((y) => y.id !== sourceYearId && new Date(y.startDate).getTime() > sourceStart)
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

  return later[0] ?? null;
}

/**
 * Attendance percentage.
 *
 * The computation moved to `@/lib/attendance-rate`, which is now the only
 * definition in the codebase. Four surfaces were computing this figure and no
 * two agreed — most damagingly over `HOLIDAY`, which only this engine dropped
 * from the denominator. A figure the school is shown must agree with the figure
 * that decides whether a child is retained, so there is one implementation and
 * the report, the performance view and the portal all call it.
 *
 * Use `attendanceRateFromCounts` / `attendanceRateFromRecords` from there.
 */

/**
 * Marks from the source year are frozen once the student has left that year's
 * class for good. They stay editable when the student repeats the year, and
 * when a re-examination is still pending (the marks are about to change).
 *
 * A transfer-out freezes marks too: the transcript has been handed over, so
 * silently editing it afterwards would make the issued document wrong.
 */
export function locksSourceYearResults(action: PromotionAction): boolean {
  return action === "PROMOTED" || action === "DEMOTED" || isExitAction(action);
}

/**
 * How the target year's roll numbers are established.
 *
 * PRESERVE   - carry the source roll number. Collisions are reported rather
 *              than silently resolved, so the office can decide.
 * SEQUENTIAL - assign provisional sequential roll numbers per target class,
 *              continuing after any numbers already present in that class.
 */
export type RollNumberPolicy = "PRESERVE" | "SEQUENTIAL";

export interface RollAssignmentInput {
  studentProfileId: string;
  targetClassId: string;
  sourceRollNumber: string;
  /** Students who exit (graduate/transfer) get no target-year enrollment. */
  exits: boolean;
}

export interface RollAssignmentResult {
  /** studentProfileId -> roll number to write in the target year. */
  assignments: Map<string, string>;
  conflicts: Array<{
    studentProfileId: string;
    targetClassId: string;
    rollNumber: string;
  }>;
}

function numericSuffix(value: string): number | null {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && String(parsed) === value.trim() ? parsed : null;
}

/**
 * Deterministically resolve the roll number each student receives in the
 * target year. Pure, so the collision behaviour is unit-testable rather than
 * discovered in production.
 */
export function assignTargetRollNumbers(
  entries: RollAssignmentInput[],
  existingRollNumbersByClass: Record<string, string[]>,
  policy: RollNumberPolicy
): RollAssignmentResult {
  const assignments = new Map<string, string>();
  const conflicts: RollAssignmentResult["conflicts"] = [];

  const takenByClass = new Map<string, Set<string>>();
  for (const [classId, rolls] of Object.entries(existingRollNumbersByClass)) {
    takenByClass.set(classId, new Set(rolls));
  }
  const taken = (classId: string) => {
    let set = takenByClass.get(classId);
    if (!set) {
      set = new Set<string>();
      takenByClass.set(classId, set);
    }
    return set;
  };

  const active = entries.filter((entry) => !entry.exits);

  if (policy === "PRESERVE") {
    for (const entry of active) {
      const used = taken(entry.targetClassId);
      if (used.has(entry.sourceRollNumber)) {
        conflicts.push({
          studentProfileId: entry.studentProfileId,
          targetClassId: entry.targetClassId,
          rollNumber: entry.sourceRollNumber,
        });
        continue;
      }
      used.add(entry.sourceRollNumber);
      assignments.set(entry.studentProfileId, entry.sourceRollNumber);
    }
    return { assignments, conflicts };
  }

  // SEQUENTIAL - deterministic order so repeated runs produce identical output.
  const ordered = [...active].sort((a, b) => {
    const aNum = numericSuffix(a.sourceRollNumber);
    const bNum = numericSuffix(b.sourceRollNumber);
    if (aNum !== null && bNum !== null && aNum !== bNum) return aNum - bNum;
    if (aNum !== null && bNum === null) return -1;
    if (aNum === null && bNum !== null) return 1;
    const byRoll = a.sourceRollNumber.localeCompare(b.sourceRollNumber);
    return byRoll !== 0 ? byRoll : a.studentProfileId.localeCompare(b.studentProfileId);
  });

  const nextByClass = new Map<string, number>();
  for (const entry of ordered) {
    if (!nextByClass.has(entry.targetClassId)) {
      let max = 0;
      for (const existing of taken(entry.targetClassId)) {
        const num = numericSuffix(existing);
        if (num !== null && num > max) max = num;
      }
      nextByClass.set(entry.targetClassId, max + 1);
    }

    const used = taken(entry.targetClassId);
    let candidate = nextByClass.get(entry.targetClassId)!;
    while (used.has(String(candidate))) candidate++;
    nextByClass.set(entry.targetClassId, candidate + 1);

    used.add(String(candidate));
    assignments.set(entry.studentProfileId, String(candidate));
  }

  return { assignments, conflicts };
}
