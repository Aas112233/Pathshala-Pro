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
}

export default function ExamReportPage() {
  const tExam = useTranslations("reports.examReport");
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
    filters.examType && filters.examType !== "all"
      ? { label: "Exam type", value: filters.examType }
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
      if (filters.examType && filters.examType !== "all") params.set("examType", filters.examType);

      const response = await api.get<ExamReportData>(`/api/reports/exams?${params.toString()}`);
      const reportData = (response as ApiSuccessResponse<ExamReportData>).data;

      setData(reportData.results || []);
      setMetrics(reportData.metrics || null);
      setGradeDistribution(reportData.gradeDistribution || null);
      setSubjectWiseData(reportData.subjectWise || []);
      setClassWiseData(reportData.classWise || []);
      setFailedStudents(reportData.failedStudents || []);
      setHasGenerated(true);
      setGeneratedAt(formatDateTime(new Date()));
    } catch (error) {
      console.error("Failed to generate exam report:", error);
      toast.error("Failed to generate exam report");
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
  };

  const handleExportExcel = async () => {
    const result = await exportExamReport(data, dateRange);
    if (result.success) {
      toast.success("Exam report exported");
      return;
    }
    toast.error("Failed to export exam report");
  };

  const handleExportPdf = async () => {
    if (!metrics) return;

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
      records: data.map((row) => ({
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
      toast.success("Exam report exported");
      return;
    }
    toast.error("Failed to export exam report");
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
      header: "Roll No.",
      cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span>,
    },
    { accessorKey: "studentName", header: "Student Name" },
    { accessorKey: "className", header: "Class" },
    { accessorKey: "section", header: "Section" },
    { accessorKey: "examName", header: "Exam" },
    { accessorKey: "subject", header: "Subject" },
    {
      accessorKey: "marksObtained",
      header: "Marks",
      cell: ({ getValue, row }) => (
        <span className="font-medium">
          {getValue<number>()} / {row.original.maxMarks}
        </span>
      ),
    },
    {
      accessorKey: "percentage",
      header: "%",
      cell: ({ getValue }) => {
        const percentage = getValue<number>();
        let colorClass = "text-green-600";
        if (percentage < 40) colorClass = "text-red-600";
        else if (percentage < 60) colorClass = "text-yellow-600";

        return <span className={`font-bold ${colorClass}`}>{percentage}%</span>;
      },
    },
    {
      accessorKey: "grade",
      header: "Grade",
      cell: ({ getValue }) => {
        const grade = getValue<string>();
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
              gradeColors[grade] || "bg-gray-100 text-gray-800"
            }`}
          >
            {grade}
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
          PASS: "bg-green-100 text-green-800",
          FAIL: "bg-red-100 text-red-800",
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
          data.length > 0 ? (
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
            data.length > 0 || isLoading ? (
              <ReportTable
                title="Exam Results Details"
                description="Detailed exam results for the selected filters."
                columns={columns}
                data={data}
                isLoading={isLoading}
                showExport={false}
                onExportCSV={handleExportExcel}
              />
            ) : (
              <ReportEmptyState
                title="No exam results found"
                description="Try another exam type, section, or reporting period."
              />
            )
          ) : (
            <ReportEmptyState
              title="Generate an exam report"
              description="Select the reporting period and optional class filters to review exam performance and export the report."
              actionLabel="Generate report"
              onAction={handleGenerateReport}
            />
          )
        }
      />
    </div>
  );
}

