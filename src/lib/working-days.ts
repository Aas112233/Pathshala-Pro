/**
 * Working days for a date range.
 *
 * ## Working days are a set, not a subtraction
 *
 * The arithmetic this module replaces was
 * `totalCalendarDays - sundaysCount - totalHolidays`, and it was wrong twice in
 * one expression:
 *
 *   - **The weekend was a hardcoded constant.** `getDay() === 0` counted
 *     Sundays. A school whose week runs Monday–Friday got a denominator that
 *     included every Saturday, so `totalWorkingDays` was overstated by up to
 *     four days a month on a payslip.
 *   - **A holiday was subtracted twice when it fell on the weekend.** A holiday
 *     spanning a Sunday was removed once as a Sunday and again as a holiday.
 *     Two overlapping holidays were likewise counted twice. The result
 *     understated working days, and the comment on the original line —
 *     "approx calendar days minus Sundays and holidays" — shows the author knew
 *     the figure was approximate. It was never approximate; it was wrong in a
 *     direction nobody could see.
 *
 * Enumerating the dates and testing each one against a policy makes both
 * impossible: a date is either in the set or it is not, and there is no
 * subtraction available to double-count. The same reasoning removed the
 * counted `absentDays` from the attendance rate.
 *
 * ## The weekend is a policy, not a constant
 *
 * Nothing here assumes Saturday and Sunday. The non-working weekdays are
 * supplied explicitly and are recorded per academic year, because a count
 * computed under one convention must never be silently reinterpreted under
 * another. `Tenant.firstDayOfWeek` is a *calendar display* setting; it is a
 * reasonable thing to pre-fill a form from, and an unreasonable thing to derive
 * arithmetic from at read time.
 *
 * ## Everything here is UTC
 *
 * `AcademicHoliday.startDate`/`endDate` are `@db.Date`, which Prisma returns as
 * a `Date` at UTC midnight. Reading the weekday with the local `getDay()` shifts
 * it back a day for every tenant west of UTC: a holiday stored as 2026-03-01
 * (a Sunday) reads as Saturday in a UTC-3 timezone. Dates are therefore
 * reduced to an integer day index in UTC and compared as integers, which also
 * sidesteps daylight-saving arithmetic entirely — the day index of a date never
 * gains or loses an hour.
 *
 * ## Invalid input throws
 *
 * Same convention as `applyOverride` refusing a demotion with no target class:
 * a policy that cannot be interpreted is an error, not a default. Silently
 * choosing a weekend, or returning zero working days because every weekday was
 * marked non-working, would put a wrong number in front of a user who has no
 * way to tell.
 */

/** 0 = Sunday … 6 = Saturday, matching `Date.prototype.getUTCDay`. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const WEEKDAYS: readonly Weekday[] = [0, 1, 2, 3, 4, 5, 6];

/** Indexed by weekday number, so `WEEKDAY_NAMES[0]` is Sunday. */
export const WEEKDAY_NAMES = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

export type WeekdayName = (typeof WEEKDAY_NAMES)[number];

const MS_PER_DAY = 86_400_000;

/**
 * A weekday name to its number, or `null` if it is not a weekday name.
 * Used to pre-fill a policy from `Tenant.firstDayOfWeek`, which stores a name.
 */
export function weekdayNumberFromName(name: unknown): Weekday | null {
  if (typeof name !== "string") return null;
  const index = WEEKDAY_NAMES.indexOf(name.trim().toLowerCase() as WeekdayName);
  return index === -1 ? null : (index as Weekday);
}

export function weekdayName(weekday: Weekday): WeekdayName {
  return WEEKDAY_NAMES[weekday];
}

export interface HolidayRange {
  startDate: Date | string;
  endDate: Date | string;
}

/**
 * The declared policy for a year: which weekdays the institute does not teach.
 *
 * A seven-day week is legitimate and is expressed as an empty list. A
 * zero-working-day year is not, and is refused — see
 * {@link assertNonWorkingWeekdays}.
 */
export interface WorkingDayPolicy {
  nonWorkingWeekdays: readonly Weekday[];
}

/**
 * Reduces a date to an integer day index in UTC.
 *
 * The value is meaningless as a timestamp; it exists so that two dates can be
 * compared and iterated as integers without any timezone or DST arithmetic.
 */
