"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  FileSpreadsheet,
  GraduationCap,
  Users,
  Landmark,
  Calendar,
  Search,
  Printer,
  Download,
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

type StatementType = "STUDENT" | "STAFF" | "ACCOUNT";

export default function AccountingStatementsPage() {
  const t = useTranslations("accounting.statements");
  const [statementType, setStatementType] = useState<StatementType>("STUDENT");
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
    fetchStatement(statementType);
  }, [statementType]);

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

  const handleExportCSV = () => {
    if (!data?.statement?.entries || data.statement.entries.length === 0) {
      toast.error(t("noEntriesToExport"));
      return;
    }

    const headers = [t("csvDate"), t("csvRefId"), t("csvCategory"), t("csvDescription"), t("csvDebit"), t("csvCredit"), t("csvBalance"), t("csvStatus"), t("csvPaymentMethod")];
    const rows = data.statement.entries.map((e: any) => [
      new Date(e.date).toLocaleDateString(),
      `"${e.refId}"`,
      `"${e.category}"`,
      `"${e.description.replace(/"/g, '""')}"`,
      e.debit || 0,
      e.credit || 0,
      e.runningBalance || 0,
      e.status,
      e.paymentMethod,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r: any) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `statement_${statementType.toLowerCase()}_${selectedEntityId || "all"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(t("exportedCsv"));
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
          {new Date(row.date).toLocaleDateString()}
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
            onClick={handleExportCSV}
            className="text-xs h-9 gap-1.5 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            {t("exportCsv")}
          </Button>
          <Button
            onClick={handlePrint}
            className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 shadow-sm text-xs h-9 cursor-pointer"
          >
            <Printer className="h-3.5 w-3.5" />
            {t("printStatement")}
          </Button>
        </div>
      </div>

      {/* Statement Category Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-1.5 bg-muted/40 rounded-2xl border border-border">
        <button
          type="button"
          onClick={() => handleTypeChange("STUDENT")}
          className={`flex items-center justify-center gap-2.5 p-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            statementType === "STUDENT"
              ? "bg-card text-foreground shadow-xs ring-1 ring-border"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <GraduationCap className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          <span>{t("studentStatement")}</span>
        </button>

        <button
          type="button"
          onClick={() => handleTypeChange("STAFF")}
          className={`flex items-center justify-center gap-2.5 p-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            statementType === "STAFF"
              ? "bg-card text-foreground shadow-xs ring-1 ring-border"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Users className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          <span>{t("staffLedger")}</span>
        </button>

        <button
          type="button"
          onClick={() => handleTypeChange("ACCOUNT")}
          className={`flex items-center justify-center gap-2.5 p-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
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
                  <select
                    value={selectedEntityId}
                    onChange={(e) => handleEntityChange(e.target.value)}
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {options.students?.map((s: any) => (
                      <option key={s.id} value={s.id}>
                        {s.firstName} {s.lastName} (Roll #{s.rollNumber} • ID: {s.studentId})
                      </option>
                    ))}
                  </select>
                )}

                {statementType === "STAFF" && (
                  <select
                    value={selectedEntityId}
                    onChange={(e) => handleEntityChange(e.target.value)}
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {options.staffList?.map((s: any) => (
                      <option key={s.id} value={s.id}>
                        {s.firstName} {s.lastName} ({s.designation} • {s.department})
                      </option>
                    ))}
                  </select>
                )}

                {statementType === "ACCOUNT" && (
                  <select
                    value={selectedEntityId}
                    onChange={(e) => handleEntityChange(e.target.value)}
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {options.bankAccounts?.map((b: any) => (
                      <option key={b.id} value={b.id}>
                        {b.accountName} ({b.bankName} • Acc #{b.accountNumber})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Date Filters */}
              <div className="md:col-span-3 space-y-1.5">
                <Label htmlFor="start-date" className="text-xs font-semibold flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  {t("fromDate")}
                </Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-10 text-xs"
                />
              </div>

              <div className="md:col-span-3 space-y-1.5">
                <Label htmlFor="end-date" className="text-xs font-semibold flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  {t("toDate")}
                </Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-10 text-xs"
                />
              </div>

              <div className="md:col-span-1">
                <Button type="submit" className="w-full h-10 bg-indigo-600 hover:bg-indigo-700 text-white text-xs">
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
        <div className="p-4 rounded-2xl border border-border/80 bg-card flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-3.5">
            <div className="h-12 w-12 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-extrabold text-lg">
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
    </div>
  );
}
