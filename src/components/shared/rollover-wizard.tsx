"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CalendarPlus, Loader2, Play } from "lucide-react";
import { TopSheet } from "@/components/ui/top-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { TenantDateInput } from "@/components/ui/tenant-date-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ERPFormSection, ERPFormGrid, ERPFormField } from "@/components/ui/erp-form-layout";
import { RolloverPlanPanel } from "@/components/shared/rollover-plan-panel";
import { AppDropdown } from "@/components/ui/app-dropdown";
import { ApiError } from "@/lib/api-client";
import { FEE_BALANCE_POLICIES, type FeeBalancePolicy } from "@/lib/rollover-plan";
import {
  useExecuteRollover,
  useRolloverPreview,
  type RolloverRequest,
} from "@/hooks/use-rollover";

/**
 * The rollover wizard (roadmap item 16).
 *
 * ## The order of the two buttons is the design
 *
 * "Preview" then "Open the year", never one button. The preview runs the exact
 * plan the commit will run — the same endpoint, the same loader, the same
 * decision module — so what the operator reads is what will happen, not a
 * summary of it. The commit is disabled until a preview has come back clear, and
 * the server refuses with 409 if the plan went stale in between. A wizard that
 * offered one button would be asking an operator to authorise a write they have
 * not seen, on a screen that then copies money-shaped configuration forward.
 *
 * ## It does three things and no more
 *
 * It does not close the source year, promote anyone, or switch the operating
 * year. Each of those is a separate act with its own capability check. Rolling
 * three irreversible operations into one button is how a school closes a year it
 * has not finished.
 */

export interface RolloverWizardYear {
  id: string;
  yearId: string;
  label: string;
  startDate: string;
  endDate: string;
  isClosed: boolean;
}

interface RolloverWizardProps {
  isOpen: boolean;
  onClose: () => void;
  /** Every year the tenant has, newest or oldest — the caller decides the order. */
  years: RolloverWizardYear[];
  /** The wizard writes configuration; the caller has already checked the capability. */
  canExecute: boolean;
  onCompleted?: () => void;
}

const MS_PER_DAY = 86_400_000;

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * The dates the next year most likely runs on: it starts the day after the
 * source year ends and ends the day before that date comes round again.
 *
 * Offered as an editable default rather than written silently. The session code
 * and the label are deliberately **not** guessed — a school's naming convention
 * is not derivable from one year's code, and a plausible-looking wrong code is
 * harder to notice than a blank field.
 *
 * Exported because it is arithmetic, and arithmetic is worth testing: a year
 * boundary is exactly where an off-by-one day puts a student's attendance
 * outside the year it belongs to.
 */
export function suggestDates(source: RolloverWizardYear | undefined): {
  startDate: string;
  endDate: string;
} {
  if (!source?.endDate) return { startDate: "", endDate: "" };

  const sourceEnd = new Date(source.endDate);
  if (Number.isNaN(sourceEnd.getTime())) return { startDate: "", endDate: "" };

  const start = new Date(sourceEnd.getTime() + MS_PER_DAY);
  const finish = new Date(start.getTime());
  finish.setUTCFullYear(finish.getUTCFullYear() + 1);
  finish.setUTCDate(finish.getUTCDate() - 1);

  return { startDate: isoDay(start), endDate: isoDay(finish) };
}

