"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  ShieldAlert,
  ShieldCheck,
  Search,
  Filter,
  RefreshCw,
  Clock,
  User,
  Building2,
  FileText,
  Activity,
  Layers,
} from "lucide-react";
import { ERPDataTable, ERPStatusPill, type ColumnDef } from "@/components/ui/erp-data-table";

export default function SystemAdminAuditLogsPage() {
  const t = useTranslations("systemAdminPages");
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [selectedIds, setSelectedIds] = useState<(string | number)[]>([]);

  const fetchAuditLogs = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/system-admin/audit-logs?limit=100", { credentials: "include" });
      const json = await res.json();
      if (json.success) {
        setLogs(json.data || []);
      } else {
        toast.error(t("loadAuditFailed"));
      }
    } catch {
      toast.error(t("networkError"));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  const filteredLogs = logs.filter((log: any) => {
    const matchSearch =
      !search ||
      log.userEmail?.toLowerCase().includes(search.toLowerCase()) ||
      log.entity?.toLowerCase().includes(search.toLowerCase()) ||
      log.tenantId?.toLowerCase().includes(search.toLowerCase());
    const matchAction = !actionFilter || log.action === actionFilter;
    return matchSearch && matchAction;
  });

  const columns: ColumnDef<any>[] = [
    {
      key: "createdAt",
      header: t("timestamp"),
      cell: (row) => (
        <span className="text-xs text-muted-foreground font-mono">
          {new Date(row.createdAt).toLocaleString()}
        </span>
      ),
    },
    {
      key: "action",
      header: t("action"),
      cell: (row) => {
        const variant =
          row.action === "DELETE"
            ? "amber"
            : row.action === "CREATE"
            ? "emerald"
            : "subtle";
        return <ERPStatusPill status={row.action} variant={variant} />;
      },
    },
    {
      key: "entity",
      header: t("entityId"),
      cell: (row) => (
        <div>
          <span className="text-xs font-bold text-foreground">{row.entity}</span>
          {row.entityId && (
            <p className="text-[10px] text-muted-foreground font-mono truncate max-w-[120px]">
              ID: {row.entityId}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "userEmail",
      header: t("executedBy"),
      cell: (row) => (
        <span className="text-xs font-medium text-foreground">{row.userEmail || "System"}</span>
      ),
    },
    {
      key: "tenantId",
      header: t("tenant"),
      cell: (row) => (
        <Badge variant="outline" className="text-[10px] font-mono">
          {row.tenantId}
        </Badge>
      ),
    },
    {
      key: "details",
      header: t("payloadDetails"),
      cell: (row) => (
        <code className="text-[11px] font-mono text-muted-foreground truncate max-w-[280px] block">
          {row.details ? JSON.stringify(row.details) : "—"}
        </code>
      ),
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title={t("auditTitle")}
        description={t("auditDescription")}
        icon={ShieldAlert}
      >
        <Button
          variant="outline"
          size="sm"
          onClick={fetchAuditLogs}
          className="text-xs gap-1.5 h-9"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} /> Refresh Stream
        </Button>
      </PageHeader>

      {/* KPI Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border border-border/80 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase">
                Total Events
              </span>
              <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                <Activity className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <h3 className="text-2xl font-extrabold text-foreground">{logs.length}</h3>
            <p className="text-[11px] text-muted-foreground">{t("storedRecords")}</p>
          </CardContent>
        </Card>

        <Card className="border border-border/80 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase">
                Deletions & Purges
              </span>
              <div className="p-1.5 rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-400">
                <ShieldAlert className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <h3 className="text-2xl font-extrabold text-foreground">
              {logs.filter((l) => l.action === "DELETE").length}
            </h3>
            <p className="text-[11px] text-muted-foreground">{t("highRiskActions")}</p>
          </CardContent>
        </Card>

        <Card className="border border-border/80 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase">
                Creation Mutations
              </span>
              <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                <ShieldCheck className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <h3 className="text-2xl font-extrabold text-foreground">
              {logs.filter((l) => l.action === "CREATE").length}
            </h3>
            <p className="text-[11px] text-muted-foreground">{t("newRecords")}</p>
          </CardContent>
        </Card>

        <Card className="border border-border/80 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase">
                Audit Integrity
              </span>
              <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                <ShieldCheck className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <h3 className="text-2xl font-extrabold text-foreground">{t("enforced")}</h3>
            <p className="text-[11px] text-muted-foreground">{t("tenantLogging")}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Card */}
      <Card className="border border-border/70 shadow-xs">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[240px]">
              <Input
                placeholder={t("auditSearch")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="h-9 px-3 rounded-md border border-input bg-background text-xs"
              >
                <option value="">{t("allActions")}</option>
                <option value="CREATE">CREATE</option>
                <option value="UPDATE">UPDATE</option>
                <option value="DELETE">DELETE</option>
                <option value="LOGIN">LOGIN</option>
              </select>

              {(search || actionFilter) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setActionFilter("");
                  }}
                  className="h-9 text-xs"
                >
                  Clear Filters
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Audit Log DataTable */}
      <ERPDataTable<any>
        title={t("auditTrail")}
        subtitle={t("showingEvents", { count: filteredLogs.length })}
        data={filteredLogs}
        columns={columns}
        keyExtractor={(row) => row.id}
        searchPlaceholder={t("filterAudit")}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
      />
    </div>
  );
}
