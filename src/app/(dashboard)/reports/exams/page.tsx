"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { AlertCircle, Award, BookOpen, Trophy } from "lucide-react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTenantFormatting, useTenantSettings } from "@/components/providers/tenant-settings-provider";
import { useExcelExport } from "@/hooks/use-excel-export";
import { usePDFExport } from "@/hooks/use-pdf-export";
import { useClasses, useSections } from "@/hooks/use-queries";
import { collectAllReportRows } from "@/lib/report-pagination";
import { api } from "@/lib/api-client";
import type { ApiSuccessResponse } from "@/types/api";
import { toast } from "sonner";

interface ExamResult {
  id: string;
  studentName: string;
  className: string;
  section: string;
  rollNumber: string;
  examName: string;
  examType: "MID_TERM" | "FINAL" | "UNIT_TEST" | "QUARTERLY" | "ANNUAL";
  subject: string;
  marksObtained: number;
  maxMarks: number;
  percentage: number;
  grade: "A+" | "A" | "B" | "C" | "D" | "F";
  status: "PASS" | "FAIL";
}

interface ExamReportData {
  metrics: {
    totalExams: number;
    passPercentage: number;
    averageMarks: number;
    topPerformers: number;
    totalResults: number;
    passCount: number;
    failCount: number;
  };
  gradeDistribution: {
    "A+": number;
    A: number;
    B: number;
    C: number;
    D: number;
    F: number;
  };
  subjectWise: { subject: string; averagePercentage: number }[];
  classWise: { className: string; averagePercentage: number }[];
  failedStudents: ExamResult[];
  results: ExamResult[];
  failedStudentsTruncated?: boolean;
  pagination?: { page: number; pageSize: number; totalCount: number };
}