export function RolloverWizard({
  isOpen,
  onClose,
  years,
  canExecute,
  onCompleted,
}: RolloverWizardProps) {
  const t = useTranslations("rollover");
  const tAcademicYear = useTranslations("academicYear");

  const [sourceId, setSourceId] = useState("");
  const [mode, setMode] = useState<"CREATE" | "EXISTING">("CREATE");
  const [targetYearId, setTargetYearId] = useState("");
  const [yearId, setYearId] = useState("");
  const [label, setLabel] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [copyRules, setCopyRules] = useState(true);
  const [copyFees, setCopyFees] = useState(true);
  // Off by default. A copied grid is a proposal to confirm, not an allocation
  // the school made, so the operator has to ask for it.
  const [copyTimetables, setCopyTimetables] = useState(false);

  /**
   * Stated, never defaulted. The three options decide what happens to money,
   * and an empty select that blocks the request is the honest control: it makes
   * the operator look at the choice instead of accepting one.
   */
  const [feeBalancePolicy, setFeeBalancePolicy] = useState<string>("");

  /**
   * The request the panel is describing — not the form's current state.
   *
   * Keeping these apart is the point: once a preview is on screen, editing the
   * form must not silently re-label that preview as describing the new values.
   * The operator re-previews, or commits what they actually saw.
   */
  const [submitted, setSubmitted] = useState<RolloverRequest | null>(null);

  const source = useMemo(() => years.find((year) => year.id === sourceId), [years, sourceId]);
  const preview = useRolloverPreview(submitted);
  const execute = useExecuteRollover();

  // A closed wizard reopens empty. Written as flat state resets rather than a
  // `resetForm` helper so the dependency list is the prop it actually watches.
  useEffect(() => {
    if (isOpen) return;
    setSourceId("");
    setMode("CREATE");
    setTargetYearId("");
    setYearId("");
    setLabel("");
    setStartDate("");
    setEndDate("");
    setCopyRules(true);
    setCopyFees(true);
    setSubmitted(null);
  }, [isOpen]);

  const handleSourceChange = (value: string) => {
    setSourceId(value);
    setTargetYearId("");
    setSubmitted(null);

    const next = suggestDates(years.find((year) => year.id === value));
    setStartDate(next.startDate);
    setEndDate(next.endDate);
  };

  /** Everything that can be checked before the server sees the request. */
  const buildRequest = (): RolloverRequest | null => {
    if (!sourceId) {
      toast.error(t("selectSourceYear"));
      return null;
    }

    if (mode === "EXISTING") {
      if (!targetYearId) {
        toast.error(t("selectTargetYear"));
        return null;
      }
      if (!feeBalancePolicy) {
        toast.error(t("feeBalancePlaceholder"));
        return null;
      }
      if (targetYearId === sourceId) {
        // The server refuses this too, but there is no reason to spend a round
        // trip telling the operator what the two selects already show. The
        // sentence comes from the shared vocabulary rather than a second copy.
        toast.error(t("codes.TARGET_IS_SOURCE" as never, { year: source?.label ?? "" } as never));
        return null;
      }
      return {
        sourceAcademicYearId: sourceId,
        mode: "EXISTING",
        academicYearId: targetYearId,
        copy: { promotionRules: copyRules, feeStructures: copyFees, timetables: copyTimetables },
        feeBalancePolicy: feeBalancePolicy as FeeBalancePolicy,
      };
    }

    if (!yearId.trim() || !label.trim() || !startDate || !endDate) {
      toast.error(t("fillTargetDetails"));
      return null;
    }

    if (!feeBalancePolicy) {
      toast.error(t("feeBalancePlaceholder"));
      return null;
    }

    return {
      sourceAcademicYearId: sourceId,
      mode: "CREATE",
      yearId: yearId.trim(),
      label: label.trim(),
      startDate,
      endDate,
      copy: { promotionRules: copyRules, feeStructures: copyFees, timetables: copyTimetables },
      feeBalancePolicy: feeBalancePolicy as FeeBalancePolicy,
    };
  };

  const handlePreview = () => {
    const request = buildRequest();
    if (request) setSubmitted(request);
  };

  const handleCommit = () => {
    if (!submitted) return;

    execute.mutate(submitted, {
      onSuccess: (response) => {
        const opened =
          response.plan.target.mode === "CREATE"
            ? t("successOpened", {
                targetLabel: response.plan.target.label,
                sourceLabel: response.plan.source.label,
              })
            : t("successRolledInto", {
                targetLabel: response.plan.target.label,
                sourceLabel: response.plan.source.label,
              });

        const parts: string[] = [];
        if (response.plan.writes.created > 0) {
          parts.push(t("createdDetail", { count: response.plan.writes.created }));
        }
        if (response.plan.writes.updated > 0) {
          parts.push(t("updatedDetail", { count: response.plan.writes.updated }));
        }

        toast.success(`${opened} ${parts.length > 0 ? parts.join(", ") : t("nothingCarried")}`);
        onCompleted?.();
        onClose();
      },
      onError: (error: unknown) => {
        // 409 means the plan was refused by the server after the preview said it
        // was clear — the configuration moved underneath it. Re-running the
        // preview is the useful response: it shows the current blockers in the
        // operator's language instead of the raw field details of a refusal.
        if (error instanceof ApiError && error.statusCode === 409) {
          preview.refetch();
        }
        toast.error(error instanceof Error ? error.message : t("blocked"));
      },
    });
  };

  const plan = preview.data ?? null;
  const canCommit = canExecute && Boolean(plan?.canProceed) && !execute.isPending;

  return (
    <TopSheet
      isOpen={isOpen}
      onClose={onClose}
      title={t("title")}
      description={t("description")}
      maxWidth="4xl"
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">{t("previewDescription")}</p>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={execute.isPending}>
              {t("cancel")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handlePreview}
              disabled={preview.isFetching || execute.isPending}
            >
              {preview.isFetching ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              {preview.isFetching ? t("previewing") : t("preview")}
            </Button>
            <Button type="button" onClick={handleCommit} disabled={!canCommit}>
              {execute.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CalendarPlus className="mr-2 h-4 w-4" />
              )}
              {execute.isPending ? t("applying") : t("apply")}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        <ERPFormSection title={t("sourceYearLabel")} description={t("sourceYearHint")}>
          <ERPFormGrid cols={1}>
            <ERPFormField label={t("sourceYearLabel")} required htmlFor="rollover-source">
              <Select value={sourceId} onValueChange={handleSourceChange}>
                <SelectTrigger id="rollover-source">
                  <SelectValue placeholder={t("sourceYearLabel")} />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year.id} value={year.id}>
                      {year.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </ERPFormField>
          </ERPFormGrid>
        </ERPFormSection>

        <ERPFormSection title={t("modeLabel")} description={t("targetYearHint")}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(["CREATE", "EXISTING"] as const).map((option) => {
              const selected = mode === option;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    setMode(option);
                    setSubmitted(null);
                  }}
                  aria-pressed={selected}
                  className={`rounded-lg border px-4 py-3 text-left transition-colors ${
                    selected
                      ? "border-primary/60 bg-primary/5"
                      : "border-border/70 hover:bg-muted/40"
                  }`}
                >
                  <span className="block text-sm font-medium text-foreground">
                    {option === "CREATE" ? t("modeCreate") : t("modeExisting")}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {option === "CREATE" ? t("modeCreateHint") : t("modeExistingHint")}
                  </span>
                </button>
              );
            })}
          </div>
        </ERPFormSection>

        {mode === "CREATE" ? (
          <ERPFormSection title={t("targetYearLabel")} description={t("targetYearHint")}>
            <ERPFormGrid cols={2}>
              <ERPFormField
                label={tAcademicYear("yearId")}
                required
                helperText={tAcademicYear("yearIdHelper")}
                htmlFor="rollover-year-id"
              >
                <Input
                  id="rollover-year-id"
                  value={yearId}
                  onChange={(event) => {
                    setYearId(event.target.value);
                    setSubmitted(null);
                  }}
                  placeholder={tAcademicYear("yearIdPlaceholder")}
                  className="font-mono"
                />
              </ERPFormField>

              <ERPFormField
                label={tAcademicYear("label")}
                required
                helperText={tAcademicYear("labelHelper")}
                htmlFor="rollover-year-label"
              >
                <Input
                  id="rollover-year-label"
                  value={label}
                  onChange={(event) => {
                    setLabel(event.target.value);
                    setSubmitted(null);
                  }}
                  placeholder={tAcademicYear("labelPlaceholder")}
                />
              </ERPFormField>

              <ERPFormField
                label={tAcademicYear("startDate")}
                required
                helperText={tAcademicYear("startDateHelper")}
              >
                <TenantDateInput
                  value={startDate}
                  onChange={(value) => {
                    setStartDate(value);
                    setSubmitted(null);
                  }}
                />
              </ERPFormField>

              <ERPFormField
                label={tAcademicYear("endDate")}
                required
                helperText={tAcademicYear("endDateHelper")}
              >
                <TenantDateInput
                  value={endDate}
                  onChange={(value) => {
                    setEndDate(value);
                    setSubmitted(null);
                  }}
                />
              </ERPFormField>
            </ERPFormGrid>
          </ERPFormSection>
        ) : (
          <ERPFormSection title={t("targetYearLabel")} description={t("targetYearHint")}>
            <ERPFormGrid cols={1}>
              <ERPFormField label={t("targetYearLabel")} required htmlFor="rollover-target">
                <Select
                  value={targetYearId}
                  onValueChange={(value) => {
                    setTargetYearId(value);
                    setSubmitted(null);
                  }}
                >
                  <SelectTrigger id="rollover-target">
                    <SelectValue placeholder={t("targetYearLabel")} />
                  </SelectTrigger>
                  <SelectContent>
                    {years
                      .filter((year) => year.id !== sourceId)
                      .map((year) => (
                        <SelectItem key={year.id} value={year.id}>
                          {year.label}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </ERPFormField>
            </ERPFormGrid>
          </ERPFormSection>
        )}

        <ERPFormSection title={t("copyTitle")} description={t("copyDescription")}>
          <div className="space-y-3">
            {[
              {
                id: "rollover-copy-rules",
                checked: copyRules,
                onChange: setCopyRules,
                label: t("copyPromotionRules"),
                hint: t("copyPromotionRulesHint"),
              },
              {
                id: "rollover-copy-fees",
                checked: copyFees,
                onChange: setCopyFees,
                label: t("copyFeeStructures"),
                hint: t("copyFeeStructuresHint"),
              },
              {
                id: "rollover-copy-timetable",
                checked: copyTimetables,
                onChange: setCopyTimetables,
                label: t("copyTimetables"),
                hint: t("copyTimetablesHint"),
              },
            ].map((option) => (
              <div
                key={option.id}
                className="flex items-start gap-3 rounded-lg border border-border/70 px-4 py-3"
              >
                <Switch
                  id={option.id}
                  checked={option.checked}
                  onCheckedChange={(checked) => {
                    option.onChange(checked);
                    setSubmitted(null);
                  }}
                  className="mt-0.5"
                />
                <Label htmlFor={option.id} className="cursor-pointer">
                  <span className="block text-sm font-medium text-foreground">{option.label}</span>
                  <span className="block text-xs text-muted-foreground">{option.hint}</span>
                </Label>
              </div>
            ))}

            {!copyRules && !copyFees && !copyTimetables && (
              <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                {t("nothingSelected")}
              </p>
            )}

            <ERPFormField
              label={t("feeBalanceLabel")}
              helperText={t("feeBalanceHint")}
            >
              <AppDropdown
                value={feeBalancePolicy}
                onChange={(value) => {
                  setFeeBalancePolicy(value);
                  setSubmitted(null);
                }}
                placeholder={t("feeBalancePlaceholder")}
                options={FEE_BALANCE_POLICIES.map((policy) => ({
                  value: policy,
                  label: t(`feeBalance.${policy}` as never),
                }))}
              />
            </ERPFormField>
          </div>
        </ERPFormSection>

        {!canExecute && (
          <p className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs font-medium text-amber-700 dark:text-amber-400">
            {t("forbidden")}
          </p>
        )}

        {/* Rendered once a preview exists, and only for the request it was built
            from. `isBlocked` is surfaced by the panel, not here. */}
        {(submitted || preview.isFetching) && (
          <RolloverPlanPanel
            plan={plan}
            isPreviewing={preview.isFetching}
            onRecheck={() => preview.refetch()}
            isPreview
          />
        )}
      </div>
    </TopSheet>
  );
}
