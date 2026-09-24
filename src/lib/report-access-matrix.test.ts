import { describe, expect, it } from "vitest";
import { getPermissionModuleForApiPath } from "@/lib/api-auth";
import {
  getEffectivePermissions,
  hasPermission,
  hasRolePermission,
  type UserRole,
} from "@/lib/permissions";

/**
 * Report API access matrix — characterization test.
 *
 * WHY THIS EXISTS
 * `requireApiAccess` enforces TWO independent gates that read from different
 * sources, and only one of them is visible at the call site:
 *
 *   1. Module gate  — inferred from the URL via getPermissionModuleForApiPath()
 *                     then checked with hasPermission(effective, module, action).
 *   2. Role-list gate — the `permission:` option, checked against the role's flat
 *                     ROLE_PERMISSIONS list with hasRolePermission().
 *
 * Reading a route file therefore reveals only gate 2. An audit that stopped at
 * the file reads concluded `/api/reports/students` was unguarded; it is not —
 * gate 1 covers it via the path map. This test pins the real behaviour so that
 * conclusion can never be re-derived incorrectly, and so an edit to the path
 * map fails loudly instead of silently widening or closing access.
 *
 * If a row below changes, change it deliberately and update
 * docs/REPORT-MODULES-ANALYSIS.md §3.4 at the same time.
 */

/** Every report route, the module its path maps to, and its declared permission. */
const REPORT_ROUTES = [
  { route: "/api/reports/fees", module: "fees", declared: "fees:read" },
  { route: "/api/reports/students", module: "students", declared: null },
  { route: "/api/reports/attendance", module: "attendance", declared: "attendance:read" },
  { route: "/api/reports/exams", module: "exams", declared: "exams:read" },
  { route: "/api/reports/admissions", module: "students", declared: "students:read" },
  { route: "/api/reports/financial", module: "fees", declared: "accounting:read" },
  { route: "/api/reports/salary", module: "salary", declared: "payroll:read" },
] as const;

/**
 * Locked-in access decisions per role, as measured against the current
 * permission model. "allow" means both gates pass for a GET.
 */
const EXPECTED_ACCESS: Record<string, Record<string, "allow" | "deny">> = {
  "/api/reports/fees": { ACCOUNTANT: "allow", ACADEMIC_COORDINATOR: "deny", CLERK: "allow", TEACHER: "deny" },
  "/api/reports/students": { ACCOUNTANT: "allow", ACADEMIC_COORDINATOR: "allow", CLERK: "allow", TEACHER: "allow" },
  "/api/reports/attendance": { ACCOUNTANT: "deny", ACADEMIC_COORDINATOR: "allow", CLERK: "allow", TEACHER: "allow" },
  "/api/reports/exams": { ACCOUNTANT: "deny", ACADEMIC_COORDINATOR: "allow", CLERK: "deny", TEACHER: "allow" },
  "/api/reports/admissions": { ACCOUNTANT: "allow", ACADEMIC_COORDINATOR: "allow", CLERK: "allow", TEACHER: "allow" },
  "/api/reports/financial": { ACCOUNTANT: "allow", ACADEMIC_COORDINATOR: "deny", CLERK: "deny", TEACHER: "deny" },
  "/api/reports/salary": { ACCOUNTANT: "allow", ACADEMIC_COORDINATOR: "deny", CLERK: "deny", TEACHER: "deny" },
};

const NON_ADMIN_ROLES = [
  "ACCOUNTANT",
  "ACADEMIC_COORDINATOR",
  "CLERK",
  "TEACHER",
] as const;

function evaluate(role: string, route: string, moduleName: string | null, declared: string | null) {
  const effective = getEffectivePermissions(role, null, null);
  const moduleGate = moduleName ? hasPermission(effective, moduleName, "read") : false;
  const roleGate = declared ? hasRolePermission(role as UserRole, declared as never) : true;
  return moduleGate && roleGate;
}

describe("Report API access matrix", () => {
  it("maps every report route to a module so no route can fall through to the fail-closed default", () => {
    for (const { route, module: expected } of REPORT_ROUTES) {
      const resolved = getPermissionModuleForApiPath(route);
      expect(resolved, `${route} resolved to null — the path map has no branch for it`).not.toBeNull();
      expect(resolved).toBe(expected);
    }
  });

  it("enforces the documented allow/deny decision for every role and report", () => {
    for (const { route, module: moduleName, declared } of REPORT_ROUTES) {
      const expectations = EXPECTED_ACCESS[route];
      expect(expectations, `no expectations recorded for ${route}`).toBeDefined();

      for (const role of NON_ADMIN_ROLES) {
        const allowed = evaluate(role, route, moduleName, declared);
        const expected = expectations[role];
        expect(
          allowed ? "allow" : "deny",
          `${role} -> ${route}: expected ${expected}. ` +
            `If this change is intentional, update EXPECTED_ACCESS and docs/REPORT-MODULES-ANALYSIS.md §3.4.`
        ).toBe(expected);
      }
    }
  });

  it("keeps the students report guarded — it has no declared permission, so its only gate is the path map", () => {
    const studentsRoute = REPORT_ROUTES.find((r) => r.route === "/api/reports/students")!;
    expect(studentsRoute.declared).toBeNull();

    // The path map is therefore load-bearing. Prove it actually discriminates:
    // a role with no `students` module read must be denied.
    const effective = getEffectivePermissions("ACCOUNTANT", null, null);
    expect(hasPermission(effective, studentsRoute.module, "read")).toBe(true);

    const stripped = getEffectivePermissions("ACCOUNTANT", { notices: { read: true } }, null);
    expect(
      hasPermission(stripped, studentsRoute.module, "read"),
      "students report must deny a role lacking the students module grant"
    ).toBe(false);
  });

  it("documents that nav visibility and API access disagree for TEACHER", () => {
    const effective = getEffectivePermissions("TEACHER", null, null);

    // TEACHER has no `reports` module, so the hub + sidebar entry are hidden.
    expect(hasPermission(effective, "reports", "read")).toBe(false);

    // Yet four report APIs would allow the same request. This asymmetry is
    // recorded in docs/REPORT-MODULES-ANALYSIS.md §3.4 as a consistency defect,
    // and is the reason hub cards must be filtered from the same source the API
    // enforces rather than from nav state.
    const reachable = REPORT_ROUTES.filter(({ module: m, declared }) =>
      evaluate("TEACHER", "", m, declared)
    ).map((r) => r.route);
    expect(reachable).toEqual([
      "/api/reports/students",
      "/api/reports/attendance",
      "/api/reports/exams",
      "/api/reports/admissions",
    ]);
  });
});
