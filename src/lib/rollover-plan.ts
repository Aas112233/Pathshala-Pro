import {
  assertNonWorkingWeekdays,
  nonWorkingWeekdayNames,
  readWorkingDayPolicy,
  type Weekday,
} from "@/lib/working-days";

/**
 * The rollover plan: what opening the next academic year will actually do.
 *
 * ## Why this is a pure module and not a route
 *
 * Roadmap item 16 is the rollover wizard. The failure mode the gap analysis
 * names for it is precise: *"A rollover wizard that copies fee structures into a
 * year students never actually enter is worse than no wizard, because it looks
 * finished."* The defence against a wizard that looks finished is to settle the
 * semantics somewhere testable and make the surface a rendering of them, so the
 * decision layer is here — DB-free, like `promotion-engine.ts` and
 * `rollover-preflight.ts` — and the route only loads evidence and applies the
 * result.
 *
 * ## What a rollover is allowed to copy
 *
 * Only configuration that is (a) year-scoped and (b) carries a unique key that
 * makes a re-run idempotent:
 *
 * | Table | Year-scoped | Unique key | Copyable |
 * |---|---|---|---|
 * | `PromotionRule` | yes | `(tenantId, academicYearId, classId)` | **yes** |
 * | `ClassFeeStructure` | yes | `(tenantId, academicYearId, classId)` | **yes** |
 * | `Timetable` | yes | **none** | **no** |
 *
 * The timetable is excluded on a structural ground rather than a preference:
 * with no unique constraint, item 18's "upsert semantics with match keys" is not
 * satisfiable for it, and a second run would duplicate the entire grid instead of
 * updating it. It is listed in {@link NOT_COPIED_CONFIGURATION} with that reason
 * so the exclusion is published rather than discovered.
 *
 * ## Why promotion rules are copied by default and not left optional
 *
 * A year with no promotion rules cannot promote anyone — `runPromotionPreflight`
 * reports `NO_PROMOTION_RULE` as a blocker and `POST /api/promotions/execute`
 * refuses. So a wizard that opens a year and copies no rules produces a year in
 * which the wizard's own next step is impossible. That is checked as a
 * *consequence* rather than as an input: {@link planRollover} asks whether the
 * target will hold an active rule *after* the run, so declining the copy and
 * rolling into an unconfigured year are caught by the same blocker.
 *
 * ## What it deliberately does not decide
 *
 * Whether students are promoted, and whether a class's rule is correct. The
 * per-class promotion pre-flight already owns that (`rollover-preflight.ts`) and
 * it runs at promotion time and at year close. Duplicating it here would create a
 * second home for the same judgement, and two gates that disagree is worse than
 * one gate.
 */

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

export const ROLLOVER_MODES = ["CREATE", "EXISTING"] as const;
export type RolloverMode = (typeof ROLLOVER_MODES)[number];

export const ROLLOVER_SEVERITIES = ["blocker", "warning"] as const;
export type RolloverSeverity = (typeof ROLLOVER_SEVERITIES)[number];

/**
 * Every way a rollover can be refused or flagged.
 *
 * A runtime list with a derived union, so a code that is added here and not
 * given a severity in {@link ROLLOVER_FINDING_SEVERITY} fails to compile, and a
 * code that is added without a translation is visible to a guard. A bare string
 * union would be invisible to both.
 */
export const ROLLOVER_FINDING_CODES = [
  /** The target is the source. A rollover must cross a year boundary. */
  "TARGET_IS_SOURCE",
  /** The target year does not start after the source year. */
  "TARGET_YEAR_NOT_AFTER_SOURCE",
  /** The target year is closed, so nothing may be written into it. */
  "TARGET_YEAR_CLOSED",
  /** The requested dates for a new year are unusable. */
  "TARGET_DATES_INVALID",
  /** The requested `yearId` is already used by this tenant. */
  "DUPLICATE_YEAR_ID",
  /** After the run the target would hold no active promotion rule. */
  "TARGET_WILL_HAVE_NO_PROMOTION_RULES",
  /** The source year is still open, so its records can still change. */
  "SOURCE_YEAR_STILL_OPEN",
  /** The target year already has students enrolled in it. */
  "TARGET_YEAR_HAS_STUDENTS",
  /** Nothing is being carried across. */
  "NOTHING_REQUESTED",
  /** The source declares no working-day policy, so neither will the target. */
  "WORKING_DAY_POLICY_UNDECLARED",
  /** The target year keeps its own working-day policy; the source's was not applied. */
  "TARGET_WORKING_DAY_POLICY_KEPT",
  /** The source has no fee structures to carry. */
  "SOURCE_HAS_NO_FEE_STRUCTURES",
  /** A copied rule points at a class that no longer exists. */
  "DANGLING_NEXT_CLASS",
  /** A rule's class no longer exists, so the rule cannot be carried. */
  "ORPHAN_RULE_CLASS",
] as const;

