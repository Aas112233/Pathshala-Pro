"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { AppDropdown } from "@/components/ui/app-dropdown";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { TenantDateInput } from "@/components/ui/tenant-date-input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  FileSpreadsheet,
  FileText,
  GraduationCap,
  Users,
  Landmark,
  Calendar,
  Search,
  Printer,
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  Building2,
  Phone,
  Mail,
  User,
  CheckCircle2,
  Clock,
  Filter,
} from "lucide-react";
import { ERPDataTable, ERPStatusPill, type ColumnDef } from "@/components/ui/erp-data-table";
import { useAuth } from "@/components/providers/auth-provider";
import { useTenantSettings } from "@/components/providers/tenant-settings-provider";
import { formatDateWithSettings } from "@/lib/tenant-settings";
import { useExcelExport } from "@/hooks/use-excel-export";
import { usePDFExport } from "@/hooks/use-pdf-export";
import type { ExcelColumn } from "@/lib/excel-exporter";
import { hasPermission, getEffectivePermissions } from "@/lib/permissions";

type StatementType = "STUDENT" | "STAFF" | "ACCOUNT";

export default function AccountingStatementsPage() {
  const t = useTranslations("accounting.statements");
  const common = useTranslations("common");
  const { settings } = useTenantSettings();
  const [statementType, setStatementType] = useState<StatementType>("STUDENT");
  const { exportData } = useExcelExport({
    fileName: `statement_${statementType.toLowerCase()}`,
    schoolName: settings.name || "Pathshala Pro School",
    schoolAddress: settings.address,
    schoolPhone: settings.phone,
    schoolEmail: settings.email,
  });
  const { exportStatementPDF } = usePDFExport();
  const { user: authUser, isLoading: isAuthLoading } = useAuth();
  const perms = getEffectivePermissions(authUser?.role as string, (authUser as any)?.permissions, (authUser as any)?.accessLevel);
  const canReadAccounting = hasPermission(perms, "accounting", "read");
  const canWriteAccounting = hasPermission(perms, "accounting", "write");
  const canManageAccounting = hasPermission(perms, "accounting", "manage");
  const [selectedEntityId, setSelectedEntityId] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<(string | number)[]>([]);

  const fetchStatement = async (type: StatementType, entityId?: string) => {
    setIsLoading(true);
    try {
      let url = `/api/accounting/statements?type=${type}`;
      if (entityId) url += `&entityId=${entityId}`;
      if (startDate) url += `&startDate=${startDate}`;
      if (endDate) url += `&endDate=${endDate}`;

      const res = await fetch(url);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        if (!entityId && json.data?.entity?.id) {
          setSelectedEntityId(json.data.entity.id);
        }
      } else {
        toast.error(t("loadFailed"));
      }
    } catch {
      toast.error(t("networkError"));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Don't fire a doomed request: the API returns 403 without accounting:read,
    // and the page renders the access-restricted gate instead.
    if (isAuthLoading || !canReadAccounting) return;
    fetchStatement(statementType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statementType, isAuthLoading, canReadAccounting]);

  const handleTypeChange = (type: StatementType) => {
    setStatementType(type);
    setSelectedEntityId("");
    fetchStatement(type, "");
  };

  const handleEntityChange = (id: string) => {
    setSelectedEntityId(id);
    fetchStatement(statementType, id);
  };

  const handleApplyFilter = (e: React.FormEvent) => {
    e.preventDefault();
    fetchStatement(statementType, selectedEntityId);
  };

  const handleQuickDatePreset = (preset: "THIS_MONTH" | "LAST_MONTH" | "THIS_YEAR" | "ALL") => {
    const now = new Date();
    if (preset === "ALL") {
      setStartDate("");
      setEndDate("");
    } else if (preset === "THIS_MONTH") {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
      setStartDate(firstDay);
      setEndDate(lastDay);
    } else if (preset === "LAST_MONTH") {
      const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split("T")[0];
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split("T")[0];
      setStartDate(firstDay);
      setEndDate(lastDay);
    } else if (preset === "THIS_YEAR") {
      const firstDay = new Date(now.getFullYear(), 0, 1).toISOString().split("T")[0];
      const lastDay = new Date(now.getFullYear(), 11, 31).toISOString().split("T")[0];
      setStartDate(firstDay);
      setEndDate(lastDay);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = async () => {
    if (!data?.statement?.entries || data.statement.entries.length === 0) {
      toast.error(t("noEntriesToExport"));
      return;
    }

    const columns: ExcelColumn[] = [
      { header: t("csvDate"), key: "date", style: "date" },
      { header: t("csvRefId"), key: "refId" },
      { header: t("csvCategory"), key: "category" },
      { header: t("csvDescription"), key: "description" },
      { header: t("csvDebit"), key: "debit", style: "currency" },
      { header: t("csvCredit"), key: "credit", style: "currency" },
      { header: t("csvBalance"), key: "runningBalance", style: "currency" },
      { header: t("csvStatus"), key: "status" },
      { header: t("csvPaymentMethod"), key: "paymentMethod" },
    ];
    const rows = data.statement.entries.map((e: any) => ({
      date: new Date(e.date),
      refId: e.refId,
      category: e.category,
      description: e.description,
      debit: e.debit || 0,
      credit: e.credit || 0,
      runningBalance: e.runningBalance || 0,
      status: e.status,
      paymentMethod: e.paymentMethod,
    }));

    const result = await exportData({ title: t("title"), columns, data: rows });
    if (result.success) {
      toast.success(t("exportedExcel"));
    } else {
      toast.error(
        result.error instanceof Error ? result.error.message : String(result.error)
      );
    }
  };

  const handleExportPDF = async () => {
    const entries = data?.statement?.entries || [];
    if (entries.length === 0) {
      toast.error(t("noEntriesToExport"));
      return;
    }

    const entityInfo = data?.entity;
    const stmt = data?.statement || {
      openingBalance: 0,
      totalDebit: 0,
      totalCredit: 0,
      closingBalance: 0,
    };
    const entityLabel =
      statementType === "ACCOUNT"
        ? entityInfo?.accountName || t("accountLedger")
        : entityInfo
        ? `${entityInfo.firstName} ${entityInfo.lastName}`
        : "";
    const fmt = (value: number) => Number(value || 0).toLocaleString();

    const result = await exportStatementPDF({
      school: {
        name: settings.name || "Pathshala Pro School",
        address: settings.address || "",
        phone: settings.phone || "",
        email: settings.email || "",
        logoUrl: settings.logoUrl,
      },
      title: t("title"),
      subtitle: entityLabel,
      generatedAt: new Date().toLocaleString(),
      dateRangeLabel: `${startDate || "—"} → ${endDate || "—"}`,
      filters: [
        { label: t("title"), value: entityLabel },
        { label: t("fromDate"), value: startDate || "—" },
        { label: t("toDate"), value: endDate || "—" },
      ],
      metrics: [
        { label: t("openingBalance"), value: fmt(stmt.openingBalance) },
        { label: t("debitHeader"), value: fmt(stmt.totalDebit), tone: "danger" },
        { label: t("creditHeader"), value: fmt(stmt.totalCredit), tone: "success" },
        { label: t("closingBalance"), value: fmt(stmt.closingBalance) },
      ],
      records: entries.map((entry: any) => ({
        date: formatDateWithSettings(entry.date, settings),
        refId: entry.refId,
        description: entry.description,
        debit: fmt(entry.debit),
        credit: fmt(entry.credit),
        balance: fmt(entry.runningBalance),
      })),
    });

    if (result.success) {
      toast.success(t("exportedPDF"));
      return;
    }
    toast.error(t("exportFailed"));
  };

  const entity = data?.entity;
  const statement = data?.statement || {
    openingBalance: 0,
    totalDebit: 0,
    totalCredit: 0,
    closingBalance: 0,
    entries: [],
  };
  const options = data?.options || { students: [], staffList: [], bankAccounts: [] };

  const columns: ColumnDef<any>[] = [
    {
      key: "date",
      header: t("dateHeader"),
      cell: (row) => (
        <span className="text-xs font-mono text-muted-foreground whitespace-nowrap">
          {formatDateWithSettings(row.date, settings)}
        </span>
      ),
    },
    {
      key: "refId",
      header: t("refHeader"),
      cell: (row) => (
        <Badge variant="outline" className="text-[10px] font-mono whitespace-nowrap">
          {row.refId}
        </Badge>
      ),
    },
    {
      key: "description",
      header: t("descriptionHeader"),
      cell: (row) => (
        <div>
          <p className="text-xs font-semibold text-foreground">{row.description}</p>
          <span className="text-[10px] text-muted-foreground uppercase font-mono">{row.category}</span>
        </div>
      ),
    },
    {
      key: "debit",
      header: t("debitHeader"),
      cell: (row) => (
        <span className={`text-xs font-bold font-mono ${row.debit > 0 ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground"}`}>
          {row.debit > 0 ? `+${row.debit.toLocaleString()}` : "-"}
        </span>
      ),
    },
    {
      key: "credit",
      header: t("creditHeader"),
      cell: (row) => (
        <span className={`text-xs font-bold font-mono ${row.credit > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
          {row.credit > 0 ? `-${row.credit.toLocaleString()}` : "-"}
        </span>
      ),
    },
    {
      key: "runningBalance",
      header: t("balanceHeader"),
      cell: (row) => (
        <span className={`text-xs font-extrabold font-mono ${row.runningBalance > 0 ? "text-foreground" : "text-emerald-600 dark:text-emerald-400"}`}>
          {row.runningBalance.toLocaleString()}
        </span>
      ),
    },
    {
      key: "status",
      header: t("statusHeader"),
      cell: (row) => {
        const variant =
          row.status === "PAID" || row.status === "CLEARED"
            ? "emerald"
            : row.status === "PARTIAL"
            ? "amber"
            : "rose";
        return <ERPStatusPill status={row.status} variant={variant} />;
      },
    },
    {
      key: "paymentMethod",
      header: t("methodHeader"),
      cell: (row) => (
        <span className="text-[11px] text-muted-foreground font-mono uppercase">
          {row.paymentMethod}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader
          title={t("title")}
          description={t("description")}
          icon={FileSpreadsheet}
        />
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            className="text-xs h-9 gap-1.5 cursor-pointer"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            {t("exportExcel")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPDF}
            className="text-xs h-9 gap-1.5 cursor-pointer"
          >
            <FileText className="h-3.5 w-3.5" />
            {t("exportPdf")}
          </Button>
          <Button
            onClick={handlePrint}
            className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 text-xs h-9 cursor-pointer"
          >
            <Printer className="h-3.5 w-3.5" />
            {t("printStatement")}
          </Button>
        </div>
      </div>

      {!isAuthLoading && !canReadAccounting ? (
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground">{common("accessRestricted")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{common("noPermission")}</p>
        </div>
      ) : (
        <>

      {/* Statement Category Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-1 bg-muted/40 rounded-lg border border-border">
        <button
          type="button"
          onClick={() => handleTypeChange("STUDENT")}
          className={`flex items-center justify-center gap-2.5 p-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            statementType === "STUDENT"
              ? "bg-card text-foreground shadow-xs ring-1 ring-border"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <GraduationCap className="h-4 w-4 text-primary" />
          <span>{t("studentStatement")}</span>
        </button>

        <button
          type="button"
          onClick={() => handleTypeChange("STAFF")}
          className={`flex items-center justify-center gap-2.5 p-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            statementType === "STAFF"
              ? "bg-card text-foreground shadow-xs ring-1 ring-border"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Users className="h-4 w-4 text-primary" />
          <span>{t("staffLedger")}</span>
        </button>

        <button
          type="button"
          onClick={() => handleTypeChange("ACCOUNT")}
          className={`flex items-center justify-center gap-2.5 p-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            statementType === "ACCOUNT"
              ? "bg-card text-foreground shadow-xs ring-1 ring-border"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Landmark className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <span>{t("accountLedger")}</span>
        </button>
      </div>

      {/* Filter & Entity Selection Bar */}
      <Card className="border border-border/80 shadow-xs">
        <CardContent className="p-4">
          <form onSubmit={handleApplyFilter} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
              {/* Entity Picker */}
              <div className="md:col-span-5 space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  {statementType === "STUDENT"
                    ? t("selectStudent")
                    : statementType === "STAFF"
                    ? t("selectStaff")
                    : t("selectAccount")}
                </Label>

                {statementType === "STUDENT" && (
                  <AppDropdown
                    value={selectedEntityId}
                    onChange={handleEntityChange}
                    options={(options.students || []).map((s: any) => ({ value: s.id, label: `${s.firstName} ${s.lastName} (Roll #${s.rollNumber} • ID: ${s.studentId})` }))}
                    searchable
                  />
                )}

                {statementType === "STAFF" && (
                  <AppDropdown
                    value={selectedEntityId}
                    onChange={handleEntityChange}
                    options={(options.staffList || []).map((s: any) => ({ value: s.id, label: `${s.firstName} ${s.lastName} (${s.designation} • ${s.department})` }))}
                    searchable
                  />
                )}

                {statementType === "ACCOUNT" && (
                  <AppDropdown
                    value={selectedEntityId}
                    onChange={handleEntityChange}
                    options={(options.bankAccounts || []).map((b: any) => ({ value: b.id, label: `${b.accountName} (${b.bankName} • Acc #${b.accountNumber})` }))}
                    searchable
                  />
                )}
              </div>

              {/* Date Filters */}
              <div className="md:col-span-3 space-y-1.5">
                <Label htmlFor="start-date" className="text-xs font-semibold flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  {t("fromDate")}
                </Label>
                <TenantDateInput
                  id="start-date"
                  value={startDate}
                  onChange={setStartDate}
                  className="h-10 text-xs"
                />
              </div>

              <div className="md:col-span-3 space-y-1.5">
                <Label htmlFor="end-date" className="text-xs font-semibold flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  {t("toDate")}
                </Label>
                <TenantDateInput
                  id="end-date"
                  value={endDate}
                  onChange={setEndDate}
                  className="h-10 text-xs"
                />
              </div>

              <div className="md:col-span-1">
                <Button type="submit" className="w-full h-10 bg-primary hover:bg-primary/90 text-primary-foreground text-xs">
                  <Filter className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Quick Presets */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[11px] font-semibold text-muted-foreground">{t("quickFilters")}</span>
              {[
                { label: t("thisMonth"), value: "THIS_MONTH" as const },
                { label: t("lastMonth"), value: "LAST_MONTH" as const },
                { label: t("thisYear"), value: "THIS_YEAR" as const },
                { label: t("allRecords"), value: "ALL" as const },
              ].map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => {
                    handleQuickDatePreset(p.value);
                  }}
                  className="px-2.5 py-1 rounded-lg border border-border text-[11px] font-semibold bg-muted/30 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Entity Profile Ribbon */}
      {entity && (
        <div className="p-4 rounded-lg border border-border/80 bg-card flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="h-12 w-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-semibold text-lg">
              {statementType === "STUDENT" && <GraduationCap className="h-6 w-6" />}
              {statementType === "STAFF" && <Users className="h-6 w-6" />}
              {statementType === "ACCOUNT" && <Landmark className="h-6 w-6" />}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-foreground">
                  {statementType === "ACCOUNT" ? entity.accountName : `${entity.firstName} ${entity.lastName}`}
                </h3>
                <Badge variant="outline" className="text-[10px] uppercase font-mono">
                  {statementType === "STUDENT"
                    ? `Roll #${entity.rollNumber}`
                    : statementType === "STAFF"
                    ? entity.designation
                    : entity.accountType}
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1">
                {statementType === "STUDENT" && (
                  <>
                    <span>{t("studentId")}: <strong className="text-foreground font-mono">{entity.studentId}</strong></span>
                    {entity.guardianName && <span>{t("guardian")}: <strong className="text-foreground">{entity.guardianName}</strong></span>}
                    {entity.guardianContact && <span>{t("contact")}: <strong className="text-foreground font-mono">{entity.guardianContact}</strong></span>}
                  </>
                )}

                {statementType === "STAFF" && (
                  <>
                    <span>{t("staffId")}: <strong className="text-foreground font-mono">{entity.staffId}</strong></span>
                    <span>{t("department")}: <strong className="text-foreground">{entity.department}</strong></span>
                    <span>{t("baseSalary")}: <strong className="text-foreground font-mono">{entity.baseSalary?.toLocaleString()}</strong></span>
                  </>
                )}

                {statementType === "ACCOUNT" && (
                  <>
                    <span>{t("bank")}: <strong className="text-foreground">{entity.bankName}</strong></span>
                    <span>{t("accountNumber")}: <strong className="text-foreground font-mono">{entity.accountNumber}</strong></span>
                    <span>{t("currency")}: <strong className="text-foreground font-mono">{entity.currency}</strong></span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="text-right border-t md:border-t-0 pt-3 md:pt-0 border-border">
            <span className="text-xs text-muted-foreground font-semibold uppercase">{t("netRunningBalance")}</span>
            <h4 className={`text-2xl font-extrabold font-mono ${statement.closingBalance > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
              {statement.closingBalance.toLocaleString()}
            </h4>
          </div>
        </div>
      )}

      {/* KPI Financial Metric Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border border-border/80 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase">
              {t("openingBalance")}
            </span>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <h3 className="text-2xl font-extrabold text-foreground font-mono">
              {statement.openingBalance.toLocaleString()}
            </h3>
            <p className="text-[11px] text-muted-foreground">{t("openingDescription")}</p>
          </CardContent>
        </Card>

        <Card className="border border-border/80 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase">
                {statementType === "STUDENT" ? t("totalBilled") : statementType === "STAFF" ? t("totalDisbursed") : t("totalDeposits")}
              </span>
              <div className="p-1 rounded-md bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-400">
                <ArrowUpRight className="h-3.5 w-3.5" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <h3 className="text-2xl font-extrabold text-rose-600 dark:text-rose-400 font-mono">
              +{statement.totalDebit.toLocaleString()}
            </h3>
            <p className="text-[11px] text-muted-foreground">{t("debitDescription")}</p>
          </CardContent>
        </Card>

        <Card className="border border-border/80 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase">
                {statementType === "STUDENT" ? t("totalCollected") : statementType === "STAFF" ? t("salaryAccrued") : t("totalOutflow")}
              </span>
              <div className="p-1 rounded-md bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                <ArrowDownLeft className="h-3.5 w-3.5" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <h3 className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
              -{statement.totalCredit.toLocaleString()}
            </h3>
            <p className="text-[11px] text-muted-foreground">{t("creditDescription")}</p>
          </CardContent>
        </Card>

        <Card className="border border-border/80 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase">
              {t("closingBalance")}
            </span>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <h3 className="text-2xl font-extrabold text-foreground font-mono">
              {statement.closingBalance.toLocaleString()}
            </h3>
            <p className="text-[11px] text-muted-foreground">{t("closingDescription")}</p>
          </CardContent>
        </Card>
      </div>

      {/* Ledger Table */}
      <ERPDataTable<any>
        title={t("ledgerTitle")}
        subtitle={t("showingTransactions", { count: statement.entries?.length || 0 })}
        data={statement.entries || []}
        columns={columns}
        keyExtractor={(row) => row.id}
        searchPlaceholder={t("filterPlaceholder")}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
      />
        </>
      )}
    </div>
  );
}
