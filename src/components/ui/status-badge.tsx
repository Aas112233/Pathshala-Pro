import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/**
 * Universal variant → color mapping.
 * Each variant maps to a Tailwind color-class set (bg + text + border).
 */
const variantClasses = {
  success:  "bg-[var(--status-success-bg)] text-[var(--status-success-text)] border-[var(--status-success-border)]",
  error:    "bg-[var(--status-error-bg)] text-[var(--status-error-text)] border-[var(--status-error-border)]",
  warning:  "bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] border-[var(--status-warning-border)]",
  info:     "bg-[var(--status-info-bg)] text-[var(--status-info-text)] border-[var(--status-info-border)]",
  neutral:  "bg-[var(--status-neutral-bg)] text-[var(--status-neutral-text)] border-[var(--status-neutral-border)]",
  emerald:  "bg-[var(--status-emerald-bg)] text-[var(--status-emerald-text)] border-[var(--status-emerald-border)]",
  amber:    "bg-[var(--status-amber-bg)] text-[var(--status-amber-text)] border-[var(--status-amber-border)]",
  orange:   "bg-[var(--status-orange-bg)] text-[var(--status-orange-text)] border-[var(--status-orange-border)]",
  purple:   "bg-[var(--status-purple-bg)] text-[var(--status-purple-text)] border-[var(--status-purple-border)]",
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

/** Exam result pass/fail/absent */
const examResultStatusMap: Record<string, StatusVariant> = {
  PASS:   "success",
  FAIL:   "error",
  ABSENT: "neutral",
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
