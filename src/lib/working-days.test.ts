// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  WEEKDAY_NAMES,
  assertNonWorkingWeekdays,
  countWorkingDays,
  enumerateWorkingDays,
  enumerateWorkingDaysInMonth,
  isoDateFromDayIndex,
  nonWorkingWeekdayNames,
  parseNonWorkingWeekdays,
  policyFromFirstDayOfWeek,
  readWorkingDayPolicy,
  utcWeekday,
  weekdayNumberFromName,
  type Weekday,
} from "./working-days";

/**
 * March 2026 is the fixture month throughout: it starts on a Sunday and has 31
 * days, so it contains 5 Sundays and 4 Saturdays. Every arithmetic expectation
 * below is checkable by hand against that.
 */
const MARCH = { startDate: "2026-03-01", endDate: "2026-03-31" };

/** Sunday off — a six-day week. */
const SUNDAY_OFF: Weekday[] = [0];
/** Saturday and Sunday off — a five-day week. */
const WEEKEND_OFF: Weekday[] = [0, 6];

function march(overrides: Partial<Parameters<typeof enumerateWorkingDays>[0]> = {}) {
  return enumerateWorkingDays({
    ...MARCH,
    nonWorkingWeekdays: SUNDAY_OFF,
    ...overrides,
  });
}

describe("weekday vocabulary", () => {
  it("indexes names by weekday number, Sunday first", () => {
    expect(WEEKDAY_NAMES[0]).toBe("sunday");
    expect(WEEKDAY_NAMES[6]).toBe("saturday");
  });

  it("maps a weekday name to its number, case- and space-insensitively", () => {
    expect(weekdayNumberFromName("sunday")).toBe(0);
    expect(weekdayNumberFromName("Saturday")).toBe(6);
    expect(weekdayNumberFromName("  monday ")).toBe(1);
  });

  it("returns null for anything that is not a weekday name", () => {
    expect(weekdayNumberFromName("funday")).toBeNull();
    expect(weekdayNumberFromName("")).toBeNull();
    expect(weekdayNumberFromName(null)).toBeNull();
    expect(weekdayNumberFromName(3)).toBeNull();
  });
});

describe("assertNonWorkingWeekdays", () => {
  it("deduplicates and sorts", () => {
    expect(assertNonWorkingWeekdays([6, 0, 6, 0])).toEqual([0, 6]);
  });

  it("accepts an empty list, which is a legitimate seven-day week", () => {
    expect(assertNonWorkingWeekdays([])).toEqual([]);
  });

  it("refuses a non-integer or out-of-range weekday", () => {
    expect(() => assertNonWorkingWeekdays([7])).toThrow(/Not a weekday number/);
    expect(() => assertNonWorkingWeekdays([-1])).toThrow(/Not a weekday number/);
    expect(() => assertNonWorkingWeekdays([1.5])).toThrow(/Not a weekday number/);
    expect(() => assertNonWorkingWeekdays(["sunday"])).toThrow(/Not a weekday number/);
    expect(() => assertNonWorkingWeekdays([null])).toThrow(/Not a weekday number/);
  });

  it("refuses a list that would leave no working days at all", () => {
    expect(() => assertNonWorkingWeekdays([0, 1, 2, 3, 4, 5, 6])).toThrow(
      /no working days at all/
    );
  });

  it("refuses a non-array", () => {
    expect(() => assertNonWorkingWeekdays(0 as unknown as unknown[])).toThrow(
      /requires an array/
    );
  });
});

describe("parseNonWorkingWeekdays", () => {
  it("refuses null and undefined rather than assuming a weekend", () => {
    expect(() => parseNonWorkingWeekdays(null)).toThrow(/must be stated explicitly/);
    expect(() => parseNonWorkingWeekdays(undefined)).toThrow(/must be stated explicitly/);
  });

  it("accepts a bare array, which is what the Json column holds", () => {
    expect(parseNonWorkingWeekdays([0])).toEqual([0]);
    expect(parseNonWorkingWeekdays([])).toEqual([]);
  });

  it("accepts an object carrying the list", () => {
    expect(parseNonWorkingWeekdays({ nonWorkingWeekdays: [0, 6] })).toEqual([0, 6]);
  });

  it("refuses an object without the list", () => {
    expect(() => parseNonWorkingWeekdays({ weekend: [0] })).toThrow(
      /must carry a nonWorkingWeekdays array/
    );
  });

  it("refuses a bare scalar", () => {
    expect(() => parseNonWorkingWeekdays(6)).toThrow(/must be an array of weekdays/);
  });
});

