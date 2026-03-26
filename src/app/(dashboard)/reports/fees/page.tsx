"use client";

import { PageHeader } from "@/components/shared/page-header";
import {
  ReportFilters,
  ReportMetricCard,
  ReportTable,
  BarChart,
  PieChart,
  ExportDropdown,
} from "@/components/reports";
import type { ReportFilterState } from "@/components/reports";
import { useTranslations } from "next-intl";
import { Receipt, DollarSign, TrendingUp, AlertCircle, FileSpreadsheet } from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ColumnDef } from "@tanstack/react-table";
import { api } from "@/lib/api-client";
import { useExcelExport } from "@/hooks/use-excel-export";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useTenantFormatting } from "@/components/providers/tenant-settings-provider";

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
  const { formatCurrency } = useTenantFormatting();
  const { exportFeeReport } = useExcelExport({
    schoolName: "Pathshala Pro School",
  });

  const [filters, setFilters] = useState<ReportFilterState>({
    fromDate: "",
    toDate: "",
    status: "",
    paymentMethod: "",
  });

  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<FeeVoucher[]>([]);
  const [metrics, setMetrics] = useState<FeeReportData["metrics"] | null>(null);

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
      const reportData = (response as any).data;
      
      setData(reportData.vouchers || []);
      setMetrics(reportData.metrics || null);
    } catch (error) {
      console.error("Failed to generate fee report:", error);
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
  };

  const handleExportExcel = async () => {
    try {
      const result = await exportFeeReport(data, {
        from: filters.fromDate || "N/A",
        to: filters.toDate || "Present",
      });
      
      if (result.success) {
        toast.success("Report exported successfully");
      } else {
        toast.error("Failed to export report");
      }
    } catch (error) {
      toast.error("Failed to export report");
    }
  };

  const handleExport = async (type: "excel" | "pdf") => {
    if (type === "excel") {
      await handleExportExcel();
    } else {
      toast.info("PDF export coming soon");
    }
  };

  // Payment method breakdown for pie chart
  const paymentMethodData = [
    {
      label: "Cash",
      value: metrics?.cashCollected || 0,
      color: "hsl(var(--primary))",
    },
    {
      label: "Digital",
      value: metrics?.digitalCollected || 0,
      color: "hsl(var(--secondary))",
    },
  ];

  // Status breakdown for bar chart
  const statusCounts = {
    PAID: data.filter((v) => v.status === "PAID").length,
    PENDING: data.filter((v) => v.status === "PENDING").length,
    PARTIAL: data.filter((v) => v.status === "PARTIAL").length,
    OVERDUE: data.filter((v) => v.status === "OVERDUE").length,
  };

  const statusData = [
    { label: "Paid", value: statusCounts.PAID, color: "hsl(var(--primary))" },
    {
      label: "Pending",
      value: statusCounts.PENDING,
      color: "hsl(var(--secondary))",
    },
    {
      label: "Partial",
      value: statusCounts.PARTIAL,
      color: "hsl(var(--accent))",
    },
    {
      label: "Overdue",
      value: statusCounts.OVERDUE,
      color: "hsl(var(--destructive))",
    },
  ];

  const columns: ColumnDef<FeeVoucher>[] = [
    {
      accessorKey: "voucherNumber",
      header: "Voucher No.",
      cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span>,
    },
    {
      accessorKey: "studentName",
      header: "Student Name",
    },
    {
      accessorKey: "className",
      header: "Class",
      cell: ({ getValue }) => `${getValue<string>()}`,
    },
    {
      accessorKey: "section",
      header: "Section",
    },
    {
      accessorKey: "amount",
      header: "Total Amount",
      cell: ({ getValue }) => formatCurrency(getValue<number>()),
    },
    {
      accessorKey: "paidAmount",
      header: "Paid",
      cell: ({ getValue }) => formatCurrency(getValue<number>()),
    },
    {
      accessorKey: "dueAmount",
      header: "Due",
      cell: ({ getValue }) => {
        const due = getValue<number>();
        return (
          <span className={due > 0 ? "text-red-600 font-medium" : "text-green-600"}>
            {formatCurrency(due)}
          </span>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ getValue }) => {
        const status = getValue<string>();
        const statusColors: Record<string, string> = {
          PAID: "bg-green-100 text-green-800",
          PENDING: "bg-yellow-100 text-yellow-800",
          PARTIAL: "bg-blue-100 text-blue-800",
          OVERDUE: "bg-red-100 text-red-800",
        };
        return (
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
              statusColors[status] || "bg-gray-100 text-gray-800"
            }`}
          >
            {status}
          </span>
        );
      },
    },
    {
      accessorKey: "paymentMethod",
      header: "Payment Method",
      cell: ({ getValue }) => (getValue<string>() === "CASH" ? "Cash" : "Digital"),
    },
    {
      accessorKey: "date",
      header: "Date",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={tFee("title")}
        description={tFee("description")}
        icon={Receipt}
      />

      {/* Filters */}
      <ReportFilters
        filters={filters}
        onFilterChange={setFilters}
        onGenerate={handleGenerateReport}
        onReset={handleReset}
        isLoading={isLoading}
        showStatusFilter
        showPaymentMethodFilter
        exportComponent={
          <ExportDropdown onExport={handleExport} disabled={data.length === 0} />
        }
      />

      {/* Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <ReportMetricCard
          title={tFee("totalCollected")}
          value={formatCurrency(metrics?.totalCollected || 0)}
          icon={DollarSign}
        />
        <ReportMetricCard
          title={tFee("totalPending")}
          value={formatCurrency(metrics?.totalPending || 0)}
          icon={AlertCircle}
        />
        <ReportMetricCard
          title={tFee("totalOverdue")}
          value={formatCurrency(metrics?.totalOverdue || 0)}
          icon={AlertCircle}
        />
        <ReportMetricCard
          title={tFee("collectionRate")}
          value={`${metrics?.collectionRate || 0}%`}
          icon={TrendingUp}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <PieChart
          title={tFee("paymentMethodBreakdown")}
          data={paymentMethodData}
          size={200}
        />
        <BarChart
          title="Voucher Status Distribution"
          data={statusData}
          height={200}
        />
      </div>

      {/* Detailed Table */}
      <ReportTable
        title={tFee("voucherDetails")}
        columns={columns}
        data={data}
        isLoading={isLoading}
        showExport={false}
        onExportCSV={handleExportExcel}
      />

      {/* Export Button */}
      <div className="flex justify-end">
        <Button onClick={handleExportExcel} disabled={data.length === 0}>
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Export to Excel
        </Button>
      </div>

      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle>Report Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground">Cash Collected</p>
              <p className="text-2xl font-bold">{formatCurrency(metrics?.cashCollected || 0)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Digital Collected</p>
              <p className="text-2xl font-bold">{formatCurrency(metrics?.digitalCollected || 0)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Vouchers</p>
              <p className="text-2xl font-bold">{metrics?.totalVouchers || 0}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
