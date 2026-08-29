"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Users, 
  School, 
  DollarSign, 
  Activity,
  ArrowUpRight,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Plus,
  Building2,
  ExternalLink,
  Receipt,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { OnboardInstituteModal } from "@/components/system-admin/onboard-institute-modal";

export default function SystemAdminDashboard() {
  const t = useTranslations();
  const router = useRouter();
  const [stats, setStats] = useState({
    totalTenants: 0,
    activeTenants: 0,
    totalStudents: 0,
    totalStaff: 0,
    estimatedMRR: 0,
    systemHealth: "100% Operational",
  });
  const [recentTenants, setRecentTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOnboardModalOpen, setIsOnboardModalOpen] = useState(false);

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/tenants");
      const json = await res.json();
      const tenants = json?.data ?? (Array.isArray(json) ? json : []);

      if (Array.isArray(tenants)) {
        const active = tenants.filter((t: any) => t.subscriptionStatus === "ACTIVE").length;
        const students = tenants.reduce((acc: number, t: any) => acc + (t._count?.studentProfiles || 0), 0);
        const staff = tenants.reduce((acc: number, t: any) => acc + (t._count?.users || 0), 0);

        setStats({
          totalTenants: tenants.length,
          activeTenants: active,
          totalStudents: students,
          totalStaff: staff,
          estimatedMRR: active * 249,
          systemHealth: "100% Operational",
        });

        setRecentTenants(tenants.slice(0, 5));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const cards = [
    {
      title: "Total School Instances",
      value: stats.totalTenants.toString(),
      unit: "Tenants Globally",
      icon: School,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-950",
    },
    {
      title: "Active Paid Subscriptions",
      value: stats.activeTenants.toString(),
      unit: `$${stats.estimatedMRR.toLocaleString()}/mo MRR`,
      icon: DollarSign,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-950",
    },
    {
      title: "Cross-Platform Students",
      value: stats.totalStudents.toLocaleString(),
      unit: "Total Active Pupils",
      icon: Users,
      color: "text-purple-600 dark:text-purple-400",
      bg: "bg-purple-50 dark:bg-purple-950",
    },
    {
      title: "Platform Infrastructure",
      value: "Healthy",
      unit: stats.systemHealth,
      icon: Activity,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-950",
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
            {t("systemAdmin.title")}
          </h1>
          <p className="text-xs text-muted-foreground">
            {t("systemAdmin.description")}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            onClick={() => setIsOnboardModalOpen(true)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs gap-1.5 h-9"
          >
            <Plus className="h-4 w-4" />
            Onboard New School
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.title} className="border border-border/80 shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {card.title}
              </span>
              <div className={`p-1.5 rounded-lg ${card.bg} ${card.color}`}>
                <card.icon className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-2xl font-extrabold text-foreground">{card.value}</div>
              <p className="text-[11px] text-muted-foreground mt-0.5">{card.unit}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Access SuperAdmin Panels */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Recent Schools Table */}
        <div className="lg:col-span-8 space-y-4">
          <Card className="border border-border/80 shadow-xs">
            <CardHeader className="pb-3 border-b border-border/50 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <School className="h-4 w-4 text-primary" />
                Recently Provisioned Schools
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/system-admin/tenants")}
                className="text-xs text-primary gap-1 h-7"
              >
                View All Directory <ArrowUpRight className="h-3 w-3" />
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/60">
                {recentTenants.length === 0 ? (
                  <div className="p-6 text-center text-xs text-muted-foreground">
                    No school tenants provisioned yet.
                  </div>
                ) : (
                  recentTenants.map((tenant) => (
                    <div
                      key={tenant.id}
                      className="flex items-center justify-between p-3.5 hover:bg-muted/20 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 bg-primary/10 text-primary rounded-lg flex items-center justify-center font-semibold text-xs">
                          <Building2 className="h-4 w-4" />
                        </div>
                        <div>
                          <button
                            onClick={() => router.push(`/system-admin/tenants/${tenant.id || tenant.tenantId}`)}
                            className="font-bold text-xs text-foreground hover:text-primary text-left flex items-center gap-1 cursor-pointer"
                          >
                            <span>{tenant.name}</span>
                            <ExternalLink className="h-3 w-3 opacity-60" />
                          </button>
                          <p className="text-[10px] text-muted-foreground font-mono">
                            Tenant: {tenant.tenantId} • Students: {tenant._count?.studentProfiles || 0}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={
                            tenant.subscriptionStatus === "ACTIVE"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]"
                              : "bg-blue-50 text-blue-700 border-blue-200 text-[10px]"
                          }
                        >
                          {tenant.subscriptionStatus}
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => router.push(`/system-admin/tenants/${tenant.id || tenant.tenantId}`)}
                          className="h-7 text-xs text-muted-foreground"
                        >
                          Inspector
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Command Shortcuts */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="border border-border/80 shadow-xs">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                SuperAdmin Modules
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 space-y-2">
              <button
                onClick={() => router.push("/system-admin/billing")}
                className="w-full text-left p-3 rounded-lg border border-border/60 bg-muted/20 hover:bg-muted/40 transition-all flex items-center justify-between group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                    <DollarSign className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">SaaS Revenue & MRR</p>
                    <p className="text-[10px] text-muted-foreground">Manage subscriptions & plans</p>
                  </div>
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </button>

              <button
                onClick={() => router.push("/system-admin/audit-logs")}
                className="w-full text-left p-3 rounded-lg border border-border/60 bg-muted/20 hover:bg-muted/40 transition-all flex items-center justify-between group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-400">
                    <ShieldAlert className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">Global Security Audit</p>
                    <p className="text-[10px] text-muted-foreground">Real-time mutation stream</p>
                  </div>
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </button>

              <button
                onClick={() => router.push("/system-admin/tenants")}
                className="w-full text-left p-3 rounded-lg border border-border/60 bg-muted/20 hover:bg-muted/40 transition-all flex items-center justify-between group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">Tenant 360° Directory</p>
                    <p className="text-[10px] text-muted-foreground">Full multi-tenant inspector</p>
                  </div>
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </button>
            </CardContent>
          </Card>
        </div>
      </div>

      <OnboardInstituteModal
        isOpen={isOnboardModalOpen}
        onClose={() => setIsOnboardModalOpen(false)}
        onSuccess={fetchStats}
      />
    </div>
  );
}