function utcDayIndex(value: Date | string): number {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Not a valid date: ${JSON.stringify(value)}.`);
  }
  return Math.floor(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / MS_PER_DAY
  );
}

/** The inverse of {@link utcDayIndex}, as `YYYY-MM-DD`. */
export function isoDateFromDayIndex(dayIndex: number): string {
  return new Date(dayIndex * MS_PER_DAY).toISOString().slice(0, 10);
}

/** The weekday of a date, read in UTC. */
export function utcWeekday(value: Date | string): Weekday {
  return new Date(utcDayIndex(value) * MS_PER_DAY).getUTCDay() as Weekday;
}

/**
 * Validates a non-working-weekday list, deduplicating and sorting it.
 *
 * Throws rather than repairing: a list containing `7` or `"sunday"` is a bug at
 * the call site or a corrupt column, and coercing it would hide that.
 */
export function assertNonWorkingWeekdays(value: readonly unknown[]): Weekday[] {
  if (!Array.isArray(value)) {
    throw new Error("A working-day policy requires an array of non-working weekdays.");
  }

  const seen = new Set<Weekday>();
  for (const entry of value) {
    if (typeof entry !== "number" || !Number.isInteger(entry) || entry < 0 || entry > 6) {
      throw new Error(
        `Not a weekday number: ${JSON.stringify(entry)}. Expected an integer 0 (Sunday) to 6 (Saturday).`
      );
    }
    seen.add(entry as Weekday);
  }

  const weekdays = [...seen].sort((a, b) => a - b);

  if (weekdays.length === WEEKDAYS.length) {
    throw new Error(
      "All seven weekdays are marked non-working, which would leave the year with no working days at all."
    );
  }

  return weekdays;
}

/**
 * Reads a stored policy value into weekdays.
 *
 * `null` is refused on purpose. An academic year with no declared policy is
 * *undeclared*, not "assume Saturday and Sunday" — callers must handle that case
 * explicitly, because a working-day count is an arithmetic input and a wrong
 * convention produces a wrong number with nothing to signal it.
 */
export function parseNonWorkingWeekdays(raw: unknown): Weekday[] {
  if (raw === null || raw === undefined) {
    throw new Error(
      "No working-day policy is declared. A policy must be stated explicitly; there is no default weekend."
    );
  }

  // Tolerate the shapes a Json column can hold: a bare array, or an object with
  // the list under `nonWorkingWeekdays`.
  let list: unknown = raw;
  if (!Array.isArray(raw) && typeof raw === "object" && raw !== null) {
    if (!("nonWorkingWeekdays" in raw)) {
      throw new Error(
        "A stored working-day policy object must carry a nonWorkingWeekdays array."
      );
    }
    list = (raw as { nonWorkingWeekdays: unknown }).nonWorkingWeekdays;
  }

  if (!Array.isArray(list)) {
    throw new Error(
      "A stored working-day policy must be an array of weekdays, or an object with a nonWorkingWeekdays array."
    );
  }

  return assertNonWorkingWeekdays(list);
}

/** Reads a policy object, or `null` when the value is undeclared. */
export function readWorkingDayPolicy(raw: unknown): WorkingDayPolicy | null {
  if (raw === null || raw === undefined) return null;
  return { nonWorkingWeekdays: parseNonWorkingWeekdays(raw) };
}

/** A policy from a weekday name, for pre-filling a form from `firstDayOfWeek`. */
export function policyFromFirstDayOfWeek(name: unknown): WorkingDayPolicy | null {
  const weekday = weekdayNumberFromName(name);
  return weekday === null ? null : { nonWorkingWeekdays: [weekday] };
}

/** Human-readable names of the non-working weekdays, for messages and previews. */
export function nonWorkingWeekdayNames(nonWorkingWeekdays: readonly Weekday[]): WeekdayName[] {
  return assertNonWorkingWeekdays(nonWorkingWeekdays).map((weekday) => WEEKDAY_NAMES[weekday]);
}

export interface WorkingDaysInput {
  startDate: Date | string;
  endDate: Date | string;
  nonWorkingWeekdays: readonly Weekday[];
  /** Holiday ranges. Filtered by the caller (`affectsStaff` / `affectsStudents`). */
  holidays?: readonly HolidayRange[];
}

export interface WorkingDaysResult {
  /** Every working date in the range, ascending, as `YYYY-MM-DD`. */
  days: string[];
  count: number;
  totalCalendarDays: number;
  /** Dates excluded because their weekday is non-working. */
  weekendDays: number;
  /**
   * Dates excluded because a holiday covers them *and* their weekday is
   * working. A holiday that falls on a non-working weekday is counted under
   * `weekendDays` instead, so it can never be excluded twice.
   */
  holidayWorkingDays: number;
  /**
   * Distinct holiday dates in the range, whatever weekday they fall on.
   *
   * Always `>= holidayWorkingDays`. The gap is the holidays that landed on a
   * weekly day off — precisely the days the old
   * `calendarDays - sundays - holidays` arithmetic removed twice. Having the
   * two figures side by side makes that class of error visible in the numbers
   * rather than silent.
   */
  holidayCalendarDays: number;
}

/**
 * Enumerates the working days in a range.
 *
 * `count === days.length` always holds, and
 * `count === totalCalendarDays - weekendDays - holidayWorkingDays` always holds —
 * the three buckets are disjoint by construction rather than by care.
 */
export function enumerateWorkingDays(input: WorkingDaysInput): WorkingDaysResult {
  const nonWorking = assertNonWorkingWeekdays(input.nonWorkingWeekdays);
  const nonWorkingSet = new Set<Weekday>(nonWorking);

  const start = utcDayIndex(input.startDate);
  const end = utcDayIndex(input.endDate);
  if (end < start) {
    throw new Error(
      `The range ends before it starts: ${isoDateFromDayIndex(start)} to ${isoDateFromDayIndex(end)}.`
    );
  }

  // A Set, so overlapping holidays collapse to one exclusion and a holiday that
  // lands on a non-working weekday is simply the same date as that weekday —
  // there is no second subtraction to make. Clamped to the range as it is built,
  // so a holiday a decade wide costs nothing.
  const holidayDates = new Set<number>();
  for (const holiday of input.holidays ?? []) {
    const from = utcDayIndex(holiday.startDate);
    const to = utcDayIndex(holiday.endDate);
    if (to < from) {
      throw new Error(
        `A holiday range ends before it starts: ${isoDateFromDayIndex(from)} to ${isoDateFromDayIndex(to)}.`
      );
    }
    for (let day = Math.max(from, start); day <= Math.min(to, end); day++) {
      holidayDates.add(day);
    }
  }

  const days: string[] = [];
  let weekendDays = 0;
  let holidayWorkingDays = 0;

  for (let day = start; day <= end; day++) {
    const weekday = new Date(day * MS_PER_DAY).getUTCDay() as Weekday;

    if (nonWorkingSet.has(weekday)) {
      weekendDays++;
      continue;
    }
    if (holidayDates.has(day)) {
      holidayWorkingDays++;
      continue;
    }

    days.push(isoDateFromDayIndex(day));
  }

  return {
    days,
    count: days.length,
    totalCalendarDays: end - start + 1,
    weekendDays,
    holidayWorkingDays,
    holidayCalendarDays: holidayDates.size,
  };
}

/** {@link enumerateWorkingDays} reduced to the figure most callers want. */
export function countWorkingDays(input: WorkingDaysInput): number {
  return enumerateWorkingDays(input).count;
}

/**
 * The working days of one calendar month, which is the shape the staff payroll
 * summary needs.
 *
 * `month` is 1–12, matching the rest of the payroll code. The month's bounds are
 * computed in UTC so they agree with the `@db.Date` holiday rows they are
 * compared against.
 */
export function enumerateWorkingDaysInMonth(input: {
  year: number;
  month: number;
  nonWorkingWeekdays: readonly Weekday[];
  holidays?: readonly HolidayRange[];
}): WorkingDaysResult {
  const { year, month } = input;
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error(`Not a valid year/month pair: ${JSON.stringify({ year, month })}.`);
  }

  return enumerateWorkingDays({
    startDate: new Date(Date.UTC(year, month - 1, 1)),
    endDate: new Date(Date.UTC(year, month, 0)),
    nonWorkingWeekdays: input.nonWorkingWeekdays,
    holidays: input.holidays,
  });
}
