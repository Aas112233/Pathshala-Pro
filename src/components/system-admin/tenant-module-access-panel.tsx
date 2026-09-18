"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Layers,
  Save,
  Loader2,
  BookOpen,
  UserPlus,
  CalendarCheck,
  Award,
  CreditCard,
  Landmark,
  BadgeDollarSign,
  Clock,
  Calendar,
  FileSpreadsheet,
  Bell,
  CalendarOff,
  Bus,
  Home,
  BookMarked,
  Package,
  FileCheck,
  Stethoscope,
  LucideIcon,
  RefreshCw,
} from "lucide-react";
import {
  TenantModuleKey,
  TENANT_MODULE_DEFINITIONS,
  resolveTenantModules,
} from "@/lib/tenant-modules";

const MODULE_ICONS: Record<TenantModuleKey, LucideIcon> = {
  academics: BookOpen,
  admissions: UserPlus,
  attendance: CalendarCheck,
  examinations: Award,
  fees: CreditCard,
  accounting: Landmark,
  payroll: BadgeDollarSign,
  timetable: Clock,
  calendar: Calendar,
  homework: FileSpreadsheet,
  notices: Bell,
  leaves: CalendarOff,
  transport: Bus,
  hostel: Home,
  library: BookMarked,
  inventory: Package,
  certificates: FileCheck,
  health: Stethoscope,
};

interface TenantModuleAccessPanelProps {
  tenantId: string;
  initialModules?: Record<string, boolean>;
  onUpdated?: () => void;
}

export function TenantModuleAccessPanel({
  tenantId,
  initialModules,
  onUpdated,
}: TenantModuleAccessPanelProps) {
  const t = useTranslations("systemAdminPages");
  const tMod = useTranslations("tenantModules");

  const [modules, setModules] = useState<Record<TenantModuleKey, boolean>>(() =>
    resolveTenantModules(initialModules)
  );
  const [savedModules, setSavedModules] = useState<Record<TenantModuleKey, boolean>>(() =>
    resolveTenantModules(initialModules)
  );
  const [isSaving, setIsSaving] = useState(false);

  const isDirty = JSON.stringify(modules) !== JSON.stringify(savedModules);

  const handleToggle = (key: TenantModuleKey, value: boolean) => {
    setModules((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleReset = () => {
    setModules(savedModules);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/tenants/${tenantId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          featureFlags: modules,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || t("updateModulesFailed"));
      }

      setSavedModules(modules);
      toast.success(t("modulesUpdated"));
      onUpdated?.();
    } catch (err: any) {
      toast.error(err.message || t("updateModulesFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  const categories = [
    {
      key: "core",
      title: t("modulesCategoryCore"),
      modules: TENANT_MODULE_DEFINITIONS.filter((m) => m.category === "core"),
    },
    {
      key: "academic",
      title: t("modulesCategoryAcademic"),
      modules: TENANT_MODULE_DEFINITIONS.filter((m) => m.category === "academic"),
    },
    {
      key: "finance",
      title: t("modulesCategoryFinance"),
      modules: TENANT_MODULE_DEFINITIONS.filter((m) => m.category === "finance"),
    },
    {
      key: "facilities",
      title: t("modulesCategoryFacilities"),
      modules: TENANT_MODULE_DEFINITIONS.filter((m) => m.category === "facilities"),
    },
  ];

  const enabledCount = Object.values(modules).filter(Boolean).length;
  const totalCount = Object.keys(modules).length;

  return (
    <Card className="border border-border/80 shadow-xs">
      <CardHeader className="p-4 border-b border-border/50">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-bold">{t("moduleAccess")}</CardTitle>
              <Badge variant="outline" className="text-[11px] font-medium font-mono">
                {t("enabledCount", { enabled: enabledCount, total: totalCount })}
              </Badge>
            </div>
            <CardDescription className="text-xs">
              {t("moduleAccessDescription")}
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            {isDirty && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                disabled={isSaving}
                className="h-8 text-xs gap-1.5"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Reset
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving || !isDirty}
              className="h-8 text-xs gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {isSaving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              {isSaving ? t("savingModuleAccess") : t("saveModuleAccess")}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-6">
        {categories.map((cat) => (
          <div key={cat.key} className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {cat.title}
              </h3>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {cat.modules.map((mod) => {
                const Icon = MODULE_ICONS[mod.key] || Layers;
                const isEnabled = !!modules[mod.key];
                return (
                  <div
                    key={mod.key}
                    className={`flex items-start justify-between p-3 rounded-lg border transition-colors ${
                      isEnabled
                        ? "bg-card border-border/80 shadow-2xs"
                        : "bg-muted/20 border-dashed border-border/60 opacity-75"
                    }`}
                  >
                    <div className="flex items-start gap-2.5 pr-2">
                      <div
                        className={`p-1.5 rounded-md mt-0.5 ${
                          isEnabled
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-foreground">
                            {tMod(`${mod.key}.title` as any)}
                          </span>
                          <span
                            className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-mono font-semibold ${
                              isEnabled
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {isEnabled ? t("moduleEnabled") : t("moduleDisabled")}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">
                          {tMod(`${mod.key}.description` as any)}
                        </p>
                      </div>
                    </div>

                    <Switch
                      checked={isEnabled}
                      onCheckedChange={(val) => handleToggle(mod.key, val)}
                      className="mt-1"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
