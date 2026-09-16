import {
  PdfFilterItem,
  PdfMetricItem,
  PdfSchoolInfo,
  PdfCommonLabels,
  ReportBaseTemplate,
} from "./report-base";

export interface FeeDaybookTemplateProps {
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
 * Fee Collections Daybook PDF. Records come from `fetchFeeDaybookRows` on the
 * server so the PDF covers the whole selected date range, not just the page
 * loaded in the transactions table.
 */
export function FeeDaybookTemplate({
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
}: FeeDaybookTemplateProps) {
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
        { key: "sno", label: "S.No", flex: 0.5, align: "center" },
        { key: "date", label: "Date", flex: 1 },
        { key: "voucherNumber", label: "Voucher No.", flex: 1.3 },
        { key: "studentId", label: "Student ID", flex: 1.1 },
        { key: "studentName", label: "Student Name", flex: 1.8 },
        { key: "className", label: "Class", flex: 1 },
        { key: "paymentMode", label: "Payment Mode", flex: 1.1, align: "center" },
        { key: "receiptNumber", label: "Receipt No.", flex: 1.3 },
        { key: "amountPaid", label: "Amount Paid", flex: 1.1, align: "right" },
        { key: "journalEntryRef", label: "Journal Ref", flex: 1.3 },
      ]}
      rows={records}
      labels={labels}
      notes={notes}
    />
  );
}
