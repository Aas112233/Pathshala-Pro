import { describe, it, expect } from "vitest";
import {
  parseDateWithSettings,
  formatDateWithSettings,
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
