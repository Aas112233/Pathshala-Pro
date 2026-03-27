"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { AlertTriangle, CalendarCheck, Percent, Users } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  BarChart,
  ExportDropdown,
  LineChart,
  ReportEmptyState,
  ReportFilters,
  ReportMetricCard,
  ReportPageShell,
  ReportSummaryBar,
  ReportTable,
} from "@/components/reports";
import type { ReportFilterState } from "@/components/reports";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTenantFormatting, useTenantSettings } from "@/components/providers/tenant-settings-provider";
import { useExcelExport } from "@/hooks/use-excel-export";
import { usePDFExport } from "@/hooks/use-pdf-export";
import { api } from "@/lib/api-client";
import type { ApiSuccessResponse } from "@/types/api";
import { toast } from "sonner";

interface AttendanceRecord {
  id: string;
  studentName: string;
  className: string;
  section: string;
  rollNumber: string;
  presentDays: number;
  absentDays: number;
  totalDays: number;
  attendancePercentage: number;
  status: "GOOD" | "AVERAGE" | "DEFICIT";
}

interface AttendanceReportData {
  metrics: {
    averageAttendance: number;
    totalPresent: number;
    totalAbsent: number;
    defaulterCount: number;
    totalStudents: number;
  };
  records: AttendanceRecord[];
  classWise: { className: string; averagePercentage: number }[];
}

