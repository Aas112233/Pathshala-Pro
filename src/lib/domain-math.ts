/**
 * Domain arithmetic for payroll, examinations, campus operations and the
 * general ledger.
 *
 * Every function here is pure, deterministic and free of database access so it
 * can be unit-tested exhaustively. Production callers should replace inline
 * arithmetic with these helpers rather than re-implementing the formulas —
 * the audit found the same formula implemented between three and five times
 * per domain, with the copies disagreeing.
 */

import { roundTo, roundCurrency, safeDivide, safePercentage, clamp, clampNonNegative } from "@/lib/math-utils";

/* ------------------------------------------------------------------ *
 * Payroll: proration, loss of pay, net payable
 * ------------------------------------------------------------------ */

/** Calendar days in a month. `month` is 1–12. Never returns 0 for valid input. */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Whole-day count, clamped into [0, totalDays]. Guards against over-accrual. */
export function clampPayableDays(unpaidDays: number, totalDays: number): number {
  return Math.min(Math.max(0, Math.trunc(unpaidDays)), Math.max(0, totalDays));
}

/**
 * Pro-rate an amount over payable days. Returns 0 when there is no period to
 * pro-rate across, so a mid-month joinee cannot divide by zero.
 */
export function prorate(base: number, payableDays: number, totalDays: number): number {
  if (!Number.isFinite(totalDays) || totalDays <= 0) return 0;
  return roundCurrency((base * clampPayableDays(payableDays, totalDays)) / totalDays);
}

/** Per-day salary, rounded once to 2dp. Use this (not the raw quotient) for LOP. */
export function perDaySalary(gross: number, totalDays: number): number {
  if (!Number.isFinite(totalDays) || totalDays <= 0) return 0;
  return roundCurrency(gross / totalDays);
}

/**
 * Loss of pay as the *residual* of proration.
 *
 * Prefer this over `perDaySalary * unpaidDays`: that form rounds twice, so the
 * payslip's printed daily rate multiplied by the days no longer equals the
 * deducted amount (off by a paisa, which breaks reconciliation).
 */
export function computeLop(gross: number, unpaidDays: number, totalDays: number): number {
  if (!Number.isFinite(totalDays) || totalDays <= 0) return 0;
  const earned = prorate(gross, totalDays - clampPayableDays(unpaidDays, totalDays), totalDays);
  return roundCurrency(gross - earned);
}

/**
 * Inclusive calendar-day span between two instants, immune to time-of-day.
 *
 * `Math.ceil((b - a) / 86400000) + 1` — the pattern used across the codebase —
 * double-counts whenever an endpoint is not exactly midnight, and mis-counts
 * across a DST transition because the difference is elapsed time, not dates.
 */
export function inclusiveDays(from: Date, to: Date): number {
  const utcDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.max(0, Math.floor((utcDay(to) - utcDay(from)) / 86_400_000) + 1);
}

/**
 * Net payable, clamping at zero while *reporting* the discarded shortfall.
 *
 * Clamping net to 0 without recording the shortfall silently writes off the
 * unrecovered loan/PF/TDS and leaves the accrual journal unable to balance.
 */
export function computeNetPayable(input: {
  gross: number;
  lop?: number;
  pf?: number;
  tax?: number;
  loan?: number;
}): { netPayable: number; shortfall: number; totalDeductions: number } {
  const lop = clampNonNegative(input.lop ?? 0);
  const pf = clampNonNegative(input.pf ?? 0);
  const tax = clampNonNegative(input.tax ?? 0);
  const loan = clampNonNegative(input.loan ?? 0);
  const totalDeductions = roundCurrency(lop + pf + tax + loan);
  const rawNet = roundCurrency(input.gross - totalDeductions);
  return {
    netPayable: Math.max(0, rawNet),
    shortfall: Math.max(0, -rawNet),
    totalDeductions,
  };
}

/* ------------------------------------------------------------------ *
 * Examinations: percentages, GPA, grade bands, ranking
 * ------------------------------------------------------------------ */

/**
 * Subject percentage. Returns 0 — never `NaN`/`Infinity` — when `max <= 0`.
 * Clamps obtained into [0, max] so grace or bonus marks can't exceed 100%.
 */
export function computePercentage(
  obtained: number,
  max: number,
  options?: { clamp?: boolean },
): number {
  if (!Number.isFinite(obtained) || !Number.isFinite(max) || max <= 0) return 0;
  const capped = options?.clamp === false ? obtained : Math.min(Math.max(0, obtained), max);
  return roundTo(safeDivide(capped, max) * 100, 2);
}

/**
 * Cohort aggregate: the **ratio of sums**, never the mean of percentages.
 *
 * The mean-of-percentages form weights a 10-mark quiz equally with a 100-mark
 * final, and compounds a rounding error per row. Raw marks are summed first and
 * rounded exactly once.
 */