describe("readWorkingDayPolicy and the first-day-of-week suggestion", () => {
  it("reads a declared policy and reports an undeclared one as null", () => {
    expect(readWorkingDayPolicy([0])).toEqual({ nonWorkingWeekdays: [0] });
    expect(readWorkingDayPolicy(null)).toBeNull();
    expect(readWorkingDayPolicy(undefined)).toBeNull();
  });

  it("suggests a policy from the tenant's first day of the week", () => {
    expect(policyFromFirstDayOfWeek("sunday")).toEqual({ nonWorkingWeekdays: [0] });
    expect(policyFromFirstDayOfWeek("monday")).toEqual({ nonWorkingWeekdays: [1] });
    expect(policyFromFirstDayOfWeek("nonsense")).toBeNull();
  });

  it("names the non-working weekdays for a message or preview", () => {
    expect(nonWorkingWeekdayNames([0, 6])).toEqual(["sunday", "saturday"]);
    expect(nonWorkingWeekdayNames([])).toEqual([]);
  });
});

describe("UTC weekday reading", () => {
  it("reads the weekday in UTC, so a @db.Date value cannot shift", () => {
    // 2026-03-01 is a Sunday. A @db.Date row arrives as UTC midnight.
    expect(utcWeekday("2026-03-01")).toBe(0);
    expect(utcWeekday(new Date(Date.UTC(2026, 2, 1)))).toBe(0);
    expect(utcWeekday("2026-03-07")).toBe(6);
  });

  it("truncates to the UTC day rather than the local one", () => {
    expect(utcWeekday(new Date(Date.UTC(2026, 2, 1, 23, 59, 59, 999)))).toBe(0);
    expect(utcWeekday(new Date(Date.UTC(2026, 2, 2, 0, 0, 0, 0)))).toBe(1);
  });

  it("refuses an invalid date", () => {
    expect(() => utcWeekday("not a date")).toThrow(/Not a valid date/);
  });

  it("round-trips a day index through its ISO form", () => {
    expect(isoDateFromDayIndex(0)).toBe("1970-01-01");
    expect(utcWeekday(isoDateFromDayIndex(20_000))).toBe(
      new Date(20_000 * 86_400_000).getUTCDay()
    );
  });
});