export default function AttendanceReportPage() {
  const tAttendance = useTranslations("reports.attendanceReport");
  const { settings } = useTenantSettings();
  const { formatDateTime } = useTenantFormatting();
  const { exportAttendanceReport } = useExcelExport({
    fileName: "attendance_report",
    schoolName: settings.name || "Pathshala Pro School",
    schoolAddress: settings.address,
    schoolPhone: settings.phone,
    schoolEmail: settings.email,
  });
  const { exportAttendanceReportPDF } = usePDFExport();

  const [filters, setFilters] = useState<ReportFilterState>({
    fromDate: "",
    toDate: "",
    classId: "",
    sectionId: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [generatedAt, setGeneratedAt] = useState("");
  const [data, setData] = useState<AttendanceRecord[]>([]);
  const [metrics, setMetrics] = useState<AttendanceReportData["metrics"] | null>(null);
  const [classWiseData, setClassWiseData] = useState<{ className: string; averagePercentage: number }[]>(
    []
  );

  const schoolInfo = {
    name: settings.name || "Pathshala Pro School",
    address: settings.address || "",
    phone: settings.phone || "",
    email: settings.email || "",
    logoUrl: settings.logoUrl,
  };
  const dateRange = {
    from: filters.fromDate || "Start",
    to: filters.toDate || "Present",
  };
  const dateRangeLabel = `${dateRange.from} to ${dateRange.to}`;
  const appliedFilters = [
    filters.classId && filters.classId !== "all" ? { label: "Class", value: filters.classId } : null,
    filters.sectionId && filters.sectionId !== "all"
      ? { label: "Section", value: filters.sectionId }
      : null,
  ].filter((value): value is { label: string; value: string } => Boolean(value));

  const handleGenerateReport = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.fromDate) params.set("fromDate", filters.fromDate);
      if (filters.toDate) params.set("toDate", filters.toDate);
      if (filters.classId && filters.classId !== "all") params.set("classId", filters.classId);
      if (filters.sectionId && filters.sectionId !== "all") params.set("sectionId", filters.sectionId);

      const response = await api.get<AttendanceReportData>(
        `/api/reports/attendance?${params.toString()}`
      );
      const reportData = (response as ApiSuccessResponse<AttendanceReportData>).data;

      setData(reportData.records || []);
      setMetrics(reportData.metrics || null);
      setClassWiseData(reportData.classWise || []);
      setHasGenerated(true);
      setGeneratedAt(formatDateTime(new Date()));
    } catch (error) {
      console.error("Failed to generate attendance report:", error);
      toast.error("Failed to generate attendance report");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setFilters({
      fromDate: "",
      toDate: "",
      classId: "",
      sectionId: "",
    });
    setData([]);
    setMetrics(null);
    setClassWiseData([]);
    setHasGenerated(false);
    setGeneratedAt("");
  };

  const handleExportExcel = async () => {
    const result = await exportAttendanceReport(data, dateRange);
    if (result.success) {
      toast.success("Attendance report exported");
      return;
    }
    toast.error("Failed to export attendance report");
  };

  const handleExportPdf = async () => {
    if (!metrics) return;

    const result = await exportAttendanceReportPDF({
      school: schoolInfo,
      dateRangeLabel,
      generatedAt: generatedAt || formatDateTime(new Date()),
      filters: appliedFilters,
      metrics: {
        averageAttendance: `${metrics.averageAttendance}%`,
        totalPresent: String(metrics.totalPresent),
        totalAbsent: String(metrics.totalAbsent),
        defaulterCount: String(metrics.defaulterCount),
      },
      records: data.map((record) => ({
        rollNumber: record.rollNumber,
        studentName: record.studentName,
        className: record.className,
        section: record.section,
        presentDays: record.presentDays,
        absentDays: record.absentDays,
        totalDays: record.totalDays,
        attendancePercentage: `${record.attendancePercentage}%`,
        status: record.status,
      })),
    });

    if (result.success) {
      toast.success("Attendance report exported");
      return;
    }
    toast.error("Failed to export attendance report");
  };

  const handleExport = async (type: "excel" | "pdf") => {
    if (type === "excel") {
      await handleExportExcel();
      return;
    }
    await handleExportPdf();
  };

  const defaulters = data.filter((record) => record.attendancePercentage < 75);

  const columns: ColumnDef<AttendanceRecord>[] = [
    {
      accessorKey: "rollNumber",
      header: "Roll No.",
      cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span>,
    },
    { accessorKey: "studentName", header: "Student Name" },
    { accessorKey: "className", header: "Class" },
    { accessorKey: "section", header: "Section" },
    {
      accessorKey: "presentDays",
      header: "Present",
      cell: ({ getValue }) => <span className="font-medium text-green-600">{getValue<number>()}</span>,
    },
    {
      accessorKey: "absentDays",
      header: "Absent",
      cell: ({ getValue }) => <span className="font-medium text-red-600">{getValue<number>()}</span>,
    },
    { accessorKey: "totalDays", header: "Total Days" },
    {
      accessorKey: "attendancePercentage",
      header: "Attendance %",
      cell: ({ getValue }) => {
        const percentage = getValue<number>();
        let colorClass = "text-green-600";
        if (percentage < 75) colorClass = "text-red-600";
        else if (percentage < 85) colorClass = "text-yellow-600";

        return <span className={`font-bold ${colorClass}`}>{percentage}%</span>;
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ getValue }) => (
        <StatusBadge
          status={getValue<string>()}
          domain="attendance"
        />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={tAttendance("title")}
        description={tAttendance("description")}
        icon={CalendarCheck}
      />

      <ReportPageShell
        filters={
          <ReportFilters
            filters={filters}
            onFilterChange={setFilters}
            onGenerate={handleGenerateReport}
            onReset={handleReset}
            isLoading={isLoading}
            showClassFilter
            showSectionFilter
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
                title={tAttendance("averageAttendance")}
                value={`${metrics.averageAttendance}%`}
                icon={Percent}
              />
              <ReportMetricCard
                title={tAttendance("presentDays")}
                value={metrics.totalPresent}
                icon={CalendarCheck}
              />
              <ReportMetricCard
                title={tAttendance("absentDays")}
                value={metrics.totalAbsent}
                icon={AlertTriangle}
              />
              <ReportMetricCard
                title={tAttendance("defaulterList")}
                value={metrics.defaulterCount}
                icon={Users}
              />
            </div>
          ) : undefined
        }
        insights={
          data.length > 0 ? (
            <div className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-2">
                <BarChart
                  title={tAttendance("classWiseAttendance")}
                  data={classWiseData.map((item) => ({
                    label: item.className,
                    value: item.averagePercentage,
                    color: "hsl(var(--primary))",
                  }))}
                  height={200}
                />
                <LineChart
                  title="Attendance Trend"
                  data={data.slice(0, 5).map((record, index) => ({
                    label: `S${index + 1}`,
                    value: record.attendancePercentage,
                  }))}
                  height={200}
                />
              </div>

              {defaulters.length > 0 ? (
                <Card className="border-red-200 bg-red-50">
                  <CardHeader>
                    <CardTitle className="text-red-800">
                      {tAttendance("defaulterList")} ({defaulters.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                      {defaulters.map((defaulter) => (
                        <div
                          key={defaulter.id}
                          className="flex items-center justify-between rounded-lg bg-white p-3 shadow-sm"
                        >
                          <div>
                            <p className="font-medium">{defaulter.studentName}</p>
                            <p className="text-sm text-muted-foreground">
                              {defaulter.className} - {defaulter.section}
                            </p>
                          </div>
                          <span className="font-bold text-red-600">
                            {defaulter.attendancePercentage}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : null}
            </div>
          ) : undefined
        }
        table={
          hasGenerated || isLoading ? (
            data.length > 0 || isLoading ? (
              <ReportTable
                title="Attendance Details"
                description="Attendance status for the generated period."
                columns={columns}
                data={data}
                isLoading={isLoading}
                showExport={false}
                onExportCSV={handleExportExcel}
              />
            ) : (
              <ReportEmptyState
                title="No attendance data found"
                description="Try a different period or broader class filters."
              />
            )
          ) : (
            <ReportEmptyState
              title="Generate an attendance report"
              description="Select the date range and optional class filters to review attendance trends and export the report."
              actionLabel="Generate report"
              onAction={handleGenerateReport}
            />
          )
        }
      />
    </div>
  );
}

