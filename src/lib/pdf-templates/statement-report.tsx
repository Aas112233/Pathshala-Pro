import {
  PdfFilterItem,
  PdfMetricItem,
  PdfSchoolInfo,
  PdfCommonLabels,
  ReportBaseTemplate,
} from "./report-base";

export interface StatementReportTemplateProps {
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

/**
 * Account / student / staff ledger statement PDF. Mirrors the on-screen ledger
 * columns so the exported statement matches the running balance shown in the app.
 */
export function StatementReportTemplate({
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
}: StatementReportTemplateProps) {
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
        { key: "date", label: "Date", flex: 1.1, align: "center" },
        { key: "refId", label: "Reference", flex: 1.3 },
        { key: "description", label: "Description", flex: 2.2 },
        { key: "debit", label: "Debit", flex: 1, align: "right" },
        { key: "credit", label: "Credit", flex: 1, align: "right" },
        { key: "balance", label: "Balance", flex: 1.1, align: "right" },
      ]}
      rows={records}
      labels={labels}
      notes={notes}
    />
  );
}