export function computeAggregatePercentage(
  rows: ReadonlyArray<{ obtained: number; max: number }>,
): number {
  let sumObtained = 0;
  let sumMax = 0;
  for (const row of rows) {
    if (Number.isFinite(row.obtained)) sumObtained += row.obtained;
    if (Number.isFinite(row.max)) sumMax += row.max;
  }
  return sumMax <= 0 ? 0 : roundTo(safeDivide(sumObtained, sumMax) * 100, 2);
}

/** A single subject's contribution to a GPA. */
export interface GpaEntry {
  gradePoint: number;
  creditHours?: number | null;
}

/**
 * Credit-weighted GPA: `SUM(gradePoint x creditHours) / SUM(creditHours)`.
 * Falls back to the unweighted mean when no credits are assigned, and returns
 * 0 for an empty cohort rather than `NaN`.
 */
export function computeWeightedGpa(entries: ReadonlyArray<GpaEntry>): number {
  const valid = entries.filter((entry) => Number.isFinite(entry.gradePoint));
  if (valid.length === 0) return 0;

  const totalCredits = valid.reduce((sum, entry) => sum + Math.max(0, entry.creditHours ?? 0), 0);
  if (totalCredits <= 0) {
    return roundTo(safeDivide(valid.reduce((sum, e) => sum + e.gradePoint, 0), valid.length), 2);
  }
  const weighted = valid.reduce((sum, e) => sum + e.gradePoint * (e.creditHours ?? 0), 0);
  return roundTo(safeDivide(weighted, totalCredits), 2);
}

export interface GradeBand {
  min: number;
  grade: string;
  point: number;
}

/**
 * Resolve a grade from a percentage.
 *
 * Sorts a defensive copy descending, because `bands.find(b => pct >= b.min)`
 * returns the wrong band for an ascending table — a tenant-supplied `gpaScale`
 * stored ascending grades an 85% student as F. Throws when the score falls in
 * a genuine gap instead of falling through to the last band.
 */
export function resolveGradePoint(percentage: number, bands: ReadonlyArray<GradeBand>): GradeBand {
  if (bands.length === 0) throw new Error("resolveGradePoint: empty band table");
  const sorted = [...bands].sort((a, b) => b.min - a.min);
  const pct = roundTo(Number.isFinite(percentage) ? percentage : 0, 2);
  const match = sorted.find((band) => pct >= band.min);
  if (!match) throw new Error(`resolveGradePoint: ${pct}% falls in no configured band`);
  return match;
}

export type RankingPolicy =
  /** 1,1,3 — standard competition ranking. Next rank skips the tied places. */
  | "competition"
  /** 1,1,2 — dense ranking. Next rank is the next distinct score. */
  | "dense"
  /** 1,2,3 — every row unique. Legacy behaviour; opt in explicitly. */
  | "ordinal";

export interface Ranked {
  rank: number;
  rankLabel: string;
  /** Size of the tied group this row belongs to. */
  tieCount: number;
}

