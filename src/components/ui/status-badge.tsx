import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/**
 * Universal variant → color mapping.
 * Each variant maps to a Tailwind color-class set (bg + text + border).
 */
const variantClasses = {
  success:  "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800",
  error:    "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
  warning:  "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800",
  info:     "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
  neutral:  "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800/50 dark:text-gray-300 dark:border-gray-700",
  emerald:  "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800",
  amber:    "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800",
  orange:   "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800",
  purple:   "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800",
} as const;

export type StatusVariant = keyof typeof variantClasses;

// ─── Pre-built status → variant maps for common domain statuses ─────────────

/** Active / Inactive (users, staff, sections, groups) */
const activeStatusMap: Record<string, StatusVariant> = {
  true:  "success",
  false: "neutral",
};

/** Fee payment status */
const feeStatusMap: Record<string, StatusVariant> = {
  PAID:     "success",
  PARTIAL:  "warning",
  PENDING:  "warning",
  OVERDUE:  "error",
  DUE:      "neutral",
};

/** Salary payment status */
const salaryStatusMap: Record<string, StatusVariant> = {
  PAID:     "success",
  PARTIAL:  "warning",
  PENDING:  "neutral",
};

/** Academic year status (isClosed) */
const academicYearStatusMap: Record<string, StatusVariant> = {
  true:  "error",   // closed
  false: "success", // active
};

/** Student profile status */
const studentStatusMap: Record<string, StatusVariant> = {
  ACTIVE:      "success",
  INACTIVE:    "neutral",
  GRADUATED:   "info",
  TRANSFERRED: "warning",
};

/** Exam result pass/fail */
const examResultStatusMap: Record<string, StatusVariant> = {
  PASS: "success",
  FAIL: "error",
};

/** Attendance report status */
const attendanceStatusMap: Record<string, StatusVariant> = {
  GOOD:    "success",
  AVERAGE: "warning",
  DEFICIT: "error",
};

/** Tenant status */
const tenantStatusMap: Record<string, StatusVariant> = {
  ACTIVE:    "emerald",
  SUSPENDED: "error",
  TRIAL:     "info",
};

/** Subject type (compulsory / elective) */
const subjectTypeMap: Record<string, StatusVariant> = {
  COMPULSORY: "info",
  ELECTIVE:   "amber",
};

/** All pre-built status maps keyed by domain name */
export const statusMaps = {
  active:       activeStatusMap,
  fee:          feeStatusMap,
  salary:       salaryStatusMap,
  academicYear: academicYearStatusMap,
  student:      studentStatusMap,
  examResult:   examResultStatusMap,
  attendance:   attendanceStatusMap,
  tenant:       tenantStatusMap,
  subjectType:  subjectTypeMap,
} as const;

export type StatusDomain = keyof typeof statusMaps;

// ─── Component ──────────────────────────────────────────────────────────────

interface StatusBadgeProps {
  /** The string key to look up in the domain map, or a boolean for active/inactive */
  status: string | boolean;
  /** Optional label to display — if omitted, the status string itself is displayed */
  label?: ReactNode;
  /** Use a pre-built domain map */
  domain?: StatusDomain;
  /** Or pass a direct variant (overrides domain lookup) */
  variant?: StatusVariant;
  /** Optional leading icon */
  icon?: ReactNode;
  /** Additional classes */
  className?: string;
}

export function StatusBadge({
  status,
  label,
  domain,
  variant,
  icon,
  className,
}: StatusBadgeProps) {
  // Resolve variant: explicit > domain lookup > neutral fallback
  let resolvedVariant: StatusVariant = variant || "neutral";

  if (!variant && domain) {
    const map = statusMaps[domain];
    const key = String(status);
    resolvedVariant = map[key] || "neutral";
  }

  const displayLabel =
    label ??
    (typeof status === "boolean"
      ? status
        ? "Active"
        : "Inactive"
      : status);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        variantClasses[resolvedVariant],
        className,
      )}
    >
      {icon}
      {displayLabel}
    </span>
  );
}
