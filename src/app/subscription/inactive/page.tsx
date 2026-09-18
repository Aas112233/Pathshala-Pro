"use client";

import { useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { AlertTriangle, LifeBuoy, Loader2, RefreshCw, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Standalone inactive-notice page shown when a tenant's subscription has
 * expired and the grace period has lapsed. Renders outside the dashboard shell
 * so blocked tenants see a clean, uncluttered message instead of the ERP UI.
 */
export default function SubscriptionInactivePage() {
  const t = useTranslations("subscription");
  const { logout } = useAuth();
  const [busy, setBusy] = useState<"check" | "logout" | null>(null);

  const checkAccess = async () => {
    setBusy("check");
    try {
      const response = await fetch("/api/tenants/subscription-status", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error?.message || result.message || t("inactive.checkFailed"));
      if (result.data?.isBlocked === false) window.location.replace("/");
      else toast.info(t("inactive.stillInactive"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("inactive.checkFailed"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-2xl border border-border/80 bg-card p-8 text-center shadow-sm">
        <div className="relative mx-auto mb-6 flex h-24 w-24 items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-rose-500/10 blur-xl" />
          <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-rose-100 border-4 border-white shadow-xl">
            <AlertTriangle className="h-10 w-10 text-rose-600" />
          </div>
        </div>

        <h1 className="mb-2 text-2xl font-extrabold tracking-tight text-foreground">
          {t("inactive.title")}
        </h1>

        <p className="mb-6 text-sm text-muted-foreground leading-relaxed">
          {t("inactive.message")}
        </p>

        <div className="rounded-lg border border-border/60 bg-muted/30 p-4 text-left text-sm">
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <LifeBuoy className="h-4 w-4 text-primary" />
            {t("inactive.supportHeading")}
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {t("inactive.supportText")}
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">{t("inactive.renewalSteps")}</p>
          <Button onClick={checkAccess} disabled={busy !== null} className="w-full" size="lg">
            {busy === "check" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            {t(busy === "check" ? "inactive.checking" : "inactive.checkAccess")}
          </Button>
          <Button variant="outline" disabled={busy !== null} onClick={async () => {
            setBusy("logout");
            await logout();
          }}>
            {busy === "logout" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />}
            {t(busy === "logout" ? "inactive.signingOut" : "inactive.signOut")}
          </Button>
        </div>
      </div>
    </div>
  );
}
