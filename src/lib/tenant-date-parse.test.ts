import { describe, it, expect } from "vitest";
import {
  parseDateWithSettings,
  formatDateWithSettings,
  formatDigitRunDate,
  DEFAULT_TENANT_SETTINGS,
} from "@/lib/tenant-settings";

const withFormat = (dateFormat: string) => ({ ...DEFAULT_TENANT_SETTINGS, dateFormat });

describe("parseDateWithSettings", () => {
  it("parses DD/MM/YYYY by default", () => {
    expect(parseDateWithSettings("25/08/2026")).toBe("2026-08-25");
    expect(parseDateWithSettings("")).toBe("");
    expect(parseDateWithSettings("  ")).toBe("");
  });

  it("parses each supported tenant format", () => {
    expect(parseDateWithSettings("08/25/2026", withFormat("MM/DD/YYYY"))).toBe("2026-08-25");
    expect(parseDateWithSettings("2026-08-25", withFormat("YYYY-MM-DD"))).toBe("2026-08-25");
    expect(parseDateWithSettings("25-08-2026", withFormat("DD-MM-YYYY"))).toBe("2026-08-25");
  });

  it("rejects impossible calendar dates", () => {
    expect(parseDateWithSettings("31/02/2026")).toBe("");
    expect(parseDateWithSettings("32/01/2026")).toBe("");
    expect(parseDateWithSettings("15/13/2026")).toBe("");
    expect(parseDateWithSettings("29/02/2025")).toBe("");
    expect(parseDateWithSettings("29/02/2024")).toBe("2024-02-29");
  });

  it("rejects wrong shapes and non-numeric parts", () => {
    expect(parseDateWithSettings("25/08/26")).toBe("");
    expect(parseDateWithSettings("2026/08/25")).toBe("");
    expect(parseDateWithSettings("ab/cd/efgh")).toBe("");
    expect(parseDateWithSettings("25-08-2026")).toBe(""); // dashes under slash format
  });

  it("round-trips through formatDateWithSettings", () => {
    for (const format of ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD", "DD-MM-YYYY"]) {
      const settings = withFormat(format);
      const display = formatDateWithSettings("2026-08-25", settings);
      expect(parseDateWithSettings(display, settings)).toBe("2026-08-25");
    }
  });
});

describe("formatDigitRunDate", () => {
  it("inserts separators per tenant format", () => {
    expect(formatDigitRunDate("31122026", "DD/MM/YYYY")).toBe("31/12/2026");
    expect(formatDigitRunDate("12312026", "MM/DD/YYYY")).toBe("12/31/2026");
    expect(formatDigitRunDate("20261231", "YYYY-MM-DD")).toBe("2026-12-31");
    expect(formatDigitRunDate("31122026", "DD-MM-YYYY")).toBe("31-12-2026");
    expect(formatDigitRunDate("31122026")).toBe("31/12/2026"); // default format
  });

  it("formatted runs validate through parseDateWithSettings", () => {
    for (const [run, format, iso] of [
      ["31122026", "DD/MM/YYYY", "2026-12-31"],
      ["12312026", "MM/DD/YYYY", "2026-12-31"],
      ["20261231", "YYYY-MM-DD", "2026-12-31"],
      ["29022024", "DD/MM/YYYY", "2024-02-29"],
    ] as const) {
      const settings = withFormat(format);
      expect(parseDateWithSettings(formatDigitRunDate(run, format), settings)).toBe(iso);
    }
  });

  it("rejects impossible runs and non-numeric formats", () => {
    // Impossible calendar dates format fine but never validate:
    for (const run of ["32132026", "31132026", "00000000"]) {
      expect(parseDateWithSettings(formatDigitRunDate(run, "DD/MM/YYYY"), withFormat("DD/MM/YYYY"))).toBe("");
    }
    // Wrong lengths and non-digits place nothing:
    expect(formatDigitRunDate("311226", "DD/MM/YYYY")).toBe("");
    expect(formatDigitRunDate("311220260", "DD/MM/YYYY")).toBe("");
    expect(formatDigitRunDate("31/12/2026", "DD/MM/YYYY")).toBe("");
    // Month-name formats cannot be reconstructed from digits:
    expect(formatDigitRunDate("31122026", "DD MMM YYYY")).toBe("");
    expect(formatDigitRunDate("31122026", "MMM DD, YYYY")).toBe("");
  });
});
