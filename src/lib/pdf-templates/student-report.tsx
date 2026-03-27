import {
  PdfFilterItem,
  PdfSchoolInfo,
  ReportBaseTemplate,
} from "./report-base";

interface StudentRecord {
  admissionNumber: string;
  studentName: string;
  className: string;
  section: string;
  rollNumber: string;
  gender: string;
  status: string;
  admissionDate: string;
  guardianName: string;
  contactNumber: string;
  [key: string]: string | number;
}

interface StudentReportTemplateProps {
  school: PdfSchoolInfo;
  dateRangeLabel: string;
  generatedAt: string;
  filters: PdfFilterItem[];
  metrics: {
    totalStudents: number;
    activeStudents: number;
    newAdmissions: number;
    transferredOut: number;
    graduated: number;
  };
  records: StudentRecord[];
}

export function StudentReportTemplate({
  school,
  dateRangeLabel,
  generatedAt,
  filters,
  metrics,
  records,
}: StudentReportTemplateProps) {
  return (
    <ReportBaseTemplate
      school={school}
      title="Student Enrollment Report"
      subtitle="Student enrollment and demographic overview"
      generatedAt={generatedAt}
      dateRangeLabel={dateRangeLabel}
      recordCount={records.length}
      filters={filters}
      metrics={[
        { label: "Total students", value: String(metrics.totalStudents) },
        { label: "Active students", value: String(metrics.activeStudents), tone: "success" },
        { label: "New admissions", value: String(metrics.newAdmissions) },
        {
          label: "Transferred / graduated",
          value: String(metrics.transferredOut + metrics.graduated),
          tone: "warning",
        },
      ]}
      columns={[
        { key: "admissionNumber", label: "Admission No.", flex: 1.1 },
        { key: "studentName", label: "Student", flex: 1.8 },
        { key: "className", label: "Class", flex: 0.9 },
        { key: "section", label: "Section", flex: 0.8, align: "center" },
        { key: "rollNumber", label: "Roll No.", flex: 0.9, align: "center" },
        { key: "gender", label: "Gender", flex: 0.8, align: "center" },
        { key: "status", label: "Status", flex: 1, align: "center" },
        { key: "admissionDate", label: "Admission Date", flex: 1.1, align: "center" },
        { key: "guardianName", label: "Guardian", flex: 1.5 },
        { key: "contactNumber", label: "Contact", flex: 1.2 },
      ]}
      rows={records}
      notes={[
        "Status values reflect the current enrollment state at report generation time.",
        "This report contains confidential student information.",
      ]}
    />
  );
}

