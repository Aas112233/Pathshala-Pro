"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { Wallet, Users, CheckCircle2, Clock, DollarSign, Building2 } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  BarChart,
  ExportDropdown,
  PieChart,
  ReportEmptyState,
  ReportMetricCard,
  ReportPageShell,
  ReportSummaryBar,
  ReportTable,
} from "@/components/reports";
import { PageHeader } from "@/components/shared/page-header";
import { useTenantFormatting, useTenantSettings } from "@/components/providers/tenant-settings-provider";
import { useExcelExport } from "@/hooks/use-excel-export";
import { api } from "@/lib/api-client";
import type { ApiSuccessResponse } from "@/types/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AppDropdown } from "@/components/ui/app-dropdown";

interface SalaryRecord {
  id: string;
  staffId: string;
  staffName: string;
  department: string;
  designation: string;
  month: number;
  year: number;
  period: string;
  baseSalary: number;
  deductions: number;
  netPayable: number;
  paidAmount: number;
  pendingAmount: number;
  status: string;
  paidAt: string | null;
}

interface SalaryReportData {
  metrics: {
    totalGross: number;
    totalPaid: number;
    totalPending: number;
    totalDeductions: number;
    disbursementRate: number;
    staffCount: number;
  };
  departmentBreakdown: Array<{
    department: string;
    amount: number;
    staffCount: number;
  }>;
  records: SalaryRecord[];
}

