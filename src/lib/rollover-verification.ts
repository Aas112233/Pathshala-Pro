/**
 * The post-rollover verification checklist (roadmap item 25).
 *
 * A rollover that wrote configuration is not the same as a year that is ready
 * to be used, and the gap between those two states is exactly where the
 * "looks finished" failure lives. The `AcademicYearRollover` row records what a
 * run *did*; this module turns that record plus the target year's current state
 * into the list an operator should actually walk through before treating the
 * year as live.
 *
 * Pure, like every other decision module: it reads a shape, it returns a list.
 * The loader assembles the shape, so the same checklist can be produced from a
 * test fixture and from the database and cannot disagree between them.
 *
 * Deliberately **read-only**. Verifying is not a mutation; nothing here flips a
 * flag or writes a row, because a checklist that can be "completed" is a
 * checklist that can be completed without being read.
 */

export const VERIFICATION_STATUSES = ["ok", "attention", "info"] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const VERIFICATION_KEYS = [
  /** The year has at least one active promotion rule, so it can promote. */
  "promotionRulesActive",
  /** The year has at least one fee structure, so invoices can be generated. */
  "feeStructuresPresent",
  /** Copied timetable slots have been reviewed and confirmed. */
  "timetableReviewed",
  /** Students are actually enrolled in the year. */
  "studentsEnrolled",
  /** The working-day policy is declared, so day counts have a denominator. */
  "workingDayPolicyDeclared",
  /** The fee-balance policy has been stated, so invoicing knows what to inherit. */
  "feeBalancePolicyStated",
  /** Informational: this run did not make the year the operating year. */
  "operatingYearUnchanged",
] as const;
export type VerificationKey = (typeof VERIFICATION_KEYS)[number];

export interface VerificationItem {
  key: VerificationKey;
  status: VerificationStatus;
  /** Interpolation values, so the UI translates `key` + `params`. */
  params: Record<string, string | number>;
  /** Log/API fallback only. Never render this — translate `key`. */
  message: string;
}

export interface RolloverVerificationInput {
  /** What the most recent run asked to carry. Absent when the year was not opened by a rollover. */
  rollover: {
    mode: string;
    copyPromotionRules: boolean;
    copyFeeStructures: boolean;
    copyTimetables: boolean;
    feeBalancePolicy: string | null;
    workingDayPolicyCarried: boolean;
  } | null;
  target: {
    label: string;
    /** The counts that decide the first four checks. */
    activePromotionRules: number;
    promotionRules: number;
    feeStructures: number;
    timetableSlots: number;
    timetableSlotsNeedingReview: number;
    enrolledStudents: number;
    workingDayPolicyDeclared: boolean;
    feeBalancePolicy: string | null;
    isCurrent: boolean;
  };
}

export interface RolloverVerification {
  /** The year the checklist describes. */
  targetLabel: string;
  items: VerificationItem[];
  counts: { ok: number; attention: number; info: number };
  /** True when nothing needs attention. Convenience for the UI, derived here. */
  ready: boolean;
}

function item(
  key: VerificationKey,
  status: VerificationStatus,
  params: Record<string, string | number>,
  message: string
): VerificationItem {
  return { key, status, params, message };
}

export function buildRolloverVerification(input: RolloverVerificationInput): RolloverVerification {
  const { target, rollover } = input;
  const items: VerificationItem[] = [];

  // A year that cannot promote anyone is the "looks finished" trap, so this is
  // the first thing on the list and it is checked against the *outcome* — the
  // active count — rather than what was copied.
  items.push(
    target.activePromotionRules > 0
      ? item(
          "promotionRulesActive",
          "ok",
          { count: target.activePromotionRules },
          `${target.activePromotionRules} active promotion rule(s).`
        )
      : item(
          "promotionRulesActive",
          "attention",
          { count: target.promotionRules },
          `No active promotion rule. ${target.promotionRules} rule(s) exist but none is active, so no class can be promoted in this year.`
        )
  );

  // Only raised as attention when the run was asked to carry them — a school
  // that deliberately declined the copy should not be told it failed.
  if (target.feeStructures > 0) {
    items.push(
      item(
        "feeStructuresPresent",
        "ok",
        { count: target.feeStructures },
        `${target.feeStructures} fee structure(s) present.`
      )
    );
  } else {
    items.push(
      item(
        "feeStructuresPresent",
        rollover?.copyFeeStructures === false ? "info" : "attention",
        { count: 0 },
        "No fee structure, so invoices cannot be generated in this year."
      )
    );
  }

  items.push(
    target.timetableSlotsNeedingReview > 0
      ? item(
          "timetableReviewed",
          "attention",
          { count: target.timetableSlotsNeedingReview, total: target.timetableSlots },
          `${target.timetableSlotsNeedingReview} of ${target.timetableSlots} timetable slot(s) are still flagged for review. A copied grid is a proposal to confirm, not an allocation the school made.`
        )
      : item(
          "timetableReviewed",
          "ok",
          { count: target.timetableSlots },
          target.timetableSlots > 0
            ? `All ${target.timetableSlots} timetable slot(s) reviewed.`
            : "No timetable slots."
      )
  );

  items.push(
    target.enrolledStudents > 0
      ? item(
          "studentsEnrolled",
          "ok",
          { count: target.enrolledStudents },
          `${target.enrolledStudents} student(s) enrolled.`
        )
      : item(
          "studentsEnrolled",
          "attention",
          { count: 0 },
          "No student is enrolled in this year. Configuration without students is a year nobody can attend."
        )
  );

  items.push(
    target.workingDayPolicyDeclared
      ? item(
          "workingDayPolicyDeclared",
          "ok",
          {},
          "A working-day policy is declared, so day counts have a denominator."
        )
      : item(
          "workingDayPolicyDeclared",
          "attention",
          {},
          "No working-day policy declared. Attendance rates and payroll day counts will report no figure until one is set."
        )
  );

  items.push(
    target.feeBalancePolicy
      ? item(
          "feeBalancePolicyStated",
          "ok",
          { policy: target.feeBalancePolicy },
          `Fee-balance policy stated: ${target.feeBalancePolicy}.`
        )
      : item(
          "feeBalancePolicyStated",
          "attention",
          {},
          "No fee-balance policy stated. Invoicing will not inherit balances from the previous year until one is chosen — which is the safe default, but it should be a decision rather than an omission."
        )
  );

  // Informational rather than a defect: a rollover deliberately does not switch
  // the operating year, because that is a separate act with its own check.
  items.push(
    item(
      "operatingYearUnchanged",
      target.isCurrent ? "ok" : "info",
      {},
      target.isCurrent
        ? "This year is the operating year."
        : "This year is not the operating year. Switching it is a separate action."
    )
  );

  const counts = {
    ok: items.filter((entry) => entry.status === "ok").length,
    attention: items.filter((entry) => entry.status === "attention").length,
    info: items.filter((entry) => entry.status === "info").length,
  };

  return {
    targetLabel: target.label,
    items,
    counts,
    ready: counts.attention === 0,
  };
}