function formatOrdinal(rank: number): string {
  const mod100 = rank % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${rank}th`;
  switch (rank % 10) {
    case 1:
      return `${rank}st`;
    case 2:
      return `${rank}nd`;
    case 3:
      return `${rank}rd`;
    default:
      return `${rank}th`;
  }
}

/**
 * Deterministic, tie-aware student ranking.
 *
 * Ties are detected on the score rounded to `precision` decimals, so 92.4 and
 * 92.40000000000001 can never be split into different ranks. Ties always
 * receive an identical rank; only the policy decides what the *next* distinct
 * score is numbered. `tieBreak` makes ordering reproducible across database
 * result orders.
 */
export function rankStudents<T extends object>(
  rows: ReadonlyArray<T>,
  scoreOf: (row: T) => number,
  options?: {
    policy?: RankingPolicy;
    precision?: number;
    tieBreak?: (a: T, b: T) => number;
  },
): Array<T & Ranked> {
  const policy = options?.policy ?? "competition";
  const precision = options?.precision ?? 2;

  const indexed = rows.map((row, index) => ({
    row,
    index,
    key: roundTo(Number.isFinite(scoreOf(row)) ? scoreOf(row) : 0, precision),
  }));

  indexed.sort((a, b) => {
    if (b.key !== a.key) return b.key - a.key;
    if (options?.tieBreak) {
      const tie = options.tieBreak(a.row, b.row);
      if (tie !== 0) return tie;
    }
    return a.index - b.index; // stable: identical input order yields identical output
  });

  const ranked: Array<T & Ranked> = [];
  let denseRank = 0;
  let previousKey = Number.NaN;
  let previousRank = 0;
  let groupStart = 0;

  for (let i = 0; i < indexed.length; i++) {
    const isNewGroup = i === 0 || indexed[i].key !== previousKey;
    if (isNewGroup) {
      denseRank += 1;
      groupStart = i;
    }
    const rank =
      policy === "ordinal" ? i + 1 : policy === "dense" ? denseRank : isNewGroup ? i + 1 : previousRank;

    ranked.push({
      ...indexed[i].row,
      rank,
      rankLabel: formatOrdinal(rank),
      tieCount: i - groupStart + 1,
    });

    previousKey = indexed[i].key;
    previousRank = rank;
  }

  return ranked;
}

/**
 * Attendance percentage for report cards and promotion gates.
 *
 * Returns `null` — meaning *unknown* — when there are no working days, rather
 * than 0 (which auto-retains a student for a data-entry gap) or a fabricated
 * value. Holidays and excused days must be excluded by the caller.
 */
export function computeAttendancePercentage(input: {
  present: number;
  late?: number;
  halfDay?: number;
  workingDays: number;
}): number | null {
  const { present, late = 0, halfDay = 0, workingDays } = input;
  if (!Number.isFinite(workingDays) || workingDays <= 0) return null;
  const credit = clampNonNegative(present) + clampNonNegative(late) + clampNonNegative(halfDay) * 0.5;
  return roundTo(Math.min(100, safeDivide(credit, workingDays) * 100), 2);
}

/* ------------------------------------------------------------------ *
 * Campus operations: fines, capacity, inventory
 * ------------------------------------------------------------------ */

/**
 * Whole calendar days from `due` to `returned`. Negative means returned early.
 *
 * Uses UTC date components, not an elapsed-millisecond division, so a DST
 * transition cannot add or drop a day and a same-day return counts as 0.
 */
export function daysBetween(due: Date, returned: Date): number {
  const utcDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.floor((utcDay(returned) - utcDay(due)) / 86_400_000);
}

export interface FinePolicy {
  dailyRate: number;
  /** Ceiling on the fine. Omit for uncapped. */
  maxFine?: number;
  /** Grace period in whole days before billing starts. Defaults to 0. */
  graceDays?: number;
}

/** Overdue library fine. Never negative, always 2dp, capped when configured. */
export function computeOverdueFine(
  dueDate: Date,
  returnDate: Date,
  policy: FinePolicy,
): { daysLate: number; fine: number } {
  const raw = daysBetween(dueDate, returnDate) - (policy.graceDays ?? 0);
  const daysLate = Math.max(0, raw); // an early return must never produce a negative fine
  const uncapped = daysLate * policy.dailyRate;
  const capped = policy.maxFine === undefined ? uncapped : Math.min(uncapped, policy.maxFine);
  return { daysLate, fine: roundCurrency(Math.max(0, capped)) };
}

/** Occupancy as a percentage in [0, 100]. Zero capacity returns the fallback. */
export function occupancyRate(allocated: number, capacity: number, fallback = 0): number {
  if (!Number.isFinite(allocated) || !Number.isFinite(capacity) || capacity <= 0) return fallback;
  return clamp(safePercentage(allocated, capacity, 1), 0, 100);
}

/**
 * Whether one more unit fits. An empty container (capacity 0) can never be
 * allocated into, so overbooking is impossible by construction.
 */
export function canAllocate(allocated: number, capacity: number): boolean {
  if (!Number.isFinite(allocated) || !Number.isFinite(capacity)) return false;
  return capacity > 0 && allocated < capacity;
}

/**
 * Guarded stock movement. Returns the resulting quantity, or `null` when the
 * delta would breach [0, maxQty].
 *
 * `null` means *reject the operation* — never silently clamp, because clamping
 * hides the fact that more stock was issued than existed.
 */
export function applyStockDelta(
  currentQuantity: number,
  delta: number,
  maxQuantity = Number.MAX_SAFE_INTEGER,
): number | null {
  if (!Number.isFinite(currentQuantity) || !Number.isFinite(delta)) return null;
  const next = currentQuantity + delta;
  return next >= 0 && next <= maxQuantity ? next : null;
}

/** Single source of truth for the reorder trigger (threshold is inclusive). */
export function needsReorder(quantity: number, reorderLevel: number): boolean {
  if (!Number.isFinite(quantity) || !Number.isFinite(reorderLevel)) return false;
  return quantity <= reorderLevel;
}

/** Quantity to order to bring stock back up to `targetLevel`. */
export function reorderQuantity(quantity: number, reorderLevel: number, targetLevel: number): number {
  if (!needsReorder(quantity, reorderLevel)) return 0;
  return Math.max(0, targetLevel - quantity);
}

/* ------------------------------------------------------------------ *
 * General ledger
 * ------------------------------------------------------------------ */

export interface JournalLineInput {
  side: "DEBIT" | "CREDIT";
  amount: number;
}

/**
 * Sum each side of a journal **after** rounding every line to 2dp.
 *
 * Rounding first is essential: the database column is `Decimal(15,2)`, so
 * Postgres rounds each line independently. Asserting on unrounded in-memory
 * values lets `Dr 0.005 + Dr 0.005 vs Cr 0.01` pass the check and then be
 * stored as `Dr 0.02 / Cr 0.01` — balanced in memory, unbalanced on disk.
 */
export function sumSides(lines: ReadonlyArray<JournalLineInput>): {
  totalDebit: number;
  totalCredit: number;
} {
  let debitCents = 0;
  let creditCents = 0;
  for (const line of lines) {
    const cents = Math.round(roundCurrency(line.amount) * 100);
    if (line.side === "DEBIT") debitCents += cents;
    else creditCents += cents;
  }
  return { totalDebit: debitCents / 100, totalCredit: creditCents / 100 };
}

/**
 * Assert double-entry equilibrium. Throws with the imbalance rather than
 * returning a boolean, so an unbalanced journal can never be persisted.
 *
 * Rejects negative amounts: a contra entry must flip `side`, not negate the
 * amount, or the trial balance silently nets two wrong numbers.
 */
export function assertJournalBalance(lines: ReadonlyArray<JournalLineInput>): {
  totalDebit: number;
  totalCredit: number;
} {
  if (lines.length < 2) throw new Error("A journal requires at least two lines");
  for (const line of lines) {
    if (!Number.isFinite(line.amount)) {
      throw new RangeError(`Journal line has a non-finite amount: ${line.amount}`);
    }
    if (line.amount < 0) {
      throw new RangeError(
        `Journal line amount ${line.amount} is negative — flip "side" instead of negating the amount`,
      );
    }
  }
  const { totalDebit, totalCredit } = sumSides(lines);
  if (totalDebit !== totalCredit) {
    throw new Error(
      `Unbalanced journal: Debit ${totalDebit.toFixed(2)} != Credit ${totalCredit.toFixed(2)} ` +
        `(difference ${(totalDebit - totalCredit).toFixed(2)})`,
    );
  }
  if (totalDebit === 0) throw new Error("Journal has a zero total");
  return { totalDebit, totalCredit };
}

export type AccountClass = "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";

/**
 * Classify an account by its **numeric** code.
 *
 * Ranges are half-open so they are exhaustive and non-overlapping: 1999 is an
 * asset, 2000 is a liability, and no code can fall between two ranges and be
 * silently dropped from the balance sheet. Classification must never compare
 * account codes as strings — `"10000" < "4000"` is true lexicographically.
 */
export function classifyAccountCode(code: number): AccountClass {
  if (!Number.isFinite(code)) throw new RangeError(`Account code must be numeric, received ${code}`);
  if (code >= 1000 && code < 2000) return "ASSET";
  if (code >= 2000 && code < 3000) return "LIABILITY";
  if (code >= 3000 && code < 4000) return "EQUITY";
  if (code >= 4000 && code < 5000) return "REVENUE";
  if (code >= 5000 && code < 6000) return "EXPENSE";
  throw new RangeError(
    `Account code ${code} falls in no configured range — it would be silently dropped from reports`,
  );
}

/** Sign a balance by its normal balance, so contra accounts render correctly. */
export function signedBalance(
  sumDebit: number,
  sumCredit: number,
  normalBalance: "DEBIT" | "CREDIT",
): number {
  return normalBalance === "DEBIT" ? sumDebit - sumCredit : sumCredit - sumDebit;
}

export interface BalanceSheetTotals {
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  currentPeriodSurplus: number;
  /** Surplus earned before the reporting window — required for the equation to close. */
  otherReserves?: number;
}

/**
 * Balance sheet equation: Assets === Liabilities + Equity + Surplus.
 *
 * Returns `difference` so the caller can *raise* on an unreconciled report
 * instead of returning `isBalanced: false` and letting a CFO read an
 * out-of-balance statement with no warning.
 */
export function computeBalanceSheet(totals: BalanceSheetTotals): {
  totalLiabilitiesAndEquity: number;
  isBalanced: boolean;
  difference: number;
} {
  const equity =
    totals.totalEquity + totals.currentPeriodSurplus + (totals.otherReserves ?? 0);
  const totalLiabilitiesAndEquity = roundCurrency(totals.totalLiabilities + equity);
  const totalAssets = roundCurrency(totals.totalAssets);
  const difference = roundCurrency(totalAssets - totalLiabilitiesAndEquity);
  return {
    totalLiabilitiesAndEquity,
    isBalanced: difference === 0,
    difference,
  };
}

/** Net surplus. Expenses are stored as positive debits — never negate them here. */
export function computeNetSurplus(totalRevenue: number, totalExpenses: number): number {
  return roundCurrency(totalRevenue - totalExpenses);
}
