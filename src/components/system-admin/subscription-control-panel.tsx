"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Save, ShieldCheck, CalendarClock, Hourglass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppDropdown, type DropdownOption } from "@/components/ui/app-dropdown";
import { ERPFormField, ERPFormGrid } from "@/components/ui/erp-form-layout";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  SubscriptionHistoryTimeline,
  type SubscriptionChangeHistoryItem,
} from "./subscription-history-timeline";

interface PlanOption {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  monthlyPrice: number | string;
  maxStudents: number;
  maxStaff: number;
  maxStorageMb: number;
  maxSmsPerMonth: number;
  features: Record<string, any>;
}

interface SubscriptionView {
  tenantId: string;
  planCode: string;
  planName: string;
  status: string;
  billingCycle: string;
  subscriptionEndAt: string | null;
  gracePeriodDays: number;
  graceEndsAt: string | null;
  expiredAt: string | null;
  daysRemaining: number | null;
  isBlocked: boolean;
  isInGrace: boolean;
}

interface LifecyclePayload {
  view: SubscriptionView;
  history: SubscriptionChangeHistoryItem[];
  plans: PlanOption[];
}

function toLocalInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Superadmin Subscription Control panel. Owns its data fetch (view + history +
 * plan catalog) and all lifecycle mutations, routed through the subscription
 * engine so TenantSubscription stays the single source of truth.
 */
export function SubscriptionControlPanel({ tenantId }: { tenantId: string }) {
  const t = useTranslations("saasAdmin.tenantDetail");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<LifecyclePayload | null>(null);

  const [plan, setPlan] = useState("");
  const [endDate, setEndDate] = useState("");
  const [graceDays, setGraceDays] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/system-admin/subscriptions/${tenantId}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || t("loadFailed"));
      }
      const payload = json.data as LifecyclePayload;
      setData(payload);
      setPlan(payload.view?.planCode ?? "");
      setEndDate(toLocalInputValue(payload.view?.subscriptionEndAt));
      setGraceDays(payload.view?.gracePeriodDays != null ? String(payload.view.gracePeriodDays) : "0");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [tenantId, t]);

  useEffect(() => {
    load();
  }, [load]);

  const planOptions = useMemo<DropdownOption[]>(
    () =>
      (data?.plans ?? []).map((p) => ({
        value: p.code,
        label: `${p.name} (${p.code})`,
      })),
    [data]
  );

  const selectedPlan = useMemo(
    () => (data?.plans ?? []).find((p) => p.code === plan),
    [data, plan]
  );

  const handleSave = async () => {
    if (!data?.view?.tenantId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/system-admin/subscriptions/${data.view.tenantId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: plan || undefined,
          subscriptionEndAt: endDate ? new Date(endDate).toISOString() : undefined,
          gracePeriodDays: graceDays !== "" ? Number(graceDays) : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || t("saveFailed"));
      }
      toast.success(t("saveSuccess"));
      // The POST response only carries { view, history } — reload the full
      // lifecycle payload (including the plan catalog) so the plan dropdown,
      // feature summary, and form fields stay in sync with the saved state.
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const view = data?.view;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border/60 bg-background p-4 space-y-4">
        <ERPFormGrid cols={2}>
          <ERPFormField label={t("planPickerLabel")} helperText={t("planPickerHelper")}>
            <AppDropdown
              value={plan}
              onChange={setPlan}
              options={planOptions}
              placeholder={t("planPickerPlaceholder")}
              searchable
              disabled={loading}
            />
          </ERPFormField>

          <ERPFormField label={t("endDateLabel")} helperText={t("endDateHelper")}>
            <Input
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              disabled={loading}
            />
          </ERPFormField>

          <ERPFormField label={t("graceDaysLabel")} helperText={t("graceDaysHelper")}>
            <Input
              type="number"
              min={0}
              max={3650}
              value={graceDays}
              onChange={(e) => setGraceDays(e.target.value)}
              disabled={loading}
              placeholder="0"
            />
          </ERPFormField>

          <ERPFormField label={t("daysRemainingLabel")}>
            {loading || !view ? (
              <div className="flex h-9 items-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />…
              </div>
            ) : (
              <div className="flex h-9 items-center gap-2 text-sm">
                <StatusBadge status={view.status} />
                <span className="text-muted-foreground">
                  {view.daysRemaining !== null ? t("daysRemaining", { days: String(view.daysRemaining) }) : t("noEndDate")}
                </span>
              </div>
            )}
          </ERPFormField>
        </ERPFormGrid>

        {/* Selected plan feature summary */}
        {selectedPlan && (
          <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-xs space-y-1.5">
            <div className="flex items-center gap-2 font-semibold text-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              {selectedPlan.name}
            </div>
            <p className="text-muted-foreground">
              {t("planIncluded", {
                students: String(selectedPlan.maxStudents),
                staff: String(selectedPlan.maxStaff),
                storage: String(selectedPlan.maxStorageMb),
              })}
            </p>
          </div>
        )}

        {/* Current grace window */}
        {view?.isInGrace || (view?.graceEndsAt && view.daysRemaining !== null) ? (
          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-200">
            <Hourglass className="h-3.5 w-3.5 shrink-0" />
            {view.isInGrace
              ? t("graceActiveDetail", { date: new Date(view.graceEndsAt as string).toLocaleString() })
              : t("graceConfigured", { date: new Date(view.graceEndsAt as string).toLocaleString() })}
          </div>
        ) : null}

        <div className="flex items-center justify-end gap-2 border-t border-border/50 pt-4">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />}
            {t("refresh")}
          </Button>
          <Button size="sm" onClick={handleSave} disabled={loading || saving}>
            {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
            {saving ? t("saving") : t("saveAndNotify")}
          </Button>
        </div>
      </div>

      {/* Lifecycle history */}
      <div className="rounded-lg border border-border/60 bg-background p-4">
        <div className="mb-3 flex items-center gap-2 pb-2 border-b border-border/50">
          <CalendarClock className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold text-foreground">{t("historyTitle")}</h4>
        </div>
        <SubscriptionHistoryTimeline items={data?.history ?? []} loading={loading} />
      </div>
    </div>
  );
}
