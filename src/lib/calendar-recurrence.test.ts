// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  addMonthsClamped,
  getRecurrenceOccurrenceStarts,
  MAX_OCCURRENCES,
} from "./calendar-recurrence";

function atLocal(y: number, m: number, d: number, hh = 0, mm = 0): Date {
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

function endOfDay(y: number, m: number, d: number): Date {
  return new Date(y, m - 1, d, 23, 59, 59, 999);
}

describe("addMonthsClamped", () => {
  it("clamps Jan 31 to Feb 28 in non-leap years and preserves clock time", () => {
    const base = atLocal(2026, 1, 31, 9, 30);
    const feb = addMonthsClamped(base, 1);
    expect(feb.getMonth()).toBe(1);
    expect(feb.getDate()).toBe(28);
    expect(feb.getHours()).toBe(9);
    expect(feb.getMinutes()).toBe(30);
  });

  it("clamps to Feb 29 in leap years", () => {
    const base = atLocal(2028, 1, 31);
    const feb = addMonthsClamped(base, 1);
    expect(feb.getDate()).toBe(29);
  });

  it("keeps the original day when the target month is long enough", () => {
    const base = atLocal(2026, 1, 15);
    const mar = addMonthsClamped(base, 2);
    expect(mar.getDate()).toBe(15);
  });
});

describe("getRecurrenceOccurrenceStarts", () => {
  it("returns the single start for NONE when it overlaps the window", () => {
    const starts = getRecurrenceOccurrenceStarts({
      recurrence: "NONE",
      seriesStart: atLocal(2026, 3, 10, 10, 0),
      seriesEnd: atLocal(2026, 3, 10, 12, 0),
      recurrenceEndDate: null,
      windowStart: atLocal(2026, 3, 1),
      windowEnd: endOfDay(2026, 3, 31),
    });
    expect(starts).toHaveLength(1);
    expect(starts[0].getDate()).toBe(10);
  });

  it("returns empty for NONE when the event falls outside the window", () => {
    const starts = getRecurrenceOccurrenceStarts({
      recurrence: "NONE",
      seriesStart: atLocal(2026, 4, 2),
      seriesEnd: null,
      recurrenceEndDate: null,
      windowStart: atLocal(2026, 3, 1),
      windowEnd: endOfDay(2026, 3, 31),
    });
    expect(starts).toHaveLength(0);
  });

  it("includes a NONE multi-day occurrence that straddles the window start", () => {
    const starts = getRecurrenceOccurrenceStarts({
      recurrence: "NONE",
      seriesStart: atLocal(2026, 2, 26),
      seriesEnd: atLocal(2026, 3, 2),
      recurrenceEndDate: null,
      windowStart: atLocal(2026, 3, 1),
      windowEnd: endOfDay(2026, 3, 31),
    });
    expect(starts).toHaveLength(1);
  });

  it("expands WEEKLY occurrences inside the window only", () => {
    const starts = getRecurrenceOccurrenceStarts({
      recurrence: "WEEKLY",
      seriesStart: atLocal(2026, 3, 2, 8, 0), // a Monday
      seriesEnd: atLocal(2026, 3, 2, 9, 0),
      recurrenceEndDate: null,
      windowStart: atLocal(2026, 4, 1),
      windowEnd: endOfDay(2026, 4, 30),
    });
    const days = starts.map((d) => d.getDate());
    expect(days).toEqual([6, 13, 20, 27]);
    starts.forEach((d) => {
      expect(d.getDay()).toBe(1);
      expect(d.getHours()).toBe(8);
    });
  });

  it("jumps forward efficiently for a series that started years before the window", () => {
    const starts = getRecurrenceOccurrenceStarts({
      recurrence: "WEEKLY",
      seriesStart: atLocal(2019, 1, 7),
      seriesEnd: null,
      recurrenceEndDate: null,
      windowStart: atLocal(2026, 9, 1),
      windowEnd: endOfDay(2026, 9, 30),
    });
    expect(starts).toHaveLength(4);
    starts.forEach((d) => expect(d.getDay()).toBe(1));
  });

  it("stops at the recurrence end date (inclusive)", () => {
    const starts = getRecurrenceOccurrenceStarts({
      recurrence: "WEEKLY",
      seriesStart: atLocal(2026, 3, 2),
      seriesEnd: null,
      recurrenceEndDate: atLocal(2026, 3, 16),
      windowStart: atLocal(2026, 3, 1),
      windowEnd: endOfDay(2026, 3, 31),
    });
    expect(starts.map((d) => d.getDate())).toEqual([2, 9, 16]);
  });

  it("expands MONTHLY occurrences with day clamping at month ends", () => {
    const starts = getRecurrenceOccurrenceStarts({
      recurrence: "MONTHLY",
      seriesStart: atLocal(2026, 1, 31),
      seriesEnd: null,
      recurrenceEndDate: null,
      windowStart: atLocal(2026, 2, 1),
      windowEnd: endOfDay(2026, 4, 30),
    });
    expect(starts.map((d) => `${d.getMonth() + 1}-${d.getDate()}`)).toEqual([
      "2-28",
      "3-31",
      "4-30",
    ]);
  });

  it("respects the occurrence cap for unbounded series against a huge window", () => {
    const starts = getRecurrenceOccurrenceStarts({
      recurrence: "WEEKLY",
      seriesStart: atLocal(2000, 1, 3),
      seriesEnd: null,
      recurrenceEndDate: null,
      windowStart: atLocal(2000, 1, 1),
      windowEnd: endOfDay(2200, 12, 31),
    });
    expect(starts).toHaveLength(MAX_OCCURRENCES);
  });
});
