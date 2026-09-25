import { describe, expect, it } from "vitest";
import { suggestDates, type RolloverWizardYear } from "./rollover-wizard";

/**
 * The wizard's date suggestion.
 *
 * A year boundary is where an off-by-one day does real damage: attendance
 * marked on the 31st of March against a year that ends on the 30th falls
 * outside every year-scoped query, and the register silently loses a day.
 *
 * The arithmetic is also the only part of the wizard worth testing in
 * isolation. Everything else it does — validating the form, deciding whether a
 * plan may be committed — is either a message the server also produces or a
 * single expression over the plan the panel already renders.
 */

function year(overrides: Partial<RolloverWizardYear> = {}): RolloverWizardYear {
  return {
    id: "ay-2025",
    yearId: "AY2025",
    label: "2025-2026",
    startDate: "2025-04-01T00:00:00.000Z",
    endDate: "2026-03-31T00:00:00.000Z",
    isClosed: true,
    ...overrides,
  };
}

describe("suggestDates", () => {
  it("starts the day after the source year ends", () => {
    expect(suggestDates(year()).startDate).toBe("2026-04-01");
  });

  it("ends the day before that date comes round again", () => {
    // 2026-04-01 → 2027-03-31, not 2027-04-01: a year that ends on the day it
    // starts contains 366 days and overlaps the next year by one.
    expect(suggestDates(year()).endDate).toBe("2027-03-31");
  });

  it("crosses a month boundary without skipping a day", () => {
    const result = suggestDates(year({ endDate: "2026-01-31T00:00:00.000Z" }));

    expect(result.startDate).toBe("2026-02-01");
    expect(result.endDate).toBe("2027-01-31");
  });

  it("handles a 29 February in the source year's end date", () => {
    const result = suggestDates(year({ endDate: "2028-02-29T00:00:00.000Z" }));

    expect(result.startDate).toBe("2028-03-01");
    // The following year has no 29 February, and a naive "+1 year" on the 1st
    // would land on 2029-03-01 — a year one day too long.
    expect(result.endDate).toBe("2029-02-28");
  });

  it("keeps the leap day when the target year has one", () => {
    // 2027-03-01 + 1 year - 1 day = 2028-02-29, which exists.
    const result = suggestDates(year({ endDate: "2027-02-28T00:00:00.000Z" }));

    expect(result.startDate).toBe("2027-03-01");
    expect(result.endDate).toBe("2028-02-29");
  });

  it("suggests nothing when there is no source, or no usable end date", () => {
    expect(suggestDates(undefined)).toEqual({ startDate: "", endDate: "" });
    expect(suggestDates(year({ endDate: "" }))).toEqual({ startDate: "", endDate: "" });
    expect(suggestDates(year({ endDate: "not a date" }))).toEqual({
      startDate: "",
      endDate: "",
    });
  });

  it("does not depend on the process time zone", () => {
    // The dates are calendar boundaries stored as UTC midnight. Building them
    // through local-time setters would shift them by a day west of Greenwich.
    const result = suggestDates(year());
    const parsed = new Date(`${result.startDate}T00:00:00.000Z`);

    expect(parsed.getUTCFullYear()).toBe(2026);
    expect(parsed.getUTCMonth()).toBe(3);
    expect(parsed.getUTCDate()).toBe(1);
  });
});
