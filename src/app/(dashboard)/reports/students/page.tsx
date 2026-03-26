"use client";

import { PageHeader } from "@/components/shared/page-header";
import { ReportFilters, ReportMetricCard, ReportTable, BarChart, PieChart, ExportDropdown } from "@/components/reports";
import type { ReportFilterState } from "@/components/reports";
import { useTranslations } from "next-intl";
import { GraduationCap, UserPlus, UserCheck, UserMinus, FileSpreadsheet, FileText, Download } from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ColumnDef } from "@tanstack/react-table";
import { api } from "@/lib/api-client";
import { useExcelExport } from "@/hooks/use-excel-export";
import { Button } from "@/components/ui/button";
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
  const { exportStudentReport } = useExcelExport({
    schoolName: "Pathshala Pro School",
  });

  const [filters, setFilters] = useState<ReportFilterState>({
    fromDate: "",
    toDate: "",
    classId: "",
    sectionId: "",
    status: "",
  });

  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<StudentRecord[]>([]);
  const [metrics, setMetrics] = useState<StudentReportData["metrics"] | null>(null);
  const [genderData, setGenderData] = useState<StudentReportData["genderDistribution"] | null>(null);
  const [classWiseData, setClassWiseData] = useState<{ className: string; count: number }[]>([]);
  const [admissionTrendData, setAdmissionTrendData] = useState<{ month: string; count: number }[]>([]);

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
      const reportData = (response as any).data;
      
      setData(reportData.students || []);
      setMetrics(reportData.metrics || null);
      setGenderData(reportData.genderDistribution || null);
      setClassWiseData(reportData.classWise || []);
      setAdmissionTrendData(reportData.admissionTrend || []);
    } catch (error) {
      console.error("Failed to generate student report:", error);
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
  };

  const handleExportExcel = async () => {
    try {
      const result = await exportStudentReport(data, {
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

  const columns: ColumnDef<StudentRecord>[] = [
    {
      accessorKey: "admissionNumber",
      header: "Admission No.",
      cell: ({ getValue }) => (
        <span className="font-medium">{getValue<string>()}</span>
      ),
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
      accessorKey: "rollNumber",
      header: "Roll No.",
    },
    {
      accessorKey: "gender",
      header: "Gender",
      cell: ({ getValue }) => getValue<string>(),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ getValue }) => {
        const status = getValue<string>();
        const statusColors: Record<string, string> = {
          ACTIVE: "bg-green-100 text-green-800",
          INACTIVE: "bg-gray-100 text-gray-800",
          GRADUATED: "bg-blue-100 text-blue-800",
          TRANSFERRED: "bg-orange-100 text-orange-800",
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
      accessorKey: "admissionDate",
      header: "Admission Date",
    },
    {
      accessorKey: "guardianName",
      header: "Guardian Name",
    },
    {
      accessorKey: "contactNumber",
      header: "Contact",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={tStudent("title")}
        description={tStudent("description")}
        icon={GraduationCap}
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
        showStatusFilter
        exportComponent={
          <ExportDropdown onExport={handleExport} disabled={data.length === 0} />
        }
      />

      {/* Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <ReportMetricCard
          title={tStudent("totalStudents")}
          value={metrics?.totalStudents || 0}
          icon={GraduationCap}
        />
        <ReportMetricCard
          title={tStudent("activeStudents")}
          value={metrics?.activeStudents || 0}
          icon={UserCheck}
        />
        <ReportMetricCard
          title={tStudent("newAdmissions")}
          value={metrics?.newAdmissions || 0}
          icon={UserPlus}
        />
        <ReportMetricCard
          title={tStudent("transferredOut")}
          value={(metrics?.transferredOut || 0) + (metrics?.graduated || 0)}
          icon={UserMinus}
        />
      </div>

      {/* Charts */}
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
          data={classWiseData.map((c) => ({
            label: c.className,
            value: c.count,
            color: "hsl(var(--primary))",
          }))}
          height={200}
        />
      </div>

      <BarChart
        title={tStudent("admissionTrend")}
        data={admissionTrendData.map((t) => ({
          label: t.month,
          value: t.count,
          color: "hsl(var(--primary))",
        }))}
        height={200}
      />

      {/* Detailed Table */}
      <ReportTable
        title="Student Details"
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
              <p className="text-sm text-muted-foreground">Male Students</p>
              <p className="text-2xl font-bold">{genderData?.male || 0}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Female Students</p>
              <p className="text-2xl font-bold">{genderData?.female || 0}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Graduated</p>
              <p className="text-2xl font-bold text-blue-600">{metrics?.graduated || 0}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Transferred</p>
              <p className="text-2xl font-bold text-orange-600">
                {metrics?.transferredOut || 0}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
