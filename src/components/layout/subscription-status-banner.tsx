"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertTriangle, Clock, CreditCard } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface SubscriptionView {
  tenantId: string;
  planCode: string;
  planName: string;
  status: string;
  subscriptionEndAt: string | null;
  gracePeriodDays: number;
  graceEndsAt: string | null;
  daysRemaining: number | null;
  isBlocked: boolean;
  isInGrace: boolean;
}

/**
 * Tenant-facing subscription banner.
 *
 * - If the tenant is blocked (expired / inactive / grace lapsed), redirects to
 *   the standalone inactive notice page.
 * - If the tenant is inside a grace window, shows an urgent banner with the
 *   grace expiry date.
 * - If the subscription ends within 14 days, shows a soft renewal reminder.
 * - Otherwise renders nothing.
 *
 * Mounted inside the dashboard shell so every protected page checks its own
 * subscription state and surfaces plan / grace context to the tenant.
 */
export function SubscriptionStatusBanner() {
  const t = useTranslations("subscription");
  const router = useRouter();

  const { data } = useQuery({
    queryKey: ["subscription-status"],
    queryFn: async () => {
      const res = await fetch("/api/tenants/subscription-status", {
        credentials: "include",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        // Auth or other error — do not block the UI on it.
        return null;
      }
      return json.data as SubscriptionView;
    },
    refetchInterval: 5 * 60 * 1000,
    retry: 1,
  });

  useEffect(() => {
    if (data?.isBlocked) router.replace("/subscription/inactive");
  }, [data, router]);

  // Render nothing while loading / no data / not blocked / no urgent state.
  if (!data) return null;

  if (data.isInGrace || (data.graceEndsAt && data.isBlocked === false && data.status === "GRACE")) {
    return (
      <div className="border-b border-rose-200 bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200 dark:border-rose-900">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-2 text-xs">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span className="font-semibold">{t("banner.graceTitle")}</span>
          <span className="text-rose-700 dark:text-rose-300">
            {data.graceEndsAt
              ? t("banner.graceEndsOn", { date: new Date(data.graceEndsAt).toLocaleDateString() })
              : t("banner.graceActive")}
          </span>
        </div>
      </div>
    );
  }

  const soon = typeof data.daysRemaining === "number" && data.daysRemaining <= 14;
  if (soon && !data.isBlocked) {
    return (
      <div className="border-b border-amber-200 bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-900">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-2 text-xs">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          <span className="font-semibold">{t("banner.endingSoonTitle")}</span>
          <span className="text-amber-700 dark:text-amber-300">
            {data.subscriptionEndAt
              ? t("banner.endsOn", { date: new Date(data.subscriptionEndAt).toLocaleDateString() })
              : t("banner.daysLeft", { days: String(data.daysRemaining) })}
          </span>
        </div>
      </div>
    );
  }

  if (data.status === "ACTIVE" || data.status === "TRIALING" || data.status === "TRIAL") {
    return (
      <div className="hidden border-b border-border/50 bg-muted/20 text-muted-foreground">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-1.5 text-[11px]">
          <CreditCard className="h-3 w-3 shrink-0" />
          <span>
            {t("banner.plan", { plan: data.planName })}
            {data.daysRemaining !== null
              ? ` · ${t("banner.daysLeft", { days: String(data.daysRemaining) })}`
              : ""}
          </span>
        </div>
      </div>
    );
  }

  return null;
}
