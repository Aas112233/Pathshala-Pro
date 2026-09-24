"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { ShieldX } from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { PageHeader } from "@/components/shared/page-header";
import { ReportEmptyState } from "@/components/reports/report-empty-state";
import { reportIcon } from "@/components/reports/report-icons";
import { canAccessReport, findReportByHref } from "@/lib/report-registry";

/**
 * Route-level access guard for every report page.
 *
 * The hub and the sidebar both hide reports a role cannot open, but nothing
 * stopped a hand-typed or bookmarked URL from mounting the page: the user would
 * fill in filters, press Generate, and only then get an opaque 403 toast. This
 * layout answers the question before the page renders.
 *
 * It reuses `canAccessReport` from the registry, which mirrors both gates
 * `requireApiAccess` applies (module read + role-list permission), so the UI
 * verdict and the API verdict cannot drift.
 *
 * This is a UX affordance, not a security boundary — the API still enforces
 * both gates independently.
 */
export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const t = useTranslations("reports");
  const tCommon = useTranslations("reports.common");
  const { user, isLoading } = useAuth();

  const report = findReportByHref(pathname);

  // The hub ("/reports") and any non-report route in this segment fall through.
  if (!report) return <>{children}</>;

  // While the session resolves we cannot answer the question yet. Render the
  // page optimistically rather than flashing "denied" at a user who is allowed
  // in — the API remains the authority, so a wrong guess costs one 403.
  if (isLoading) return <>{children}</>;

  if (canAccessReport(report, user?.permissions, user?.role)) {
    return <>{children}</>;
  }

  const Icon = reportIcon(report.id);

  return (
    <div className="space-y-6">
      <PageHeader title={t(report.titleKey)} description={t(report.descriptionKey)} icon={Icon} />
      <ReportEmptyState
        variant="denied"
        icon={ShieldX}
        title={tCommon("reportUnavailableForRole")}
        description={tCommon("reportUnavailableForRoleHint")}
      />
    </div>
  );
}
