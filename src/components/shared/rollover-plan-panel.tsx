"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  MinusCircle,
  PlusCircle,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ERPStatusPill } from "@/components/ui/erp-data-table";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  RolloverFinding,
  RolloverPlan,
  RolloverSkipReason,
} from "@/lib/rollover-plan";
import { cn } from "@/lib/utils";

/**
 * The rollover plan, rendered (roadmap item 16).
 *
 * ## What this component is for
 *
 * The wizard's whole reason to exist is that a rollover which copies fee
 * structures into a year students never enter is worse than no wizard, because
 * it *looks* finished. So this panel's job is not to reassure — it is to make
 * the operator read four things before they press the button: what will be
 * created, what will be changed, what will be skipped, and what will not be
 * carried at all. The last one is the one no other screen in the product says.
 *
 * ## Findings are translated from `code`, never from `message`
 *
 * The module's `message` is an English fallback for logs and non-UI API
 * consumers, and the module says so. Rendering it here would mean an Urdu
 * operator reading an English blocker list on the one screen where reading it
 * matters. The `catch` is the same shape `RolloverPreflightPanel` uses, so a
 * code added without a translation degrades to the server's English rather than
 * to a blank line.
 *
 * ## A blocked plan is a result, not an error
 *
 * `canProceed: false` arrives with HTTP 200 from the preview, so it renders as a
 * verdict with reasons — not as a failure state. The commit button is disabled
 * while it holds; the 409 the commit path can still return is the backstop for a
 * plan that went stale between the preview and the press.
 */

/**
 * The parts of a diff row this panel renders.
 *
 * Narrower than `RolloverDiffRow` on purpose: the payload of a row is what the
 * server is about to write, and a UI that echoed it back would be a second
 * rendering of the promotion-rule form and the fee-structure form — two screens
 * that already exist and would then disagree with this one.
 */
interface PlanRow {
  classId: string;
  className: string;
  /** Names the slot for a table that holds more than one row per class. */
  rowLabel?: string;
  changedFields: string[];
  reason: { code: RolloverSkipReason; message: string } | null;
}

interface ConfigSection {
  requested: boolean;
  created: PlanRow[];
  updated: PlanRow[];
  skipped: PlanRow[];
  counts: { created: number; updated: number; skipped: number };
}

/**
 * Weekday number → `weekdays` message key. Indexed by number, so `[0]` is
 * Sunday, which is the numbering `working-days.ts` uses.
 */
const WEEKDAY_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

interface RolloverPlanPanelProps {
  plan: RolloverPlan | null | undefined;
  /** The plan is being (re)built. */
  isPreviewing?: boolean;
  onRecheck?: () => void;
  /** True when the plan came back from a dry run rather than a commit. */
  isPreview?: boolean;
  className?: string;
}

function FindingRow({
  finding,
  tone,
  translate,
  translateFix,
}: {
  finding: RolloverFinding;
  tone: "blocker" | "warning";
  translate: (finding: RolloverFinding) => string;
  translateFix: (code: string) => string;
}) {
  const fix = translateFix(finding.code);

  return (
    <li className="flex gap-3 border-b border-border/50 py-3 last:border-b-0">
      <AlertTriangle
        className={cn(
          "mt-0.5 h-4 w-4 shrink-0",
          tone === "blocker" ? "text-rose-600 dark:text-rose-400" : "text-amber-600 dark:text-amber-400"
        )}
      />
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-medium text-foreground">{translate(finding)}</p>
        {fix && <p className="text-xs text-muted-foreground">{fix}</p>}
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground/70">
          {finding.code}
        </p>
      </div>
    </li>
  );
}

