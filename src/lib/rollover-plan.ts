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
 * How the target year treats balances left over from the source year.
 *
 * **ZERO** is the only option whose behaviour is derivable from the code: a year
 * that said zero inherits nothing, so the invoice run must not sweep the source
 * year's rows into its arrears. `CARRY_BALANCE` and `CARRY_UNPAID` both mean
 * "inherit", and at the write boundary they behave identically — the distinction
 * the roadmap draws between them (a net opening balance versus the itemised
 * unpaid dues) is an accounting presentation question, and consolidating or
 * re-cutting financial records is a decision this module will not make silently.
 * What each option *does* guarantee is that the operator saw the outstanding
 * total before choosing it, because {@link RolloverPlan.feeBalance} reports it.
 */
export const FEE_BALANCE_POLICIES = ["CARRY_BALANCE", "CARRY_UNPAID", "ZERO"] as const;
export type FeeBalancePolicy = (typeof FEE_BALANCE_POLICIES)[number];

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
  /**
   * The source has no timetable slots to carry, so the toggle copied nothing.
   */
  "SOURCE_HAS_NO_TIMETABLES",
  /**
   * Copied timetable slots arrived flagged for review. Always raised when the
   * toggle copies anything, because a copied grid is a proposal to confirm and
   * must not be read as an allocation the school made.
   */
  "TIMETABLE_ARRIVES_NEEDING_REVIEW",
  /**
   * The source holds more than one slot under the same match key — possible,
   * because Postgres treats NULLs as distinct in a unique index and a slot with
   * no section is not covered by the constraint. The run carries one of them;
   * the others are the source's own defect, surfaced rather than multiplied.
   */
  "SOURCE_HAS_DUPLICATE_TIMETABLE_SLOTS",
  /**
   * The operator chose ZERO for the balance and there was something to zero.
   * A warning rather than a blocker: writing a balance off is exactly what the
   * operator asked for, and refusing it would make the option a lie.
   */
  "FEE_BALANCE_WRITTEN_OFF",
  /**
   * A roll-into where the target already holds a different balance policy. The
   * operator's choice is recorded on the run, but the year keeps its own, for
   * the same reason it keeps its own working-day policy: invoices already
   * issued under one policy must not change meaning retroactively.
   */
  "TARGET_FEE_BALANCE_POLICY_KEPT",
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
  SOURCE_HAS_NO_TIMETABLES: "warning",
  TIMETABLE_ARRIVES_NEEDING_REVIEW: "warning",
  SOURCE_HAS_DUPLICATE_TIMETABLE_SLOTS: "warning",
  FEE_BALANCE_WRITTEN_OFF: "warning",
  TARGET_FEE_BALANCE_POLICY_KEPT: "warning",
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
      "The policy the school chooses governs whether balances are inherited, but the balances themselves stay in the year that raised them. Nothing is copied; what is carried forward is a figure on the next invoice, not a financial record.",
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
 * One timetable slot as it is stored, minus its own id and year.
 *
 * The match key is the table's own unique constraint —
 * `(tenantId, academicYearId, classId, sectionId, dayOfWeek, periodNumber)` —
 * so a re-run updates the slot rather than duplicating it. `classId` is carried
 * separately like the other copyable tables; `sectionId`, `dayOfWeek` and
 * `periodNumber` stay inside `values` because they are part of the key the
 * write targets, not a change to it.
 */
export interface RolloverTimetable {
  classId: string;
  sectionId: string | null;
  dayOfWeek: string;
  periodNumber: number;
  startTime: string;
  endTime: string;
  subjectId: string | null;
  staffProfileId: string | null;
  roomNumber: string | null;
  isBreak: boolean;
  breakLabel: string | null;
  needsReview: boolean;
}

/**
 * The configuration a rollover is asked to carry.
 *
 * All three fields are **required**. A default would mean the caller that forgot
 * to decide silently gets a year with no configuration, and the operator would
 * read that as "there was nothing to copy". Making them required moves the
 * decision to the compiler, which is where it belongs.
 */