describe("enumerateWorkingDays — the buckets are disjoint", () => {
  it("counts a six-day week with Sunday off", () => {
    const result = march();
    expect(result.totalCalendarDays).toBe(31);
    expect(result.weekendDays).toBe(5);
    expect(result.holidayWorkingDays).toBe(0);
    expect(result.count).toBe(26);
    expect(result.days).toHaveLength(26);
    expect(result.days[0]).toBe("2026-03-02");
    expect(result.days.at(-1)).toBe("2026-03-31");
  });

  it("counts a five-day week with Saturday and Sunday off", () => {
    const result = march({ nonWorkingWeekdays: WEEKEND_OFF });
    expect(result.weekendDays).toBe(9);
    expect(result.count).toBe(22);
    expect(result.days).not.toContain("2026-03-07");
    expect(result.days).not.toContain("2026-03-08");
  });

  it("excludes Saturdays when the policy says so — the hardcoded-Sunday regression", () => {
    // The arithmetic this module replaced counted Sundays only, so a school on a
    // Monday-Friday week was handed a denominator containing every Saturday.
    const fiveDay = march({ nonWorkingWeekdays: WEEKEND_OFF });
    const sixDay = march({ nonWorkingWeekdays: SUNDAY_OFF });

    expect(fiveDay.count).toBe(sixDay.count - 4);
    for (const saturday of ["2026-03-07", "2026-03-14", "2026-03-21", "2026-03-28"]) {
      expect(sixDay.days).toContain(saturday);
      expect(fiveDay.days).not.toContain(saturday);
    }
  });

  it("treats an empty policy as a seven-day week", () => {
    const result = march({ nonWorkingWeekdays: [] });
    expect(result.count).toBe(31);
    expect(result.weekendDays).toBe(0);
  });

  it("keeps count, days.length and the bucket identity in agreement", () => {
    const scenarios = [
      march(),
      march({ nonWorkingWeekdays: WEEKEND_OFF }),
      march({ nonWorkingWeekdays: [] }),
      march({ holidays: [{ startDate: "2026-03-07", endDate: "2026-03-09" }] }),
      march({
        nonWorkingWeekdays: WEEKEND_OFF,
        holidays: [{ startDate: "2026-02-26", endDate: "2026-03-03" }],
      }),
    ];

    for (const result of scenarios) {
      expect(result.count).toBe(result.days.length);
      expect(result.count).toBe(
        result.totalCalendarDays - result.weekendDays - result.holidayWorkingDays
      );
      expect(result.holidayCalendarDays).toBeGreaterThanOrEqual(result.holidayWorkingDays);
    }
  });
});

describe("enumerateWorkingDays — holidays", () => {
  it("counts a holiday that spans a non-working weekday exactly once", () => {
    // Saturday 7th, Sunday 8th, Monday 9th. Sunday is already excluded by the
    // policy, so only the Saturday and the Monday are holiday exclusions.
    //
    // The arithmetic this module replaced computed 31 - 5 sundays - 3 holiday
    // days = 23, removing the 8th twice. 24 is the correct figure, and the
    // difference is exactly that one day.
    const result = march({ holidays: [{ startDate: "2026-03-07", endDate: "2026-03-09" }] });

    expect(result.weekendDays).toBe(5);
    expect(result.holidayWorkingDays).toBe(2);
    expect(result.count).toBe(24);
    expect(result.count).not.toBe(23);
    expect(result.days).not.toContain("2026-03-07");
    expect(result.days).not.toContain("2026-03-08");
    expect(result.days).not.toContain("2026-03-09");

    // Three holiday dates, but only two reduced the count: the Sunday was
    // already excluded as a weekly day off. The old arithmetic subtracted all
    // three and lost a day. The gap between these two figures *is* that day.
    expect(result.holidayCalendarDays).toBe(3);
    expect(result.holidayCalendarDays - result.holidayWorkingDays).toBe(1);
  });

  it("collapses overlapping holiday ranges instead of counting them twice", () => {
    const result = march({
      holidays: [
        { startDate: "2026-03-02", endDate: "2026-03-04" },
        { startDate: "2026-03-04", endDate: "2026-03-06" },
      ],
    });

    // The union is 2nd-6th, five days, not 3 + 3.
    expect(result.holidayWorkingDays).toBe(5);
    expect(result.count).toBe(26 - 5);
  });

  it("clips a holiday that straddles the range boundary", () => {
    const result = march({ holidays: [{ startDate: "2026-02-26", endDate: "2026-03-03" }] });

    // In range: the 1st (a Sunday, already excluded), the 2nd and the 3rd.
    expect(result.weekendDays).toBe(5);
    expect(result.holidayWorkingDays).toBe(2);
    expect(result.count).toBe(24);
  });

  it("ignores a holiday entirely outside the range", () => {
    const result = march({ holidays: [{ startDate: "2026-04-01", endDate: "2026-04-03" }] });
    expect(result.holidayWorkingDays).toBe(0);
    expect(result.holidayCalendarDays).toBe(0);
    expect(result.count).toBe(26);
  });

  it("ignores a holiday that falls wholly on non-working weekdays", () => {
    const result = march({ holidays: [{ startDate: "2026-03-08", endDate: "2026-03-08" }] });
    expect(result.weekendDays).toBe(5);
    expect(result.holidayWorkingDays).toBe(0);
    expect(result.holidayCalendarDays).toBe(1);
    expect(result.count).toBe(26);
  });

  it("excludes a holiday that falls on a working weekday", () => {
    const result = march({ holidays: [{ startDate: "2026-03-02", endDate: "2026-03-02" }] });
    expect(result.holidayWorkingDays).toBe(1);
    expect(result.count).toBe(25);
    expect(result.days).not.toContain("2026-03-02");
  });

  it("accepts a Date as well as an ISO string", () => {
    const result = march({
      holidays: [{ startDate: new Date(Date.UTC(2026, 2, 2)), endDate: new Date(Date.UTC(2026, 2, 2)) }],
    });
    expect(result.holidayWorkingDays).toBe(1);
  });
});

