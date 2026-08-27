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
      toast.error("Failed to generate salary payroll report");
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
      toast.success("Payroll report exported to Excel");
      return;
    }
    toast.error("Failed to export payroll report");
  };

  const columns: ColumnDef<SalaryRecord>[] = [
    {
      accessorKey: "staffId",
      header: "Staff ID",
      cell: ({ row }) => (
        <span className="font-mono text-xs font-semibold">{row.original.staffId}</span>
      ),
    },
    {
      accessorKey: "staffName",
      header: "Employee Name",
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-foreground">{row.original.staffName}</p>
          <p className="text-xs text-muted-foreground">{row.original.designation}</p>
        </div>
      ),
    },
    {
      accessorKey: "department",
      header: "Department",
      cell: ({ row }) => (
        <span className="text-xs bg-muted px-2 py-0.5 rounded-md font-medium">
          {row.original.department}
        </span>
      ),
    },
    {
      accessorKey: "period",
      header: "Period",
      cell: ({ row }) => <span className="text-xs font-mono">{row.original.period}</span>,
    },
    {
      accessorKey: "baseSalary",
      header: "Gross Base",
      cell: ({ row }) => (
        <span className="text-xs font-medium">{formatCurrency(row.original.baseSalary)}</span>
      ),
    },
    {
      accessorKey: "deductions",
      header: "Deductions",
      cell: ({ row }) => (
        <span className="text-xs text-rose-600 font-medium">
          {row.original.deductions > 0 ? `-${formatCurrency(row.original.deductions)}` : "—"}
        </span>
      ),
    },
    {
      accessorKey: "netPayable",
      header: "Net Payable",
      cell: ({ row }) => (
        <span className="text-xs font-bold text-foreground">
          {formatCurrency(row.original.netPayable)}
        </span>
      ),
    },
    {
      accessorKey: "paidAmount",
      header: "Paid Amount",
      cell: ({ row }) => (
        <span className="text-xs font-semibold text-emerald-600">
          {formatCurrency(row.original.paidAmount)}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const s = row.original.status;
        const variant = s === "PAID" ? "success" : s === "PARTIAL" ? "warning" : "danger";
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
        { label: "Disbursed / Paid", value: metrics.totalPaid, color: "#10b981" },
        { label: "Pending Payout", value: metrics.totalPending, color: "#f59e0b" },
        { label: "Deductions/Withheld", value: metrics.totalDeductions, color: "#64748b" },
      ].filter((x) => x.value > 0)
    : [];

  return (
    <ReportPageShell>
      <PageHeader
        title={t("title")}
        description={t("description")}
        icon={Wallet}
        actions={
          hasGenerated && data.length > 0 ? (
            <ExportDropdown onExportExcel={handleExportExcel} />
          ) : undefined
        }
      />

      {/* Filter Bar */}
      <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-xs space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase">Year</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs focus:ring-2 focus:ring-primary"
            >
              {[2024, 2025, 2026, 2027].map((y) => (
                <option key={y} value={y.toString()}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase">Month</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs focus:ring-2 focus:ring-primary"
            >
              <option value="all">All Months</option>
              {[
                "January",
                "February",
                "March",
                "April",
                "May",
                "June",
                "July",
                "August",
                "September",
                "October",
                "November",
                "December",
              ].map((m, idx) => (
                <option key={m} value={(idx + 1).toString()}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase">Department</label>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs focus:ring-2 focus:ring-primary"
            >
              <option value="all">All Departments</option>
              <option value="Academic">Academic / Teaching</option>
              <option value="Administration">Administration</option>
              <option value="Accounts">Accounts & Finance</option>
              <option value="Support">Support & Transport</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase">Payout Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs focus:ring-2 focus:ring-primary"
            >
              <option value="all">All Statuses</option>
              <option value="PAID">Paid / Disbursed</option>
              <option value="PENDING">Pending Payout</option>
              <option value="PARTIAL">Partial</option>
            </select>
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
            {isLoading ? "Generating..." : "Generate Report"}
          </Button>
        </div>
      </div>

      {/* Generated Report Content */}
      {hasGenerated && metrics && (
        <>
          <ReportSummaryBar
            generatedAt={generatedAt}
            totalRecords={data.length}
            filters={[
              { label: "Year", value: selectedYear },
              { label: "Month", value: selectedMonth === "all" ? "All" : `Month ${selectedMonth}` },
            ]}
          />

          {/* Metrics Grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ReportMetricCard
              title="Total Gross Payroll"
              value={formatCurrency(metrics.totalGross)}
              icon={DollarSign}
              color="text-indigo-600"
              bgColor="bg-indigo-50 dark:bg-indigo-950"
            />
            <ReportMetricCard
              title="Net Disbursed"
              value={formatCurrency(metrics.totalPaid)}
              icon={CheckCircle2}
              color="text-emerald-600"
              bgColor="bg-emerald-50 dark:bg-emerald-950"
            />
            <ReportMetricCard
              title="Pending Payouts"
              value={formatCurrency(metrics.totalPending)}
              icon={Clock}
              color="text-amber-600"
              bgColor="bg-amber-50 dark:bg-amber-950"
            />
            <ReportMetricCard
              title="Total Deductions"
              value={formatCurrency(metrics.totalDeductions)}
              icon={Wallet}
              color="text-rose-600"
              bgColor="bg-rose-50 dark:bg-rose-950"
            />
          </div>

          {/* Charts Row */}
          <div className="grid gap-6 md:grid-cols-2">
            <BarChart
              title="Payroll by Department"
              description="Gross salary allocation across departments"
              data={chartData}
            />
            <PieChart
              title="Disbursement Composition"
              description="Ratio of disbursed vs pending vs deductions"
              data={statusPieData}
            />
          </div>

          {/* Table */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-foreground">Staff Payout Ledger</h3>
            <ReportTable columns={columns} data={data} searchPlaceholder="Search staff name or ID..." />
          </div>
        </>
      )}

      {!hasGenerated && (
        <ReportEmptyState
          title="No Payroll Report Generated"
          description="Select fiscal year, month, and department filters above then click Generate Report."
        />
      )}
    </ReportPageShell>
  );
}
