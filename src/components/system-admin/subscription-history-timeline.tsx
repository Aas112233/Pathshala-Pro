"use client";

import { useTranslations } from "next-intl";
import { Activity, CalendarClock, CheckCircle2, Clock, FileClock, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface SubscriptionChangeHistoryItem {
  id: string;
  changeType: string;
  oldStatus?: string;
  newStatus?: string;
  subscriptionEndAt?: string | null;
  gracePeriodDays?: number | null;
  changedByEmail?: string | null;
  details?: Record<string, any> | null;
  createdAt: string;
  plan?: { code?: string | null; name?: string | null } | null;
}

const CHANGE_ICON: Record<string, typeof CheckCircle2> = {
  PLAN_CHANGE: RefreshCw,
  STATUS_CHANGE: CheckCircle2,
  END_DATE_CHANGE: CalendarClock,
  GRACE_CHANGE: Clock,
  EXPIRY: FileClock,
};

const CHANGE_LABEL_KEY: Record<string, string> = {
  PLAN_CHANGE: "historyTypePlanChange",
  STATUS_CHANGE: "historyTypeStatusChange",
  END_DATE_CHANGE: "historyTypeEndDateChange",
  GRACE_CHANGE: "historyTypeGraceChange",
  EXPIRY: "historyTypeExpiry",
};

/**
 * Presentational timeline of a tenant's subscription lifecycle changes,
 * rendered from SubscriptionChangeLog rows.
 */
export function SubscriptionHistoryTimeline({
  items,
  loading,
}: {
  items: SubscriptionChangeHistoryItem[];
  loading?: boolean;
}) {
  const t = useTranslations("saasAdmin.tenantDetail");

  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-lg bg-muted/40" />
        ))}
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="rounded-lg border border-dashed border-border/70 p-6 text-center text-xs text-muted-foreground">
        <Activity className="mx-auto mb-2 h-5 w-5 text-muted-foreground/50" />
        {t("historyEmpty")}
      </div>
    );
  }

  return (
    <ol className="relative ml-2 space-y-4 border-l border-border/60 pl-5">
      {items.map((item) => {
        const Icon = CHANGE_ICON[item.changeType] ?? CheckCircle2;
        const labelKey = CHANGE_LABEL_KEY[item.changeType] ?? "historyTypePlanChange";
        const changeLabel = t(labelKey as never) as string;

        return (
          <li key={item.id} className="relative">
            <span className="absolute -left-[27px] flex h-5 w-5 items-center justify-center rounded-full border border-border/60 bg-background">
              <Icon className="h-3 w-3 text-primary" />
            </span>
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-foreground">{changeLabel}</span>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(item.createdAt).toLocaleString()}
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                {item.plan?.name ? (
                  <Badge variant="outline" className="text-[10px]">
                    {item.plan.name}
                  </Badge>
                ) : null}
                {item.oldStatus && (
                  <span className="text-muted-foreground">{item.oldStatus}</span>
                )}
                {item.oldStatus && item.newStatus && (
                  <span aria-hidden>{"\u2192"}</span>
                )}
                {item.newStatus && (
                  <span className="font-semibold text-foreground">{item.newStatus}</span>
                )}
                {typeof item.gracePeriodDays === "number" && item.gracePeriodDays > 0 && (
                  <span>{t("graceDaysInline", { days: String(item.gracePeriodDays) })}</span>
                )}
                {item.subscriptionEndAt && (
                  <span>
                    {t("endsOnInline", { date: new Date(item.subscriptionEndAt).toLocaleDateString() })}
                  </span>
                )}
              </div>
              {item.changedByEmail && (
                <p className="mt-1 text-[10px] text-muted-foreground/70">
                  {t("changedBy", { email: item.changedByEmail })}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