export default function SalaryReportPage() {
  const t = useTranslations("reports.salaryReport");
  const { settings } = useTenantSettings();
  const { formatCurrency, formatDateTime } = useTenantFormatting();

  const { exportSalaryReport } = useExcelExport({
    fileName: "salary_payroll_report",
    schoolName: settings.name || "Pathshala Pro School",
    schoolAddress: settings.address,
    schoolPhone: settings.phone,
    schoolEmail: settings.email,
  });

  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedDept, setSelectedDept] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");

  const [isLoading, setIsLoading] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [generatedAt, setGeneratedAt] = useState("");
  const [data, setData] = useState<SalaryRecord[]>([]);
  const [metrics, setMetrics] = useState<SalaryReportData["metrics"] | null>(null);
  const [departmentBreakdown, setDepartmentBreakdown] = useState<
    SalaryReportData["departmentBreakdown"]
  >([]);

  const handleGenerateReport = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedYear && selectedYear !== "all") params.set("year", selectedYear);
      if (selectedMonth && selectedMonth !== "all") params.set("month", selectedMonth);
      if (selectedDept && selectedDept !== "all") params.set("department", selectedDept);
      if (selectedStatus && selectedStatus !== "all") params.set("status", selectedStatus);

      const response = await api.get<SalaryReportData>(`/api/reports/salary?${params.toString()}`);
      const reportData = (response as ApiSuccessResponse<SalaryReportData>).data;

      setData(reportData.records || []);
      setMetrics(reportData.metrics || null);
      setDepartmentBreakdown(reportData.departmentBreakdown || []);
      setHasGenerated(true);
      setGeneratedAt(formatDateTime(new Date()));
    } catch (error) {
      console.error("Failed to generate salary report:", error);
      toast.error(t("generateFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setSelectedYear(new Date().getFullYear().toString());
    setSelectedMonth("all");
    setSelectedDept("all");
    setSelectedStatus("all");
    setData([]);
    setMetrics(null);
    setDepartmentBreakdown([]);
    setHasGenerated(false);
    setGeneratedAt("");
  };

  const handleExportExcel = async () => {
    const result = await exportSalaryReport(data, {
      from: `${selectedMonth !== "all" ? `M-${selectedMonth}` : "All"} / ${selectedYear}`,
      to: "Disbursement",
    });
    if (result.success) {
      toast.success(t("exportedExcel"));
      return;
    }
    toast.error(t("exportFailed"));
  };

  const columns: ColumnDef<SalaryRecord>[] = [
    {
      accessorKey: "staffId",
      header: t("staffId"),
      cell: (info: any) => (
        <span className="font-mono text-xs font-semibold">{info?.row?.original?.staffId ?? info?.staffId ?? "-"}</span>
      ),
    },
    {
      accessorKey: "staffName",
      header: t("employeeName"),
      cell: (info: any) => (
        <div>
          <p className="font-medium text-foreground">{info?.row?.original?.staffName ?? info?.staffName ?? "-"}</p>
          <p className="text-xs text-muted-foreground">{info?.row?.original?.designation ?? info?.designation ?? ""}</p>
        </div>
      ),
    },
    {
      accessorKey: "department",
      header: t("department"),
      cell: (info: any) => (
        <span className="text-xs bg-muted px-2 py-0.5 rounded-md font-medium">
          {info?.row?.original?.department ?? info?.department ?? "-"}
        </span>
      ),
    },
    {
      accessorKey: "period",
      header: t("period"),
      cell: (info: any) => <span className="text-xs font-mono">{info?.row?.original?.period ?? info?.period ?? "-"}</span>,
    },
    {
      accessorKey: "baseSalary",
      header: t("grossBase"),
      cell: (info: any) => (
        <span className="text-xs font-medium">{formatCurrency(info?.row?.original?.baseSalary ?? info?.baseSalary ?? 0)}</span>
      ),
    },
    {
      accessorKey: "deductions",
      header: t("deductions"),
      cell: (info: any) => {
        const deductions = info?.row?.original?.deductions ?? info?.deductions ?? 0;
        return (
          <span className="text-xs text-rose-600 font-medium">
            {deductions > 0 ? `-${formatCurrency(deductions)}` : "—"}
          </span>
        );
      },
    },
    {
      accessorKey: "netPayable",
      header: t("netPayable"),
      cell: (info: any) => (
        <span className="text-xs font-bold text-foreground">
          {formatCurrency(info?.row?.original?.netPayable ?? info?.netPayable ?? 0)}
        </span>
      ),
    },
    {
      accessorKey: "paidAmount",
      header: t("paidAmount"),
      cell: (info: any) => (
        <span className="text-xs font-semibold text-emerald-600">
          {formatCurrency(info?.row?.original?.paidAmount ?? info?.paidAmount ?? 0)}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: t("status"),
      cell: (info: any) => {
        const s = info?.row?.original?.status ?? info?.status ?? "UNPAID";
        const variant = s === "PAID" ? "success" : s === "PARTIAL" ? "warning" : "error";
        return <StatusBadge status={s} variant={variant} />;
      },
    },
  ];

  const chartData = departmentBreakdown.map((d) => ({
    label: d.department,
    value: d.amount,
  }));

  const statusPieData = metrics
    ? [
        { label: t("disbursedPaid"), value: metrics.totalPaid, color: "#10b981" },
        { label: t("pendingPayout"), value: metrics.totalPending, color: "#f59e0b" },
        { label: t("deductionsWithheld"), value: metrics.totalDeductions, color: "#64748b" },
      ].filter((x) => x.value > 0)
    : [];

  return (
    <ReportPageShell>
      <PageHeader
        title={t("title")}
        description={t("description")}
        icon={Wallet}
      >
        {hasGenerated && data.length > 0 ? (
          <ExportDropdown
            onExport={(type) => {
              if (type === "excel") void handleExportExcel();
            }}
          />
        ) : undefined}
      </PageHeader>

      {/* Filter Bar */}
      <div className="rounded-lg border border-border/80 bg-card p-4 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase">{t("year")}</label>
            <AppDropdown
              value={selectedYear}
              onChange={(v) => setSelectedYear(v)}
              options={["2024", "2025", "2026", "2027", "2028"].map((y) => ({ value: y, label: y }))}
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase">{t("month")}</label>
            <AppDropdown
              value={selectedMonth}
              onChange={(v) => setSelectedMonth(v)}
              options={[
                { value: "all", label: t("allMonths") },
                { value: "1", label: "January" },
                { value: "2", label: "February" },
                { value: "3", label: "March" },
                { value: "4", label: "April" },
                { value: "5", label: "May" },
                { value: "6", label: "June" },
                { value: "7", label: "July" },
                { value: "8", label: "August" },
                { value: "9", label: "September" },
                { value: "10", label: "October" },
                { value: "11", label: "November" },
                { value: "12", label: "December" },
              ]}
              searchable
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase">{t("department")}</label>
            <AppDropdown
              value={selectedDept}
              onChange={(v) => setSelectedDept(v)}
              options={[
                { value: "all", label: t("allDepartments") },
                { value: "Academic", label: t("academicTeaching") },
                { value: "Administration", label: t("administration") },
                { value: "Accounts", label: t("accountsFinance") },
                { value: "Support", label: t("supportTransport") },
              ]}
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase">{t("payoutStatus")}</label>
            <AppDropdown
              value={selectedStatus}
              onChange={(v) => setSelectedStatus(v)}
              options={[
                { value: "all", label: t("allStatuses") },
                { value: "PAID", label: t("paidDisbursed") },
                { value: "PENDING", label: t("pendingPayout") },
                { value: "PARTIAL", label: t("partial") },
              ]}
              className="mt-1"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-border/50">
          <Button variant="ghost" size="sm" onClick={handleReset} className="text-xs h-8">
            Reset
          </Button>
          <Button
            size="sm"
            onClick={handleGenerateReport}
            disabled={isLoading}
            className="text-xs h-8 bg-primary text-primary-foreground"
          >
            {isLoading ? t("generating") : t("generateReport")}
          </Button>
        </div>
      </div>

      {/* Generated Report Content */}
      {hasGenerated && metrics && (
        <>
          <ReportSummaryBar
            dateRangeLabel={`${selectedYear} / ${selectedMonth === "all" ? "All months" : `Month ${selectedMonth}`}`}
            generatedAtLabel={generatedAt}
            recordCount={data.length}
            appliedFilters={[
              { label: t("year"), value: selectedYear },
              { label: t("month"), value: selectedMonth === "all" ? t("all") : `${t("month")} ${selectedMonth}` },
            ]}
          />

          {/* Metrics Grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ReportMetricCard
              title={t("totalGrossPayroll")}
              value={formatCurrency(metrics.totalGross)}
              icon={DollarSign}
            />
            <ReportMetricCard
              title={t("netDisbursed")}
              value={formatCurrency(metrics.totalPaid)}
              icon={CheckCircle2}
            />
            <ReportMetricCard
              title={t("pendingPayouts")}
              value={formatCurrency(metrics.totalPending)}
              icon={Clock}
            />
            <ReportMetricCard
              title={t("totalDeductions")}
              value={formatCurrency(metrics.totalDeductions)}
              icon={Wallet}
            />
          </div>

          {/* Charts Row */}
          <div className="grid gap-6 md:grid-cols-2">
            <BarChart
              title={t("payrollByDepartment")}
              description={t("payrollByDepartmentDescription")}
              data={chartData}
            />
            <PieChart
              title={t("disbursementComposition")}
              description={t("disbursementCompositionDescription")}
              data={statusPieData}
            />
          </div>

          {/* Table */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-foreground">Staff Payout Ledger</h3>
            <ReportTable columns={columns} data={data} />
          </div>
        </>
      )}

      {!hasGenerated && (
        <ReportEmptyState
          title={t("noReportTitle")}
          description={t("noReportDescription")}
        />
      )}
    </ReportPageShell>
  );
}