export type RolloverFindingCode = (typeof ROLLOVER_FINDING_CODES)[number];

/**
 * Blocker or warning, decided once, for every code.
 *
 * Typed as a `Record` over the code union, so adding a code without deciding
 * whether it stops the run is a compile error rather than a silent default. The
 * rule for choosing: a **blocker** is something that makes the result wrong or
 * unusable — the year is not crossed, the year cannot promote, the write would
 * collide. A **warning** is something the operator should know that the run
 * cannot fix on its own.
 */
export const ROLLOVER_FINDING_SEVERITY: Record<RolloverFindingCode, RolloverSeverity> = {
  TARGET_IS_SOURCE: "blocker",
  TARGET_YEAR_NOT_AFTER_SOURCE: "blocker",
  TARGET_YEAR_CLOSED: "blocker",
  TARGET_DATES_INVALID: "blocker",
  DUPLICATE_YEAR_ID: "blocker",
  TARGET_WILL_HAVE_NO_PROMOTION_RULES: "blocker",

  SOURCE_YEAR_STILL_OPEN: "warning",
  TARGET_YEAR_HAS_STUDENTS: "warning",
  NOTHING_REQUESTED: "warning",
  WORKING_DAY_POLICY_UNDECLARED: "warning",
  TARGET_WORKING_DAY_POLICY_KEPT: "warning",
  SOURCE_HAS_NO_FEE_STRUCTURES: "warning",
  // A rule pointing at a class that no longer exists is already broken in the
  // source year. Copying it forwards the defect rather than creating one, and
  // the target year is still open, so this is surfaced and the run proceeds.
  DANGLING_NEXT_CLASS: "warning",
  ORPHAN_RULE_CLASS: "warning",
};

/** Why a row will not be written. Machine-readable so the UI can translate it. */
export const ROLLOVER_SKIP_REASONS = [
  /** The row's class is not in the tenant's class ladder any more. */
  "CLASS_MISSING",
  /** The target year already holds an identical row; writing it would be a no-op. */
  "ALREADY_IDENTICAL",
] as const;

export type RolloverSkipReason = (typeof ROLLOVER_SKIP_REASONS)[number];

// ---------------------------------------------------------------------------
// The published exclusion list
// ---------------------------------------------------------------------------

export const NOT_COPIED_KEYS = [
  "terms",
  "holidays",
  "students",
  "examSessions",
  "feeVouchers",
  "timetables",
  "attendance",
  "certificates",
  "feeBalancePolicy",
] as const;

export type NotCopiedKey = (typeof NOT_COPIED_KEYS)[number];

export interface NotCopiedEntry {
  key: NotCopiedKey;
  /** Never empty. An entry with no reason is a shrug, not a disclosure. */
  reason: string;
}

/**
 * What a rollover does not carry, and why. Published to the operator rather
 * than left to be discovered.
 *
 * The requirement comes from the industry research the gap analysis cites: a
 * rollover surface must state what it will *not* do. Each entry here is either a
 * structural impossibility, a deliberate refusal to invent a policy, or a fact
 * about the domain — and the reason says which.
 */