function DiffBucket({
  label,
  rows,
  emptyLabel,
  tone,
  translateField,
  translateReason,
}: {
  label: string;
  rows: PlanRow[];
  emptyLabel: string;
  tone: "created" | "updated" | "skipped";
  translateField: (field: string) => string;
  translateReason: (code: RolloverSkipReason) => string;
}) {
  const Icon = tone === "created" ? PlusCircle : tone === "updated" ? RefreshCw : MinusCircle;
  const iconClass =
    tone === "created"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "updated"
        ? "text-indigo-600 dark:text-indigo-400"
        : "text-muted-foreground";

  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className={cn("h-3.5 w-3.5", iconClass)} />
        {label}
        <span className="font-mono text-foreground/70">{rows.length}</span>
      </p>

      {rows.length === 0 ? (
        <p className="pl-5 text-xs text-muted-foreground/70">{emptyLabel}</p>
      ) : (
        <ul className="space-y-1 pl-5">
          {rows.map((row) => (
            <li key={`${tone}-${row.classId}`} className="text-xs">
              <span className="font-medium text-foreground">{row.rowLabel ?? row.className}</span>
              {row.changedFields.length > 0 && (
                <span className="text-muted-foreground">
                  {" — "}
                  {row.changedFields.map(translateField).join(", ")}
                </span>
              )}
              {row.reason && (
                <span className="text-muted-foreground"> — {translateReason(row.reason.code)}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ConfigBlock({
  title,
  hint,
  section,
  translateField,
  translateReason,
  labels,
}: {
  title: string;
  hint: string;
  section: ConfigSection;
  translateField: (field: string) => string;
  translateReason: (code: RolloverSkipReason) => string;
  labels: {
    created: string;
    updated: string;
    skipped: string;
    notRequested: string;
    emptyCreated: string;
    emptyUpdated: string;
    emptySkipped: string;
  };
}) {
  if (!section.requested) {
    return (
      <div className="rounded-md border border-border/60 px-3 py-2.5">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{labels.notRequested}</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border/60 px-3 py-3">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-0.5">
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {section.counts.created > 0 && (
            <ERPStatusPill variant="emerald" status={`+${section.counts.created}`} />
          )}
          {section.counts.updated > 0 && (
            <ERPStatusPill variant="indigo" status={`~${section.counts.updated}`} />
          )}
          {section.counts.skipped > 0 && (
            <ERPStatusPill variant="subtle" status={`-${section.counts.skipped}`} />
          )}
        </div>
      </div>

      <div className="space-y-3">
        <DiffBucket
          label={labels.created}
          rows={section.created}
          emptyLabel={labels.emptyCreated}
          tone="created"
          translateField={translateField}
          translateReason={translateReason}
        />
        <DiffBucket
          label={labels.updated}
          rows={section.updated}
          emptyLabel={labels.emptyUpdated}
          tone="updated"
          translateField={translateField}
          translateReason={translateReason}
        />
        <DiffBucket
          label={labels.skipped}
          rows={section.skipped}
          emptyLabel={labels.emptySkipped}
          tone="skipped"
          translateField={translateField}
          translateReason={translateReason}
        />
      </div>
    </div>
  );
}

export function RolloverPlanPanel({
  plan,
  isPreviewing = false,
  onRecheck,
  isPreview = true,
  className,
}: RolloverPlanPanelProps) {
  const t = useTranslations("rollover");
  const tWeekday = useTranslations("weekdays");

  /**
   * A code the module can emit but the namespace has not translated yet.
   *
   * `t.has` rather than `try/catch`. next-intl 4 does **not** throw on a
   * missing message — it reports it through `onError` and returns the key path
   * as the string. So a `catch` here would never run, and an untranslated code
   * would render `rollover.codes.SOME_CODE` on screen: worse than the English
   * fallback it was written to provide, because it tells the operator nothing.
   * `RolloverPreflightPanel` has the same dead `catch`, and its comment claims
   * the opposite of what the library does.
   */
  const translate = (finding: RolloverFinding) => {
    const key = `codes.${finding.code}`;
    return t.has(key as never)
      ? t(key as never, finding.params as never)
      : finding.message;
  };

  const translateFix = (code: string) => {
    const key = `fixes.${code}`;
    return t.has(key as never) ? t(key as never) : "";
  };

  const translateField = (field: string) => {
    const key = `fields.${field}`;
    // A column added to a copyable table before its label exists still has to
    // render as something; the raw column name is ugly but honest.
    return t.has(key as never) ? t(key as never) : field;
  };

  const translateReason = (code: RolloverSkipReason) => {
    const key = `skipReasons.${code}`;
    return t.has(key as never) ? t(key as never) : code;
  };

  const blocked = plan ? !plan.canProceed : false;

  /**
   * The target year's weekly day off, named in the reader's language.
   *
   * The plan also carries `nonWorkingWeekdayNames`, but those are
   * `WEEKDAY_NAMES` from `working-days.ts` — English, and indexed by weekday
   * number. Translating from the numbers is the only way this line reads as
   * Urdu or Bengali, and it is why `weekdays` exists as a shared namespace
   * rather than being spelled out at each of the two surfaces that report a
   * week.
   */
  const nonWorkingDays = plan?.target.nonWorkingWeekdays ?? null;
  const weekdayNames = (nonWorkingDays ?? []).map((weekday) =>
    tWeekday(WEEKDAY_KEYS[weekday] as never)
  );
  const weekdayText = weekdayNames.length > 0 ? weekdayNames.join(", ") : null;

  return (
    <Card className={cn("border-border/80", className)}>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              {!plan ? (
                <Eye className="h-4 w-4 text-muted-foreground" />
              ) : blocked ? (
                <ShieldAlert className="h-4 w-4 text-rose-600 dark:text-rose-400" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              )}
              {t("previewTitle")}
            </CardTitle>
            <CardDescription>{t("previewDescription")}</CardDescription>
          </div>

          <div className="flex items-center gap-2">
            {plan && (
              <>
                <ERPStatusPill
                  variant={blocked ? "rose" : "emerald"}
                  status={`${plan.counts.blockers} ${t("blockersLabel")}`}
                />
                {plan.counts.warnings > 0 && (
                  <ERPStatusPill
                    variant="amber"
                    status={`${plan.counts.warnings} ${t("warningsLabel")}`}
                  />
                )}
              </>
            )}
            {onRecheck && (
              <Button variant="outline" size="sm" onClick={onRecheck} disabled={isPreviewing}>
                <RefreshCw
                  className={cn("mr-2 h-3.5 w-3.5", isPreviewing && "animate-spin")}
                />
                {t("recheck")}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-0">
        {isPreviewing && !plan ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : !plan ? null : (
          <>
            {isPreview && (
              <p className="flex items-start gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                <Eye className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {t("previewNotice")}
              </p>
            )}

            {blocked ? (
              <div className="rounded-md border border-rose-500/30 bg-rose-500/5 px-3 py-2">
                <p className="text-sm font-medium text-rose-700 dark:text-rose-400">
                  {t("blocked")}
                </p>
                <p className="text-xs text-muted-foreground">{t("resolveFirst")}</p>
              </div>
            ) : (
              <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
                {t("ready")}
              </p>
            )}

            {plan.blockers.length > 0 && (
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("blockersLabel")}
                </p>
                <ul className="rounded-md border border-border/60">
                  {plan.blockers.map((finding, index) => (
                    <FindingRow
                      key={`${finding.code}-${index}`}
                      finding={finding}
                      tone="blocker"
                      translate={translate}
                      translateFix={translateFix}
                    />
                  ))}
                </ul>
              </div>
            )}

            {plan.warnings.length > 0 && (
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("warningsLabel")}
                </p>
                <ul className="rounded-md border border-border/60">
                  {plan.warnings.map((finding, index) => (
                    <FindingRow
                      key={`${finding.code}-${index}`}
                      finding={finding}
                      tone="warning"
                      translate={translate}
                      translateFix={translateFix}
                    />
                  ))}
                </ul>
              </div>
            )}

            {/* The week the target year will run on. Reported because it is
                carried silently — a year that inherits a six-day week from a
                source that declared one is a change nobody asked for. */}
            <div className="rounded-md border border-border/60 px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t("workingDayPolicyLabel")}
              </p>
              <p className="mt-0.5 text-xs text-foreground">
                {plan.target.writesWorkingDayPolicy
                  ? weekdayText
                    ? t("workingDayPolicyCarried", { days: weekdayText })
                    : t("workingDayPolicyUndeclared")
                  : weekdayText
                    ? t("workingDayPolicyKept", { days: weekdayText })
                    : t("workingDayPolicyUndeclared")}
              </p>
            </div>

            {/* The balance figure is the whole reason the policy is a choice:
                rendering it here means "ZERO" is a decision about a number the
                operator has seen. */}
            <div className="rounded-md border border-border/60 px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t("feeBalanceLabel")}
              </p>
              <p className="mt-0.5 text-xs text-foreground">
                {t(`feeBalance.${plan.feeBalance.policy}` as never)}
                {plan.feeBalance.totalBalance > 0 &&
                  ` — ${t("feeBalanceOutstanding", {
                    count: plan.feeBalance.studentCount,
                    total: plan.feeBalance.totalBalance,
                  } as never)}`}
              </p>
            </div>

            <ConfigBlock
              title={t("copyPromotionRules")}
              hint={t("copyPromotionRulesHint")}
              section={plan.promotionRules as ConfigSection}
              translateField={translateField}
              translateReason={translateReason}
              labels={{
                created: t("createdLabel"),
                updated: t("updatedLabel"),
                skipped: t("skippedLabel"),
                notRequested: t("notRequested"),
                emptyCreated: t("emptyCreated"),
                emptyUpdated: t("emptyUpdated"),
                emptySkipped: t("emptySkipped"),
              }}
            />

            <ConfigBlock
              title={t("copyFeeStructures")}
              hint={t("copyFeeStructuresHint")}
              section={plan.feeStructures as ConfigSection}
              translateField={translateField}
              translateReason={translateReason}
              labels={{
                created: t("createdLabel"),
                updated: t("updatedLabel"),
                skipped: t("skippedLabel"),
                notRequested: t("notRequested"),
                emptyCreated: t("emptyCreated"),
                emptyUpdated: t("emptyUpdated"),
                emptySkipped: t("emptySkipped"),
              }}
            />

            <ConfigBlock
              title={t("copyTimetables")}
              hint={t("copyTimetablesHint")}
              section={plan.timetables as unknown as ConfigSection}
              translateField={translateField}
              translateReason={translateReason}
              labels={{
                created: t("createdLabel"),
                updated: t("updatedLabel"),
                skipped: t("skippedLabel"),
                notRequested: t("notRequested"),
                emptyCreated: t("emptyCreated"),
                emptyUpdated: t("emptyUpdated"),
                emptySkipped: t("emptySkipped"),
              }}
            />

            {/* The disclosure. `<details>` rather than a state variable so it
                works before hydration and cannot be hidden by a failed render. */}
            <details className="rounded-md border border-border/60 px-3 py-2.5">
              <summary className="cursor-pointer text-xs font-semibold text-foreground">
                {t("notCopiedTitle")}
              </summary>
              <p className="mt-1 text-xs text-muted-foreground">{t("notCopiedDescription")}</p>
              <ul className="mt-2 space-y-2">
                {plan.notCopied.map((entry) => (
                  <li key={entry.key} className="text-xs">
                    <p className="font-medium text-foreground">
                      {t(`notCopied.${entry.key}.title` as never)}
                    </p>
                    <p className="text-muted-foreground">
                      {t(`notCopied.${entry.key}.reason` as never)}
                    </p>
                  </li>
                ))}
              </ul>
            </details>
          </>
        )}
      </CardContent>
    </Card>
  );
}
