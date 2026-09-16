import {
  PdfFilterItem,
  PdfMetricItem,
  PdfSchoolInfo,
  PdfCommonLabels,
  ReportBaseTemplate,
} from "./report-base";

export interface SalaryReportTemplateProps {
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

export function SalaryReportTemplate({
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
}: SalaryReportTemplateProps) {
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
        { key: "staffId", label: "Staff ID", flex: 1 },
        { key: "staffName", label: "Employee", flex: 1.7 },
        { key: "department", label: "Department", flex: 1 },
        { key: "period", label: "Period", flex: 1, align: "center" },
        { key: "baseSalary", label: "Gross", flex: 1, align: "right" },
        { key: "deductions", label: "Deductions", flex: 1, align: "right" },
        { key: "netPayable", label: "Net Payable", flex: 1, align: "right" },
        { key: "paidAmount", label: "Paid", flex: 1, align: "right" },
        { key: "status", label: "Status", flex: 0.9, align: "center" },
      ]}
      rows={records}
      labels={labels}
      notes={notes}
    />
  );
}
