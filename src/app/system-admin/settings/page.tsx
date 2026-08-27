"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  const [isSaving, setIsSaving] = useState(false);
  const [platformConfig, setPlatformConfig] = useState({
    platformName: "Pathshala-Pro ERP",
    supportEmail: "support@pathshalapro.com",
    defaultTrialDays: 30,
    allowPublicRegistration: true,
    maintenanceMode: false,
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      toast.success("Platform settings updated successfully!");
    }, 600);
  };

  return (
    <div className="space-y-6 pb-12 max-w-5xl">
      <PageHeader
        title="Platform & SaaS Infrastructure Settings"
        description="Global Multi-Tenant Platform Parameters, Trial Policies & Infrastructure Health"
        icon={Settings}
      />

      <form onSubmit={handleSave} className="space-y-6">
        {/* Platform Identity */}
        <Card className="border border-border/80 shadow-xs">
          <CardHeader className="p-4 pb-2 border-b border-border/50">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Globe className="h-4 w-4 text-indigo-600" />
              SaaS Platform Branding & Policies
            </CardTitle>
            <CardDescription className="text-xs">
              Global defaults applied across new school provisions
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Platform Application Name</Label>
                <Input
                  value={platformConfig.platformName}
                  onChange={(e) => setPlatformConfig({ ...platformConfig, platformName: e.target.value })}
                  className="h-10 text-xs font-semibold"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Global Support Desk Email</Label>
                <Input
                  type="email"
                  value={platformConfig.supportEmail}
                  onChange={(e) => setPlatformConfig({ ...platformConfig, supportEmail: e.target.value })}
                  className="h-10 text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Default Evaluation Trial Period (Days)</Label>
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
                  <span className="text-xs font-semibold text-foreground">Self-Serve School Onboarding</span>
                  <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                    ENABLED
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Infrastructure & Services Status */}
        <Card className="border border-border/80 shadow-xs">
          <CardHeader className="p-4 pb-2 border-b border-border/50">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Server className="h-4 w-4 text-emerald-600" />
              Connected Cloud Infrastructure
            </CardTitle>
            <CardDescription className="text-xs">
              Backend services powering Pathshala-Pro
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-xl border border-border/60 bg-background space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground">PostgreSQL Database</span>
                  <div className="h-2 w-2 rounded-full bg-emerald-500" />
                </div>
                <p className="text-[10px] text-muted-foreground">Neon Serverless Engine</p>
                <Badge variant="outline" className="text-[9px] font-mono mt-1">
                  Connected
                </Badge>
              </div>

              <div className="p-3 rounded-xl border border-border/60 bg-background space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground">Document Storage</span>
                  <div className="h-2 w-2 rounded-full bg-emerald-500" />
                </div>
                <p className="text-[10px] text-muted-foreground">Cloudflare R2 Object Storage</p>
                <Badge variant="outline" className="text-[9px] font-mono mt-1">
                  Replicated
                </Badge>
              </div>

              <div className="p-3 rounded-xl border border-border/60 bg-background space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground">Next.js Edge Runtime</span>
                  <div className="h-2 w-2 rounded-full bg-emerald-500" />
                </div>
                <p className="text-[10px] text-muted-foreground">Turbopack Optimized</p>
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
            className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shadow-sm text-xs h-9"
          >
            <Save className="h-4 w-4" />
            {isSaving ? "Saving..." : "Save Platform Configuration"}
          </Button>
        </div>
      </form>
    </div>
  );
}
