/**
 * The one definition of "attendance rate".
 *
 * Pure, database-free, like `promotion-engine.ts`, `rollover-preflight.ts` and
 * `academic-year-finalisation.ts`.
 *
 * Why this module exists: seven surfaces were computing this figure, and no two
 * of them agreed.
 *
 * | Surface | LATE | HALF_DAY | EXCUSED | HOLIDAY |
 * |---|---|---|---|---|
 * | here (and the promotion engine) | attended | not attended | not attended | excluded |
 * | `reports/attendance` | not attended | not attended | not attended | **counted as absent** |
 * | `student-performance` | half a day | ignored | attended | counted as absent |
 * | `portal/me` | attended | attended | not attended | counted as absent |
 * | `batch-report-cards` | attended | half a day | not attended | **counted as absent** |
 * | `dashboard/summary` | not attended | not attended | not attended | **counted as absent** |
 * | `attendance` page (today) | not attended | not attended | not attended | **counted as absent** |
 *
 * The HOLIDAY column was the damaging one. `POST /api/attendance` rewrites every
 * student's status to `HOLIDAY` when an academic holiday covers the date, so
 * holiday rows exist for the whole school — and only the promotion engine
 * dropped them from the denominator. Every other surface counted them as days
 * absent, which understates every student's attendance by the holiday fraction
 * of the year. Against a 75% deficit threshold, a school with 15% holidays sees
 * a defaulter list that is mostly an artefact.
 *
 * The `batch-report-cards` row matters most of the seven, because that figure is
 * *printed*: a parent held a report card that disagreed with the promotion
 * sheet, and the report card was wrong.
 *
 * `attendance-service.ts` also computes an attendance figure, for staff payroll
 * (`lopDays`, `payableDays`). It is deliberately **not** converged here: it
 * answers "how much is this employee paid", not "did this student attend", and
 * its half-day and late-penalty rules are a payroll policy rather than a
 * promotion one.
 *
 * The convention here is the promotion engine's, and deliberately so: that is
 * the one with academic consequences, and a figure the school *sees* must agree
 * with the figure that decides whether a child is retained.
 *
 * ## The vocabulary was a second, quieter version of the same defect
 *
 * The table above is about *arithmetic*. The status **names** were disagreeing
 * just as badly, and for longer — four hand-written lists, none of which
 * imported any of the others:
 *
 * | Surface | Statuses it knew about |
 * |---|---|
 * | `attendance-rate.ts` (this module) | PRESENT, ABSENT, LATE, HALF_DAY, EXCUSED, HOLIDAY |
 * | `attendance-service.ts` | PRESENT, ABSENT, LATE, HALF_DAY, EXCUSED, HOLIDAY |
 * | `createAttendanceSchema`, `mark-attendance-modal`, `entities.ts` | PRESENT, ABSENT, LATE, **LEAVE** |
 * | `fast-attendance-grid` | PRESENT, ABSENT, LATE, **EXCUSED** |
 * | `POST /api/attendance` (fast grid) | **nothing — any string was persisted** |
 *
 * `LEAVE` was the damaging one, exactly as `HOLIDAY` was in the table above. Two
 * paths write it — the manual attendance form and leave approval — and it
 * appears in no domain list, so it was never *handled*: it fell through
 * `ATTENDED_STATUSES` and `NON_TEACHING_STATUSES` alike and landed in the
 * denominator without landing in the numerator. An approved absence was counted
 * as an absence, by accident, because nobody had decided otherwise.
 *
 * That is the same failure as before: a status that means something to one
 * screen and nothing to the arithmetic. So the vocabulary now lives here, once,
 * and writers validate against it instead of inventing a fifth list.
 *
 * ## Changing the policy
 *
 * `ATTENDED_STATUSES`, `NON_TEACHING_STATUSES` and `AUTHORISED_ABSENCE_STATUSES`
 * below are the whole policy. Two entries are judgement calls rather than facts:
 *
 * - **`HALF_DAY` does not count as attended.** A half day is not a full day.
 * - **`EXCUSED` and `LEAVE` do not count as attended.** An authorised absence is
 *   still an absence from the register, though many schools would rather it not
 *   count against the student.
 *
 * Both are preserved from the promotion engine exactly, because changing either
 * changes *who gets promoted*. If your institution wants authorised absence
 * excluded from the requirement, add `AUTHORISED_ABSENCE_STATUSES` to
 * `NON_TEACHING_STATUSES` — and understand that it will move real students
 * across the promotion line, so it belongs in a deliberate release rather than a
 * refactor.
 */

/** Every status the system may persist. **Writers must validate against this.** */
export const ATTENDANCE_STATUSES = [
  "PRESENT",
  "ABSENT",
  "LATE",
  "HALF_DAY",
  "EXCUSED",
  "HOLIDAY",
  "LEAVE",
] as const;

export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

/** Statuses that count as a day attended. */
export const ATTENDED_STATUSES: readonly string[] = ["PRESENT", "LATE"];

/**
 * Statuses dropped from the numerator *and* the denominator: days the school
 * did not teach, so neither attending nor missing them means anything.
 */
export const NON_TEACHING_STATUSES: readonly string[] = ["HOLIDAY"];

