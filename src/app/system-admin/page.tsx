"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { 
  Users, 
  School, 
  DollarSign, 
  Activity,
  ArrowUpRight,
  ShieldCheck
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SystemAdminDashboard() {
  const t = useTranslations();
  const [stats, setStats] = useState({
    totalTenants: 0,
    activeTenants: 0,
    totalStudents: 0,
    systemHealth: "100%",
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/tenants");
        const json = await res.json();
        
        if (json.success) {
          const tenants = json.data;
          const active = tenants.filter((t: any) => t.subscriptionStatus === "ACTIVE").length;
          const students = tenants.reduce((acc: number, t: any) => acc + (t._count?.studentProfiles || 0), 0);
          
          setStats({
            totalTenants: tenants.length,
            activeTenants: active,
            totalStudents: students,
            systemHealth: "Healthy",
          });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  const cards = [
    {
      title: t("systemAdmin.totalTenants"),
      value: stats.totalTenants,
      icon: School,
      description: "+2 since last month",
      color: "text-blue-600",
      bg: "bg-blue-100",
    },
    {
      title: t("systemAdmin.activeTenants"),
      value: stats.activeTenants,
      icon: DollarSign,
      description: `Targeting 100% renewal rate`,
      color: "text-emerald-600",
      bg: "bg-emerald-100",
    },
    {
      title: "Cross-Platform Students",
      value: stats.totalStudents,
      icon: Users,
      description: "Total children globally",
      color: "text-purple-600",
      bg: "bg-purple-100",
    },
    {
      title: t("systemAdmin.systemHealth"),
      value: stats.systemHealth,
      icon: Activity,
      description: "All services operational",
      color: "text-amber-600",
      bg: "bg-amber-100",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">{t("systemAdmin.title")}</h1>
        <p className="text-slate-500">{t("systemAdmin.description")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.title} className="border-none shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">
                {card.title}
              </CardTitle>
              <div className={`${card.bg} p-2 rounded-lg`}>
                <card.icon className={`h-4 w-4 ${card.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">
                {loading ? "..." : card.value}
              </div>
              <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                {card.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Placeholder for Revenue Chart */}
      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle>Platform Growth Overview</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center border-2 border-dashed border-slate-200 rounded-lg mx-6 mb-6">
          <div className="text-center">
            <ShieldCheck className="h-12 w-12 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-400">Global SaaS Analytics appearing soon...</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
