/**
 * Calendar recurrence expansion.
 *
 * Occurrences are derived, never stored: a recurring event stores its series
 * start and a recurrence rule (WEEKLY / MONTHLY) plus an optional inclusive
 * end date, and every range query expands occurrences on the fly. This keeps
 * edits atomic (one row) and avoids drift between stored and displayed dates.
 */

export type CalendarRecurrence = "NONE" | "WEEKLY" | "MONTHLY";

const DAY_MS = 86_400_000;

/** Hard cap so a malformed series (e.g. weekly for 50 years) cannot stall a request. */
export const MAX_OCCURRENCES = 500;

function startOfDayLocal(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Adds months preserving day-of-month and clock time, clamping to month length (Jan 31 → Feb 28). */
export function addMonthsClamped(base: Date, months: number): Date {
  const targetMonth = base.getMonth() + months;
  const daysInTargetMonth = new Date(base.getFullYear(), targetMonth + 1, 0).getDate();
  return new Date(
    base.getFullYear(),
    targetMonth,
    Math.min(base.getDate(), daysInTargetMonth),
    base.getHours(),
    base.getMinutes(),
    base.getSeconds(),
    base.getMilliseconds()
  );
}

export interface RecurrenceExpansionParams {
  recurrence: CalendarRecurrence;
  /** Series start; carries the clock time for timed events. */
  seriesStart: Date;
  /** Per-occurrence end (duration anchor); null means same-day all-day. */
  seriesEnd: Date | null;
  /** Inclusive last date a recurrence may start on; null = unlimited. */
  recurrenceEndDate: Date | null;
  /** Query window start (inclusive, local midnight). */
  windowStart: Date;
  /** Query window end (inclusive, end of day). */
  windowEnd: Date;
}

/**
 * Returns the START instants of every occurrence of the series that overlaps
 * [windowStart, windowEnd]. An occurrence overlaps when it has started by the
 * window end and has not fully ended before the window start (multi-day
 * occurrences straddling the window boundary are therefore included).
 */
export function getRecurrenceOccurrenceStarts(params: RecurrenceExpansionParams): Date[] {
  const { recurrence, seriesStart, seriesEnd, recurrenceEndDate, windowStart, windowEnd } = params;
  const durationMs = seriesEnd ? seriesEnd.getTime() - seriesStart.getTime() : 0;
  const occurrenceEndFor = (start: Date) => new Date(start.getTime() + durationMs);
  const lastAllowedStartMs = recurrenceEndDate
    ? Math.min(startOfDayLocal(recurrenceEndDate).getTime() + DAY_MS - 1, windowEnd.getTime())
    : windowEnd.getTime();

  if (recurrence === "NONE") {
    const singleEnd = occurrenceEndFor(seriesStart);
    return seriesStart.getTime() <= windowEnd.getTime() && singleEnd.getTime() >= windowStart.getTime()
      ? [seriesStart]
      : [];
  }

  if (seriesStart.getTime() > windowEnd.getTime()) {
    return [];
  }

  const occurrences: Date[] = [];

  if (recurrence === "WEEKLY") {
    // Jump the series forward to the first occurrence that could still overlap
    // the window (one step back from the alignment point to catch a straddler),
    // so a years-old series does not iterate from its origin.
    const weeksToWindow = Math.max(
      0,
      Math.floor((windowStart.getTime() - seriesStart.getTime()) / (7 * DAY_MS))
    );
    let cursor = new Date(seriesStart.getTime() + weeksToWindow * 7 * DAY_MS);
    if (cursor.getTime() > seriesStart.getTime()) {
      cursor = new Date(cursor.getTime() - 7 * DAY_MS);
    }
    if (cursor.getTime() < seriesStart.getTime()) {
      cursor = new Date(seriesStart);
    }

    let count = 0;
    while (cursor.getTime() <= lastAllowedStartMs && count < MAX_OCCURRENCES) {
      if (occurrenceEndFor(cursor).getTime() >= windowStart.getTime()) {
        occurrences.push(new Date(cursor));
      }
      cursor = new Date(cursor.getTime() + 7 * DAY_MS);
      count += 1;
    }
    return occurrences;
  }

  if (recurrence === "MONTHLY") {
    const monthsToWindow = Math.max(
      0,
      Math.floor(
        (windowStart.getFullYear() - seriesStart.getFullYear()) * 12 +
          (windowStart.getMonth() - seriesStart.getMonth()) - 1
      )
    );
    let offset = monthsToWindow;
    let count = 0;
    while (count < MAX_OCCURRENCES) {
      const occurrence = addMonthsClamped(seriesStart, offset);
      if (occurrence.getTime() > lastAllowedStartMs) break;
      if (occurrenceEndFor(occurrence).getTime() >= windowStart.getTime()) {
        occurrences.push(occurrence);
      }
      if (occurrence.getTime() > windowEnd.getTime()) break;
      offset += 1;
      count += 1;
    }
    return occurrences;
  }

  return [];
}