export default function ExamReportPage() {
  const tExam = useTranslations("reports.examReport");
  const tCommon = useTranslations("reports.common");
  const { settings } = useTenantSettings();
  const { formatDateTime } = useTenantFormatting();
  const { exportExamReport } = useExcelExport({
    fileName: "exam_report",
    schoolName: settings.name || "Pathshala Pro School",
    schoolAddress: settings.address,
    schoolPhone: settings.phone,
    schoolEmail: settings.email,
  });
  const { exportExamReportPDF } = usePDFExport();

  const [filters, setFilters] = useState<ReportFilterState>({
    fromDate: "",
    toDate: "",
    classId: "",
    sectionId: "",
    examType: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [generatedAt, setGeneratedAt] = useState("");
  const [data, setData] = useState<ExamResult[]>([]);
  const [metrics, setMetrics] = useState<ExamReportData["metrics"] | null>(null);
  const [gradeDistribution, setGradeDistribution] = useState<ExamReportData["gradeDistribution"] | null>(
    null
  );
  const [subjectWiseData, setSubjectWiseData] = useState<{ subject: string; averagePercentage: number }[]>(
    []
  );
  const [classWiseData, setClassWiseData] = useState<{ className: string; averagePercentage: number }[]>(
    []
  );
  const [failedStudents, setFailedStudents] = useState<ExamResult[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);

  // Populate the class/section dropdowns — previously rendered empty because no
  // report page supplied them, so the filters could never affect the query.
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
    from: filters.fromDate || tExam("start"),
    to: filters.toDate || tExam("present"),
  };
  const dateRangeLabel = `${dateRange.from} to ${dateRange.to}`;

  // Resolve names so the applied-filter chips read "Class: Grade 9" rather than
  // echoing back a raw UUID.
  const classLabelById = new Map(classes.map((c: any) => [c.id, c.name as string]));
  const sectionLabelById = new Map(sections.map((s: any) => [s.id, s.name as string]));
  const appliedFilters = [
    hasSpecificClass
      ? {
          label: tExam("className"),
          value: classLabelById.get(filters.classId as string) ?? (filters.classId as string),
        }
      : null,
    filters.sectionId && filters.sectionId !== "all"
      ? {
          label: tExam("section"),
          value: sectionLabelById.get(filters.sectionId) ?? filters.sectionId,
        }
      : null,
    filters.examType && filters.examType !== "all"
      ? { label: tExam("examType"), value: filters.examType }
      : null,
  ].filter((value): value is { label: string; value: string } => Boolean(value));

  // Single source for the filter query string, shared by the paged fetch and the
  // export fetch so the two can never diverge.
  const buildBaseParams = () => {
    const params = new URLSearchParams();
    if (filters.fromDate) params.set("fromDate", filters.fromDate);
    if (filters.toDate) params.set("toDate", filters.toDate);
    if (filters.classId && filters.classId !== "all") params.set("classId", filters.classId);
    if (filters.sectionId && filters.sectionId !== "all") params.set("sectionId", filters.sectionId);
    if (filters.examType && filters.examType !== "all") params.set("examType", filters.examType);
    return params;
  };

  const runReport = async (targetPage: number, targetPageSize: number) => {
    setIsLoading(true);
    try {
      const params = buildBaseParams();
      params.set("page", String(targetPage));
      params.set("pageSize", String(targetPageSize));

      const response = await api.get<ExamReportData>(`/api/reports/exams?${params.toString()}`);
      const reportData = (response as ApiSuccessResponse<ExamReportData>).data;

      setData(reportData.results || []);
      setMetrics(reportData.metrics || null);
      setGradeDistribution(reportData.gradeDistribution || null);
      setSubjectWiseData(reportData.subjectWise || []);
      setClassWiseData(reportData.classWise || []);
      setFailedStudents(reportData.failedStudents || []);
      setTotalCount(reportData.pagination?.totalCount ?? reportData.results?.length ?? 0);
      setPage(targetPage);
      setPageSize(targetPageSize);
      setHasGenerated(true);
      setGeneratedAt(formatDateTime(new Date()));
    } catch (error) {
      console.error("Failed to generate exam report:", error);
      toast.error(tExam("generateFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Exports must cover the whole filtered set, not the visible page.
   */
  const fetchAllResultsForExport = async () => {
    const base = buildBaseParams();
    return collectAllReportRows<ExamResult>(async (p, ps) => {
      const params = new URLSearchParams(base);
      params.set("page", String(p));
      params.set("pageSize", String(ps));
      const response = await api.get<ExamReportData>(`/api/reports/exams?${params.toString()}`);
      const payload = (response as ApiSuccessResponse<ExamReportData>).data;
      return {
        rows: payload.results ?? [],
        totalCount: payload.pagination?.totalCount ?? payload.results?.length ?? 0,
      };
    });
  };

  // A new filter set always restarts at page 1.
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
      examType: "",
    });
    setData([]);
    setMetrics(null);
    setGradeDistribution(null);
    setSubjectWiseData([]);
    setClassWiseData([]);
    setFailedStudents([]);
    setHasGenerated(false);
    setGeneratedAt("");
    setPage(1);
    setTotalCount(0);
  };

  const handleExportExcel = async () => {
    const { rows, truncated } = await fetchAllResultsForExport();
    const result = await exportExamReport(rows, dateRange);
    if (result.success) {
      toast.success(truncated ? tCommon("exportTruncated") : tExam("exported"));
      return;
    }
    toast.error(tExam("exportFailed"));
  };

  const handleExportPdf = async () => {
    if (!metrics) return;

    const { rows, truncated } = await fetchAllResultsForExport();
    const result = await exportExamReportPDF({
      school: schoolInfo,
      dateRangeLabel,
      generatedAt: generatedAt || formatDateTime(new Date()),
      filters: appliedFilters,
      metrics: {
        totalExams: String(metrics.totalExams),
        passPercentage: `${metrics.passPercentage}%`,
        averageMarks: `${metrics.averageMarks}%`,
        topPerformers: String(metrics.topPerformers),
      },
      records: rows.map((row) => ({
        rollNumber: row.rollNumber,
        studentName: row.studentName,
        className: row.className,
        section: row.section,
        examName: row.examName,
        subject: row.subject,
        marks: `${row.marksObtained}/${row.maxMarks}`,
        percentage: `${row.percentage}%`,
        grade: row.grade,
        status: row.status,
      })),
    });

    if (result.success) {
      toast.success(truncated ? tCommon("exportTruncated") : tExam("exported"));
      return;
    }
    toast.error(tExam("exportFailed"));
  };

  const handleExport = async (type: "excel" | "pdf") => {
    if (type === "excel") {
      await handleExportExcel();
      return;
    }
    await handleExportPdf();
  };

  const columns: ColumnDef<ExamResult>[] = [
    {
      accessorKey: "rollNumber",
      header: tExam("rollNo"),
      cell: (info: any) => (
        <span className="font-medium">
          {typeof info?.getValue === "function"
            ? info.getValue()
            : info?.row?.original?.rollNumber ?? "-"}
        </span>
      ),
    },
    { accessorKey: "studentName", header: tExam("studentName") },
    { accessorKey: "className", header: tExam("className") },
    { accessorKey: "section", header: tExam("section") },
    { accessorKey: "examName", header: tExam("exam") },
    { accessorKey: "subject", header: tExam("subject") },
    {
      accessorKey: "marksObtained",
      header: tExam("marks"),
      cell: (info: any) => {
        const marks =
          typeof info?.getValue === "function"
            ? info.getValue()
            : info?.row?.original?.marksObtained ?? "-";
        const maxMarks = info?.row?.original?.maxMarks ?? "-";
        return (
          <span className="font-medium">
            {marks} / {maxMarks}
          </span>
        );
      },
    },
    {
      accessorKey: "percentage",
      header: "%",
      cell: (info: any) => {
        const percentage =
          typeof info?.getValue === "function"
            ? info.getValue()
            : info?.row?.original?.percentage ?? 0;
        let colorClass = "text-green-600";
        if (percentage < 40) colorClass = "text-red-600";
        else if (percentage < 60) colorClass = "text-yellow-600";

        return <span className={`font-bold ${colorClass}`}>{percentage}%</span>;
      },
    },
    {
      accessorKey: "grade",
      header: tExam("grade"),
      cell: (info: any) => {
        const grade =
          typeof info?.getValue === "function"
            ? info.getValue()
            : info?.row?.original?.grade ?? "-";
        const gradeColors: Record<string, string> = {
          "A+": "bg-green-600 text-white",
          A: "bg-green-500 text-white",
          B: "bg-blue-500 text-white",
          C: "bg-yellow-500 text-white",
          D: "bg-orange-500 text-white",
          F: "bg-red-600 text-white",
        };

        return (
          <span
            className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-sm font-bold ${
              gradeColors[grade] || "bg-muted text-muted-foreground"
            }`}
          >
            {grade}
          </span>
        );
      },
    },
    {
      accessorKey: "status",
      header: tExam("status"),
      cell: (info: any) => {
        const status =
          typeof info?.getValue === "function"
            ? info.getValue()
            : info?.row?.original?.status ?? "-";
        const statusColors: Record<string, string> = {
          PASS: "bg-green-100 text-green-800",
          FAIL: "bg-red-100 text-red-800",
        };

        return (
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
              statusColors[status] || "bg-muted text-muted-foreground"
            }`}
          >
            {status}
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={tExam("title")} description={tExam("description")} icon={BookOpen} />

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
            showExamTypeFilter
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
              <ReportMetricCard title={tExam("totalExams")} value={metrics.totalExams} icon={BookOpen} />
              <ReportMetricCard
                title={tExam("passPercentage")}
                value={`${metrics.passPercentage}%`}
                icon={Award}
              />
              <ReportMetricCard
                title={tExam("averageMarks")}
                value={`${metrics.averageMarks}%`}
                icon={Trophy}
              />
              <ReportMetricCard
                title={tExam("topPerformers")}
                value={metrics.topPerformers}
                icon={Award}
              />
            </div>
          ) : undefined
        }
        insights={
          totalCount > 0 ? (
            <div className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-2">
                <PieChart
                  title={tExam("gradeDistribution")}
                  data={
                    gradeDistribution
                      ? [
                          { label: "A+", value: gradeDistribution["A+"], color: "hsl(var(--primary))" },
                          { label: "A", value: gradeDistribution.A, color: "hsl(var(--secondary))" },
                          { label: "B", value: gradeDistribution.B, color: "hsl(var(--accent))" },
                          { label: "C", value: gradeDistribution.C, color: "hsl(var(--muted))" },
                          { label: "D", value: gradeDistribution.D, color: "hsl(var(--warning))" },
                          { label: "F", value: gradeDistribution.F, color: "hsl(var(--destructive))" },
                        ].filter((item) => item.value > 0)
                      : []
                  }
                  size={200}
                />
                <BarChart
                  title={tExam("subjectWiseAnalysis")}
                  data={subjectWiseData.map((item) => ({
                    label: item.subject,
                    value: item.averagePercentage,
                    color: "hsl(var(--primary))",
                  }))}
                  height={200}
                />
              </div>

              <BarChart
                title={tExam("classWiseResults")}
                data={classWiseData.map((item) => ({
                  label: item.className,
                  value: item.averagePercentage,
                  color: "hsl(var(--primary))",
                }))}
                height={200}
              />

              {failedStudents.length > 0 ? (
                <Card className="border-red-200 bg-red-50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-red-800">
                      <AlertCircle className="h-5 w-5" />
                      {tExam("failures")} ({failedStudents.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                      {failedStudents.map((student) => (
                        <div
                          key={student.id}
                          className="flex items-center justify-between rounded-lg bg-white p-3 shadow-sm"
                        >
                          <div>
                            <p className="font-medium">{student.studentName}</p>
                            <p className="text-sm text-muted-foreground">
                              {student.className} - {student.section} | {student.subject}
                            </p>
                          </div>
                          <span className="font-bold text-red-600">
                            {student.marksObtained}/{student.maxMarks}
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
                title={tExam("reportDetailsTitle")}
                description={tExam("reportDetailsDescription")}
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
                title={tExam("noResults")}
                description={tExam("noResultsDescription")}
              />
            )
          ) : (
            <ReportEmptyState
              title={tExam("generateTitle")}
              description={tExam("generateDescription")}
              actionLabel={tExam("generateAction")}
              onAction={handleGenerateReport}
            />
          )
        }
      />
    </div>
  );
}

