import {
  PdfFilterItem,
  PdfMetricItem,
  PdfSchoolInfo,
  PdfCommonLabels,
  ReportBaseTemplate,
} from "./report-base";

export interface FinancialReportTemplateProps {
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

export function FinancialReportTemplate({
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
}: FinancialReportTemplateProps) {
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
        { key: "expenseNumber", label: "Voucher No.", flex: 1.1 },
        { key: "title", label: "Description", flex: 1.8 },
        { key: "payeeName", label: "Payee", flex: 1.4 },
        { key: "category", label: "Category", flex: 1.1 },
        { key: "paymentMethod", label: "Method", flex: 1, align: "center" },
        { key: "amount", label: "Amount", flex: 1, align: "right" },
        { key: "expenseDate", label: "Date", flex: 1.1, align: "center" },
      ]}
      rows={records}
      labels={labels}
      notes={notes}
    />
  );
}
