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
    from: filters.fromDate || tStudent("start"),
    to: filters.toDate || tStudent("present"),
  };
  const dateRangeLabel = `${dateRange.from} to ${dateRange.to}`;
  const appliedFilters = [
    filters.classId && filters.classId !== "all" ? { label: tStudent("class"), value: filters.classId } : null,
    filters.sectionId && filters.sectionId !== "all"
      ? { label: tStudent("section"), value: filters.sectionId }
      : null,
    filters.status && filters.status !== "all" ? { label: tStudent("status"), value: filters.status } : null,
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
      toast.error(tStudent("generateFailed"));
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
      toast.success(tStudent("exported"));
      return;
    }
    toast.error(tStudent("exportFailed"));
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
      toast.success(tStudent("exported"));
      return;
    }
    toast.error(tStudent("exportFailed"));
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
      header: tStudent("admissionNo"),
      cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span>,
    },
    { accessorKey: "studentName", header: tStudent("studentName") },
    { accessorKey: "className", header: tStudent("class") },
    { accessorKey: "section", header: tStudent("section") },
    { accessorKey: "rollNumber", header: tStudent("rollNo") },
    { accessorKey: "gender", header: tStudent("gender"), cell: ({ getValue }) => getValue<string>() },
    {
      accessorKey: "status",
      header: tStudent("status"),
      cell: ({ getValue }) => (
        <StatusBadge
          status={getValue<string>()}
          domain="student"
        />
      ),
    },
    { accessorKey: "admissionDate", header: tStudent("admissionDate") },
    { accessorKey: "guardianName", header: tStudent("guardianName") },
    { accessorKey: "contactNumber", header: tStudent("contact") },
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
              { value: "ACTIVE", label: tStudent("active") },
              { value: "INACTIVE", label: tStudent("inactive") },
              { value: "GRADUATED", label: tStudent("graduated") },
              { value: "TRANSFERRED", label: tStudent("transferred") },
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
                    { label: tStudent("male"), value: genderData?.male || 0, color: "hsl(var(--primary))" },
                    { label: tStudent("female"), value: genderData?.female || 0, color: "hsl(var(--secondary))" },
                    { label: tStudent("other"), value: genderData?.other || 0, color: "hsl(var(--accent))" },
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
                title={tStudent("studentDetails")}
                description={tStudent("studentDetailsDescription")}
                columns={columns}
                data={data}
                isLoading={isLoading}
                showExport={false}
                onExportCSV={handleExportExcel}
              />
            ) : (
              <ReportEmptyState
                title={tStudent("noStudentsTitle")}
                description={tStudent("noStudentsDescription")}
              />
            )
          ) : (
            <ReportEmptyState
              title={tStudent("generateTitle")}
              description={tStudent("generateDescription")}
              actionLabel={tStudent("generateReport")}
              onAction={handleGenerateReport}
            />
          )
        }
      />
    </div>
  );
}