describe("enumerateWorkingDays — refusals", () => {
  it("refuses a range that ends before it starts", () => {
    expect(() =>
      enumerateWorkingDays({
        startDate: "2026-03-31",
        endDate: "2026-03-01",
        nonWorkingWeekdays: SUNDAY_OFF,
      })
    ).toThrow(/ends before it starts/);
  });

  it("refuses a holiday range that ends before it starts", () => {
    expect(() =>
      march({ holidays: [{ startDate: "2026-03-09", endDate: "2026-03-07" }] })
    ).toThrow(/holiday range ends before it starts/);
  });

  it("refuses an undeclared policy rather than picking a weekend", () => {
    expect(() =>
      enumerateWorkingDays({
        ...MARCH,
        nonWorkingWeekdays: null as unknown as Weekday[],
      })
    ).toThrow(/requires an array/);
  });

  it("refuses a policy that leaves no working days", () => {
    expect(() => march({ nonWorkingWeekdays: [0, 1, 2, 3, 4, 5, 6] })).toThrow(
      /no working days at all/
    );
  });

  it("refuses an invalid date", () => {
    expect(() => march({ startDate: "2026-13-01" })).toThrow(/Not a valid date/);
  });
});

describe("countWorkingDays", () => {
  it("is the count alone", () => {
    expect(countWorkingDays({ ...MARCH, nonWorkingWeekdays: SUNDAY_OFF })).toBe(26);
  });
});

describe("enumerateWorkingDaysInMonth", () => {
  it("agrees with the equivalent explicit range", () => {
    const month = enumerateWorkingDaysInMonth({
      year: 2026,
      month: 3,
      nonWorkingWeekdays: SUNDAY_OFF,
    });
    const range = march();

    expect(month).toEqual(range);
    expect(month.count).toBe(26);
  });

  it("handles a month boundary and February in a non-leap year", () => {
    expect(
      enumerateWorkingDaysInMonth({
        year: 2026,
        month: 2,
        nonWorkingWeekdays: SUNDAY_OFF,
      }).totalCalendarDays
    ).toBe(28);

    expect(
      enumerateWorkingDaysInMonth({
        year: 2026,
        month: 12,
        nonWorkingWeekdays: SUNDAY_OFF,
      }).totalCalendarDays
    ).toBe(31);
  });

  it("reports zero for a month that is entirely holiday, without throwing", () => {
    // Legitimate: a long summer break. The caller decides what zero means; the
    // attendance rate already treats a zero denominator as untracked, not 0%.
    const result = enumerateWorkingDaysInMonth({
      year: 2026,
      month: 3,
      nonWorkingWeekdays: SUNDAY_OFF,
      holidays: [{ startDate: "2026-03-01", endDate: "2026-03-31" }],
    });

    expect(result.count).toBe(0);
    expect(result.days).toEqual([]);
  });

  it("refuses a month outside 1-12", () => {
    expect(() =>
      enumerateWorkingDaysInMonth({ year: 2026, month: 0, nonWorkingWeekdays: SUNDAY_OFF })
    ).toThrow(/Not a valid year\/month pair/);
    expect(() =>
      enumerateWorkingDaysInMonth({ year: 2026, month: 13, nonWorkingWeekdays: SUNDAY_OFF })
    ).toThrow(/Not a valid year\/month pair/);
  });
});
