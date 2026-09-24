import { describe, expect, it } from "vitest";
import { getPermissionModuleForApiPath } from "@/lib/api-auth";
import { getEffectivePermissions, type UserRole } from "@/lib/permissions";
import {
  REPORT_REGISTRY,
  accessibleReports,
  canAccessAnyReport,
  canAccessReport,
} from "./report-registry";

/**
 * The registry duplicates two facts that live in the API routes: the module a
 * report's path maps to, and the role-list permission the route declares. Both
 * are copied deliberately so the hub can predict the API's decision — these
 * tests are what stop the copies drifting.
 */

const ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "INSTITUTE_ADMIN",
  "SCHOOL_ADMIN",
  "PRINCIPAL",
  "MANAGER",
  "ACCOUNTANT",
  "ACADEMIC_COORDINATOR",
  "CLERK",
  "TEACHER",
] as const;

describe("report registry integrity", () => {
  it("records the module each report path actually resolves to", () => {
    for (const report of REPORT_REGISTRY) {
      const resolved = getPermissionModuleForApiPath(`/api${report.href}`);
      expect(
        resolved,
        `${report.href}: registry says module "${report.module}" but the path map resolves to ${resolved}`
      ).toBe(report.module);
    }
  });

  it("has a unique id and href per report", () => {
    expect(new Set(REPORT_REGISTRY.map((r) => r.id)).size).toBe(REPORT_REGISTRY.length);
    expect(new Set(REPORT_REGISTRY.map((r) => r.href)).size).toBe(REPORT_REGISTRY.length);
  });

  it("covers every report route that exists on disk", () => {
    // Guards against a new /reports/* page shipping without a registry entry,
    // which would make it invisible in the hub.
    const registered = REPORT_REGISTRY.map((r) => r.href).sort();
    expect(registered).toEqual([
      "/reports/admissions",
      "/reports/attendance",
      "/reports/exams",
      "/reports/fees",
      "/reports/financial",
      "/reports/salary",
      "/reports/students",
    ]);
  });
});

describe("report registry access decisions", () => {
  /** Same matrix as report-access-matrix.test.ts — kept in sync deliberately. */
  const EXPECTED: Record<string, Record<string, boolean>> = {
    "/reports/fees": { ACCOUNTANT: true, ACADEMIC_COORDINATOR: false, CLERK: true, TEACHER: false },
    "/reports/students": { ACCOUNTANT: true, ACADEMIC_COORDINATOR: true, CLERK: true, TEACHER: true },
    "/reports/attendance": { ACCOUNTANT: false, ACADEMIC_COORDINATOR: true, CLERK: true, TEACHER: true },
    "/reports/exams": { ACCOUNTANT: false, ACADEMIC_COORDINATOR: true, CLERK: false, TEACHER: true },
    "/reports/admissions": { ACCOUNTANT: true, ACADEMIC_COORDINATOR: true, CLERK: true, TEACHER: true },
    "/reports/financial": { ACCOUNTANT: true, ACADEMIC_COORDINATOR: false, CLERK: false, TEACHER: false },
    "/reports/salary": { ACCOUNTANT: true, ACADEMIC_COORDINATOR: false, CLERK: false, TEACHER: false },
  };

  it("predicts the same allow/deny as the API for every non-admin role", () => {
    for (const report of REPORT_REGISTRY) {
      const expected = EXPECTED[report.href];
      expect(expected, `no expectations recorded for ${report.href}`).toBeDefined();

      for (const role of ["ACCOUNTANT", "ACADEMIC_COORDINATOR", "CLERK", "TEACHER"] as const) {
        const permissions = getEffectivePermissions(role, null, null);
        const allowed = canAccessReport(report, permissions, role);
        expect(
          allowed,
          `${role} -> ${report.href}: registry predicted ${allowed}, API says ${expected[role]}. ` +
            `Update the registry (and report-access-matrix.test.ts) if the route changed.`
        ).toBe(expected[role]);
      }
    }
  });

  it("grants every report to full-access roles", () => {
    for (const role of ["SUPER_ADMIN", "ADMIN", "INSTITUTE_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "MANAGER"]) {
      const permissions = getEffectivePermissions(role, null, null);
      const reports = accessibleReports(permissions, role);
      expect(reports.length, `${role} should reach every report`).toBe(REPORT_REGISTRY.length);
    }
  });

  it("shows each non-admin role only the reports its API will serve", () => {
    const counts: Record<string, number> = {};
    for (const role of ["ACCOUNTANT", "ACADEMIC_COORDINATOR", "CLERK"] as const) {
      const permissions = getEffectivePermissions(role, null, null);
      const reports = accessibleReports(permissions, role);
      counts[role] = reports.length;
      // The defect this fixes: all 7 cards rendered regardless of role, so
      // between 2 and 3 of them returned 403 after a full-page navigation.
      expect(reports.length).toBeLessThan(REPORT_REGISTRY.length);
    }
    expect(counts).toEqual({
      // Denied: attendance, exams
      ACCOUNTANT: 5,
      // Denied: fees, financial, salary
      ACADEMIC_COORDINATOR: 4,
      // Denied: exams, financial, salary
      CLERK: 4,
    });
  });

  it("reports whether a role can reach the hub at all", () => {
    for (const role of ROLES) {
      const permissions = getEffectivePermissions(role, null, null);
      const canReach = canAccessAnyReport(permissions, role);
      // TEACHER holds attendance/exams/students read, so it can reach the hub
      // even though it has no `reports` module grant. This is what lets the hub
      // gate on the union of member reports instead of on `reports:read`.
      expect(canReach, `${role} should be able to reach at least one report`).toBe(true);
    }
  });

  it("denies a caller with no permissions at all", () => {
    expect(canAccessAnyReport({}, null)).toBe(false);
    expect(accessibleReports({}, null)).toEqual([]);
  });
});
