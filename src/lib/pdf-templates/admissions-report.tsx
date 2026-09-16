import {
  PdfFilterItem,
  PdfMetricItem,
  PdfSchoolInfo,
  PdfCommonLabels,
  ReportBaseTemplate,
} from "./report-base";

export interface AdmissionsReportTemplateProps {
  locale?: string;
  school: PdfSchoolInfo;
  title: string;
  subtitle?: string;
  generatedAt: string;
  dateRangeLabel: string;
  filters: PdfFilterItem[];
  metrics: PdfMetricItem[];
  records: Array<Record<string, string | number>>;
  notes?: string[];
  labels?: PdfCommonLabels;
}

export function AdmissionsReportTemplate({
  locale,
  school,
  title,
  subtitle,
  generatedAt,
  dateRangeLabel,
  filters,
  metrics,
  records,
  notes,
  labels,
}: AdmissionsReportTemplateProps) {
  return (
    <ReportBaseTemplate
      locale={locale}
      school={school}
      title={title}
      subtitle={subtitle}
      generatedAt={generatedAt}
      dateRangeLabel={dateRangeLabel}
      recordCount={records.length}
      filters={filters}
      metrics={metrics}
      columns={[
        { key: "studentName", label: "Applicant", flex: 1.6 },
        { key: "guardianName", label: "Guardian", flex: 1.5 },
        { key: "phone", label: "Phone", flex: 1.1 },
        { key: "className", label: "Class", flex: 0.9, align: "center" },
        { key: "source", label: "Source", flex: 1, align: "center" },
        { key: "status", label: "Status", flex: 1, align: "center" },
        { key: "assignedToName", label: "Assigned To", flex: 1.3 },
        { key: "createdAt", label: "Enquiry Date", flex: 1.1, align: "center" },
      ]}
      rows={records}
      labels={labels}
      notes={notes}
    />
  );
}
