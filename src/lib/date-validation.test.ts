import { describe, expect, it } from "vitest";
import { birthDateSchema, dateInputSchema, isDateRangeValid, isValidBirthDate, isValidDateInput, optionalDateInputSchema, todayDateString } from "./date-validation";

describe("date validation", () => {
  it.each(["2024-02-29", "2000-02-29", "2026-04-30", "2026-09-17T12:30:00.000Z", "2026-09-17T12:30:00+06:00"])("accepts valid date %s", (value) => {
    expect(isValidDateInput(value)).toBe(true);
  });
  it.each(["", " ", "not-a-date", "2025-02-29", "1900-02-29", "2026-02-30", "2026-04-31", "2026-00-10", "2026-13-01", "2026-01-00", "0000-01-01", "2026-1-1", "09/17/2026", "2026-09-17T24:00:00Z", "2026-09-17T12:60:00Z", "2026-09-17T12:30:60Z", "2026-09-17T12:00:00", "2026-02-30T12:00:00Z", "2026-09-17T12:00:00+24:00"])("rejects invalid date %s", (value) => {
    expect(isValidDateInput(value)).toBe(false);
  });
  it("keeps historical and future dates valid", () => {
    expect(dateInputSchema().safeParse("1901-01-01").success).toBe(true);
    expect(dateInputSchema().safeParse("2099-12-31").success).toBe(true);
  });
  it("preserves optional empty values without accepting malformed dates", () => {
    for (const value of [undefined, ""]) {
      expect(optionalDateInputSchema.safeParse(value).success).toBe(true);
      expect(birthDateSchema.safeParse(value).success).toBe(true);
    }
    expect(optionalDateInputSchema.safeParse("invalid").success).toBe(false);
    expect(dateInputSchema().safeParse("").success).toBe(false);
  });
  it("allows today and historical DOB but not tomorrow or impossible dates", () => {
    expect(isValidBirthDate("2026-09-16", "2026-09-17")).toBe(true);
    expect(isValidBirthDate("2026-09-17", "2026-09-17")).toBe(true);
    expect(isValidBirthDate("2026-09-18", "2026-09-17")).toBe(false);
    expect(isValidBirthDate("2026-02-30", "2026-09-17")).toBe(false);
  });
  it("formats today using local calendar components", () => {
    expect(todayDateString(new Date(2026, 0, 2, 0, 1))).toBe("2026-01-02");
    expect(todayDateString(new Date(2026, 11, 31, 23, 59))).toBe("2026-12-31");
  });
  it("checks ranges and respects timestamp offsets", () => {
    expect(isDateRangeValid("2026-09-17", "2026-09-17")).toBe(true);
    expect(isDateRangeValid("2026-09-17", "2026-09-17", false)).toBe(false);
    expect(isDateRangeValid("2026-09-18", "2026-09-17")).toBe(false);
    expect(isDateRangeValid("bad", "2026-09-17")).toBe(false);
    expect(isDateRangeValid("2026-09-17T12:00:00+06:00", "2026-09-17T07:00:00Z")).toBe(true);
  });
});
