"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { AlertCircle, DollarSign, Receipt, TrendingUp } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  BarChart,
  ExportDropdown,
  PieChart,
  ReportEmptyState,
  ReportFilters,
  ReportMetricCard,
  ReportPageShell,
  ReportSummaryBar,
  ReportTable,
} from "@/components/reports";
import type { ReportFilterState } from "@/components/reports";
import { PageHeader } from "@/components/shared/page-header";
import { useTenantFormatting, useTenantSettings } from "@/components/providers/tenant-settings-provider";
import { useExcelExport } from "@/hooks/use-excel-export";
import { usePDFExport } from "@/hooks/use-pdf-export";
import { api } from "@/lib/api-client";
import type { ApiSuccessResponse } from "@/types/api";
import { toast } from "sonner";

interface FeeVoucher {
  id: string;
  voucherNumber: string;
  studentName: string;
  className: string;
  section: string;
  amount: number;
  paidAmount: number;
  dueAmount: number;
  status: "PENDING" | "PAID" | "PARTIAL" | "OVERDUE";
  paymentMethod: "CASH" | "DIGITAL";
  date: string;
}

interface FeeReportData {
  metrics: {
    totalCollected: number;
    totalPending: number;
    totalOverdue: number;
    collectionRate: number;
    cashCollected: number;
    digitalCollected: number;
    totalVouchers: number;
  };
  vouchers: FeeVoucher[];
}

