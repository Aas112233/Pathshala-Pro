"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TopSheet } from "@/components/ui/top-sheet";
import { ERPFormField, ERPFormGrid, ERPFormSection } from "@/components/ui/erp-form-layout";
import { AppDropdown } from "@/components/ui/app-dropdown";
import { toast } from "sonner";
import {
  DollarSign,
  TrendingUp,
  CreditCard,
  Building2,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowUpRight,
  Loader2,
  Filter,
} from "lucide-react";
import { ERPDataTable, ERPStatusPill, type ColumnDef } from "@/components/ui/erp-data-table";

export default function SystemAdminBillingPage() {
  const t = useTranslations();
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedIds, setSelectedIds] = useState<(string | number)[]>([]);
  const [editTenant, setEditTenant] = useState<any>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editStatus, setEditStatus] = useState("ACTIVE");
  const [editPlan, setEditPlan] = useState("STARTER");

  const fetchBillingData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/system-admin/billing");
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      } else {
        toast.error(t("saasAdmin.billing.loadFailed"));
      }
    } catch {
      toast.error(t("saasAdmin.billing.networkError"));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBillingData();
  }, []);

  const handleUpdateStatus = async (tenantId: string, newStatus: string) => {
    try {
      const res = await fetch("/api/system-admin/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, status: newStatus }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(json.message || t("saasAdmin.billing.statusUpdated", { status: newStatus }));
        fetchBillingData();
      } else {
        toast.error(json.error?.message || t("saasAdmin.billing.statusUpdateFailed"));
      }
    } catch {
      toast.error(t("saasAdmin.billing.networkError"));
    }
  };

  const handleEditBilling = (row: any) => {
    setEditTenant(row);
    setEditStatus(row.status);
    setEditPlan(row.plan || "STARTER");
    setIsEditOpen(true);
  };

  const handleSaveBilling = async () => {
    if (!editTenant) return;
    try {
      const res = await fetch("/api/system-admin/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: editTenant.tenantId, status: editStatus, plan: editPlan }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success("Billing updated");
        setIsEditOpen(false);
        fetchBillingData();
      } else toast.error(json.error?.message || "Update failed");
    } catch { toast.error("Network error"); }
  };

  const handleExport = () => {
    const rows = filteredSubscriptions;
    const header = ["School", "TenantId", "Plan", "Status", "Students", "MonthlyPrice"];
    const csv = [header.join(","), ...rows.map((r: any) => [r.name, r.tenantId, r.plan, r.status, r.studentsCount, r.estimatedMonthlyPrice].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `billing-${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const metrics = data?.metrics || {
    totalSchools: 0,
    activeSubscriptions: 0,
    trialSchools: 0,
    suspendedSchools: 0,
    estimatedMRR: 0,
    estimatedARR: 0,
    trialConversionRate: "0",
  };

  const subscriptions = data?.subscriptions || [];

  const filteredSubscriptions = subscriptions.filter((sub: any) => {
    const matchSearch =
      !search ||
      sub.name.toLowerCase().includes(search.toLowerCase()) ||
      sub.tenantId.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || sub.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const columns: ColumnDef<any>[] = [
    {
      key: "name",
      header: t("saasAdmin.billing.colSchool"),
      cell: (row) => (
        <div>
          <p className="text-xs font-bold text-foreground">{row.name}</p>
          <p className="text-[11px] text-muted-foreground font-mono">{row.tenantId}</p>
        </div>
      ),
    },
    {
      key: "plan",
      header: t("saasAdmin.billing.colPlan"),
      cell: (row) => (
        <Badge
          variant="outline"
          className="text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
        >
          {row.plan}
        </Badge>
      ),
    },
    {
      key: "status",
      header: t("saasAdmin.billing.colStatus"),
      cell: (row) => (
        <ERPStatusPill
          status={row.status}
          variant={
            row.status === "ACTIVE"
              ? "emerald"
              : row.status === "TRIAL"
              ? "subtle"
              : "amber"
          }
        />
      ),
    },
    {
      key: "studentsCount",
      header: t("saasAdmin.billing.colPupils"),
      cell: (row) => (
        <span className="font-mono text-xs font-semibold text-foreground">
          {t("saasAdmin.billing.studentsCount", { count: row.studentsCount })}
        </span>
      ),
    },
    {
      key: "estimatedMonthlyPrice",
      header: t("saasAdmin.billing.colRevenue"),
      cell: (row) => (
        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
          {t("saasAdmin.billing.pricePerMonth", { price: row.estimatedMonthlyPrice })}
        </span>
      ),
    },
    {
      key: "actions",
      header: t("saasAdmin.billing.colLifecycle"),
      className: "text-right",
      cell: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => handleEditBilling(row)} className="h-7 text-[11px]">Edit</Button>
          {row.status !== "ACTIVE" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleUpdateStatus(row.tenantId, "ACTIVE")}
              className="h-7 text-[11px] border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300"
            >
              {t("saasAdmin.billing.activate")}
            </Button>
          )}
          {row.status === "ACTIVE" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleUpdateStatus(row.tenantId, "SUSPENDED")}
              className="h-7 text-[11px] border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300"
            >
              {t("saasAdmin.billing.suspend")}
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title={t("saasAdmin.billing.title")}
        description={t("saasAdmin.billing.description")}
        icon={DollarSign}
      />

      {/* SaaS Revenue Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border border-border/80 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase">
                {t("saasAdmin.billing.estimatedMrr")}
              </span>
              <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <h3 className="text-2xl font-extrabold text-foreground">
              ${metrics.estimatedMRR.toLocaleString()}
            </h3>
            <p className="text-[11px] text-muted-foreground">{t("saasAdmin.billing.mrrCaption")}</p>
          </CardContent>
        </Card>

        <Card className="border border-border/80 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase">
                {t("saasAdmin.billing.estimatedArr")}
              </span>
              <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <h3 className="text-2xl font-extrabold text-foreground">
              ${metrics.estimatedARR.toLocaleString()}
            </h3>
            <p className="text-[11px] text-muted-foreground">{t("saasAdmin.billing.arrCaption")}</p>
          </CardContent>
        </Card>

        <Card className="border border-border/80 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase">
                {t("saasAdmin.billing.activePaidSchools")}
              </span>
              <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <h3 className="text-2xl font-extrabold text-foreground">
              {metrics.activeSubscriptions} / {metrics.totalSchools}
            </h3>
            <p className="text-[11px] text-muted-foreground">
              {t("saasAdmin.billing.conversionRate", { rate: metrics.trialConversionRate })}
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border/80 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase">
                {t("saasAdmin.billing.activeTrials")}
              </span>
              <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
                <Clock className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <h3 className="text-2xl font-extrabold text-foreground">{metrics.trialSchools}</h3>
            <p className="text-[11px] text-muted-foreground">{t("saasAdmin.billing.trialsCaption")}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={handleExport} className="h-8 text-xs gap-1.5">
          <Filter className="h-3.5 w-3.5" /> Export CSV
        </Button>
      </div>

      {/* Subscriptions Table */}
      <ERPDataTable<any>
        title={t("saasAdmin.billing.tableTitle")}
        subtitle={t("saasAdmin.billing.managingInstances", { count: filteredSubscriptions.length })}
        data={filteredSubscriptions}
        columns={columns}
        keyExtractor={(row) => row.id}
        searchPlaceholder={t("saasAdmin.billing.searchPlaceholder")}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
      />

      <TopSheet
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title={`Edit Billing — ${editTenant?.name ?? ""}`}
        description={`Tenant ${editTenant?.tenantId ?? ""}`}
        maxWidth="lg"
        footer={
          <div className="flex justify-end gap-2 w-full">
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveBilling}>Save Plan</Button>
          </div>
        }
      >
        <ERPFormSection title="Plan & Status">
          <ERPFormGrid cols={2}>
            <ERPFormField label="Subscription Status">
              <AppDropdown value={editStatus} onChange={setEditStatus} options={[{value:"ACTIVE",label:"ACTIVE"},{value:"TRIAL",label:"TRIAL"},{value:"SUSPENDED",label:"SUSPENDED"},{value:"EXPIRED",label:"EXPIRED"}]} />
            </ERPFormField>
            <ERPFormField label="Plan Tier">
              <AppDropdown value={editPlan} onChange={setEditPlan} options={[{value:"STARTER",label:"STARTER 149"},{value:"PRO",label:"PRO 299"},{value:"ENTERPRISE",label:"ENTERPRISE 599"}]} />
            </ERPFormField>
          </ERPFormGrid>
        </ERPFormSection>
      </TopSheet>
    </div>
  );
}
