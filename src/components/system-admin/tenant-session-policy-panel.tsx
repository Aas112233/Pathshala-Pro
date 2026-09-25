"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { MonitorSmartphone, Save, Loader2 } from "lucide-react";

interface TenantSessionPolicyPanelProps {
  tenantId: string;
  initialAllowConcurrent?: boolean;
  onUpdated?: () => void;
}

export function TenantSessionPolicyPanel({
  tenantId,
  initialAllowConcurrent = true,
  onUpdated,
}: TenantSessionPolicyPanelProps) {
  const t = useTranslations("systemAdmin");
  const [allowed, setAllowed] = useState(initialAllowConcurrent);
  const [saved, setSaved] = useState(initialAllowConcurrent);
  const [isSaving, setIsSaving] = useState(false);
  const dirty = allowed !== saved;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/tenants/${tenantId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ allowConcurrentSessions: allowed }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        throw new Error(json.error?.message || json.message || t("sessionPolicySaveFailed"));
      }
      setSaved(allowed);
      toast.success(t("sessionPolicySaved"));
      onUpdated?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("sessionPolicySaveFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="border border-border/80 shadow-xs">
      <CardHeader className="p-4 pb-2 border-b border-border/50">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <MonitorSmartphone className="h-4 w-4 text-primary" />
          {t("sessionPolicyTitle")}
        </CardTitle>
        <CardDescription className="text-xs">{t("sessionPolicyDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/20 p-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground">{t("sessionPolicyAllowLabel")}</p>
            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
              {allowed ? t("sessionPolicyAllowHint") : t("sessionPolicySingleHint")}
            </p>
          </div>
          <Switch checked={allowed} onCheckedChange={setAllowed} aria-label={t("sessionPolicyAllowLabel")} />
        </div>
        <div className="flex items-center justify-end">
          <Button onClick={handleSave} disabled={!dirty || isSaving} className="h-9 gap-2 text-xs">
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {t("sessionPolicySave")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
