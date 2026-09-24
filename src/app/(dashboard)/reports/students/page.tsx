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
import { useClasses, useSections } from "@/hooks/use-queries";
import { collectAllReportRows } from "@/lib/report-pagination";
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
  pagination?: { page: number; pageSize: number; totalCount: number };
}

export default function StudentReportPage() {
  const tStudent = useTranslations("reports.studentReport");
  const tCommon = useTranslations("reports.common");
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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);

  // Populate the class/section dropdowns — previously rendered empty because no
  // report page supplied them.
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
    from: filters.fromDate || tStudent("start"),
    to: filters.toDate || tStudent("present"),
  };
  const dateRangeLabel = `${dateRange.from} to ${dateRange.to}`;

  // Resolve names so the applied-filter chips read "Class: Grade 9" rather than
  // echoing back a raw UUID.
  const classLabelById = new Map(classes.map((c: any) => [c.id, c.name as string]));
  const sectionLabelById = new Map(sections.map((s: any) => [s.id, s.name as string]));
  const appliedFilters = [
    hasSpecificClass
      ? {
          label: tStudent("class"),
          value: classLabelById.get(filters.classId as string) ?? (filters.classId as string),
        }
      : null,
    filters.sectionId && filters.sectionId !== "all"
      ? {
          label: tStudent("section"),
          value: sectionLabelById.get(filters.sectionId) ?? filters.sectionId,
        }
      : null,
    filters.status && filters.status !== "all" ? { label: tStudent("status"), value: filters.status } : null,
  ].filter((value): value is { label: string; value: string } => Boolean(value));

  // Single source for the filter query string, shared by the paged fetch and the
  // export fetch so the two can never diverge.
  const buildBaseParams = () => {
    const params = new URLSearchParams();
    if (filters.fromDate) params.set("fromDate", filters.fromDate);
    if (filters.toDate) params.set("toDate", filters.toDate);
    if (filters.classId && filters.classId !== "all") params.set("classId", filters.classId);
    if (filters.sectionId && filters.sectionId !== "all") params.set("sectionId", filters.sectionId);
    if (filters.status && filters.status !== "all") params.set("status", filters.status);
    return params;
  };

  const runReport = async (targetPage: number, targetPageSize: number) => {
    setIsLoading(true);
    try {
      const params = buildBaseParams();
      params.set("page", String(targetPage));
      params.set("pageSize", String(targetPageSize));

      const response = await api.get<StudentReportData>(`/api/reports/students?${params.toString()}`);
      const reportData = (response as ApiSuccessResponse<StudentReportData>).data;

      setData(reportData.students || []);
      setMetrics(reportData.metrics || null);
      setGenderData(reportData.genderDistribution || null);
      setClassWiseData(reportData.classWise || []);
      setAdmissionTrendData(reportData.admissionTrend || []);
      setTotalCount(reportData.pagination?.totalCount ?? reportData.students?.length ?? 0);
      setPage(targetPage);
      setPageSize(targetPageSize);
      setHasGenerated(true);
      setGeneratedAt(formatDateTime(new Date()));
    } catch (error) {
      console.error("Failed to generate student report:", error);
      toast.error(tStudent("generateFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Exports must cover the whole filtered set, not the visible page.
   */
  const fetchAllStudentsForExport = async () => {
    const base = buildBaseParams();
    return collectAllReportRows<StudentRecord>(async (p, ps) => {
      const params = new URLSearchParams(base);
      params.set("page", String(p));
      params.set("pageSize", String(ps));
      const response = await api.get<StudentReportData>(`/api/reports/students?${params.toString()}`);
      const payload = (response as ApiSuccessResponse<StudentReportData>).data;
      return {
        rows: payload.students ?? [],
        totalCount: payload.pagination?.totalCount ?? payload.students?.length ?? 0,
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
      status: "",
    });
    setData([]);
    setMetrics(null);
    setGenderData(null);
    setClassWiseData([]);
    setAdmissionTrendData([]);
    setHasGenerated(false);
    setGeneratedAt("");
    setPage(1);
    setTotalCount(0);
  };

  const handleExportExcel = async () => {
    const { rows, truncated } = await fetchAllStudentsForExport();
    const result = await exportStudentReport(rows, dateRange);
    if (result.success) {
      toast.success(truncated ? tCommon("exportTruncated") : tStudent("exported"));
      return;
    }
    toast.error(tStudent("exportFailed"));
  };

  const handleExportPdf = async () => {
    if (!metrics) return;

    const { rows, truncated } = await fetchAllStudentsForExport();
    const result = await exportStudentReportPDF({
      school: schoolInfo,
      dateRangeLabel,
      generatedAt: generatedAt || formatDateTime(new Date()),
      filters: appliedFilters,
      metrics,
      records: rows as any,
    });

    if (result.success) {
      toast.success(truncated ? tCommon("exportTruncated") : tStudent("exported"));
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
            classes={classes.map((c: any) => ({ id: c.id, name: c.name }))}
            sections={sections.map((s: any) => ({ id: s.id, name: s.name }))}
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
              recordCount={totalCount}
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
          totalCount > 0 ? (
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
            totalCount > 0 || isLoading ? (
              <ReportTable
                title={tStudent("studentDetails")}
                description={tStudent("studentDetailsDescription")}
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

