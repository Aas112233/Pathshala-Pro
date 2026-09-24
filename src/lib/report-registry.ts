import {
  hasPermission,
  hasRolePermission,
  type Permission,
} from "./permissions";

/**
 * Report registry — the single source of truth for the reports hub.
 *
 * WHY `module` AND `permission` ARE BOTH RECORDED
 * `requireApiAccess` enforces two independent gates and only one of them is
 * visible at the call site:
 *
 *   1. module gate     — derived from the URL by getPermissionModuleForApiPath()
 *   2. role-list gate  — the route's `permission:` option
 *
 * The hub used to be gated on `reports:read` while each API route used its own
 * module, so every non-admin role saw seven cards and three of them returned
 * 403 after a full-page navigation. Recording both gates here — copied from the
 * routes themselves, and pinned by report-access-matrix.test.ts — lets the hub
 * render exactly the cards the API will serve.
 *
 * If a route's `permission` option changes, change it here too; the matrix test
 * will fail otherwise.
 */

export type ReportCategory = "finance" | "academics" | "operations";

export interface ReportDefinition {
  id: string;
  href: string;
  /** i18n key under the `reports` namespace. */
  titleKey: string;
  descriptionKey: string;
  category: ReportCategory;
  /** Module the API enforces for this path (getPermissionModuleForApiPath). */
  module: string;
  /** Role-list permission the route declares, when it declares one. */
  permission?: Permission;
}

export const REPORT_REGISTRY: ReportDefinition[] = [
  {
    id: "fees",
    href: "/reports/fees",
    titleKey: "feeReport.title",
    descriptionKey: "feeReport.description",
    category: "finance",
    module: "fees",
    permission: "fees:read",
  },
  {
    id: "salary",
    href: "/reports/salary",
    titleKey: "salaryReport.title",
    descriptionKey: "salaryReport.description",
    category: "finance",
    module: "salary",
    permission: "payroll:read",
  },
  {
    id: "financial",
    href: "/reports/financial",
    titleKey: "financialReport.title",
    descriptionKey: "financialReport.description",
    category: "finance",
    module: "fees",
    permission: "accounting:read",
  },
  {
    id: "admissions",
    href: "/reports/admissions",
    titleKey: "admissionsReport.title",
    descriptionKey: "admissionsReport.description",
    category: "academics",
    module: "students",
    permission: "students:read",
  },
  {
    id: "attendance",
    href: "/reports/attendance",
    titleKey: "attendanceReport.title",
    descriptionKey: "attendanceReport.description",
    category: "academics",
    module: "attendance",
    permission: "attendance:read",
  },
  {
    id: "students",
    href: "/reports/students",
    titleKey: "studentReport.title",
    descriptionKey: "studentReport.description",
    category: "academics",
    module: "students",
    permission: "students:read",
  },
  {
    id: "exams",
    href: "/reports/exams",
    titleKey: "examReport.title",
    descriptionKey: "examReport.description",
    category: "academics",
    module: "exams",
    permission: "exams:read",
  },
];

export const REPORT_CATEGORY_ORDER: ReportCategory[] = [
  "finance",
  "academics",
  "operations",
];

/** i18n keys under `reports.hub.categories`. */
export const REPORT_CATEGORY_LABEL_KEY: Record<ReportCategory, string> = {
  finance: "finance",
  academics: "academics",
  operations: "operations",
};

/**
 * Mirrors `requireApiAccess`'s decision for a GET on the report's endpoint.
 *
 * Note: tenant module licensing is deliberately NOT consulted, because the API
 * does not apply it here either — `getModuleKeyForApiPath("/api/reports/…")`
 * falls through to `default: return null`, so reports are gated by RBAC alone.
 * Filtering on module access in the UI would hide cards the API happily serves.
 */
export function canAccessReport(
  report: ReportDefinition,
  effectivePermissions: unknown,
  role: string | null | undefined,
): boolean {
  if (!hasPermission(effectivePermissions, report.module, "read")) return false;
  if (report.permission && !hasRolePermission(role ?? "", report.permission)) return false;
  return true;
}

/** True when the caller can open at least one report. */
export function canAccessAnyReport(
  effectivePermissions: unknown,
  role: string | null | undefined,
): boolean {
  return REPORT_REGISTRY.some((report) =>
    canAccessReport(report, effectivePermissions, role)
  );
}

/** The reports a given caller may open, in registry order. */
export function accessibleReports(
  effectivePermissions: unknown,
  role: string | null | undefined,
): ReportDefinition[] {
  return REPORT_REGISTRY.filter((report) =>
    canAccessReport(report, effectivePermissions, role)
  );
}

/**
 * Resolve a report by its route href (e.g. "/reports/salary").
 *
 * Used by the per-page access guard so a hand-typed URL to a report the caller
 * cannot open explains itself, instead of letting the page mount and then fail
 * with an opaque 403 toast after the user has filled in the filters.
 */
export function findReportByHref(href: string): ReportDefinition | undefined {
  return REPORT_REGISTRY.find((report) => report.href === href);
}
