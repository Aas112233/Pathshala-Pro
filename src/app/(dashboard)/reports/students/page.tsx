"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { GraduationCap, UserCheck, UserMinus, UserPlus } from "lucide-react";
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

interface StudentRecord {
  id: string;
  studentName: string;
  className: string;
  section: string;
  rollNumber: string;
  admissionNumber: string;
  gender: "MALE" | "FEMALE" | "OTHER";
  status: "ACTIVE" | "INACTIVE" | "GRADUATED" | "TRANSFERRED";
  admissionDate: string;
  dateOfBirth: string | null;
  guardianName: string;
  contactNumber: string;
}

interface StudentReportData {
  metrics: {
    totalStudents: number;
    activeStudents: number;
    newAdmissions: number;
    transferredOut: number;
    graduated: number;
  };
  genderDistribution: {
    male: number;
    female: number;
    other: number;
  };
  classWise: { className: string; count: number }[];
  admissionTrend: { month: string; count: number }[];
  students: StudentRecord[];
}

export default function StudentReportPage() {
  const tStudent = useTranslations("reports.studentReport");
  const { settings } = useTenantSettings();
  const { formatDateTime } = useTenantFormatting();
  const { exportStudentReport } = useExcelExport({
    fileName: "student_report",
    schoolName: settings.name || "Pathshala Pro School",
    schoolAddress: settings.address,
    schoolPhone: settings.phone,
    schoolEmail: settings.email,
  });
  const { exportStudentReportPDF } = usePDFExport();

  const [filters, setFilters] = useState<ReportFilterState>({
    fromDate: "",
    toDate: "",
    classId: "",
    sectionId: "",
    status: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [generatedAt, setGeneratedAt] = useState("");
  const [data, setData] = useState<StudentRecord[]>([]);
  const [metrics, setMetrics] = useState<StudentReportData["metrics"] | null>(null);
  const [genderData, setGenderData] = useState<StudentReportData["genderDistribution"] | null>(null);
  const [classWiseData, setClassWiseData] = useState<{ className: string; count: number }[]>([]);
  const [admissionTrendData, setAdmissionTrendData] = useState<{ month: string; count: number }[]>(
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
    filters.status && filters.status !== "all" ? { label: "Status", value: filters.status } : null,
  ].filter((value): value is { label: string; value: string } => Boolean(value));

  const handleGenerateReport = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.fromDate) params.set("fromDate", filters.fromDate);
      if (filters.toDate) params.set("toDate", filters.toDate);
      if (filters.classId && filters.classId !== "all") params.set("classId", filters.classId);
      if (filters.sectionId && filters.sectionId !== "all") params.set("sectionId", filters.sectionId);
      if (filters.status && filters.status !== "all") params.set("status", filters.status);

      const response = await api.get<StudentReportData>(`/api/reports/students?${params.toString()}`);
      const reportData = (response as ApiSuccessResponse<StudentReportData>).data;

      setData(reportData.students || []);
      setMetrics(reportData.metrics || null);
      setGenderData(reportData.genderDistribution || null);
      setClassWiseData(reportData.classWise || []);
      setAdmissionTrendData(reportData.admissionTrend || []);
      setHasGenerated(true);
      setGeneratedAt(formatDateTime(new Date()));
    } catch (error) {
      console.error("Failed to generate student report:", error);
      toast.error("Failed to generate student report");
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
      status: "",
    });
    setData([]);
    setMetrics(null);
    setGenderData(null);
    setClassWiseData([]);
    setAdmissionTrendData([]);
    setHasGenerated(false);
    setGeneratedAt("");
  };

  const handleExportExcel = async () => {
    const result = await exportStudentReport(data, dateRange);
    if (result.success) {
      toast.success("Student report exported");
      return;
    }
    toast.error("Failed to export student report");
  };

  const handleExportPdf = async () => {
    if (!metrics) return;

    const result = await exportStudentReportPDF({
      school: schoolInfo,
      dateRangeLabel,
      generatedAt: generatedAt || formatDateTime(new Date()),
      filters: appliedFilters,
      metrics,
      records: data as any,
    });

    if (result.success) {
      toast.success("Student report exported");
      return;
    }
    toast.error("Failed to export student report");
  };

  const handleExport = async (type: "excel" | "pdf") => {
    if (type === "excel") {
      await handleExportExcel();
      return;
    }
    await handleExportPdf();
  };

  const columns: ColumnDef<StudentRecord>[] = [
    {
      accessorKey: "admissionNumber",
      header: "Admission No.",
      cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span>,
    },
    { accessorKey: "studentName", header: "Student Name" },
    { accessorKey: "className", header: "Class" },
    { accessorKey: "section", header: "Section" },
    { accessorKey: "rollNumber", header: "Roll No." },
    { accessorKey: "gender", header: "Gender", cell: ({ getValue }) => getValue<string>() },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ getValue }) => (
        <StatusBadge
          status={getValue<string>()}
          domain="student"
        />
      ),
    },
    { accessorKey: "admissionDate", header: "Admission Date" },
    { accessorKey: "guardianName", header: "Guardian Name" },
    { accessorKey: "contactNumber", header: "Contact" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={tStudent("title")}
        description={tStudent("description")}
        icon={GraduationCap}
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
            showStatusFilter
            statusOptions={[
              { value: "ACTIVE", label: "Active" },
              { value: "INACTIVE", label: "Inactive" },
              { value: "GRADUATED", label: "Graduated" },
              { value: "TRANSFERRED", label: "Transferred" },
            ]}
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
                title={tStudent("totalStudents")}
                value={metrics.totalStudents}
                icon={GraduationCap}
              />
              <ReportMetricCard
                title={tStudent("activeStudents")}
                value={metrics.activeStudents}
                icon={UserCheck}
              />
              <ReportMetricCard
                title={tStudent("newAdmissions")}
                value={metrics.newAdmissions}
                icon={UserPlus}
              />
              <ReportMetricCard
                title={tStudent("transferredOut")}
                value={metrics.transferredOut + metrics.graduated}
                icon={UserMinus}
              />
            </div>
          ) : undefined
        }
        insights={
          data.length > 0 ? (
            <div className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-2">
                <PieChart
                  title={tStudent("genderDistribution")}
                  data={[
                    { label: "Male", value: genderData?.male || 0, color: "hsl(var(--primary))" },
                    { label: "Female", value: genderData?.female || 0, color: "hsl(var(--secondary))" },
                    { label: "Other", value: genderData?.other || 0, color: "hsl(var(--accent))" },
                  ]}
                  size={200}
                />
                <BarChart
                  title={tStudent("classWiseStrength")}
                  data={classWiseData.map((item) => ({
                    label: item.className,
                    value: item.count,
                    color: "hsl(var(--primary))",
                  }))}
                  height={200}
                />
              </div>

              <BarChart
                title={tStudent("admissionTrend")}
                data={admissionTrendData.map((item) => ({
                  label: item.month,
                  value: item.count,
                  color: "hsl(var(--primary))",
                }))}
                height={200}
              />
            </div>
          ) : undefined
        }
        table={
          hasGenerated || isLoading ? (
            data.length > 0 || isLoading ? (
              <ReportTable
                title="Student Details"
                description="Generated results based on the selected filters."
                columns={columns}
                data={data}
                isLoading={isLoading}
                showExport={false}
                onExportCSV={handleExportExcel}
              />
            ) : (
              <ReportEmptyState
                title="No students found"
                description="Try widening the date range or removing one of the filters."
              />
            )
          ) : (
            <ReportEmptyState
              title="Generate a student report"
              description="Select a period and optional filters, then generate the report to view metrics, charts, and export options."
              actionLabel="Generate report"
              onAction={handleGenerateReport}
            />
          )
        }
      />
    </div>
  );
}

