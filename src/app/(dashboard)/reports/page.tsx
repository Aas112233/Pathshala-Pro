"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/components/providers/auth-provider";
import {
  REPORT_CATEGORY_LABEL_KEY,
  REPORT_CATEGORY_ORDER,
  accessibleReports,
  type ReportCategory,
  type ReportDefinition,
} from "@/lib/report-registry";
import { useTranslations } from "next-intl";
import { BarChart3, Search, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { reportIcon } from "@/components/reports/report-icons";

export default function ReportsOverviewPage() {
  const t = useTranslations("reports");
  const tHub = useTranslations("reports.hub");
  const { user, isLoading } = useAuth();
  const [query, setQuery] = useState("");

  // Cards are filtered with the same two gates the API enforces (module read +
  // role-list permission), so a card is only rendered when its endpoint will
  // actually serve it. Previously all seven rendered for every role and three
  // of them returned 403 after a full-page navigation.
  const available = useMemo(
    () => accessibleReports(user?.permissions, user?.role),
    [user?.permissions, user?.role]
  );

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = (report: ReportDefinition) =>
      !needle ||
      t(report.titleKey).toLowerCase().includes(needle) ||
      t(report.descriptionKey).toLowerCase().includes(needle);

    return REPORT_CATEGORY_ORDER.map((category: ReportCategory) => ({
      category,
      reports: available.filter((report) => report.category === category && matches(report)),
    })).filter((group) => group.reports.length > 0);
  }, [available, query, t]);

  const showNoAccess = !isLoading && available.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} icon={BarChart3} />

      {!showNoAccess && (
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={tHub("searchPlaceholder")}
            className="h-9 rounded-md pl-9 text-xs"
            aria-label={tHub("searchPlaceholder")}
          />
        </div>
      )}

      {showNoAccess && (
        <Card>
          <CardHeader className="items-center text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <CardTitle className="text-lg">{tHub("noAccess")}</CardTitle>
            <CardDescription className="mt-1">{tHub("noAccessHint")}</CardDescription>
          </CardHeader>
        </Card>
      )}

      {!showNoAccess && groups.length === 0 && (
        <Card>
          <CardHeader className="items-center text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Search className="h-6 w-6" />
            </div>
            <CardTitle className="text-lg">{tHub("emptySearch")}</CardTitle>
          </CardHeader>
        </Card>
      )}

      {groups.map((group) => (
        <section key={group.category} className="space-y-3">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            {tHub(REPORT_CATEGORY_LABEL_KEY[group.category])}
          </h2>
          <div className="grid gap-6 md:grid-cols-2">
            {group.reports.map((report) => {
              const Icon = reportIcon(report.id);
              return (
                <Link key={report.href} href={report.href}>
                  <Card>
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                          <Icon className="h-6 w-6" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{t(report.titleKey)}</CardTitle>
                          <CardDescription className="mt-1">
                            {t(report.descriptionKey)}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
