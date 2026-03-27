import {
  PdfFilterItem,
  PdfSchoolInfo,
  ReportBaseTemplate,
} from "./report-base";

interface ExamRow {
  rollNumber: string;
  studentName: string;
  className: string;
  section: string;
  examName: string;
  subject: string;
  marks: string;
  percentage: string;
  grade: string;
  status: string;
  [key: string]: string | number;
}

interface ExamReportTemplateProps {
  school: PdfSchoolInfo;
  dateRangeLabel: string;
  generatedAt: string;
  filters: PdfFilterItem[];
  metrics: {
    totalExams: string;
    passPercentage: string;
    averageMarks: string;
    topPerformers: string;
  };
  records: ExamRow[];
}

export function ExamReportTemplate({
  school,
  dateRangeLabel,
  generatedAt,
  filters,
  metrics,
  records,
}: ExamReportTemplateProps) {
  return (
    <ReportBaseTemplate
      school={school}
      title="Exam Performance Report"
      subtitle="Exam results and subject performance analysis"
      generatedAt={generatedAt}
      dateRangeLabel={dateRangeLabel}
      recordCount={records.length}
      filters={filters}
      metrics={[
        { label: "Total exams", value: metrics.totalExams },
        { label: "Pass percentage", value: metrics.passPercentage, tone: "success" },
        { label: "Average marks", value: metrics.averageMarks },
        { label: "Top performers", value: metrics.topPerformers, tone: "warning" },
      ]}
      columns={[
        { key: "rollNumber", label: "Roll No.", flex: 0.8, align: "center" },
        { key: "studentName", label: "Student", flex: 1.7 },
        { key: "className", label: "Class", flex: 0.8 },
        { key: "section", label: "Section", flex: 0.7, align: "center" },
        { key: "examName", label: "Exam", flex: 1.4 },
        { key: "subject", label: "Subject", flex: 1.2 },
        { key: "marks", label: "Marks", flex: 0.9, align: "center" },
        { key: "percentage", label: "%", flex: 0.7, align: "center" },
        { key: "grade", label: "Grade", flex: 0.7, align: "center" },
        { key: "status", label: "Status", flex: 0.8, align: "center" },
      ]}
      rows={records}
      notes={[
        "Pass and grade values are based on the configured grading logic at export time.",
        "Use the detailed spreadsheet export for deeper subject-level analysis.",
      ]}
    />
  );
}

