import { isValidDateInput } from "./date-validation";

/**
 * Calendar-day range normalisation for Prisma date filters.
 *
 * THE BUG THIS EXISTS TO PREVENT
 * `new Date("2026-09-24")` parses as `2026-09-24T00:00:00.000Z` — midnight at
 * the *start* of the day. Using that value for a `lte` bound silently excludes
 * everything recorded during the selected end date, so a "1-30 September"
 * report omits all of 30 September. It looks like ordinary variance, which is
 * why it survives testing and surfaces as a parent querying a missing payment.
 *
 * `normalizeDateRange()` makes the end bound inclusive by construction, so no
 * caller has to remember the `T23:59:59.999Z` suffix. Before this helper the
 * pattern was hand-rolled in at least four places (report fees route,
 * accounting statements, accounting daybook, analytics-service) and omitted
 * entirely in five others.
 *
 * Timezone contract: report filters receive `YYYY-MM-DD` from TenantDateInput.
 * Bounds are anchored to UTC so the same query returns the same rows regardless
 * of the server's local timezone.
 */

export interface NormalizedDateRange {
  gte?: Date;
  lte?: Date;
}

/** First millisecond of the calendar day, in UTC. Null for empty/invalid input. */
export function parseRangeStart(value: string | null | undefined): Date | null {
  if (!value || !isValidDateInput(value)) return null;
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
}

/**
 * Last millisecond of the calendar day, in UTC — the inclusive end bound.
 * Null for empty/invalid input, so callers can tell "no upper bound" apart from
 * "Invalid Date" (which would otherwise silently match nothing, or everything,
 * depending on the driver).
 */
export function parseRangeEnd(value: string | null | undefined): Date | null {
  if (!value || !isValidDateInput(value)) return null;
  return new Date(`${value.slice(0, 10)}T23:59:59.999Z`);
}

/**
 * Build a Prisma-ready `{ gte, lte }` range. Omits bounds that were not
 * supplied, so an open-ended range stays open-ended rather than becoming
 * `lte: null` (which Prisma reads as an equality test against NULL).
 */
export function normalizeDateRange(
  from: string | null | undefined,
  to: string | null | undefined,
): NormalizedDateRange {
  const range: NormalizedDateRange = {};
  const gte = parseRangeStart(from);
  const lte = parseRangeEnd(to);
  if (gte) range.gte = gte;
  if (lte) range.lte = lte;
  return range;
}

/** True when at least one bound is set, i.e. the filter should be applied. */
export function hasDateBounds(range: NormalizedDateRange): boolean {
  return range.gte !== undefined || range.lte !== undefined;
}

/**
 * In-memory equivalent, for aggregate counters that re-test rows already
 * fetched (e.g. the students report's "new admissions" metric). Uses the same
 * inclusive end bound as the Prisma path so the two can never disagree.
 */
export function isWithinDateRange(
  value: Date | string | null | undefined,
  from: string | null | undefined,
  to: string | null | undefined,
): boolean {
  if (!value) return false;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  const gte = parseRangeStart(from);
  const lte = parseRangeEnd(to);
  if (gte && date.getTime() < gte.getTime()) return false;
  if (lte && date.getTime() > lte.getTime()) return false;
  return true;
}
