import {
  PdfFilterItem,
  PdfSchoolInfo,
  ReportBaseTemplate,
} from "./report-base";

interface AttendanceRow {
  rollNumber: string;
  studentName: string;
  className: string;
  section: string;
  presentDays: number;
  absentDays: number;
  totalDays: number;
  attendancePercentage: string;
  status: string;
  [key: string]: string | number;
}

interface AttendanceReportTemplateProps {
  school: PdfSchoolInfo;
  dateRangeLabel: string;
  generatedAt: string;
  filters: PdfFilterItem[];
  metrics: {
    averageAttendance: string;
    totalPresent: string;
    totalAbsent: string;
    defaulterCount: string;
  };
  records: AttendanceRow[];
}

export function AttendanceReportTemplate({
  school,
  dateRangeLabel,
  generatedAt,
  filters,
  metrics,
  records,
}: AttendanceReportTemplateProps) {
  return (
    <ReportBaseTemplate
      school={school}
      title="Attendance Analysis Report"
      subtitle="Attendance patterns and defaulter analysis"
      generatedAt={generatedAt}
      dateRangeLabel={dateRangeLabel}
      recordCount={records.length}
      filters={filters}
      metrics={[
        { label: "Average attendance", value: metrics.averageAttendance, tone: "success" },
        { label: "Present days", value: metrics.totalPresent },
        { label: "Absent days", value: metrics.totalAbsent, tone: "warning" },
        { label: "Defaulters", value: metrics.defaulterCount, tone: "danger" },
      ]}
      columns={[
        { key: "rollNumber", label: "Roll No.", flex: 0.9, align: "center" },
        { key: "studentName", label: "Student", flex: 1.8 },
        { key: "className", label: "Class", flex: 0.9 },
        { key: "section", label: "Section", flex: 0.8, align: "center" },
        { key: "presentDays", label: "Present", flex: 0.9, align: "center" },
        { key: "absentDays", label: "Absent", flex: 0.9, align: "center" },
        { key: "totalDays", label: "Total", flex: 0.9, align: "center" },
        { key: "attendancePercentage", label: "Attendance %", flex: 1, align: "center" },
        { key: "status", label: "Status", flex: 1, align: "center" },
      ]}
      rows={records}
      notes={[
        "Attendance percentage is calculated from present days divided by total days.",
        "Students below the minimum threshold should be reviewed by the class teacher.",
      ]}
    />
  );
}