/**
 * An absence the school authorised — a leave the school granted.
 *
 * Two spellings, because two screens grew independently and neither imported
 * the other: the manual form and the leave module write `LEAVE`, while the
 * register, the reports and the historical importer write `EXCUSED`. They are
 * the same fact, so they are declared once here and given the same treatment.
 *
 * Kept as a named group rather than merged into one value because the
 * alternative — rewriting one spelling into the other — is a data migration
 * across live attendance history, and the two are already interchangeable under
 * every calculation in this module.
 */
export const AUTHORISED_ABSENCE_STATUSES: readonly string[] = ["EXCUSED", "LEAVE"];

const KNOWN_STATUS_SET: ReadonlySet<string> = new Set<string>(ATTENDANCE_STATUSES);

/**
 * Whether a status is one this system understands.
 *
 * Exists so a writer can refuse an unknown value at the boundary rather than
 * persisting it and letting every reader downstream guess. A row carrying a
 * status nothing recognises is not inert — it is counted as an absence in every
 * denominator, which is how a typo becomes a defaulter.
 */
export function isKnownAttendanceStatus(status: unknown): status is AttendanceStatus {
  return typeof status === "string" && KNOWN_STATUS_SET.has(status);
}

/** The statuses in `counts` that this system does not recognise. */
export function unknownAttendanceStatuses(counts: Record<string, number>): string[] {
  return Object.keys(counts).filter((status) => !KNOWN_STATUS_SET.has(status));
}

export interface AttendanceRate {
  /**
   * Percentage attended, to two decimals — or `null` when no teaching days are
   * on file. Never 0 for an untracked student: 0% is a real and very different
   * figure, and rendering it turns "nobody has marked this class yet" into
   * "this child has never attended".
   */
  rate: number | null;
  /** Days counted as attended. */
  presentDays: number;
  /** Days counted, holidays excluded. */
  totalDays: number;
  /** False when nothing is tracked, in which case attendance is not enforced. */
  tracked: boolean;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

const UNTRACKED: AttendanceRate = {
  rate: null,
  presentDays: 0,
  totalDays: 0,
  tracked: false,
};

/**
 * The rate from pre-aggregated status counts, so a caller can use one grouped
 * query instead of loading every attendance row.
 *
 * Note what is *not* special-cased. Only `NON_TEACHING_STATUSES` leaves the
 * denominator and only `ATTENDED_STATUSES` joins the numerator; **everything
 * else counts as a day not attended**. That is the right default for a real
 * status — `ABSENT`, `HALF_DAY`, `EXCUSED`, `LEAVE` all belong in it — but it is
 * also why an unrecognised status is dangerous rather than inert. A typo is not
 * ignored; it is scored as an absence, in every denominator, silently. Hence
 * `isKnownAttendanceStatus`, and hence writers validate before they persist.
 */
export function attendanceRateFromCounts(counts: Record<string, number>): AttendanceRate {
  let presentDays = 0;
  let totalDays = 0;

  for (const [status, count] of Object.entries(counts)) {
    if (!Number.isFinite(count) || count <= 0) continue;
    if (NON_TEACHING_STATUSES.includes(status)) continue;
    totalDays += count;
    if (ATTENDED_STATUSES.includes(status)) presentDays += count;
  }

  if (totalDays === 0) return UNTRACKED;

  return {
    rate: round2((presentDays / totalDays) * 100),
    presentDays,
    totalDays,
    tracked: true,
  };
}

/** The same computation, fed raw rows. */
export function attendanceRateFromRecords(
  records: ReadonlyArray<{ status: string }>
): AttendanceRate {
  const counts: Record<string, number> = {};
  for (const record of records) {
    counts[record.status] = (counts[record.status] ?? 0) + 1;
  }
  return attendanceRateFromCounts(counts);
}

/** A day's rate across a class register, for the "how many were in today" figure. */
export interface DayAttendanceRate extends AttendanceRate {
  /**
   * True when every row for the day is a non-teaching status. A register with
   * nobody present on a holiday is not a 0% day, and reporting it as one is what
   * made a closed school look like a walkout on the dashboard.
   */
  isHoliday: boolean;
}

function withHolidayFlag(counts: Record<string, number>, rowCount: number): DayAttendanceRate {
  if (rowCount === 0) return { ...UNTRACKED, isHoliday: false };
  const rate = attendanceRateFromCounts(counts);
  if (!rate.tracked) return { ...UNTRACKED, isHoliday: true };
  return { ...rate, isHoliday: false };
}

export function dayAttendanceRate(records: ReadonlyArray<{ status: string }>): DayAttendanceRate {
  const counts: Record<string, number> = {};
  for (const record of records) {
    counts[record.status] = (counts[record.status] ?? 0) + 1;
  }
  return withHolidayFlag(counts, records.length);
}

/** The same computation from pre-aggregated counts, so a `groupBy` needs no second query. */
export function dayAttendanceRateFromCounts(counts: Record<string, number>): DayAttendanceRate {
  let rowCount = 0;
  for (const count of Object.values(counts)) {
    if (Number.isFinite(count) && count > 0) rowCount += count;
  }
  return withHolidayFlag(counts, rowCount);
}
