import { describe, it, expect } from "vitest";
import {
  formatCurrencyValue,
  formatCompactCurrencyValue,
  getCurrencyInfo,
  SUPPORTED_CURRENCIES,
} from "@/lib/currencies";
import {
  generateAcademicYearLabel,
  formatAcademicYear,
  isCurrentAcademicYear,
  STANDARD_ACADEMIC_TERMS,
  STANDARD_SEMESTERS,
} from "@/lib/academic-periods";
import {
  formatDateWithSettings,
  formatTimeWithSettings,
  formatCurrencyWithSettings,
  formatCompactCurrencyWithSettings,
  formatDateTimeWithSettings,
  DEFAULT_TENANT_SETTINGS,
} from "@/lib/tenant-settings";

describe("Currencies Registry & Formatter", () => {
  it("supports major international and regional currencies", () => {
    expect(SUPPORTED_CURRENCIES.PKR).toBeDefined();
    expect(SUPPORTED_CURRENCIES.PKR.symbol).toBe("₨");
    expect(SUPPORTED_CURRENCIES.BDT).toBeDefined();
    expect(SUPPORTED_CURRENCIES.BDT.symbol).toBe("৳");
    expect(SUPPORTED_CURRENCIES.USD).toBeDefined();
    expect(SUPPORTED_CURRENCIES.USD.symbol).toBe("$");
    expect(SUPPORTED_CURRENCIES.INR).toBeDefined();
    expect(SUPPORTED_CURRENCIES.INR.symbol).toBe("₹");
    expect(SUPPORTED_CURRENCIES.AED).toBeDefined();
    expect(SUPPORTED_CURRENCIES.SAR).toBeDefined();
  });

  it("formats standard and compact currencies without hardcoding", () => {
    const formattedPkr = formatCurrencyValue(48500, { currencyCode: "PKR" });
    expect(formattedPkr).toContain("₨");
    expect(formattedPkr).toContain("48,500");

    const compactMillions = formatCompactCurrencyValue(4850000, { currencyCode: "PKR" });
    expect(compactMillions).toContain("₨");
    expect(compactMillions).toContain("4.85M");

    const compactThousands = formatCompactCurrencyValue(15000, { currencyCode: "USD" });
    expect(compactThousands).toContain("$");
    expect(compactThousands).toContain("15K");

    const aedInfo = getCurrencyInfo("AED");
    expect(aedInfo.symbol).toBe("د.إ");
  });
});

describe("Academic Periods & Educational Year Formatter", () => {
  it("dynamically generates academic year labels across year boundaries", () => {
    const label = generateAcademicYearLabel(
      new Date("2026-01-01"),
      new Date("2027-01-01")
    );
    expect(label).toBe("2026-2027");

    const singleYear = generateAcademicYearLabel(
      new Date("2026-01-01"),
      new Date("2026-12-31")
    );
    expect(singleYear).toBe("2026");

    expect(isCurrentAcademicYear("2020-01-01", "2030-12-31")).toBe(true);
  });

  it("formats academic year data into complete session labels", () => {
    const formatted = formatAcademicYear(
      { startDate: "2026-01-01", endDate: "2026-12-31" },
      "Session"
    );
    expect(formatted).toBe("Session: 2026");
  });

  it("exports standard academic terms and semesters", () => {
    expect(STANDARD_ACADEMIC_TERMS.length).toBeGreaterThanOrEqual(4);
    expect(STANDARD_SEMESTERS.length).toBeGreaterThanOrEqual(3);
  });
});

describe("Tenant Settings Date & Time Formatters", () => {
  const sampleDate = new Date("2026-12-31T14:30:00Z");

  it("formats dates according to tenant settings", () => {
    const dmy = formatDateWithSettings(sampleDate, {
      ...DEFAULT_TENANT_SETTINGS,
      dateFormat: "DD/MM/YYYY",
      timezone: "UTC",
    });
    expect(dmy).toBe("31/12/2026");

    const mdy = formatDateWithSettings(sampleDate, {
      ...DEFAULT_TENANT_SETTINGS,
      dateFormat: "MM/DD/YYYY",
      timezone: "UTC",
    });
    expect(mdy).toBe("12/31/2026");

    const ymd = formatDateWithSettings(sampleDate, {
      ...DEFAULT_TENANT_SETTINGS,
      dateFormat: "YYYY-MM-DD",
      timezone: "UTC",
    });
    expect(ymd).toBe("2026-12-31");
  });

  it("formats time in 12h and 24h formats", () => {
    const time24 = formatTimeWithSettings(sampleDate, {
      ...DEFAULT_TENANT_SETTINGS,
      timeFormat: "24h",
      timezone: "UTC",
    });
    expect(time24).toBe("14:30");

    const time12 = formatTimeWithSettings(sampleDate, {
      ...DEFAULT_TENANT_SETTINGS,
      timeFormat: "12h",
      timezone: "UTC",
    });
    expect(time12).toContain("2:30");
    expect(time12).toContain("PM");

    const dateTime = formatDateTimeWithSettings(sampleDate, {
      ...DEFAULT_TENANT_SETTINGS,
      dateFormat: "DD/MM/YYYY",
      timeFormat: "24h",
      timezone: "UTC",
    });
    expect(dateTime).toBe("31/12/2026 14:30");
  });

  it("formats currency using active tenant settings", () => {
    const pkrSettings = {
      ...DEFAULT_TENANT_SETTINGS,
      currency: "PKR",
      currencySymbol: "₨",
    };
    const formatted = formatCurrencyWithSettings(25000, pkrSettings);
    expect(formatted).toContain("₨");
    expect(formatted).toContain("25,000");

    const compact = formatCompactCurrencyWithSettings(2500000, pkrSettings);
    expect(compact).toContain("₨");
    expect(compact).toContain("2.5M");
  });
});
