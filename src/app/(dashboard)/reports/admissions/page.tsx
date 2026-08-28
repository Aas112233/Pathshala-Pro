"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import {
  UserPlus,
  CheckCircle2,
  TrendingUp,
  Clock,
  Users,
  Compass,
  FileText,
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

interface AdmissionRecord {
  id: string;
  studentName: string;
  guardianName: string;
  phone: string;
  email: string;
  className: string;
  source: string;
  status: string;
  followUpDate: string | null;
  assignedToName: string;
  convertedStudentId: string | null;
  createdAt: string;
}

interface AdmissionsReportData {
  metrics: {
    totalEnquiries: number;
    admittedCount: number;
    conversionRate: number;
    pendingFollowups: number;
  };
  sourceBreakdown: Array<{
    source: string;
    count: number;
    percentage: number;
  }>;
  statusBreakdown: Array<{
    status: string;
    count: number;
    percentage: number;
  }>;
  records: AdmissionRecord[];
}

export default function AdmissionsReportPage() {
  const t = useTranslations("reports.admissionsReport");
  const { settings } = useTenantSettings();
  const { formatDateTime, formatDate } = useTenantFormatting();

  const { exportAdmissionsReport } = useExcelExport({
    fileName: "admissions_conversion_report",
    schoolName: settings.name || "Pathshala Pro School",
    schoolAddress: settings.address,
    schoolPhone: settings.phone,
    schoolEmail: settings.email,
  });

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedSource, setSelectedSource] = useState("all");
  const [selectedClass, setSelectedClass] = useState("all");
  const [classes, setClasses] = useState<Array<{ id: string; name: string }>>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [generatedAt, setGeneratedAt] = useState("");
  const [data, setData] = useState<AdmissionRecord[]>([]);
  const [metrics, setMetrics] = useState<AdmissionsReportData["metrics"] | null>(null);
  const [sourceBreakdown, setSourceBreakdown] = useState<
    AdmissionsReportData["sourceBreakdown"]
  >([]);
  const [statusBreakdown, setStatusBreakdown] = useState<
    AdmissionsReportData["statusBreakdown"]
  >([]);

  useEffect(() => {
    async function loadClasses() {
      try {
        const res = await fetch("/api/classes?limit=100");
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setClasses(json.data);
        }
      } catch {
        // Silent catch for class loader
      }
    }
    loadClasses();
  }, []);

  const handleGenerateReport = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (fromDate) params.set("fromDate", fromDate);
      if (toDate) params.set("toDate", toDate);
      if (selectedStatus && selectedStatus !== "all") params.set("status", selectedStatus);
      if (selectedSource && selectedSource !== "all") params.set("source", selectedSource);
      if (selectedClass && selectedClass !== "all") params.set("classId", selectedClass);

      const response = await api.get<AdmissionsReportData>(
        `/api/reports/admissions?${params.toString()}`
      );
      const reportData = (response as ApiSuccessResponse<AdmissionsReportData>).data;

      setData(reportData.records || []);
      setMetrics(reportData.metrics || null);
      setSourceBreakdown(reportData.sourceBreakdown || []);
      setStatusBreakdown(reportData.statusBreakdown || []);
      setHasGenerated(true);
      setGeneratedAt(formatDateTime(new Date()));
    } catch (error) {
      console.error("Failed to generate admissions report:", error);
      toast.error("Failed to generate admissions conversion report");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setFromDate("");
    setToDate("");
    setSelectedStatus("all");
    setSelectedSource("all");
    setSelectedClass("all");
    setData([]);
    setMetrics(null);
    setSourceBreakdown([]);
    setStatusBreakdown([]);
    setHasGenerated(false);
    setGeneratedAt("");
  };

  const handleExportExcel = async () => {
    const result = await exportAdmissionsReport(data, {
      from: fromDate || "All Time",
      to: toDate || "Present",
    });
    if (result.success) {
      toast.success("Admissions conversion report exported to Excel");
      return;
    }
    toast.error("Failed to export admissions report");
  };

  const columns: ColumnDef<AdmissionRecord>[] = [
    {
      accessorKey: "studentName",
      header: "Applicant / Student",
      cell: (info: any) => (
        <div>
          <p className="font-semibold text-foreground text-xs">{info?.row?.original?.studentName ?? info?.studentName ?? "-"}</p>
          <p className="text-[11px] text-muted-foreground">Guardian: {info?.row?.original?.guardianName ?? info?.guardianName ?? "-"}</p>
        </div>
      ),
    },
    {
      accessorKey: "phone",
      header: "Contact Phone",
      cell: (info: any) => <span className="font-mono text-xs">{info?.row?.original?.phone ?? info?.phone ?? "-"}</span>,
    },
    {
      accessorKey: "className",
      header: "Target Grade",
      cell: (info: any) => (
        <span className="text-xs font-medium bg-muted px-2 py-0.5 rounded-md">
          {info?.row?.original?.className ?? info?.className ?? "-"}
        </span>
      ),
    },
    {
      accessorKey: "source",
      header: "Lead Source",
      cell: (info: any) => (
        <span className="text-xs font-mono uppercase text-muted-foreground">
          {info?.row?.original?.source ?? info?.source ?? "-"}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: "Pipeline Status",
      cell: (info: any) => {
        const s = info?.row?.original?.status ?? info?.status ?? "ENQUIRY";
        const variant =
          s === "ADMITTED" ? "success" : s === "REJECTED" ? "error" : s === "VISITED" ? "info" : "warning";
        return <StatusBadge status={s} variant={variant} />;
      },
    },
    {
      accessorKey: "assignedToName",
      header: "Admission Officer",
      cell: (info: any) => (
        <span className="text-xs text-muted-foreground">{info?.row?.original?.assignedToName ?? info?.assignedToName ?? "-"}</span>
      ),
    },
    {
      accessorKey: "createdAt",
      header: "Enquiry Date",
      cell: (info: any) => (
        <span className="text-xs font-mono text-muted-foreground">
          {formatDate(info?.row?.original?.createdAt ?? info?.createdAt ?? "")}
        </span>
      ),
    },
  ];

  const barChartData = sourceBreakdown.map((s) => ({
    label: s.source,
    value: s.count,
  }));

  const statusPieData = statusBreakdown.map((st) => {
    const colors: Record<string, string> = {
      ADMITTED: "#10b981",
      NEW: "#3b82f6",
      CONTACTED: "#6366f1",
      VISITED: "#f59e0b",
      REJECTED: "#ef4444",
    };
    return {
      label: st.status,
      value: st.count,
      color: colors[st.status] || "#64748b",
    };
  });

  return (
    <ReportPageShell>
      <PageHeader
        title={t("title")}
        description={t("description")}
        icon={UserPlus}
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
      <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-xs space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-5">
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
            <label className="text-xs font-semibold text-muted-foreground uppercase">Pipeline Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs focus:ring-2 focus:ring-primary"
            >
              <option value="all">All Statuses</option>
              <option value="NEW">New Lead</option>
              <option value="CONTACTED">Contacted</option>
              <option value="VISITED">Campus Visited</option>
              <option value="ADMITTED">Admitted / Enrolled</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase">Lead Source</label>
            <select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs focus:ring-2 focus:ring-primary"
            >
              <option value="all">All Sources</option>
              <option value="WALK_IN">Walk In</option>
              <option value="PHONE">Phone Inquiry</option>
              <option value="WEBSITE">Website Form</option>
              <option value="REFERRAL">Parent Referral</option>
              <option value="SOCIAL">Social Media</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase">Target Class</label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs focus:ring-2 focus:ring-primary"
            >
              <option value="all">All Classes</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
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
              title="Total Enquiries"
              value={metrics.totalEnquiries}
              icon={Users}
            />
            <ReportMetricCard
              title="Admitted Students"
              value={metrics.admittedCount}
              icon={CheckCircle2}
            />
            <ReportMetricCard
              title="Conversion Rate"
              value={`${metrics.conversionRate}%`}
              icon={TrendingUp}
            />
            <ReportMetricCard
              title="Pending Follow-ups"
              value={metrics.pendingFollowups}
              icon={Clock}
            />
          </div>

          {/* Charts Row */}
          <div className="grid gap-6 md:grid-cols-2">
            <BarChart
              title="Leads by Source"
              description="Marketing channel distribution for applicant inquiries"
              data={barChartData}
            />
            <PieChart
              title="Pipeline Status Breakdown"
              description="Distribution of applicant statuses across the intake funnel"
              data={statusPieData}
            />
          </div>

          {/* Table */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-foreground">Applicant Enquiries Ledger</h3>
            <ReportTable
              columns={columns}
              data={data}
            />
          </div>
        </>
      )}

      {!hasGenerated && (
        <ReportEmptyState
          title="No Admissions Report Generated"
          description="Select date range, pipeline status, lead source, and target class filters above then click Generate Report."
        />
      )}
    </ReportPageShell>
  );
}