export default function FeeReportPage() {
  const tFee = useTranslations("reports.feeReport");
  const { settings } = useTenantSettings();
  const { formatCurrency, formatDateTime } = useTenantFormatting();
  const { exportFeeReport } = useExcelExport({
    fileName: "fee_report",
    schoolName: settings.name || "Pathshala Pro School",
    schoolAddress: settings.address,
    schoolPhone: settings.phone,
    schoolEmail: settings.email,
  });
  const { exportFeeReportPDF } = usePDFExport();

  const [filters, setFilters] = useState<ReportFilterState>({
    fromDate: "",
    toDate: "",
    status: "",
    paymentMethod: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [generatedAt, setGeneratedAt] = useState("");
  const [data, setData] = useState<FeeVoucher[]>([]);
  const [metrics, setMetrics] = useState<FeeReportData["metrics"] | null>(null);

  const schoolInfo = {
    name: settings.name || "Pathshala Pro School",
    address: settings.address || "",
    phone: settings.phone || "",
    email: settings.email || "",
    logoUrl: settings.logoUrl,
  };
  const dateRange = {
    from: filters.fromDate || tFee("start"),
    to: filters.toDate || tFee("present"),
  };
  const dateRangeLabel = `${dateRange.from} to ${dateRange.to}`;
  const appliedFilters = [
    filters.status && filters.status !== "all" ? { label: tFee("status"), value: filters.status } : null,
    filters.paymentMethod && filters.paymentMethod !== "all"
      ? { label: tFee("method"), value: filters.paymentMethod }
      : null,
  ].filter((value): value is { label: string; value: string } => Boolean(value));

  const handleGenerateReport = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.fromDate) params.set("fromDate", filters.fromDate);
      if (filters.toDate) params.set("toDate", filters.toDate);
      if (filters.status && filters.status !== "all") params.set("status", filters.status);
      if (filters.paymentMethod && filters.paymentMethod !== "all") {
        params.set("paymentMethod", filters.paymentMethod);
      }

      const response = await api.get<FeeReportData>(`/api/reports/fees?${params.toString()}`);
      const reportData = (response as ApiSuccessResponse<FeeReportData>).data;

      setData(reportData.vouchers || []);
      setMetrics(reportData.metrics || null);
      setHasGenerated(true);
      setGeneratedAt(formatDateTime(new Date()));
    } catch (error) {
      console.error("Failed to generate fee report:", error);
      toast.error(tFee("generateFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setFilters({
      fromDate: "",
      toDate: "",
      status: "",
      paymentMethod: "",
    });
    setData([]);
    setMetrics(null);
    setHasGenerated(false);
    setGeneratedAt("");
  };

  const handleExportExcel = async () => {
    const result = await exportFeeReport(data, dateRange);
    if (result.success) {
      toast.success(tFee("exported"));
      return;
    }
    toast.error(tFee("exportFailed"));
  };

  const handleExportPdf = async () => {
    if (!metrics) return;

    const result = await exportFeeReportPDF({
      school: schoolInfo,
      dateRangeLabel,
      generatedAt: generatedAt || formatDateTime(new Date()),
      filters: appliedFilters,
      metrics: {
        totalCollected: formatCurrency(metrics.totalCollected),
        totalPending: formatCurrency(metrics.totalPending),
        totalOverdue: formatCurrency(metrics.totalOverdue),
        collectionRate: `${metrics.collectionRate}%`,
      },
      records: data.map((voucher) => ({
        voucherNumber: voucher.voucherNumber,
        studentName: voucher.studentName,
        className: voucher.className,
        section: voucher.section,
        amount: formatCurrency(voucher.amount),
        paidAmount: formatCurrency(voucher.paidAmount),
        dueAmount: formatCurrency(voucher.dueAmount),
        status: voucher.status,
        paymentMethod: voucher.paymentMethod === "CASH" ? "Cash" : "Digital",
        date: voucher.date,
      })),
    });

    if (result.success) {
      toast.success(tFee("exported"));
      return;
    }
    toast.error(tFee("exportFailed"));
  };

  const handleExport = async (type: "excel" | "pdf") => {
    if (type === "excel") {
      await handleExportExcel();
      return;
    }
    await handleExportPdf();
  };

  const paymentMethodData = [
    { label: tFee("cash"), value: metrics?.cashCollected || 0, color: "hsl(var(--primary))" },
    { label: tFee("digital"), value: metrics?.digitalCollected || 0, color: "hsl(var(--secondary))" },
  ];
  const statusCounts = {
    PAID: data.filter((voucher) => voucher.status === "PAID").length,
    PENDING: data.filter((voucher) => voucher.status === "PENDING").length,
    PARTIAL: data.filter((voucher) => voucher.status === "PARTIAL").length,
    OVERDUE: data.filter((voucher) => voucher.status === "OVERDUE").length,
  };

  const columns: ColumnDef<FeeVoucher>[] = [
    {
      accessorKey: "voucherNumber",
      header: tFee("voucherNo"),
      cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span>,
    },
    { accessorKey: "studentName", header: tFee("studentName") },
    { accessorKey: "className", header: tFee("class") },
    { accessorKey: "section", header: tFee("section") },
    {
      accessorKey: "amount",
      header: tFee("totalAmount"),
      cell: ({ getValue }) => formatCurrency(getValue<number>()),
    },
    {
      accessorKey: "paidAmount",
      header: tFee("paid"),
      cell: ({ getValue }) => formatCurrency(getValue<number>()),
    },
    {
      accessorKey: "dueAmount",
      header: tFee("due"),
      cell: ({ getValue }) => {
        const due = getValue<number>();
        return (
          <span className={due > 0 ? "font-medium text-red-600" : "text-green-600"}>
            {formatCurrency(due)}
          </span>
        );
      },
    },
    {
      accessorKey: "status",
      header: tFee("status"),
      cell: ({ getValue }) => (
        <StatusBadge
          status={getValue<string>()}
          domain="fee"
        />
      ),
    },
    {
      accessorKey: "paymentMethod",
      header: tFee("paymentMethod"),
      cell: ({ getValue }) => (getValue<string>() === "CASH" ? "Cash" : "Digital"),
    },
    { accessorKey: "date", header: tFee("date") },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={tFee("title")} description={tFee("description")} icon={Receipt} />

      <ReportPageShell
        filters={
          <ReportFilters
            filters={filters}
            onFilterChange={setFilters}
            onGenerate={handleGenerateReport}
            onReset={handleReset}
            isLoading={isLoading}
            showStatusFilter
            showPaymentMethodFilter
            exportComponent={<ExportDropdown onExport={handleExport} disabled={data.length === 0} />}
          />
        }
        summary={
          hasGenerated ? (
            <ReportSummaryBar
              dateRangeLabel={dateRangeLabel}
              generatedAtLabel={generatedAt}
              recordCount={data.length}
              appliedFilters={appliedFilters}
            />
          ) : undefined
        }
        metrics={
          metrics ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <ReportMetricCard
                title={tFee("totalCollected")}
                value={formatCurrency(metrics.totalCollected)}
                icon={DollarSign}
              />
              <ReportMetricCard
                title={tFee("totalPending")}
                value={formatCurrency(metrics.totalPending)}
                icon={AlertCircle}
              />
              <ReportMetricCard
                title={tFee("totalOverdue")}
                value={formatCurrency(metrics.totalOverdue)}
                icon={AlertCircle}
              />
              <ReportMetricCard
                title={tFee("collectionRate")}
                value={`${metrics.collectionRate}%`}
                icon={TrendingUp}
              />
            </div>
          ) : undefined
        }
        insights={
          data.length > 0 ? (
            <div className="grid gap-6 lg:grid-cols-2">
              <PieChart title={tFee("paymentMethodBreakdown")} data={paymentMethodData} size={200} />
              <BarChart
                title={tFee("voucherStatusDistribution")}
                data={[
                  { label: tFee("paid"), value: statusCounts.PAID, color: "hsl(var(--primary))" },
                  { label: tFee("pending"), value: statusCounts.PENDING, color: "hsl(var(--secondary))" },
                  { label: tFee("partial"), value: statusCounts.PARTIAL, color: "hsl(var(--accent))" },
                  { label: tFee("overdue"), value: statusCounts.OVERDUE, color: "hsl(var(--destructive))" },
                ]}
                height={200}
              />
            </div>
          ) : undefined
        }
        table={
          hasGenerated || isLoading ? (
            data.length > 0 || isLoading ? (
              <ReportTable
                title={tFee("voucherDetails")}
                description={tFee("voucherDetailsDescription")}
                columns={columns}
                data={data}
                isLoading={isLoading}
                showExport={false}
                onExportCSV={handleExportExcel}
              />
            ) : (
              <ReportEmptyState
                title={tFee("noVouchersTitle")}
                description={tFee("noVouchersDescription")}
              />
            )
          ) : (
            <ReportEmptyState
              title={tFee("generateTitle")}
              description={tFee("generateDescription")}
              actionLabel={tFee("generateReport")}
              onAction={handleGenerateReport}
            />
          )
        }
      />
    </div>
  );
}

