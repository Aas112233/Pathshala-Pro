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
import { useClasses, useSections } from "@/hooks/use-queries";
import { api } from "@/lib/api-client";
import { collectAllReportRows } from "@/lib/report-pagination";
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
  /** Null when nothing is on file for this student — not 0%, which is a real figure. */
  attendancePercentage: number | null;
  tracked: boolean;
  status: "GOOD" | "AVERAGE" | "DEFICIT" | null;
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
  defaulters?: AttendanceRecord[];
  defaultersTruncated?: boolean;
  pagination?: { page: number; pageSize: number; totalCount: number };
}

export default function AttendanceReportPage() {
  const tAttendance = useTranslations("reports.attendanceReport");
  const tCommon = useTranslations("reports.common");
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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [defaulters, setDefaulters] = useState<AttendanceRecord[]>([]);

  // The class/section dropdowns previously rendered empty because no report page
  // supplied them; ReportFilters defaults both props to [].
  const { data: classes = [] } = useClasses({ isActive: true, limit: 200 });
  const hasSpecificClass = Boolean(filters.classId) && filters.classId !== "all";
  const { data: sections = [] } = useSections(
    { classId: hasSpecificClass ? filters.classId : undefined, limit: 200 },
    { enabled: hasSpecificClass }
  );

  const schoolInfo = {
    name: settings.name || "Pathshala Pro School",
    address: settings.address || "",
    phone: settings.phone || "",
    email: settings.email || "",
    logoUrl: settings.logoUrl,
  };
  const dateRange = {
    from: filters.fromDate || tAttendance("start"),
    to: filters.toDate || tAttendance("present"),
  };
  const dateRangeLabel = `${dateRange.from} to ${dateRange.to}`;

  // Resolve names so the applied-filter chips read "Class: Grade 9" rather than
  // echoing back a raw UUID.
  const classLabelById = new Map(classes.map((c: any) => [c.id, c.name as string]));
  const sectionLabelById = new Map(sections.map((s: any) => [s.id, s.name as string]));
  const appliedFilters = [
    hasSpecificClass
      ? {
          label: tAttendance("class"),
          value: classLabelById.get(filters.classId as string) ?? (filters.classId as string),
        }
      : null,
    filters.sectionId && filters.sectionId !== "all"
      ? {
          label: tAttendance("section"),
          value: sectionLabelById.get(filters.sectionId) ?? filters.sectionId,
        }
      : null,
  ].filter((value): value is { label: string; value: string } => Boolean(value));

  // Single source for the filter query string, shared by the paged fetch and the
  // export fetch so the two can never diverge.
  const buildBaseParams = () => {
    const params = new URLSearchParams();
    if (filters.fromDate) params.set("fromDate", filters.fromDate);
    if (filters.toDate) params.set("toDate", filters.toDate);
    if (hasSpecificClass) params.set("classId", filters.classId as string);
    if (filters.sectionId && filters.sectionId !== "all") params.set("sectionId", filters.sectionId);
    return params;
  };

  const runReport = async (targetPage: number, targetPageSize: number) => {
    setIsLoading(true);
    try {
      const params = buildBaseParams();
      params.set("page", String(targetPage));
      params.set("pageSize", String(targetPageSize));

      const response = await api.get<AttendanceReportData>(
        `/api/reports/attendance?${params.toString()}`
      );
      const reportData = (response as ApiSuccessResponse<AttendanceReportData>).data;

      setData(reportData.records || []);
      setMetrics(reportData.metrics || null);
      setClassWiseData(reportData.classWise || []);
      setDefaulters(reportData.defaulters || []);
      setTotalCount(reportData.pagination?.totalCount ?? reportData.records?.length ?? 0);
      setPage(targetPage);
      setPageSize(targetPageSize);
      setHasGenerated(true);
      setGeneratedAt(formatDateTime(new Date()));
    } catch (error) {
      console.error("Failed to generate attendance report:", error);
      toast.error(tAttendance("generateFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Exports must cover the whole filtered set, not the visible page. Walks the
   * endpoint page by page rather than reading the on-screen array.
   */
  const fetchAllRecordsForExport = async () => {
    const base = buildBaseParams();
    return collectAllReportRows<AttendanceRecord>(async (p, ps) => {
      const params = new URLSearchParams(base);
      params.set("page", String(p));
      params.set("pageSize", String(ps));
      const response = await api.get<AttendanceReportData>(
        `/api/reports/attendance?${params.toString()}`
      );
      const payload = (response as ApiSuccessResponse<AttendanceReportData>).data;
      return {
        rows: payload.records ?? [],
        totalCount: payload.pagination?.totalCount ?? payload.records?.length ?? 0,
      };
    });
  };

  // A new filter set always restarts at page 1 — staying on page 4 of a
  // different result set would show an empty table.
  const handleGenerateReport = () => runReport(1, pageSize);

  const handlePageChange = (nextPage: number) => {
    if (nextPage < 1 || isLoading) return;
    void runReport(nextPage, pageSize);
  };

  const handlePageSizeChange = (nextSize: number) => {
    if (nextSize === pageSize || isLoading) return;
    void runReport(1, nextSize);
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
    setDefaulters([]);
    setHasGenerated(false);
    setGeneratedAt("");
    setPage(1);
    setTotalCount(0);
  };

  const handleExportExcel = async () => {
    const { rows, truncated } = await fetchAllRecordsForExport();
    const result = await exportAttendanceReport(rows, dateRange);
    if (result.success) {
      toast.success(
        truncated ? tCommon("exportTruncated") : tAttendance("exported")
      );
      return;
    }
    toast.error(tAttendance("exportFailed"));
  };

  const handleExportPdf = async () => {
    if (!metrics) return;

    const { rows, truncated } = await fetchAllRecordsForExport();
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
      records: rows.map((record) => ({
        rollNumber: record.rollNumber,
        studentName: record.studentName,
        className: record.className,
        section: record.section,
        presentDays: record.presentDays,
        absentDays: record.absentDays,
        totalDays: record.totalDays,
        attendancePercentage:
          record.attendancePercentage === null ? "" : `${record.attendancePercentage}%`,
        status: record.status ?? "",
      })),
    });

    if (result.success) {
      toast.success(
        truncated ? tCommon("exportTruncated") : tAttendance("exported")
      );
      return;
    }
    toast.error(tAttendance("exportFailed"));
  };

  const handleExport = async (type: "excel" | "pdf") => {
    if (type === "excel") {
      await handleExportExcel();
      return;
    }
    await handleExportPdf();
  };

  // `defaulters` comes from the API's full-set rollup (state above), not the
  // current page — a page of well-attending students would otherwise show an
  // empty defaulter panel while defaulters existed on another page.

  const columns: ColumnDef<AttendanceRecord>[] = [
    {
      accessorKey: "rollNumber",
      header: tAttendance("rollNo"),
      cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span>,
    },
    { accessorKey: "studentName", header: tAttendance("studentName") },
    { accessorKey: "className", header: tAttendance("class") },
    { accessorKey: "section", header: tAttendance("section") },
    {
      accessorKey: "presentDays",
      header: tAttendance("present"),
      cell: ({ getValue }) => <span className="font-medium text-green-600">{getValue<number>()}</span>,
    },
    {
      accessorKey: "absentDays",
      header: tAttendance("absent"),
      cell: ({ getValue }) => <span className="font-medium text-red-600">{getValue<number>()}</span>,
    },
    { accessorKey: "totalDays", header: tAttendance("totalDays") },
    {
      accessorKey: "attendancePercentage",
      header: tAttendance("attendancePercentage"),
      cell: ({ getValue }) => {
        const percentage = getValue<number | null>();
        if (percentage === null) {
          // Nothing on file is not 0%. Printing a figure here would name a
          // student a defaulter because nobody has marked their class yet.
          return <span className="text-muted-foreground">—</span>;
        }
        let colorClass = "text-green-600";
        if (percentage < 75) colorClass = "text-red-600";
        else if (percentage < 85) colorClass = "text-yellow-600";

        return <span className={`font-bold ${colorClass}`}>{percentage}%</span>;
      },
    },
    {
      accessorKey: "status",
      header: tAttendance("status"),
      cell: ({ getValue }) => {
        const status = getValue<string | null>();
        return status ? (
          <StatusBadge status={status} domain="attendance" />
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      },
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
            classes={classes.map((c: any) => ({ id: c.id, name: c.name }))}
            sections={sections.map((s: any) => ({ id: s.id, name: s.name }))}
            exportComponent={<ExportDropdown onExport={handleExport} disabled={data.length === 0} />}
          />
        }
        summary={
          hasGenerated ? (
            <ReportSummaryBar
              dateRangeLabel={dateRangeLabel}
              generatedAtLabel={generatedAt}
              recordCount={totalCount}
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
          totalCount > 0 ? (
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
                  title={tCommon("lowestAttendanceStudents")}
                  data={defaulters.slice(0, 8).map((record) => ({
                    label: record.rollNumber || record.studentName,
                    // Defaulters are DEFICIT by definition, so the figure is
                    // never null here; the fallback only satisfies the type.
                    value: record.attendancePercentage ?? 0,
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
                            {defaulter.attendancePercentage ?? 0}%
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
            totalCount > 0 || isLoading ? (
              <ReportTable
                title={tAttendance("attendanceDetails")}
                description={tAttendance("attendanceDetailsDescription")}
                columns={columns}
                data={data}
                isLoading={isLoading}
                showExport={false}
                page={page}
                pageSize={pageSize}
                totalCount={totalCount}
                onPageChange={handlePageChange}
                onPageSizeChange={handlePageSizeChange}
              />
            ) : (
              <ReportEmptyState
                title={tAttendance("noDataTitle")}
                description={tAttendance("noDataDescription")}
              />
            )
          ) : (
            <ReportEmptyState
              title={tAttendance("generateTitle")}
              description={tAttendance("generateDescription")}
              actionLabel={tAttendance("generateReport")}
              onAction={handleGenerateReport}
            />
          )
        }
      />
    </div>
  );
}

