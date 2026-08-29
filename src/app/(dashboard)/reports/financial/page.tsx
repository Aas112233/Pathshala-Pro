"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Landmark,
  Receipt,
  TrendingDown,
  TrendingUp,
  DollarSign,
  PieChart as PieIcon,
  CreditCard,
} from "lucide-react";
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

interface ExpenseRecord {
  id: string;
  expenseNumber: string;
  title: string;
  category: string;
  categoryCode: string;
  amount: number;
  paymentMethod: string;
  expenseDate: string;
  payeeName: string;
  receiptNumber: string;
  notes: string;
  recordedByName: string;
}

interface FinancialReportData {
  metrics: {
    totalIncome: number;
    totalExpenses: number;
    netBalance: number;
    cashExpense: number;
    bankExpense: number;
    topExpenseCategory: string;
    expenseCount: number;
  };
  categoryBreakdown: Array<{
    category: string;
    amount: number;
    percentage: number;
  }>;
  records: ExpenseRecord[];
}

export default function FinancialReportPage() {
  const t = useTranslations("reports.financialReport");
  const { settings } = useTenantSettings();
  const { formatCurrency, formatDateTime, formatDate } = useTenantFormatting();

  const { exportFinancialReport } = useExcelExport({
    fileName: "financial_expenses_report",
    schoolName: settings.name || "Pathshala Pro School",
    schoolAddress: settings.address,
    schoolPhone: settings.phone,
    schoolEmail: settings.email,
  });

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedMethod, setSelectedMethod] = useState("all");
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [generatedAt, setGeneratedAt] = useState("");
  const [data, setData] = useState<ExpenseRecord[]>([]);
  const [metrics, setMetrics] = useState<FinancialReportData["metrics"] | null>(null);
  const [categoryBreakdown, setCategoryBreakdown] = useState<
    FinancialReportData["categoryBreakdown"]
  >([]);

  useEffect(() => {
    async function loadCategories() {
      try {
        const res = await fetch("/api/accounting/categories");
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setCategories(json.data);
        }
      } catch {
        // Silent catch for category loader
      }
    }
    loadCategories();
  }, []);

  const handleGenerateReport = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (fromDate) params.set("fromDate", fromDate);
      if (toDate) params.set("toDate", toDate);
      if (selectedCategory && selectedCategory !== "all") params.set("categoryId", selectedCategory);
      if (selectedMethod && selectedMethod !== "all") params.set("paymentMethod", selectedMethod);

      const response = await api.get<FinancialReportData>(
        `/api/reports/financial?${params.toString()}`
      );
      const reportData = (response as ApiSuccessResponse<FinancialReportData>).data;

      setData(reportData.records || []);
      setMetrics(reportData.metrics || null);
      setCategoryBreakdown(reportData.categoryBreakdown || []);
      setHasGenerated(true);
      setGeneratedAt(formatDateTime(new Date()));
    } catch (error) {
      console.error("Failed to generate financial report:", error);
      toast.error("Failed to generate financial expenses report");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setFromDate("");
    setToDate("");
    setSelectedCategory("all");
    setSelectedMethod("all");
    setData([]);
    setMetrics(null);
    setCategoryBreakdown([]);
    setHasGenerated(false);
    setGeneratedAt("");
  };

  const handleExportExcel = async () => {
    const result = await exportFinancialReport(data, {
      from: fromDate || "All Time",
      to: toDate || "Present",
    });
    if (result.success) {
      toast.success("Financial expenses report exported to Excel");
      return;
    }
    toast.error("Failed to export financial report");
  };

  const columns: ColumnDef<ExpenseRecord>[] = [
    {
      accessorKey: "expenseNumber",
      header: "Voucher #",
      cell: (info: any) => (
        <span className="font-mono text-xs font-semibold text-foreground">
          {info?.row?.original?.expenseNumber ?? info?.expenseNumber ?? "-"}
        </span>
      ),
    },
    {
      accessorKey: "title",
      header: "Description / Purpose",
      cell: (info: any) => (
        <div>
          <p className="font-medium text-foreground text-xs">{info?.row?.original?.title ?? info?.title ?? "-"}</p>
          <p className="text-[11px] text-muted-foreground">Payee: {info?.row?.original?.payeeName ?? info?.payeeName ?? "-"}</p>
        </div>
      ),
    },
    {
      accessorKey: "category",
      header: "Category",
      cell: (info: any) => (
        <span className="text-xs bg-muted px-2 py-0.5 rounded-md font-medium">
          {info?.row?.original?.category ?? info?.category ?? "-"}
        </span>
      ),
    },
    {
      accessorKey: "amount",
      header: "Amount",
      cell: (info: any) => (
        <span className="text-xs font-bold text-foreground">
          {formatCurrency(info?.row?.original?.amount ?? info?.amount ?? 0)}
        </span>
      ),
    },
    {
      accessorKey: "paymentMethod",
      header: "Method",
      cell: (info: any) => (
        <span className="text-xs font-mono font-medium">{info?.row?.original?.paymentMethod ?? info?.paymentMethod ?? "-"}</span>
      ),
    },
    {
      accessorKey: "expenseDate",
      header: "Date",
      cell: (info: any) => (
        <span className="text-xs text-muted-foreground font-mono">
          {formatDate(info?.row?.original?.expenseDate ?? info?.expenseDate ?? "")}
        </span>
      ),
    },
    {
      accessorKey: "recordedByName",
      header: "Recorded By",
      cell: (info: any) => (
        <span className="text-xs text-muted-foreground">{info?.row?.original?.recordedByName ?? info?.recordedByName ?? "-"}</span>
      ),
    },
  ];

  const barChartData = categoryBreakdown.map((c) => ({
    label: c.category,
    value: c.amount,
  }));

  const methodPieData = metrics
    ? [
        { label: "Cash Expenses", value: metrics.cashExpense, color: "#3b82f6" },
        { label: "Bank & Digital", value: metrics.bankExpense, color: "#10b981" },
      ].filter((x) => x.value > 0)
    : [];

  return (
    <ReportPageShell>
      <PageHeader
        title={t("title")}
        description={t("description")}
        icon={Landmark}
      >
        {hasGenerated && data.length > 0 ? (
          <ExportDropdown
            onExport={(type) => {
              if (type === "excel") void handleExportExcel();
            }}
          />
        ) : undefined}
      </PageHeader>

      {/* Filter Control Bar */}
      <div className="rounded-lg border border-border/80 bg-card p-4 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase">Category</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs focus:ring-2 focus:ring-primary"
            >
              <option value="all">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase">Method</label>
            <select
              value={selectedMethod}
              onChange={(e) => setSelectedMethod(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs focus:ring-2 focus:ring-primary"
            >
              <option value="all">All Payment Methods</option>
              <option value="CASH">Cash</option>
              <option value="BANK">Bank Account</option>
              <option value="CHEQUE">Cheque</option>
              <option value="DIGITAL">Digital Gateway</option>
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

      {/* Generated Results */}
      {hasGenerated && metrics && (
        <>
          <ReportSummaryBar
            dateRangeLabel={`${fromDate || "Start"} to ${toDate || "Present"}`}
            generatedAtLabel={generatedAt}
            recordCount={data.length}
            appliedFilters={[
              { label: "Range", value: `${fromDate || "Start"} to ${toDate || "Present"}` },
            ]}
          />

          {/* Metric Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ReportMetricCard
              title="Total Fee Collections"
              value={formatCurrency(metrics.totalIncome)}
              icon={TrendingUp}
            />
            <ReportMetricCard
              title="Total Operational Expenses"
              value={formatCurrency(metrics.totalExpenses)}
              icon={TrendingDown}
            />
            <ReportMetricCard
              title="Net Cash Balance"
              value={formatCurrency(metrics.netBalance)}
              icon={DollarSign}
            />
            <ReportMetricCard
              title="Top Expense Category"
              value={metrics.topExpenseCategory}
              icon={PieIcon}
            />
          </div>

          {/* Charts Row */}
          <div className="grid gap-6 md:grid-cols-2">
            <BarChart
              title="Expenses by Category"
              description="Spending breakdown across operational heads"
              data={barChartData}
            />
            <PieChart
              title="Payment Methods Distribution"
              description="Cash vs Bank disbursement proportion"
              data={methodPieData}
            />
          </div>

          {/* Expenses Table */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-foreground">Itemized Expense Ledger</h3>
            <ReportTable
              columns={columns}
              data={data}
            />
          </div>
        </>
      )}

      {!hasGenerated && (
        <ReportEmptyState
          title="No Financial Report Generated"
          description="Select date range, expense categories, and payment method filters above then click Generate Report."
        />
      )}
    </ReportPageShell>
  );
}