export interface RolloverCopyOptions {
  promotionRules: boolean;
  feeStructures: boolean;
  /**
   * Copy the timetable grid. Copied slots arrive flagged `needsReview` — see
   * {@link TIMETABLE_ARRIVES_NEEDING_REVIEW} — because a slot's staff, room and
   * period are an allocation for the year that made it, and last year's
   * allocation must not read as this year's.
   */
  timetables: boolean;
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
    timetables: readonly RolloverTimetable[];
  };
  target: RolloverTarget;
  /** Configuration already on the target year. Empty when the year is new. */
  targetPromotionRules: readonly RolloverRule[];
  targetFeeStructures: readonly RolloverFeeStructure[];
  targetTimetables: readonly RolloverTimetable[];
  /** The tenant's whole class ladder, so a class reference can be checked. */
  allClasses: readonly RolloverClass[];
  /** The tenant's sections, so a timetable slot's row label can name its own. */
  allSections: readonly { id: string; name: string }[];
  /** Year ids already in use, so a collision is reported before the write. */
  existingYearIds: readonly string[];
  copy: RolloverCopyOptions;
  /**
   * The fee-balance policy for this transition, stated by the operator.
   *
   * Required rather than defaulted for the same reason `copy` is: a default
   * would mean the caller that forgot to decide silently wrote off, or
   * inherited, money nobody decided about.
   */
  feeBalancePolicy: FeeBalancePolicy;
  /**
   * The policy the target year already holds, if any. Null for a new year.
   * Read rather than assumed so the plan can refuse to silently overwrite a
   * policy that invoices may already have been swept under.
   */
  targetFeeBalancePolicy: FeeBalancePolicy | null;
  /**
   * The source year's unpaid exposure, aggregated by the loader.
   *
   * Reported rather than looked up here so the plan stays free of the database,
   * and so the operator sees the same figure the write boundary will act on.
   */
  sourceOutstanding: { studentCount: number; totalBalance: number };
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
  /**
   * A label for the row when it is finer-grained than its class. Rules and fee
   * structures are one row per class, so `className` is the whole identity and
   * this stays unset. A timetable slot is one of many for its class, so the
   * label names the slot — a UI that renders `className` alone would show
   * twenty identical-looking rows for one class.
   */
  rowLabel?: string;
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
  /** The balance policy the target will hold after the run. */
  feeBalancePolicy: FeeBalancePolicy;
  /** Whether this run writes the balance policy. See the working-day asymmetry. */
  writesFeeBalancePolicy: boolean;
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
  timetables: RolloverConfigDiff<Omit<RolloverTimetable, "classId">>;
  /** Rows this run will write, across every requested configuration. */
  writes: { created: number; updated: number };
  notCopied: readonly NotCopiedEntry[];
  /**
   * The balance policy and what it acts on. Reported even when nothing is
   * outstanding, so the operator can tell "nothing to carry" from "the figure
   * was never shown to me".
   */
  feeBalance: {
    policy: FeeBalancePolicy;
    /** Students in the source year holding an unpaid voucher. */
    studentCount: number;
    /** The sum of those balances, in the tenant's currency. */
    totalBalance: number;
    /**
     * False only for `ZERO` with something outstanding. Recorded as a field
     * rather than re-derived by the UI, so the panel and the audit entry cannot
     * disagree about whether money was written off.
     */
    writesOffBalance: boolean;
  };
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
 * The timetable fields a copy compares, and so the ones `changedFields` can
 * name.
 *
 * `sectionId`, `dayOfWeek` and `periodNumber` are **not** here: they are part of
 * the match key, so two rows that differ on them are two different slots rather
 * than one slot that changed.
 *
 * `needsReview` is **not** here either, and that is deliberate. It is not
 * compared — it is *forced* onto every row this run writes (see the timetable
 * diff in {@link planRollover}). Comparing it would break re-run idempotency:
 * after a first copy the target holds `needsReview: true` while the source holds
 * `false`, so a second run would report every slot as updated forever. Forcing
 * without comparing means a re-run finds the slots identical and skips them.
 */
export const TIMETABLE_FIELDS = [
  "sectionId",
  "dayOfWeek",
  "periodNumber",
  "startTime",
  "endTime",
  "subjectId",
  "staffProfileId",
  "roomNumber",
  "isBreak",
  "breakLabel",
] as const satisfies readonly Exclude<
  keyof Omit<RolloverTimetable, "classId">,
  "needsReview"
