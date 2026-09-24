import { describe, expect, it } from "vitest";
import {
  hasDateBounds,
  isWithinDateRange,
  normalizeDateRange,
  parseRangeEnd,
  parseRangeStart,
} from "./date-range-filter";

describe("parseRangeStart", () => {
  it("anchors a calendar date to UTC midnight", () => {
    expect(parseRangeStart("2026-09-24")?.toISOString()).toBe("2026-09-24T00:00:00.000Z");
  });

  it("discards any time component so the bound is the start of the day", () => {
    expect(parseRangeStart("2026-09-24T15:30:00Z")?.toISOString()).toBe("2026-09-24T00:00:00.000Z");
  });

  it("returns null for empty, missing or invalid input", () => {
    expect(parseRangeStart("")).toBeNull();
    expect(parseRangeStart(null)).toBeNull();
    expect(parseRangeStart(undefined)).toBeNull();
    expect(parseRangeStart("not-a-date")).toBeNull();
    expect(parseRangeStart("2026-02-30")).toBeNull();
  });
});

describe("parseRangeEnd", () => {
  it("anchors to the last millisecond of the calendar day", () => {
    expect(parseRangeEnd("2026-09-24")?.toISOString()).toBe("2026-09-24T23:59:59.999Z");
  });

  it("returns null for invalid input rather than an Invalid Date", () => {
    expect(parseRangeEnd("garbage")).toBeNull();
    expect(parseRangeEnd("")).toBeNull();
  });

  it("does not roll over into the next day", () => {
    const end = parseRangeEnd("2026-12-31")!;
    expect(end.getUTCFullYear()).toBe(2026);
    expect(end.getUTCMonth()).toBe(11);
    expect(end.getUTCDate()).toBe(31);
  });
});

describe("normalizeDateRange", () => {
  it("produces an inclusive range covering the whole end date", () => {
    const range = normalizeDateRange("2026-09-01", "2026-09-30");
    expect(range.gte?.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(range.lte?.toISOString()).toBe("2026-09-30T23:59:59.999Z");
  });

  it("omits absent bounds instead of emitting null", () => {
    expect(normalizeDateRange(null, null)).toEqual({});
    expect(normalizeDateRange("2026-09-01", null)).toEqual({
      gte: new Date("2026-09-01T00:00:00.000Z"),
    });
    expect(normalizeDateRange(null, "2026-09-30")).toEqual({
      lte: new Date("2026-09-30T23:59:59.999Z"),
    });
  });

  it("regression: the previous behaviour dropped the final day", () => {
    // `new Date("2026-09-30")` is the bug — midnight, so 30 Sep was excluded.
    const buggyEnd = new Date("2026-09-30");
    const fixedEnd = normalizeDateRange("2026-09-01", "2026-09-30").lte!;
    expect(fixedEnd.getTime()).toBeGreaterThan(buggyEnd.getTime());

    const aPaymentOnTheFinalDay = new Date("2026-09-30T14:00:00.000Z");
    expect(aPaymentOnTheFinalDay <= buggyEnd).toBe(false);
    expect(aPaymentOnTheFinalDay <= fixedEnd).toBe(true);
  });

  it("handles a single-day range", () => {
    const range = normalizeDateRange("2026-09-24", "2026-09-24");
    const midday = new Date("2026-09-24T12:00:00.000Z");
    expect(midday >= range.gte!).toBe(true);
    expect(midday <= range.lte!).toBe(true);
  });
});

describe("hasDateBounds", () => {
  it("reports whether a filter should be applied at all", () => {
    expect(hasDateBounds({})).toBe(false);
    expect(hasDateBounds({ gte: new Date() })).toBe(true);
    expect(hasDateBounds({ lte: new Date() })).toBe(true);
  });
});

describe("isWithinDateRange", () => {
  it("includes events on the end date — the whole point of the helper", () => {
    expect(isWithinDateRange("2026-09-30T09:00:00.000Z", "2026-09-01", "2026-09-30")).toBe(true);
    expect(isWithinDateRange("2026-09-30T23:59:59.999Z", "2026-09-01", "2026-09-30")).toBe(true);
  });

  it("excludes events outside the range", () => {
    expect(isWithinDateRange("2026-09-30T23:59:59.999Z", "2026-09-01", "2026-09-29")).toBe(false);
    expect(isWithinDateRange("2026-08-31T23:59:00.000Z", "2026-09-01", "2026-09-30")).toBe(false);
  });

  it("treats absent bounds as open-ended", () => {
    expect(isWithinDateRange("2020-01-01T00:00:00.000Z", null, null)).toBe(true);
    expect(isWithinDateRange("2026-09-30T09:00:00.000Z", "2026-09-01", null)).toBe(true);
    expect(isWithinDateRange("2026-08-01T09:00:00.000Z", null, "2026-09-30")).toBe(true);
  });

  it("accepts Date and string input alike, and rejects null/invalid", () => {
    const d = new Date("2026-09-15T10:00:00.000Z");
    expect(isWithinDateRange(d, "2026-09-01", "2026-09-30")).toBe(true);
    expect(isWithinDateRange(d.toISOString(), "2026-09-01", "2026-09-30")).toBe(true);
    expect(isWithinDateRange(null, "2026-09-01", "2026-09-30")).toBe(false);
    expect(isWithinDateRange("not-a-date", "2026-09-01", "2026-09-30")).toBe(false);
  });

  it("agrees with the Prisma range it mirrors", () => {
    const range = normalizeDateRange("2026-09-01", "2026-09-30");
    const probe = new Date("2026-09-30T18:45:00.000Z");
    const viaPrisma = probe >= range.gte! && probe <= range.lte!;
    expect(viaPrisma).toBe(isWithinDateRange(probe, "2026-09-01", "2026-09-30"));
  });
});
