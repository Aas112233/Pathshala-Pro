"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AppDropdown } from "@/components/ui/app-dropdown";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Settings,
  Server,
  ShieldCheck,
  Database,
  Cloud,
  Save,
  BellRing,
  Globe,
} from "lucide-react";

export default function SystemAdminSettingsPage() {
  const t = useTranslations("systemAdminPages");
  const [isSaving, setIsSaving] = useState(false);
  const [platformConfig, setPlatformConfig] = useState({
    platformName: "Pathshala-Pro ERP",
    supportEmail: "support@pathshalapro.com",
    defaultTrialDays: 30,
    allowPublicRegistration: true,
    maintenanceMode: false,
    defaultCurriculum: "NCTB",
    defaultGradingSystem: "GPA",
    defaultGracePerSubject: 5,
    defaultGracePerStudent: 10,
    gpaScaleJson: '[{"min":80,"grade":"A+","point":5},{"min":70,"grade":"A","point":4},{"min":60,"grade":"A-","point":3.5},{"min":50,"grade":"B","point":3},{"min":40,"grade":"C","point":2},{"min":33,"grade":"D","point":1},{"min":0,"grade":"F","point":0}]',
  });

  // Load platform defaults from SYSTEM tenant
  useEffect(() => {
    fetch("/api/tenants/SYSTEM", { credentials: "include" })
      .then((r) => r.json())
      .then((json) => {
        const t = json?.data;
        if (t) {
          setPlatformConfig((prev) => ({
            ...prev,
            defaultCurriculum: t.curriculum || prev.defaultCurriculum,
            defaultGradingSystem: t.gradingSystem || prev.defaultGradingSystem,
            defaultGracePerSubject: t.maxGracePerSubject ?? prev.defaultGracePerSubject,
            defaultGracePerStudent: t.maxGracePerStudent ?? prev.defaultGracePerStudent,
            ...(t.gpaScale ? { gpaScaleJson: JSON.stringify(t.gpaScale, null, 2) } : {}),
          }));
        }
      })
      .catch(() => {});
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      let gpaScale: any = undefined;
      if (platformConfig.gpaScaleJson.trim()) {
        try { gpaScale = JSON.parse(platformConfig.gpaScaleJson); } catch { toast.error(t("invalidGpa")); setIsSaving(false); return; }
      }
      const res = await fetch("/api/tenants/SYSTEM", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          curriculum: platformConfig.defaultCurriculum,
          gradingSystem: platformConfig.defaultGradingSystem,
          maxGracePerSubject: Number(platformConfig.defaultGracePerSubject),
          maxGracePerStudent: Number(platformConfig.defaultGracePerStudent),
          gpaScale,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Save failed");
      toast.success(t("platformSettingsUpdated"));
    } catch (err: any) {
      toast.error(err.message || t("networkError"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 max-w-5xl">
      <PageHeader
        title={t("settingsTitle")}
        description={t("settingsDescription")}
        icon={Settings}
      />

      <form onSubmit={handleSave} className="space-y-6">
        {/* Platform Identity */}
        <Card className="border border-border/80 shadow-xs">
          <CardHeader className="p-4 pb-2 border-b border-border/50">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Globe className="h-4 w-4 text-primary" />
              {t("brandingPolicies")}
            </CardTitle>
            <CardDescription className="text-xs">
              {t("newSchoolDefaults")}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{t("platformName")}</Label>
                <Input
                  value={platformConfig.platformName}
                  onChange={(e) => setPlatformConfig({ ...platformConfig, platformName: e.target.value })}
                  className="h-10 text-xs font-semibold"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{t("supportEmail")}</Label>
                <Input
                  type="email"
                  value={platformConfig.supportEmail}
                  onChange={(e) => setPlatformConfig({ ...platformConfig, supportEmail: e.target.value })}
                  className="h-10 text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{t("trialDays")}</Label>
                <Input
                  type="number"
                  min="7"
                  max="90"
                  value={platformConfig.defaultTrialDays}
                  onChange={(e) => setPlatformConfig({ ...platformConfig, defaultTrialDays: parseInt(e.target.value, 10) || 30 })}
                  className="h-10 text-xs font-semibold"
                />
              </div>

              <div className="space-y-1.5 flex flex-col justify-end pb-1">
                <div className="flex items-center justify-between p-2.5 rounded-lg border border-border/60 bg-muted/20">
                  <span className="text-xs font-semibold text-foreground">{t("selfServe")}</span>
                  <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                    {t("enabled")}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Academic Engine Defaults */}
        <Card className="border border-border/80 shadow-xs">
          <CardHeader className="p-4 pb-2 border-b border-border/50">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-amber-600" />
              {t("academicDefaults")}
            </CardTitle>
            <CardDescription className="text-xs">{t("academicDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{t("boardCurriculum")}</Label>
                <AppDropdown
                  value={platformConfig.defaultCurriculum}
                  onChange={(v) => setPlatformConfig({ ...platformConfig, defaultCurriculum: v })}
                  options={[
                    { value: "NCTB", label: "Bangladesh NCTB" },
                    { value: "CBSE", label: "India CBSE" },
                    { value: "FBISE", label: "Pakistan FBISE" }
                  ]}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{t("gradingSystem")}</Label>
                <AppDropdown
                  value={platformConfig.defaultGradingSystem}
                  onChange={(v) => setPlatformConfig({ ...platformConfig, defaultGradingSystem: v })}
                  options={[
                    { value: "GPA", label: "GPA 5.0" },
                    { value: "PERCENTAGE", label: "Percentage" }
                  ]}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{t("graceSubject")}</Label>
                <Input type="number" min="0" max="20" value={platformConfig.defaultGracePerSubject} onChange={(e) => setPlatformConfig({ ...platformConfig, defaultGracePerSubject: parseFloat(e.target.value) || 0 })} className="h-10 text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{t("graceStudent")}</Label>
                <Input type="number" min="0" max="50" value={platformConfig.defaultGracePerStudent} onChange={(e) => setPlatformConfig({ ...platformConfig, defaultGracePerStudent: parseFloat(e.target.value) || 0 })} className="h-10 text-xs" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs font-semibold">{t("gpaJson")}</Label>
                <textarea value={platformConfig.gpaScaleJson} onChange={(e) => setPlatformConfig({ ...platformConfig, gpaScaleJson: e.target.value })} rows={4} className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-ring" placeholder='[{"min":80,"grade":"A+","point":5}]' />
                <p className="text-[10px] text-muted-foreground">{t("gpaHelp")}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Infrastructure & Services Status */}
        <Card className="border border-border/80 shadow-xs">
          <CardHeader className="p-4 pb-2 border-b border-border/50">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Server className="h-4 w-4 text-emerald-600" />
              {t("infrastructure")}
            </CardTitle>
            <CardDescription className="text-xs">
              {t("backendServices")}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-lg border border-border/60 bg-background space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground">{t("database")}</span>
                  <div className="h-2 w-2 rounded-full bg-emerald-500" />
                </div>
                <p className="text-[10px] text-muted-foreground">{t("neon")}</p>
                <Badge variant="outline" className="text-[9px] font-mono mt-1">
                  {t("connected")}
                </Badge>
              </div>

              <div className="p-3 rounded-lg border border-border/60 bg-background space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground">{t("storage")}</span>
                  <div className="h-2 w-2 rounded-full bg-emerald-500" />
                </div>
                <p className="text-[10px] text-muted-foreground">{t("r2")}</p>
                <Badge variant="outline" className="text-[9px] font-mono mt-1">
                  {t("replicated")}
                </Badge>
              </div>

              <div className="p-3 rounded-lg border border-border/60 bg-background space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground">{t("runtime")}</span>
                  <div className="h-2 w-2 rounded-full bg-emerald-500" />
                </div>
                <p className="text-[10px] text-muted-foreground">{t("turbopack")}</p>
                <Badge variant="outline" className="text-[9px] font-mono mt-1">
                  v15.4 (App Router)
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="submit"
            disabled={isSaving}
            className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 text-xs h-9"
          >
            <Save className="h-4 w-4" />
            {isSaving ? t("saving") : t("saveConfiguration")}
          </Button>
        </div>
      </form>
    </div>
  );
}
