"use client";

import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ERPStatusPill } from "@/components/ui/erp-data-table";
import { Skeleton } from "@/components/ui/skeleton";
import type { PreflightFinding, PreflightReport } from "@/hooks/use-exams";
import { cn } from "@/lib/utils";

/**
 * The rollover pre-flight report.
 *
 * Shared by the promotion roster and the academic year close flow, because both
 * are reading the same kind of report and the two would otherwise drift the
 * first time a finding gained a field.
 *
 * Findings are translated from `code` + `params`; the server's English
 * `message` is only a fallback for a code that has no translation yet, so a new
 * check never renders as a blank line.
 */

interface RolloverPreflightPanelProps {
  report: PreflightReport | null | undefined;
  /** The report is being (re)fetched. */
  isChecking?: boolean;
  onRecheck?: () => void;
  /**
   * Which operation the report describes. The checks are the same; the framing
   * is not, and "blocked this run" is the wrong sentence on a year close.
   */
  scope?: "promotion" | "yearClose";
  /** Extra context, e.g. how many students were scanned. */
  contextNote?: string | null;
  /**
   * The report covers only part of the year.
   *
   * The loader bounds the student set and returns `scan.truncated` to say so,
   * but a bound that is only in the payload is not honesty — a partial report
   * that renders as a clean one is worse than no report, because the operator
   * closes the year on it.
   */
  scanTruncated?: boolean;
  className?: string;
}

function FindingRow({
  finding,
  tone,
  translate,
  translateFix,
}: {
  finding: PreflightFinding;
  tone: "blocker" | "warning";
  translate: (finding: PreflightFinding) => string;
  translateFix: (code: string) => string;
}) {
  return (
    <li className="flex gap-3 border-b border-border/50 py-3 last:border-b-0">
      <AlertTriangle
        className={cn(
          "mt-0.5 h-4 w-4 shrink-0",
          tone === "blocker"
            ? "text-rose-600 dark:text-rose-400"
            : "text-amber-600 dark:text-amber-400"
        )}
      />
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-medium text-foreground">{translate(finding)}</p>
        <p className="text-xs text-muted-foreground">{translateFix(finding.code)}</p>
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground/70">
          {finding.subject.label}
        </p>
      </div>
    </li>
  );
}

export function RolloverPreflightPanel({
  report,
  isChecking = false,
  onRecheck,
  scope = "promotion",
  contextNote,
  scanTruncated = false,
  className,
}: RolloverPreflightPanelProps) {
  const t = useTranslations("promotions.preflight");

  /**
   * A code the module can emit but the namespace has not translated.
   *
   * `t.has` rather than `try/catch`, and the difference is not cosmetic:
   * next-intl 4 does **not** throw on a missing message. It reports the problem
   * through `onError` and returns the key path as the string, so a `catch` here
   * never runs and an untranslated code renders `promotions.preflight.codes.X`
   * on screen — worse than the English fallback this was written to provide.
   * The fallback is still worth having, but it has to be reached by asking.
   */
  const translate = (finding: PreflightFinding) => {
    const key = `codes.${finding.code}`;
    return t.has(key as never) ? t(key as never, finding.params as never) : finding.message;
  };

  const translateFix = (code: string) => {
    const key = `fixes.${code}`;
    return t.has(key as never) ? t(key as never) : "";
  };

  const blocked = report ? !report.canProceed : false;

  return (
    <Card className={cn("border-border/80", className)}>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              {blocked ? (
                <ShieldAlert className="h-4 w-4 text-rose-600 dark:text-rose-400" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              )}
              {scope === "yearClose" ? t("yearCloseTitle") : t("title")}
            </CardTitle>
            <CardDescription>
              {scope === "yearClose" ? t("yearCloseDescription") : t("description")}
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            {report && (
              <>
                <ERPStatusPill
                  variant={blocked ? "rose" : "emerald"}
                  status={`${report.counts.blockers} ${t("blockersLabel")}`}
                />
                {report.counts.warnings > 0 && (
                  <ERPStatusPill
                    variant="amber"
                    status={`${report.counts.warnings} ${t("warningsLabel")}`}
                  />
                )}
              </>
            )}
            {onRecheck && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRecheck}
                disabled={isChecking}
              >
                {isChecking ? (
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-3.5 w-3.5" />
                )}
                {t("recheck")}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-0">
        {isChecking && !report ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : !report ? (
          <p className="text-sm text-muted-foreground">{contextNote ?? ""}</p>
        ) : (
          <>
            {contextNote && (
              <p className="text-xs text-muted-foreground">{contextNote}</p>
            )}

            {/* Read before the verdict, never after: a partial scan cannot
                support "all checks passed", and saying so would be the one
                thing this panel exists to prevent. */}
            {scanTruncated && (
              <p className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs font-medium text-amber-700 dark:text-amber-400">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {t("studentsTruncated")}
              </p>
            )}

            {report.canProceed && report.counts.warnings === 0 && !scanTruncated && (
              <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
                {t("passed")}
              </p>
            )}

            {blocked && (
              <div className="rounded-md border border-rose-500/30 bg-rose-500/5 px-3 py-2">
                <p className="text-sm font-medium text-rose-700 dark:text-rose-400">
                  {t("blocked")}
                </p>
                <p className="text-xs text-muted-foreground">{t("resolveFirst")}</p>
              </div>
            )}

            {report.blockers.length > 0 && (
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("blockersLabel")}
                </p>
                <ul className="rounded-md border border-border/60">
                  {report.blockers.map((finding, index) => (
                    <FindingRow
                      key={`${finding.code}-${finding.subject.id}-${index}`}
                      finding={finding}
                      tone="blocker"
                      translate={translate}
                      translateFix={translateFix}
                    />
                  ))}
                </ul>
              </div>
            )}

            {report.warnings.length > 0 && (
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("warningsLabel")}
                </p>
                <ul className="rounded-md border border-border/60">
                  {report.warnings.map((finding, index) => (
                    <FindingRow
                      key={`${finding.code}-${finding.subject.id}-${index}`}
                      finding={finding}
                      tone="warning"
                      translate={translate}
                      translateFix={translateFix}
                    />
                  ))}
                </ul>
              </div>
            )}

            {report.truncatedCodes.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {t("truncatedNote", {
                  count:
                    report.truncatedCodes.reduce(
                      (sum, code) => sum + (report.countsByCode[code] ?? 0),
                      0
                    ) || report.counts.blockers + report.counts.warnings,
                })}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
