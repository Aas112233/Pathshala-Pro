"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { AppDropdown } from "@/components/ui/app-dropdown";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TenantDateInput } from "@/components/ui/tenant-date-input";
import { Label } from "@/components/ui/label";
import { TopSheet } from "@/components/ui/top-sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  User,
  Clock,
  Loader2,
  Eye,
  Share2,
  Copy,
  MessageSquare,
} from "lucide-react";
import { ERPDataTable, ERPStatusPill, type ColumnDef } from "@/components/ui/erp-data-table";
import { useAuth } from "@/components/providers/auth-provider";
import { useTenantSettings } from "@/components/providers/tenant-settings-provider";
import { formatDateWithSettings } from "@/lib/tenant-settings";
import { useExcelExport } from "@/hooks/use-excel-export";
import { usePDFExport } from "@/hooks/use-pdf-export";
import type { ExcelColumn } from "@/lib/excel-exporter";
import { hasPermission, getEffectivePermissions } from "@/lib/permissions";
import { cn } from "@/lib/utils";

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
  const [selectedEntityId, setSelectedEntityId] = useState<string>("");
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<(string | number)[]>([]);
  const [selectedRowDetail, setSelectedRowDetail] = useState<any | null>(null);

  const fetchStatement = async (
    type: StatementType = statementType,
    entityId: string = selectedEntityId,
    start: string = startDate,
    end: string = endDate,
    academicYearId: string = selectedAcademicYearId
  ) => {
    setIsLoading(true);
    try {
      let url = `/api/accounting/statements?type=${type}`;
      if (entityId) url += `&entityId=${encodeURIComponent(entityId)}`;
      if (start) url += `&startDate=${encodeURIComponent(start)}`;
      if (end) url += `&endDate=${encodeURIComponent(end)}`;
      if (academicYearId) url += `&academicYearId=${encodeURIComponent(academicYearId)}`;

      const res = await fetch(url);
      const json = await res.json();
      if (json.success) {
        setData((prev: any) => ({
          ...json.data,
          options: json.data?.options || prev?.options || { students: [], staffList: [], bankAccounts: [], academicYears: [] },
        }));
      } else {
        toast.error(json.error?.message || t("loadFailed"));
      }
    } catch {
      toast.error(t("networkError"));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthLoading || !canReadAccounting) return;
    fetchStatement(statementType, "", startDate, endDate, selectedAcademicYearId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statementType, isAuthLoading, canReadAccounting]);

  const handleTypeChange = (type: StatementType) => {
    setStatementType(type);
    setSelectedEntityId("");
    setSelectedAcademicYearId("");
    setSelectedRowDetail(null);
    setData((prev: any) => ({
      ...prev,
      entity: null,
      statement: {
        openingBalance: 0,
        totalDebit: 0,
        totalCredit: 0,
        closingBalance: 0,
        entries: [],
      },
    }));
  };

  const handleEntityChange = (id: string) => {
    setSelectedEntityId(id);
    setSelectedRowDetail(null);
    setData((prev: any) => ({
      ...prev,
      entity: null,
      statement: {
        openingBalance: 0,
        totalDebit: 0,
        totalCredit: 0,
        closingBalance: 0,
        entries: [],
      },
    }));
  };

  const handleGenerateStatement = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedEntityId) {
      toast.error(t("selectEntityRequired"));
      return;
    }
    fetchStatement(statementType, selectedEntityId, startDate, endDate, selectedAcademicYearId);
  };

  const handleQuickDatePreset = (preset: "THIS_MONTH" | "LAST_MONTH" | "THIS_YEAR" | "ALL") => {
    let start = "";
    let end = "";
    const now = new Date();
    if (preset === "ALL") {
      start = "";
      end = "";
    } else if (preset === "THIS_MONTH") {
      start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
    } else if (preset === "LAST_MONTH") {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split("T")[0];
      end = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split("T")[0];
    } else if (preset === "THIS_YEAR") {
      start = new Date(now.getFullYear(), 0, 1).toISOString().split("T")[0];
      end = new Date(now.getFullYear(), 11, 31).toISOString().split("T")[0];
    }
    setStartDate(start);
    setEndDate(end);
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
  const options = data?.options || { students: [], staffList: [], bankAccounts: [], academicYears: [] };

  const generateSummaryText = () => {
    if (!entity) return "";
    const schoolName = settings.name || "Pathshala Pro School";
    const entityName =
      statementType === "ACCOUNT"
        ? entity.accountName
        : `${entity.firstName} ${entity.lastName}`;
    const period = startDate || endDate ? `${startDate || "Start"} → ${endDate || "End"}` : "All Records";
    const currency = settings.currency || "$";

    return (
      `*${schoolName} - Statement Summary*\n` +
      `Account: ${entityName}\n` +
      `Period: ${period}\n` +
      `Opening Balance: ${currency} ${statement.openingBalance.toLocaleString()}\n` +
      `Total Charges / Billed: ${currency} ${statement.totalDebit.toLocaleString()}\n` +
      `Total Paid / Received: ${currency} ${statement.totalCredit.toLocaleString()}\n` +
      `Closing Net Balance: ${currency} ${statement.closingBalance.toLocaleString()}`
    );
  };

  const handleCopySummary = async () => {
    const summary = generateSummaryText();
    if (!summary) return;
    try {
      await navigator.clipboard.writeText(summary);
      toast.success(t("summaryCopied"));
    } catch {
      toast.error("Failed to copy summary");
    }
  };

  const handleShareWhatsApp = () => {
    const summary = generateSummaryText();
    if (!summary) return;
    let phone = "";
    if (statementType === "STUDENT" && entity?.guardianContact) {
      phone = entity.guardianContact.replace(/[^0-9]/g, "");
    }
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(summary)}`
      : `https://wa.me/?text=${encodeURIComponent(summary)}`;
    window.open(url, "_blank");
  };

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
    {
      key: "actions",
      header: "",
      className: "w-10 text-right",
      cell: (row) => (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 cursor-pointer text-muted-foreground hover:text-foreground"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedRowDetail(row);
          }}
          title={t("transactionDetails")}
        >
          <Eye className="h-3.5 w-3.5" />
        </Button>
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
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-9 gap-1.5 cursor-pointer"
                disabled={!entity}
              >
                <Share2 className="h-3.5 w-3.5" />
                {t("shareStatement")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleCopySummary} className="cursor-pointer gap-2 text-xs">
                <Copy className="h-3.5 w-3.5" />
                {t("copySummary")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleShareWhatsApp} className="cursor-pointer gap-2 text-xs">
                <MessageSquare className="h-3.5 w-3.5" />
                {t("whatsappShare")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

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
              <form onSubmit={handleGenerateStatement} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                  {/* Entity Picker */}
                  <div className={cn(statementType === "ACCOUNT" ? "md:col-span-4" : "md:col-span-3", "space-y-1.5")}>
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
                        options={(options.students || []).map((s: any) => ({
                          value: s.id,
                          label: `${s.firstName} ${s.lastName} (Roll #${s.rollNumber} • ID: ${s.studentId})`,
                        }))}
                        placeholder={t("selectStudent")}
                        searchable
                      />
                    )}

                    {statementType === "STAFF" && (
                      <AppDropdown
                        value={selectedEntityId}
                        onChange={handleEntityChange}
                        options={(options.staffList || []).map((s: any) => ({
                          value: s.id,
                          label: `${s.firstName} ${s.lastName} (${s.designation} • ${s.department})`,
                        }))}
                        placeholder={t("selectStaff")}
                        searchable
                      />
                    )}

                    {statementType === "ACCOUNT" && (
                      <AppDropdown
                        value={selectedEntityId}
                        onChange={handleEntityChange}
                        options={(options.bankAccounts || []).map((b: any) => ({
                          value: b.id,
                          label: `${b.accountName} (${b.bankName} • Acc #${b.accountNumber})`,
                        }))}
                        placeholder={t("selectAccount")}
                        searchable
                      />
                    )}
                  </div>

                  {/* Academic Year Filter (Students & Staff) */}
                  {statementType !== "ACCOUNT" && (
                    <div className="md:col-span-3 space-y-1.5">
                      <Label className="text-xs font-semibold flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        {t("academicYear")}
                      </Label>
                      <AppDropdown
                        value={selectedAcademicYearId}
                        onChange={setSelectedAcademicYearId}
                        options={[
                          { value: "", label: t("allAcademicYears") },
                          ...(options.academicYears || []).map((ay: any) => ({
                            value: ay.id,
                            label: ay.label,
                          })),
                        ]}
                        placeholder={t("allAcademicYears")}
                        searchable
                      />
                    </div>
                  )}

                  {/* Date Filters */}
                  <div className={cn(statementType === "ACCOUNT" ? "md:col-span-3" : "md:col-span-2", "space-y-1.5")}>
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

                  <div className={cn(statementType === "ACCOUNT" ? "md:col-span-3" : "md:col-span-2", "space-y-1.5")}>
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

                  <div className="md:col-span-2">
                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="w-full h-10 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold gap-1.5 shadow-xs cursor-pointer"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>{t("generating")}</span>
                        </>
                      ) : (
                        <>
                          <Search className="h-3.5 w-3.5" />
                          <span>{t("generateStatement")}</span>
                        </>
                      )}
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

          {/* Aging Analysis Ribbon (Students) */}
          {statementType === "STUDENT" && statement.aging && (
            <Card className="border border-border/80 shadow-xs bg-muted/20">
              <CardHeader className="p-4 pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      {t("agingAnalysis")}
                    </CardTitle>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs font-mono font-bold",
                      statement.aging.totalOverdue > 0
                        ? "text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40"
                        : "text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40"
                    )}
                  >
                    {t("totalOverdue")}: {statement.aging.totalOverdue.toLocaleString()}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-1">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg border border-border bg-card">
                    <span className="text-[11px] font-semibold text-muted-foreground block">
                      {t("agingCurrent")}
                    </span>
                    <span className="text-base font-extrabold font-mono text-foreground">
                      {statement.aging.current.toLocaleString()}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg border border-border bg-card">
                    <span className="text-[11px] font-semibold text-muted-foreground block">
                      {t("aging30Days")}
                    </span>
                    <span
                      className={cn(
                        "text-base font-extrabold font-mono",
                        statement.aging.days30 > 0 ? "text-amber-600 dark:text-amber-400" : "text-foreground"
                      )}
                    >
                      {statement.aging.days30.toLocaleString()}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg border border-border bg-card">
                    <span className="text-[11px] font-semibold text-muted-foreground block">
                      {t("aging60Days")}
                    </span>
                    <span
                      className={cn(
                        "text-base font-extrabold font-mono",
                        statement.aging.days60 > 0 ? "text-orange-600 dark:text-orange-400" : "text-foreground"
                      )}
                    >
                      {statement.aging.days60.toLocaleString()}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg border border-border bg-card">
                    <span className="text-[11px] font-semibold text-muted-foreground block">
                      {t("aging90Plus")}
                    </span>
                    <span
                      className={cn(
                        "text-base font-extrabold font-mono",
                        statement.aging.days90Plus > 0 ? "text-rose-600 dark:text-rose-400" : "text-foreground"
                      )}
                    >
                      {statement.aging.days90Plus.toLocaleString()}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
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
            onRowClick={(row) => setSelectedRowDetail(row)}
          />

          {/* Drill-Down Details TopSheet */}
          <TopSheet
            isOpen={!!selectedRowDetail}
            onClose={() => setSelectedRowDetail(null)}
            title={t("transactionDetails")}
            subtitle={selectedRowDetail ? `${selectedRowDetail.refId} • ${selectedRowDetail.description}` : ""}
            maxWidth="2xl"
            footer={
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedRowDetail(null)}
                >
                  {t("close")}
                </Button>
              </div>
            }
          >
            {selectedRowDetail && (
              <div className="space-y-5">
                {/* Header Information Card */}
                <div className="flex items-center justify-between p-3.5 rounded-lg border border-border bg-muted/30">
                  <div>
                    <span className="text-[11px] text-muted-foreground uppercase font-mono">{t("refHeader")}</span>
                    <p className="text-sm font-bold font-mono text-foreground">{selectedRowDetail.refId}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] text-muted-foreground uppercase font-mono">{t("dateHeader")}</span>
                    <p className="text-xs font-mono text-foreground">
                      {formatDateWithSettings(selectedRowDetail.date, settings)}
                    </p>
                  </div>
                </div>

                {/* Categorized Drill-Down Breakdown */}
                {selectedRowDetail.category === "FEE_BILLING" && selectedRowDetail.details && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-foreground uppercase tracking-wide">
                      {t("voucherDetails")}
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-3 rounded-lg border border-border">
                        <span className="text-muted-foreground block text-[11px]">{t("billingPeriod")}</span>
                        <span className="font-semibold">
                          {selectedRowDetail.details.billingMonth
                            ? `${selectedRowDetail.details.billingMonth}/${selectedRowDetail.details.billingYear}`
                            : "—"}
                        </span>
                      </div>
                      <div className="p-3 rounded-lg border border-border">
                        <span className="text-muted-foreground block text-[11px]">{t("academicYear")}</span>
                        <span className="font-semibold">{selectedRowDetail.details.academicYear || "—"}</span>
                      </div>
                      <div className="p-3 rounded-lg border border-border">
                        <span className="text-muted-foreground block text-[11px]">{t("dueDate")}</span>
                        <span className="font-semibold">
                          {selectedRowDetail.details.dueDate
                            ? formatDateWithSettings(selectedRowDetail.details.dueDate, settings)
                            : "—"}
                        </span>
                      </div>
                      <div className="p-3 rounded-lg border border-border">
                        <span className="text-muted-foreground block text-[11px]">{t("statusHeader")}</span>
                        <Badge variant="outline" className="text-[10px] mt-0.5">
                          {selectedRowDetail.details.status}
                        </Badge>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg border border-border bg-card space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t("baseAmount")}</span>
                        <span className="font-mono">{selectedRowDetail.details.baseAmount?.toLocaleString()}</span>
                      </div>
                      {selectedRowDetail.details.discount > 0 && (
                        <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                          <span>{t("discountAmount")}</span>
                          <span className="font-mono">-{selectedRowDetail.details.discount?.toLocaleString()}</span>
                        </div>
                      )}
                      {selectedRowDetail.details.arrears > 0 && (
                        <div className="flex justify-between text-rose-600 dark:text-rose-400">
                          <span>{t("arrears")}</span>
                          <span className="font-mono">+{selectedRowDetail.details.arrears?.toLocaleString()}</span>
                        </div>
                      )}
                      <div className="border-t border-border pt-2 flex justify-between font-bold text-sm">
                        <span>{t("totalBilled")}</span>
                        <span className="font-mono text-rose-600 dark:text-rose-400">
                          +{selectedRowDetail.details.totalDue?.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {selectedRowDetail.category === "FEE_PAYMENT" && selectedRowDetail.details && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-foreground uppercase tracking-wide">
                      {t("receiptDetails")}
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-3 rounded-lg border border-border">
                        <span className="text-muted-foreground block text-[11px]">{t("methodHeader")}</span>
                        <span className="font-semibold uppercase">{selectedRowDetail.details.paymentMethod}</span>
                      </div>
                      <div className="p-3 rounded-lg border border-border">
                        <span className="text-muted-foreground block text-[11px]">{t("collectedBy")}</span>
                        <span className="font-semibold">{selectedRowDetail.details.collectedBy || "—"}</span>
                      </div>
                      <div className="p-3 rounded-lg border border-border">
                        <span className="text-muted-foreground block text-[11px]">{t("paymentReference")}</span>
                        <span className="font-mono">
                          {selectedRowDetail.details.chequeNumber || selectedRowDetail.details.reference || "—"}
                        </span>
                      </div>
                      <div className="p-3 rounded-lg border border-border">
                        <span className="text-muted-foreground block text-[11px]">{t("refHeader")}</span>
                        <span className="font-mono">{selectedRowDetail.details.voucherId || "—"}</span>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg border border-border bg-emerald-50/50 dark:bg-emerald-950/20 flex justify-between items-center text-sm font-bold">
                      <span className="text-emerald-700 dark:text-emerald-300">{t("totalCollected")}</span>
                      <span className="font-mono text-emerald-600 dark:text-emerald-400 text-lg">
                        -{selectedRowDetail.details.amountPaid?.toLocaleString()}
                      </span>
                    </div>
                    {selectedRowDetail.details.note && (
                      <p className="text-xs text-muted-foreground italic px-1">
                        Note: {selectedRowDetail.details.note}
                      </p>
                    )}
                  </div>
                )}

                {selectedRowDetail.category === "SALARY_ACCRUAL" && selectedRowDetail.details && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-foreground uppercase tracking-wide">
                      {t("salaryDetails")}
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-3 rounded-lg border border-border">
                        <span className="text-muted-foreground block text-[11px]">{t("billingPeriod")}</span>
                        <span className="font-semibold">
                          {selectedRowDetail.details.monthLabel} {selectedRowDetail.details.year}
                        </span>
                      </div>
                      <div className="p-3 rounded-lg border border-border">
                        <span className="text-muted-foreground block text-[11px]">{t("academicYear")}</span>
                        <span className="font-semibold">{selectedRowDetail.details.academicYear || "—"}</span>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg border border-border bg-card space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t("baseSalary")}</span>
                        <span className="font-mono">{selectedRowDetail.details.baseSalary?.toLocaleString()}</span>
                      </div>
                      {selectedRowDetail.details.deductions &&
                        Object.entries(selectedRowDetail.details.deductions).map(([k, v]) => (
                          <div key={k} className="flex justify-between text-muted-foreground">
                            <span className="capitalize">{k}</span>
                            <span className="font-mono">-{Number(v).toLocaleString()}</span>
                          </div>
                        ))}
                      <div className="border-t border-border pt-2 flex justify-between font-bold text-sm">
                        <span>{t("totalDisbursed")}</span>
                        <span className="font-mono text-emerald-600 dark:text-emerald-400">
                          {selectedRowDetail.details.netPayable?.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {selectedRowDetail.category === "SALARY_DISBURSEMENT" && selectedRowDetail.details && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-foreground uppercase tracking-wide">
                      {t("salaryDetails")}
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-3 rounded-lg border border-border">
                        <span className="text-muted-foreground block text-[11px]">{t("billingPeriod")}</span>
                        <span className="font-semibold">{selectedRowDetail.details.monthLabel}</span>
                      </div>
                      <div className="p-3 rounded-lg border border-border">
                        <span className="text-muted-foreground block text-[11px]">{t("methodHeader")}</span>
                        <span className="font-semibold">{selectedRowDetail.details.paymentMethod}</span>
                      </div>
                    </div>
                    <div className="p-3 rounded-lg border border-border bg-rose-50/50 dark:bg-rose-950/20 flex justify-between items-center text-sm font-bold">
                      <span className="text-rose-700 dark:text-rose-300">{t("totalDisbursed")}</span>
                      <span className="font-mono text-rose-600 dark:text-rose-400 text-lg">
                        {selectedRowDetail.details.paidAmount?.toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}

                {selectedRowDetail.category !== "FEE_BILLING" &&
                  selectedRowDetail.category !== "FEE_PAYMENT" &&
                  selectedRowDetail.category !== "SALARY_ACCRUAL" &&
                  selectedRowDetail.category !== "SALARY_DISBURSEMENT" && (
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold text-foreground uppercase tracking-wide">
                        {t("journalDetails")}
                      </h4>
                      <div className="p-3 rounded-lg border border-border bg-card space-y-2 text-xs">
                        <p className="text-sm font-medium text-foreground">{selectedRowDetail.description}</p>
                        <div className="flex justify-between pt-2">
                          <span className="text-muted-foreground">{t("debitHeader")}</span>
                          <span className="font-mono font-bold">
                            {selectedRowDetail.debit > 0 ? `+${selectedRowDetail.debit.toLocaleString()}` : "0"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{t("creditHeader")}</span>
                          <span className="font-mono font-bold">
                            {selectedRowDetail.credit > 0 ? `-${selectedRowDetail.credit.toLocaleString()}` : "0"}
                          </span>
                        </div>
                        <div className="border-t border-border pt-2 flex justify-between font-extrabold text-sm">
                          <span>{t("balanceHeader")}</span>
                          <span className="font-mono">{selectedRowDetail.runningBalance?.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  )}
              </div>
            )}
          </TopSheet>
        </>
      )}
    </div>
  );
}
