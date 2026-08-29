"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  School,
  Users,
  GraduationCap,
  Receipt,
  ArrowLeft,
  Settings,
  ShieldAlert,
  LogIn,
  CheckCircle2,
  Clock,
  Building2,
  Calendar,
  Layers,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import { EditTenantModal } from "@/components/system-admin/edit-tenant-modal";

export default function TenantDetailPage() {
  const t = useTranslations();
  const params = useParams();
  const router = useRouter();
  const tenantId = params.id as string;

  const [tenant, setTenant] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const fetchTenantDetails = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/tenants/${tenantId}`);
      const json = await res.json();
      if (json.success) {
        setTenant(json.data);
      } else {
        toast.error(json.error?.message || "Failed to load tenant details");
      }
    } catch {
      toast.error("Network error loading school telemetry");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (tenantId) fetchTenantDetails();
  }, [tenantId]);

  const handleImpersonate = async () => {
    if (!tenant) return;
    setIsImpersonating(true);
    try {
      const res = await fetch("/api/system-admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetTenantId: tenant.tenantId }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(`Logged in as ${tenant.name}`);
        localStorage.removeItem(`tenant_settings_${tenant.tenantId}`);
        window.location.href = "/";
      } else {
        toast.error("Failed to impersonate tenant");
        setIsImpersonating(false);
      }
    } catch {
      toast.error("Error initiating support session");
      setIsImpersonating(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!tenant) return;
    setIsUpdatingStatus(true);
    try {
      const res = await fetch("/api/system-admin/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: tenant.tenantId, status: newStatus }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(`Status updated to ${newStatus}`);
        fetchTenantDetails();
      } else {
        toast.error("Failed to update status");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-xs text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin text-primary" /> Loading school 360° telemetry...
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="py-20 text-center space-y-3">
        <School className="h-12 w-12 mx-auto text-muted-foreground/40" />
        <h2 className="text-lg font-bold">School Not Found</h2>
        <Button onClick={() => router.push("/system-admin/tenants")} variant="outline">
          Back to Tenants Directory
        </Button>
      </div>
    );
  }

  const counts = tenant._count || {};
  const financials = tenant.financials || {};

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/system-admin/tenants")}
            className="h-9 w-9"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
                {tenant.name}
              </h1>
              <Badge
                className={
                  tenant.subscriptionStatus === "ACTIVE"
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-none"
                    : tenant.subscriptionStatus === "TRIAL"
                    ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-none"
                    : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-none"
                }
              >
                {tenant.subscriptionStatus}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">
              Tenant ID: {tenant.tenantId} • Created: {new Date(tenant.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            onClick={() => setIsEditModalOpen(true)}
            className="text-xs gap-1.5 h-9"
          >
            <Settings className="h-3.5 w-3.5" /> Edit Configuration
          </Button>
          <Button
            onClick={handleImpersonate}
            disabled={isImpersonating}
            className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs gap-1.5 h-9"
          >
            {isImpersonating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <LogIn className="h-3.5 w-3.5" />
            )}
            Login As School Admin
          </Button>
        </div>
      </div>

      {/* 4 Telemetry Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border border-border/80 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase">
                Enrolled Students
              </span>
              <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                <GraduationCap className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <h3 className="text-2xl font-extrabold">{counts.studentProfiles || 0}</h3>
            <p className="text-[11px] text-muted-foreground">Active pupil profiles</p>
          </CardContent>
        </Card>

        <Card className="border border-border/80 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase">
                Faculty & Staff
              </span>
              <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                <Users className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <h3 className="text-2xl font-extrabold">{counts.staffProfiles || 0}</h3>
            <p className="text-[11px] text-muted-foreground">Teaching & operations staff</p>
          </CardContent>
        </Card>

        <Card className="border border-border/80 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase">
                Fee Throughput
              </span>
              <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                <Receipt className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <h3 className="text-2xl font-extrabold">
              {tenant.currencySymbol} {(financials.totalCollected || 0).toLocaleString()}
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Across {counts.feeVouchers || 0} generated vouchers
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border/80 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase">
                System Users
              </span>
              <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
                <Users className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <h3 className="text-2xl font-extrabold">{counts.users || 0}</h3>
            <p className="text-[11px] text-muted-foreground">Principals, Clerks & Admins</p>
          </CardContent>
        </Card>
      </div>

      {/* Grid: Subscription Controls & Institutional Parameters */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Subscription & Lifecycle Manager */}
        <div className="lg:col-span-6 space-y-4">
          <Card className="border border-border/80 shadow-xs">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                SaaS Subscription & Plan Controls
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/60">
                <div>
                  <p className="text-xs font-semibold text-foreground">Current Status</p>
                  <p className="text-[11px] text-muted-foreground">
                    Subscription lifecycle state for this school
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  {["ACTIVE", "TRIAL", "SUSPENDED"].map((st) => (
                    <Button
                      key={st}
                      size="sm"
                      variant={tenant.subscriptionStatus === st ? "default" : "outline"}
                      onClick={() => handleStatusChange(st)}
                      disabled={isUpdatingStatus || tenant.subscriptionStatus === st}
                      className="h-7 text-xs"
                    >
                      {st}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg border border-border/50 bg-background space-y-1">
                  <span className="text-muted-foreground text-[10px] uppercase font-semibold">
                    Operating Currency
                  </span>
                  <p className="font-bold text-foreground">
                    {tenant.currency} ({tenant.currencySymbol})
                  </p>
                </div>
                <div className="p-3 rounded-lg border border-border/50 bg-background space-y-1">
                  <span className="text-muted-foreground text-[10px] uppercase font-semibold">
                    Timezone & Region
                  </span>
                  <p className="font-bold text-foreground">{tenant.timezone || "Asia/Karachi"}</p>
                </div>
                <div className="p-3 rounded-lg border border-border/50 bg-background space-y-1">
                  <span className="text-muted-foreground text-[10px] uppercase font-semibold">
                    Grading Scale
                  </span>
                  <p className="font-bold text-foreground">{tenant.gradingSystem || "GPA"}</p>
                </div>
                <div className="p-3 rounded-lg border border-border/50 bg-background space-y-1">
                  <span className="text-muted-foreground text-[10px] uppercase font-semibold">
                    Standard Date Format
                  </span>
                  <p className="font-bold text-foreground">{tenant.dateFormat || "DD/MM/YYYY"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Registered Administrator Accounts */}
        <div className="lg:col-span-6 space-y-4">
          <Card className="border border-border/80 shadow-xs">
            <CardHeader className="pb-3 border-b border-border/50">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  School Administrators & Staff Accounts
                </CardTitle>
                <Badge variant="outline" className="text-xs font-mono">
                  {tenant.users?.length || 0} Accounts
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/60 max-h-72 overflow-y-auto">
                {tenant.users?.map((u: any) => (
                  <div key={u.id} className="flex items-center justify-between p-3.5 text-xs">
                    <div>
                      <p className="font-semibold text-foreground">{u.name}</p>
                      <p className="text-[11px] text-muted-foreground font-mono">{u.email}</p>
                    </div>
                    <div className="text-right space-y-0.5">
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {u.role}
                      </Badge>
                      <p className="text-[10px] text-muted-foreground">
                        {u.lastLoginAt ? `Login: ${new Date(u.lastLoginAt).toLocaleDateString()}` : "Never logged in"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <EditTenantModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        tenant={tenant}
        onSuccess={fetchTenantDetails}
      />
    </div>
  );
}
