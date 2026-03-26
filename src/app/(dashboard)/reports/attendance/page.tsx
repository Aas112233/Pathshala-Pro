"use client";

import { PageHeader } from "@/components/shared/page-header";
import {
  ReportFilters,
  ReportMetricCard,
  ReportTable,
  BarChart,
  LineChart,
  ExportDropdown,
} from "@/components/reports";
import type { ReportFilterState } from "@/components/reports";
import { useTranslations } from "next-intl";
import { CalendarCheck, Percent, AlertTriangle, Users, FileSpreadsheet } from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ColumnDef } from "@tanstack/react-table";
import { api } from "@/lib/api-client";
import { useExcelExport } from "@/hooks/use-excel-export";
import { Button } from "@/components/ui/button";
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
  const { exportAttendanceReport } = useExcelExport({
    schoolName: "Pathshala Pro School",
  });

  const [filters, setFilters] = useState<ReportFilterState>({
    fromDate: "",
    toDate: "",
    classId: "",
    sectionId: "",
  });

  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<AttendanceRecord[]>([]);
  const [metrics, setMetrics] = useState<AttendanceReportData["metrics"] | null>(null);
  const [classWiseData, setClassWiseData] = useState<{ className: string; averagePercentage: number }[]>([]);

  const handleGenerateReport = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.fromDate) params.set("fromDate", filters.fromDate);
      if (filters.toDate) params.set("toDate", filters.toDate);
      if (filters.classId && filters.classId !== "all") params.set("classId", filters.classId);
      if (filters.sectionId && filters.sectionId !== "all") params.set("sectionId", filters.sectionId);

      const response = await api.get<AttendanceReportData>(`/api/reports/attendance?${params.toString()}`);
      const reportData = (response as any).data;
      
      setData(reportData.records || []);
      setMetrics(reportData.metrics || null);
      setClassWiseData(reportData.classWise || []);
    } catch (error) {
      console.error("Failed to generate attendance report:", error);
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
  };

  const handleExportExcel = async () => {
    try {
      const result = await exportAttendanceReport(data, {
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

  const columns: ColumnDef<AttendanceRecord>[] = [
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
      accessorKey: "presentDays",
      header: "Present",
      cell: ({ getValue }) => (
        <span className="text-green-600 font-medium">{getValue<number>()}</span>
      ),
    },
    {
      accessorKey: "absentDays",
      header: "Absent",
      cell: ({ getValue }) => (
        <span className="text-red-600 font-medium">{getValue<number>()}</span>
      ),
    },
    {
      accessorKey: "totalDays",
      header: "Total Days",
    },
    {
      accessorKey: "attendancePercentage",
      header: "Attendance %",
      cell: ({ getValue }) => {
        const percentage = getValue<number>();
        let colorClass = "text-green-600";
        if (percentage < 75) colorClass = "text-red-600";
        else if (percentage < 85) colorClass = "text-yellow-600";

        return (
          <span className={`font-bold ${colorClass}`}>{percentage}%</span>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ getValue }) => {
        const status = getValue<string>();
        const statusColors: Record<string, string> = {
          GOOD: "bg-green-100 text-green-800",
          AVERAGE: "bg-yellow-100 text-yellow-800",
          DEFICIT: "bg-red-100 text-red-800",
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

  // Defaulter list (students with < 75% attendance)
  const defaulters = data.filter((r) => r.attendancePercentage < 75);

  return (
    <div className="space-y-6">
      <PageHeader
        title={tAttendance("title")}
        description={tAttendance("description")}
        icon={CalendarCheck}
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
        exportComponent={
          <ExportDropdown onExport={handleExport} disabled={data.length === 0} />
        }
      />

      {/* Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <ReportMetricCard
          title={tAttendance("averageAttendance")}
          value={`${metrics?.averageAttendance || 0}%`}
          icon={Percent}
        />
        <ReportMetricCard
          title={tAttendance("presentDays")}
          value={metrics?.totalPresent || 0}
          icon={CalendarCheck}
        />
        <ReportMetricCard
          title={tAttendance("absentDays")}
          value={metrics?.totalAbsent || 0}
          icon={AlertTriangle}
        />
        <ReportMetricCard
          title={tAttendance("defaulterList")}
          value={metrics?.defaulterCount || 0}
          icon={Users}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <BarChart
          title={tAttendance("classWiseAttendance")}
          data={classWiseData.map((c) => ({
            label: c.className,
            value: c.averagePercentage,
            color: "hsl(var(--primary))",
          }))}
          height={200}
        />
        <LineChart
          title="Attendance Trend"
          data={data.slice(0, 5).map((_, i) => ({
            label: `S${i + 1}`,
            value: data[i]?.attendancePercentage || 0,
          }))}
          height={200}
        />
      </div>

      {/* Defaulter List */}
      {defaulters.length > 0 && (
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
                  <span className="text-red-600 font-bold">
                    {defaulter.attendancePercentage}%
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detailed Table */}
      <ReportTable
        title="Attendance Details"
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
              <p className="text-sm text-muted-foreground">Total Students</p>
              <p className="text-2xl font-bold">{metrics?.totalStudents || data.length}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Good Attendance</p>
              <p className="text-2xl font-bold text-green-600">
                {data.filter((r) => r.status === "GOOD").length}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Average Attendance</p>
              <p className="text-2xl font-bold text-yellow-600">
                {data.filter((r) => r.status === "AVERAGE").length}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Deficit Attendance</p>
              <p className="text-2xl font-bold text-red-600">
                {data.filter((r) => r.status === "DEFICIT").length}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