export const NOT_COPIED_CONFIGURATION: readonly NotCopiedEntry[] = [
  {
    key: "terms",
    reason:
      "There is no term or semester model. Nothing in the system copies terms because nothing stores them.",
  },
  {
    key: "holidays",
    reason:
      "A holiday's dates belong to the year they fall in. Copying last year's break would place it in the wrong month, so holidays are configured per year after it opens.",
  },
  {
    key: "students",
    reason:
      "Students change year by being promoted, not by being copied. Copying enrollments would place every student in two years at once.",
  },
  {
    key: "examSessions",
    reason:
      "A new year has no exams, and last year's exam sessions and marks belong to the year that recorded them.",
  },
  {
    key: "feeVouchers",
    reason:
      "Vouchers, invoices and payments are financial records of the year that raised them. Carrying them forward would double-count revenue.",
  },
  {
    key: "timetables",
    reason:
      "The timetable table has no unique key, so a copy cannot be made idempotent — a second run would duplicate the whole grid rather than update it. It is excluded until a match key exists.",
  },
  {
    key: "attendance",
    reason:
      "Attendance is a record of what happened, one row per student per day. A new year has no days that have happened yet.",
  },
  {
    key: "certificates",
    reason:
      "A certificate is an issued document with its own number. Issuing it again in the new year would create a second document for the same event.",
  },
  {
    key: "feeBalancePolicy",
    reason:
      "Whether a student's unpaid balance is carried, partially carried, or zeroed is a money policy decision the school must make, not one this system can infer.",
  },
];

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export interface RolloverClass {
  id: string;
  name: string;
  classNumber: number;
}

/** A promotion rule as it is stored, minus its own id and year. */
export interface RolloverRule {
  classId: string;
  minimumAttendance: number;
  minimumOverallPercentage: number;
  minimumPerSubject: number;
  maxFailedSubjects: number;
  allowConditionalPromotion: boolean;
  autoPromote: boolean;
  nextClassId: string | null;
  isActive: boolean;
}

/** A class fee structure as it is stored, minus its own id and year. */
export interface RolloverFeeStructure {
  classId: string;
  tuitionFee: number;
  labFee: number;
  computerFee: number;
  examFee: number;
  sportsFee: number;
  libraryFee: number;
  otherFee: number;
  totalMonthlyFee: number;
  billingCycle: string;
  notes: string | null;
  isActive: boolean;
}

/**
 * The configuration a rollover is asked to carry.
 *
 * Both fields are **required**. A default would mean the caller that forgot to
 * decide silently gets a year with no configuration, and the operator would read
 * that as "there was nothing to copy". Making them required moves the decision to
 * the compiler, which is where it belongs.
 */
export interface RolloverCopyOptions {
  promotionRules: boolean;
  feeStructures: boolean;
}

export type RolloverTarget =
  | {
      mode: "CREATE";
      yearId: string;
      label: string;
      startDate: Date | string;
      endDate: Date | string;
      /** Overrides the source year's working-day policy. Omit to carry it. */
      nonWorkingWeekdays?: unknown;
    }
  | {
      mode: "EXISTING";
      academicYearId: string;
      label: string;
      startDate: Date | string;
      endDate: Date | string;
      isClosed: boolean;
      nonWorkingWeekdays: unknown;
      /** Students already enrolled in the target year. */
      enrolledStudents: number;
    };

