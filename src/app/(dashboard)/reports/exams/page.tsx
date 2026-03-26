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
import { BookOpen, Trophy, Award, AlertCircle, FileSpreadsheet } from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ColumnDef } from "@tanstack/react-table";
import { api } from "@/lib/api-client";
import { useExcelExport } from "@/hooks/use-excel-export";
import { Button } from "@/components/ui/button";
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
  const { exportExamReport } = useExcelExport({
    schoolName: "Pathshala Pro School",
  });

  const [filters, setFilters] = useState<ReportFilterState>({
    fromDate: "",
    toDate: "",
    classId: "",
    sectionId: "",
    examType: "",
  });

  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<ExamResult[]>([]);
  const [metrics, setMetrics] = useState<ExamReportData["metrics"] | null>(null);
  const [gradeDistribution, setGradeDistribution] = useState<ExamReportData["gradeDistribution"] | null>(null);
  const [subjectWiseData, setSubjectWiseData] = useState<{ subject: string; averagePercentage: number }[]>([]);
  const [classWiseData, setClassWiseData] = useState<{ className: string; averagePercentage: number }[]>([]);
  const [failedStudents, setFailedStudents] = useState<ExamResult[]>([]);

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
      const reportData = (response as any).data;
      
      setData(reportData.results || []);
      setMetrics(reportData.metrics || null);
      setGradeDistribution(reportData.gradeDistribution || null);
      setSubjectWiseData(reportData.subjectWise || []);
      setClassWiseData(reportData.classWise || []);
      setFailedStudents(reportData.failedStudents || []);
    } catch (error) {
      console.error("Failed to generate exam report:", error);
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
  };

  const handleExportExcel = async () => {
    try {
      const result = await exportExamReport(data, {
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

  const columns: ColumnDef<ExamResult>[] = [
    {
      accessorKey: "rollNumber",
      header: "Roll No.",
      cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span>,
    },
    {
      accessorKey: "studentName",
      header: "Student Name",
    },
    {
      accessorKey: "className",
      header: "Class",
    },
    {
      accessorKey: "section",
      header: "Section",
    },
    {
      accessorKey: "examName",
      header: "Exam",
      cell: ({ getValue }) => (
        <span className="text-sm">{getValue<string>()}</span>
      ),
    },
    {
      accessorKey: "subject",
      header: "Subject",
    },
    {
      accessorKey: "marksObtained",
      header: "Marks",
      cell: ({ getValue, row }) => {
        const obtained = getValue<number>();
        const max = row.original.maxMarks;
        return (
          <span className="font-medium">
            {obtained} / {max}
          </span>
        );
      },
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
      <PageHeader
        title={tExam("title")}
        description={tExam("description")}
        icon={BookOpen}
      />

      {/* Filters */}
      <ReportFilters
        filters={filters}
        onFilterChange={setFilters}
        onGenerate={handleGenerateReport}
        onReset={handleReset}
        isLoading={isLoading}
        showClassFilter
        showSectionFilter
        showExamTypeFilter
        exportComponent={
          <ExportDropdown onExport={handleExport} disabled={data.length === 0} />
        }
      />

      {/* Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <ReportMetricCard
          title={tExam("totalExams")}
          value={metrics?.totalExams || 0}
          icon={BookOpen}
        />
        <ReportMetricCard
          title={tExam("passPercentage")}
          value={`${metrics?.passPercentage || 0}%`}
          icon={Award}
        />
        <ReportMetricCard
          title={tExam("averageMarks")}
          value={`${metrics?.averageMarks || 0}%`}
          icon={Trophy}
        />
        <ReportMetricCard
          title={tExam("topPerformers")}
          value={metrics?.topPerformers || 0}
          icon={Award}
        />
      </div>

      {/* Charts */}
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
                ].filter((d) => d.value > 0)
              : []
          }
          size={200}
        />
        <BarChart
          title={tExam("subjectWiseAnalysis")}
          data={subjectWiseData.map((s) => ({
            label: s.subject,
            value: s.averagePercentage,
            color: "hsl(var(--primary))",
          }))}
          height={200}
        />
      </div>

      <BarChart
        title={tExam("classWiseResults")}
        data={classWiseData.map((c) => ({
          label: c.className,
          value: c.averagePercentage,
          color: "hsl(var(--primary))",
        }))}
        height={200}
      />

      {/* Failed Students Alert */}
      {failedStudents.length > 0 && (
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
                  <span className="text-red-600 font-bold">
                    {student.marksObtained}/{student.maxMarks}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detailed Table */}
      <ReportTable
        title="Exam Results Details"
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
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Results</p>
              <p className="text-2xl font-bold">{metrics?.totalResults || 0}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Passed</p>
              <p className="text-2xl font-bold text-green-600">{metrics?.passCount || 0}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Failed</p>
              <p className="text-2xl font-bold text-red-600">{metrics?.failCount || 0}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Excellent (90%+)</p>
              <p className="text-2xl font-bold text-blue-600">{metrics?.topPerformers || 0}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