>[];

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
 * Every copyable table shares one shape — a year-scoped row with a unique
 * constraint that makes a re-run an update rather than a duplicate — so they
 * share one implementation. What differs is the match key: rules and fee
 * structures are one row per class, so the class is the whole key; the timetable
 * holds many slots per class, so {@link params.slotOf} extends the key with the
 * slot. Passing the key through here rather than writing a second loop is what
 * keeps "a re-run updates rather than duplicates" true of all three tables at
 * once.
 */
function buildDiff<TValues extends object>(params: {
  requested: boolean;
  source: readonly ({ classId: string } & TValues)[];
  target: readonly ({ classId: string } & TValues)[];
  fields: readonly (keyof TValues & string)[];
  classById: Map<string, RolloverClass>;
  /**
   * Extends the match key beyond the class for a table that holds more than one
   * row per class. Omitted for a class-keyed table.
   */
  slotOf?: (row: { classId: string } & TValues) => string;
  /** Builds the row label for a table finer-grained than its class. */
  rowLabelOf?: (row: { classId: string } & TValues, className: string) => string;
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

  const matchKey = (row: { classId: string } & TValues): string =>
    params.slotOf ? `${row.classId}\u0000${params.slotOf(row)}` : row.classId;

  const targetByKey = new Map(params.target.map((row) => [matchKey(row), row]));

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

    const rowLabel = params.rowLabelOf?.(sourceRow, rolloverClass.name);
    const existing = targetByKey.get(matchKey(sourceRow));

    if (!existing) {
      diff.created.push({
        classId,
        className: rolloverClass.name,
        ...(rowLabel ? { rowLabel } : {}),
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
        ...(rowLabel ? { rowLabel } : {}),
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
      ...(rowLabel ? { rowLabel } : {}),
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

  const sectionById = new Map(input.allSections.map((row) => [row.id, row.name]));

  // A copied slot always arrives flagged for review, so the flag is forced here
  // rather than copied from the source — a source slot has `needsReview: false`
  // precisely because the source year confirmed it. Forcing it in the plan
  // rather than in the write keeps the dry run describing exactly what the
  // commit will write, and keeping it out of TIMETABLE_FIELDS keeps a re-run a
  // no-op: the flag is not compared, so the second run finds the slots
  // identical and skips them.
  const timetables = buildDiff<Omit<RolloverTimetable, "classId">>({
    requested: copy.timetables,
    source: source.timetables,
    target: input.targetTimetables,
    fields: TIMETABLE_FIELDS,
    classById,
    slotOf: (row) => `${row.sectionId ?? ""}\u0000${row.dayOfWeek}\u0000${row.periodNumber}`,
    rowLabelOf: (row, className) => {
      const section = row.sectionId ? sectionById.get(row.sectionId) : undefined;
      const slot = `${row.dayOfWeek} · P${row.periodNumber}`;
      return section ? `${className} · ${section} · ${slot}` : `${className} · ${slot}`;
    },
    missingClassReason:
      "The class this timetable slot belongs to is no longer in the class ladder, so the slot cannot be carried.",
  });

  for (const row of [...timetables.created, ...timetables.updated]) {
    row.values.needsReview = true;
  }

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

  if (copy.timetables && source.timetables.length === 0) {
    warnings.push(
      finding(
        "SOURCE_HAS_NO_TIMETABLES",
        { sourceLabel: source.label },
        `'${source.label}' has no timetable slots, so there was nothing to carry.`
      )
    );
  }

  // Stated rather than left to be noticed in the diff, because a grid that
  // arrived flagged is easy to read as reviewed. The count is of the slots this
  // run wrote, which is the number a review has to cover.
  const timetableWrites = timetables.counts.created + timetables.counts.updated;
  if (copy.timetables && timetableWrites > 0) {
    warnings.push(
      finding(
        "TIMETABLE_ARRIVES_NEEDING_REVIEW",
        { targetLabel: target.label, count: timetableWrites },
        `${timetableWrites} timetable slot(s) copied into '${target.label}' are flagged for review. A copied grid is a starting point, not an allocation the school made — confirm the staff, rooms and periods before it is treated as this year's timetable.`
      )
    );
  }

  // The timetable's unique key cannot see a slot with no section, because
  // Postgres treats NULLs as distinct. A duplicate is therefore invisible to
  // the database and has to be caught here, where the whole source grid is in
  // memory. Reported rather than silently de-duplicated: the school's own grid
  // holding two slots for the same period is a defect someone should see.
  if (copy.timetables) {
    const slotKey = (row: RolloverTimetable): string =>
      `${row.classId}\u0000${row.sectionId ?? ""}\u0000${row.dayOfWeek}\u0000${row.periodNumber}`;

    const sourceSlotCounts = new Map<string, number>();
    for (const row of source.timetables) {
      sourceSlotCounts.set(slotKey(row), (sourceSlotCounts.get(slotKey(row)) ?? 0) + 1);
    }
    const duplicated = [...sourceSlotCounts.values()].filter((count) => count > 1).length;
    if (duplicated > 0) {
      warnings.push(
        finding(
          "SOURCE_HAS_DUPLICATE_TIMETABLE_SLOTS",
          { sourceLabel: source.label, count: duplicated },
          `'${source.label}' holds ${duplicated} timetable slot(s) that share a class, section, day and period with another slot. The database cannot prevent this for a class with no section, so the copy carried one of them rather than both.`
        )
      );
    }
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

  if (!copy.promotionRules && !copy.feeStructures && !copy.timetables) {
    warnings.push(
      finding(
        "NOTHING_REQUESTED",
        { targetLabel: target.label },
        `No configuration is being carried, so '${target.label}' will keep only what it already has.`
      )
    );
  }

  const writes = {
    created:
      promotionRules.counts.created +
      feeStructures.counts.created +
      timetables.counts.created,
    updated:
      promotionRules.counts.updated +
      feeStructures.counts.updated +
      timetables.counts.updated,
  };

  // The balance policy is stated, never inferred. What the plan adds is the
  // figure the statement acts on, so "ZERO" is a decision about a number the
  // operator has seen rather than a tick in a form.
  const { studentCount, totalBalance } = input.sourceOutstanding;
  const writesOffBalance = input.feeBalancePolicy === "ZERO" && totalBalance > 0;
  if (writesOffBalance) {
    warnings.push(
      finding(
        "FEE_BALANCE_WRITTEN_OFF",
        { sourceLabel: source.label, targetLabel: target.label, count: studentCount, total: totalBalance },
        `'${target.label}' will not inherit balances from '${source.label}'. ${studentCount} student(s) owe a total of ${totalBalance}, and that amount will not be carried forward as a balance. The vouchers themselves are not touched — they stay in '${source.label}' as the record of what was billed.`
      )
    );
  }

  // The same asymmetry the working-day policy has, for the same reason. A new
  // year has no invoices, so stating its policy writes nothing that already
  // exists. A year already in use may have had invoices swept under its current
  // policy, so overwriting it would change the meaning of records after the
  // fact — the operator's choice is recorded on the run instead.
  const writesFeeBalancePolicy =
    target.mode === "CREATE" ||
    input.targetFeeBalancePolicy === null ||
    input.targetFeeBalancePolicy === input.feeBalancePolicy;

  if (
    target.mode === "EXISTING" &&
    input.targetFeeBalancePolicy !== null &&
    input.targetFeeBalancePolicy !== input.feeBalancePolicy
  ) {
    warnings.push(
      finding(
        "TARGET_FEE_BALANCE_POLICY_KEPT",
        {
          targetLabel: target.label,
          sourceLabel: source.label,
          targetPolicy: input.targetFeeBalancePolicy,
          requestedPolicy: input.feeBalancePolicy,
        },
        `'${target.label}' already states a fee-balance policy of ${input.targetFeeBalancePolicy}, so the policy chosen here (${input.feeBalancePolicy}) was recorded on this run but not applied. Invoices already issued under ${input.targetFeeBalancePolicy} must not change meaning retroactively.`
      )
    );
  }

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
      feeBalancePolicy: input.feeBalancePolicy,
      writesFeeBalancePolicy,
      nonWorkingWeekdayNames: targetPolicy ? nonWorkingWeekdayNames(targetPolicy) : [],
    },
    promotionRules,
    feeStructures,
    timetables,
    writes,
    notCopied: NOT_COPIED_CONFIGURATION,
    feeBalance: {
      policy: input.feeBalancePolicy,
      studentCount,
      totalBalance,
      writesOffBalance,
    },
  };
}