export interface RolloverPlanInput {
  source: {
    id: string;
    label: string;
    startDate: Date | string;
    endDate: Date | string;
    isClosed: boolean;
    nonWorkingWeekdays: unknown;
    promotionRules: readonly RolloverRule[];
    feeStructures: readonly RolloverFeeStructure[];
  };
  target: RolloverTarget;
  /** Configuration already on the target year. Empty when the year is new. */
  targetPromotionRules: readonly RolloverRule[];
  targetFeeStructures: readonly RolloverFeeStructure[];
  /** The tenant's whole class ladder, so a class reference can be checked. */
  allClasses: readonly RolloverClass[];
  /** Year ids already in use, so a collision is reported before the write. */
  existingYearIds: readonly string[];
  copy: RolloverCopyOptions;
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

export interface RolloverFinding {
  code: RolloverFindingCode;
  severity: RolloverSeverity;
  /** Interpolation values for the message. The UI renders `code` + `params`. */
  params: Record<string, string | number>;
  /** Log/API fallback only. Never render this — translate `code`. */
  message: string;
}

export type RolloverRowAction = "created" | "updated" | "skipped";

export interface RolloverDiffRow<TValues> {
  classId: string;
  className: string;
  /** The payload that will be written. For a skipped row, what it would have been. */
  values: TValues;
  /** Fields that differ from the target's current row. Empty unless updated. */
  changedFields: string[];
  /** Set exactly when the row is in `skipped`. */
  reason: { code: RolloverSkipReason; message: string } | null;
}

export interface RolloverConfigDiff<TValues> {
  /**
   * Whether the operator asked for this configuration to be carried. When false
   * every bucket is empty: a dry run reports what the options it was given will
   * do, not what some other set of options would have done.
   */
  requested: boolean;
  created: RolloverDiffRow<TValues>[];
  updated: RolloverDiffRow<TValues>[];
  skipped: RolloverDiffRow<TValues>[];
  counts: { created: number; updated: number; skipped: number };
}

export interface RolloverPlanTarget {
  mode: RolloverMode;
  /** The row to insert, for a new year. Null when rolling into an existing one. */
  create: {
    yearId: string;
    label: string;
    startDate: string;
    endDate: string;
  } | null;
  /** The year to write into. Null for a new year, which does not exist yet. */
  existingAcademicYearId: string | null;
  label: string;
  startDate: string;
  endDate: string;
  /**
   * The provenance pointer. Set **only** when the wizard opens the year — a year
   * that already existed was not cloned from anything, and recording a source for
   * it would be a claim the data does not support. An existing target's
   * provenance is the rollover record instead.
   */
  clonedFromId: string | null;
  /** The policy the target will hold after the run. Null means undeclared. */
  nonWorkingWeekdays: readonly Weekday[] | null;
  /** Whether this run writes the policy. False when the target keeps its own. */
  writesWorkingDayPolicy: boolean;
  /** The names, for a message that reads as a sentence. */
  nonWorkingWeekdayNames: string[];
}

export interface RolloverPlan {
  canProceed: boolean;
  blockers: RolloverFinding[];
  warnings: RolloverFinding[];
  counts: { blockers: number; warnings: number };
  source: {
    id: string;
    label: string;
    startDate: string;
    endDate: string;
    isClosed: boolean;
  };
  target: RolloverPlanTarget;
  promotionRules: RolloverConfigDiff<Omit<RolloverRule, "classId">>;
  feeStructures: RolloverConfigDiff<Omit<RolloverFeeStructure, "classId">>;
  /** Rows this run will write, across every requested configuration. */
  writes: { created: number; updated: number };
  notCopied: readonly NotCopiedEntry[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MS_PER_DAY = 86_400_000;

function iso(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Not a valid date: ${JSON.stringify(value)}.`);
  }
  return date.toISOString();
}

/** The instant, in UTC, for comparison. Dates here are calendar boundaries. */
function dayIndex(value: Date | string): number {
  return Math.floor(new Date(iso(value)).getTime() / MS_PER_DAY);
}

function finding(
  code: RolloverFindingCode,
  params: Record<string, string | number>,
  message: string
): RolloverFinding {
  return { code, severity: ROLLOVER_FINDING_SEVERITY[code], params, message };
}

/**
 * Which fields of two rows differ, restricted to the fields named.
 *
 * The field list is explicit rather than derived from `Object.keys`, so
 * `classId` can never be reported as a change: it is the match key, and a diff
 * that claims the match key changed would be describing a different row.
 */
function changedFields<T extends object>(
  previous: T,
  next: T,
  fields: readonly (keyof T & string)[]
): string[] {
  return fields.filter((field) => {
    const before = previous[field];
    const after = next[field];
    if (before instanceof Date || after instanceof Date) {
      return String(before) !== String(after);
    }
    return before !== after;
  });
}

const RULE_FIELDS = [
  "minimumAttendance",
  "minimumOverallPercentage",
  "minimumPerSubject",
  "maxFailedSubjects",
  "allowConditionalPromotion",
  "autoPromote",
  "nextClassId",
  "isActive",
] as const satisfies readonly (keyof Omit<RolloverRule, "classId">)[];

const FEE_FIELDS = [
  "tuitionFee",
  "labFee",
  "computerFee",
  "examFee",
  "sportsFee",
  "libraryFee",
  "otherFee",
  "totalMonthlyFee",
  "billingCycle",
  "notes",
  "isActive",
] as const satisfies readonly (keyof Omit<RolloverFeeStructure, "classId">)[];

/**
 * A row's configuration fields, without the match key.
 *
 * The match key is separated out rather than left in the payload because it is
 * not part of what an upsert writes: `classId` identifies the row, and a
 * `changedFields` list that included it would describe a different row rather
 * than a change to this one.
 */
function configValues<TValues extends object>(
  row: { classId: string } & TValues
): TValues {
  const copy: Record<string, unknown> = { ...row };
  delete copy.classId;
  return copy as TValues;
}

/**
 * Build the create/update/skip diff for one year-scoped configuration table.
 *
 * Both copyable tables share the same shape — a class-keyed row with a unique
 * constraint on `(tenantId, academicYearId, classId)` — so they share one
 * implementation. A second copy of this loop would be a second place for the
 * match key to drift.
 */
function buildDiff<TValues extends object>(params: {
  requested: boolean;
  source: readonly ({ classId: string } & TValues)[];
  target: readonly ({ classId: string } & TValues)[];
  fields: readonly (keyof TValues & string)[];
  classById: Map<string, RolloverClass>;
  /** Named in the skip reason so the operator knows which table was skipped. */
  missingClassReason: string;
}): RolloverConfigDiff<TValues> {
  const diff: RolloverConfigDiff<TValues> = {
    requested: params.requested,
    created: [],
    updated: [],
    skipped: [],
    counts: { created: 0, updated: 0, skipped: 0 },
  };

  // Not requested means nothing to do, and reporting rows here would let a UI
  // that renders `created` show writes that will never happen.
  if (!params.requested) return diff;

  const targetByClass = new Map(params.target.map((row) => [row.classId, row]));

  for (const sourceRow of params.source) {
    const classId = sourceRow.classId;
    const values = configValues(sourceRow);
    const rolloverClass = params.classById.get(classId);

    if (!rolloverClass) {
      diff.skipped.push({
        classId,
        className: classId,
        values,
        changedFields: [],
        reason: { code: "CLASS_MISSING", message: params.missingClassReason },
      });
      continue;
    }

    const existing = targetByClass.get(classId);

    if (!existing) {
      diff.created.push({
        classId,
        className: rolloverClass.name,
        values,
        changedFields: [],
        reason: null,
      });
      continue;
    }

    const fields = changedFields(configValues(existing), values, params.fields);

    if (fields.length === 0) {
      // A no-op write is not an update. Saying so is what makes a re-run
      // obviously safe rather than merely believed to be.
      diff.skipped.push({
        classId,
        className: rolloverClass.name,
        values,
        changedFields: [],
        reason: {
          code: "ALREADY_IDENTICAL",
          message: `The target year already holds an identical row for ${rolloverClass.name}.`,
        },
      });
      continue;
    }

    diff.updated.push({
      classId,
      className: rolloverClass.name,
      values,
      changedFields: fields,
      reason: null,
    });
  }

  diff.counts = {
    created: diff.created.length,
    updated: diff.updated.length,
    skipped: diff.skipped.length,
  };

  return diff;
}

// ---------------------------------------------------------------------------
// The plan
// ---------------------------------------------------------------------------

export function planRollover(input: RolloverPlanInput): RolloverPlan {
  const { source, target, copy } = input;

  const blockers: RolloverFinding[] = [];
  const warnings: RolloverFinding[] = [];

  const classById = new Map(input.allClasses.map((row) => [row.id, row]));

  const sourceStart = dayIndex(source.startDate);
  const sourceStartIso = iso(source.startDate);

  // -------------------------------------------------------------------------
  // The year boundary. The one rule that makes this a rollover at all.
  // -------------------------------------------------------------------------
  const targetStart = dayIndex(target.startDate);
  const targetStartIso = iso(target.startDate);

  if (target.mode === "EXISTING" && target.academicYearId === source.id) {
    blockers.push(
      finding(
        "TARGET_IS_SOURCE",
        { year: source.label },
        `'${source.label}' cannot be rolled over into itself.`
      )
    );
  }

  if (targetStart <= sourceStart) {
    blockers.push(
      finding(
        "TARGET_YEAR_NOT_AFTER_SOURCE",
        { sourceLabel: source.label, targetLabel: target.label, sourceStart: sourceStartIso, targetStart: targetStartIso },
        `The target year must start after '${source.label}' (${sourceStartIso}), but '${target.label}' starts ${targetStartIso}. A year that does not start later is not the next year.`
      )
    );
  }

  // -------------------------------------------------------------------------
  // The target year itself.
  // -------------------------------------------------------------------------
  if (target.mode === "CREATE") {
    const targetEnd = dayIndex(target.endDate);
    if (targetEnd <= targetStart) {
      blockers.push(
        finding(
          "TARGET_DATES_INVALID",
          { targetLabel: target.label, startDate: iso(target.startDate), endDate: iso(target.endDate) },
          `'${target.label}' ends before it starts.`
        )
      );
    }

    if (input.existingYearIds.includes(target.yearId)) {
      blockers.push(
        finding(
          "DUPLICATE_YEAR_ID",
          { yearId: target.yearId },
          `The year id '${target.yearId}' is already in use.`
        )
      );
    }
  } else {
    if (target.isClosed) {
      blockers.push(
        finding(
          "TARGET_YEAR_CLOSED",
          { targetLabel: target.label },
          `'${target.label}' is closed and read-only, so nothing can be rolled into it.`
        )
      );
    }

    if (target.enrolledStudents > 0) {
      warnings.push(
        finding(
          "TARGET_YEAR_HAS_STUDENTS",
          { targetLabel: target.label, count: target.enrolledStudents },
          `'${target.label}' already holds ${target.enrolledStudents} student(s). Configuration carried into it applies to records that already exist.`
        )
      );
    }
  }

  if (!source.isClosed) {
    warnings.push(
      finding(
        "SOURCE_YEAR_STILL_OPEN",
        { sourceLabel: source.label },
        `'${source.label}' is still open, so its records can still change after this rollover.`
      )
    );
  }

  // -------------------------------------------------------------------------
  // The working-day policy.
  //
  // A new year inherits the source's week; an existing year keeps its own. That
  // asymmetry is deliberate: the target of a create is a year nobody has
  // configured yet, and the target of a roll-into is a year that may already be
  // in use, where silently replacing the calendar would move a denominator that
  // figures have already been computed against.
  // -------------------------------------------------------------------------
  const sourcePolicy = readWorkingDayPolicy(source.nonWorkingWeekdays);
  let targetPolicy: readonly Weekday[] | null;
  let writesWorkingDayPolicy: boolean;

  if (target.mode === "CREATE") {
    targetPolicy =
      target.nonWorkingWeekdays === undefined
        ? sourcePolicy?.nonWorkingWeekdays ?? null
        : assertNonWorkingWeekdays(target.nonWorkingWeekdays as readonly unknown[]);
    writesWorkingDayPolicy = true;

    if (targetPolicy === null) {
      warnings.push(
        finding(
          "WORKING_DAY_POLICY_UNDECLARED",
          { sourceLabel: source.label, targetLabel: target.label },
          `Neither '${source.label}' nor the new year declares which weekdays are non-working, so '${target.label}' will report no working-day count until one is set.`
        )
      );
    }
  } else {
    targetPolicy = readWorkingDayPolicy(target.nonWorkingWeekdays)?.nonWorkingWeekdays ?? null;
    writesWorkingDayPolicy = false;

    const sourceNames = sourcePolicy ? nonWorkingWeekdayNames(sourcePolicy.nonWorkingWeekdays) : null;
    const targetNames = targetPolicy ? nonWorkingWeekdayNames(targetPolicy) : null;

    const sourcePolicyLabel = sourceNames ? sourceNames.join(", ") : "not declared";
    const targetPolicyLabel = targetNames ? targetNames.join(", ") : "not declared";

    if (sourcePolicyLabel !== targetPolicyLabel) {
      warnings.push(
        finding(
          "TARGET_WORKING_DAY_POLICY_KEPT",
          {
            targetLabel: target.label,
            // Both labels are supplied because the sentence names both years.
            // The English `message` interpolates `source.label` directly and so
            // reads correctly either way, which is exactly how a param goes
            // missing: the fallback hides it until a translation needs it.
            sourceLabel: source.label,
            sourcePolicy: sourcePolicyLabel,
            targetPolicy: targetPolicyLabel,
          },
          `'${target.label}' keeps its own working-day policy (${targetPolicyLabel}); '${source.label}' declares (${sourcePolicyLabel}). The source's policy was not applied.`
        )
      );
    }
  }

  // -------------------------------------------------------------------------
  // The configuration diff.
  // -------------------------------------------------------------------------
  const promotionRules = buildDiff<Omit<RolloverRule, "classId">>({
    requested: copy.promotionRules,
    source: source.promotionRules,
    target: input.targetPromotionRules,
    fields: RULE_FIELDS,
    classById,
    missingClassReason:
      "The class this rule belongs to is no longer in the class ladder, so the rule cannot be carried.",
  });

  const feeStructures = buildDiff<Omit<RolloverFeeStructure, "classId">>({
    requested: copy.feeStructures,
    source: source.feeStructures,
    target: input.targetFeeStructures,
    fields: FEE_FIELDS,
    classById,
    missingClassReason:
      "The class this fee structure belongs to is no longer in the class ladder, so the structure cannot be carried.",
  });

  // -------------------------------------------------------------------------
  // Consequences the diff alone cannot show.
  // -------------------------------------------------------------------------

  // A rule pointing at a class that does not exist is copied faithfully — the
  // target year is open and can be corrected — but it is reported, because a
  // dangling reference looks configured.
  for (const row of [...promotionRules.created, ...promotionRules.updated]) {
    if (row.values.nextClassId && !classById.has(row.values.nextClassId)) {
      warnings.push(
        finding(
          "DANGLING_NEXT_CLASS",
          { className: row.className, nextClassId: row.values.nextClassId },
          `${row.className}'s rule names a next class that does not exist. The rule was carried as it stands, so the target year inherits the same broken reference.`
        )
      );
    }
  }

  for (const row of promotionRules.skipped) {
    if (row.reason?.code === "CLASS_MISSING") {
      warnings.push(
        finding(
          "ORPHAN_RULE_CLASS",
          { classId: row.classId, sourceLabel: source.label },
          `'${source.label}' holds a promotion rule for a class that no longer exists (${row.classId}), so it was not carried.`
        )
      );
    }
  }

  if (copy.feeStructures && source.feeStructures.length === 0) {
    warnings.push(
      finding(
        "SOURCE_HAS_NO_FEE_STRUCTURES",
        { sourceLabel: source.label },
        `'${source.label}' has no class fee structures, so there was nothing to carry.`
      )
    );
  }

  // The check that stops the wizard producing a year it cannot then promote.
  // Computed from the outcome rather than from the request, so "the operator
  // declined the copy" and "the target was never configured" are one blocker.
  const targetRulesAfterRun = new Map(
    input.targetPromotionRules.map((row) => [row.classId, row])
  );
  for (const row of promotionRules.created) {
    targetRulesAfterRun.set(row.classId, { classId: row.classId, ...row.values });
  }
  for (const row of promotionRules.updated) {
    targetRulesAfterRun.set(row.classId, { classId: row.classId, ...row.values });
  }

  const willHaveActiveRule = [...targetRulesAfterRun.values()].some((row) => row.isActive);

  if (!willHaveActiveRule) {
    blockers.push(
      finding(
        "TARGET_WILL_HAVE_NO_PROMOTION_RULES",
        { targetLabel: target.label, sourceLabel: source.label },
        `After this rollover '${target.label}' would hold no active promotion rule, so no class could be promoted in it. Carry '${source.label}'s rules, or configure them in the target year first.`
      )
    );
  }

  if (!copy.promotionRules && !copy.feeStructures) {
    warnings.push(
      finding(
        "NOTHING_REQUESTED",
        { targetLabel: target.label },
        `No configuration is being carried, so '${target.label}' will keep only what it already has.`
      )
    );
  }

  const writes = {
    created: promotionRules.counts.created + feeStructures.counts.created,
    updated: promotionRules.counts.updated + feeStructures.counts.updated,
  };

  return {
    canProceed: blockers.length === 0,
    blockers,
    warnings,
    counts: { blockers: blockers.length, warnings: warnings.length },
    source: {
      id: source.id,
      label: source.label,
      startDate: sourceStartIso,
      endDate: iso(source.endDate),
      isClosed: source.isClosed,
    },
    target: {
      mode: target.mode,
      create:
        target.mode === "CREATE"
          ? {
              yearId: target.yearId,
              label: target.label,
              startDate: iso(target.startDate),
              endDate: iso(target.endDate),
            }
          : null,
      existingAcademicYearId:
        target.mode === "EXISTING" ? target.academicYearId : null,
      label: target.label,
      startDate: targetStartIso,
      endDate: iso(target.endDate),
      // Only a year the wizard opened was cloned from anything.
      clonedFromId: target.mode === "CREATE" ? source.id : null,
      nonWorkingWeekdays: targetPolicy,
      writesWorkingDayPolicy,
      nonWorkingWeekdayNames: targetPolicy ? nonWorkingWeekdayNames(targetPolicy) : [],
    },
    promotionRules,
    feeStructures,
    writes,
    notCopied: NOT_COPIED_CONFIGURATION,
  };
}
