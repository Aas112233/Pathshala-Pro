import {
  PdfFilterItem,
  PdfSchoolInfo,
  ReportBaseTemplate,
} from "./report-base";

interface FeeVoucher {
  voucherNumber: string;
  studentName: string;
  className: string;
  section: string;
  amount: string;
  paidAmount: string;
  dueAmount: string;
  status: string;
  paymentMethod: string;
  date: string;
  [key: string]: string | number;
}

interface FeeReportTemplateProps {
  school: PdfSchoolInfo;
  dateRangeLabel: string;
  generatedAt: string;
  filters: PdfFilterItem[];
  metrics: {
    totalCollected: string;
    totalPending: string;
    totalOverdue: string;
    collectionRate: string;
  };
  records: FeeVoucher[];
}

export function FeeReportTemplate({
  school,
  dateRangeLabel,
  generatedAt,
  filters,
  metrics,
  records,
}: FeeReportTemplateProps) {
  return (
    <ReportBaseTemplate
      school={school}
      title="Fee Collection Report"
      subtitle="Collection, pending balance, and overdue analysis"
      generatedAt={generatedAt}
      dateRangeLabel={dateRangeLabel}
      recordCount={records.length}
      filters={filters}
      metrics={[
        { label: "Total collected", value: metrics.totalCollected, tone: "success" },
        { label: "Pending", value: metrics.totalPending, tone: "warning" },
        { label: "Overdue", value: metrics.totalOverdue, tone: "danger" },
        { label: "Collection rate", value: metrics.collectionRate },
      ]}
      columns={[
        { key: "voucherNumber", label: "Voucher No.", flex: 1.1 },
        { key: "studentName", label: "Student", flex: 1.7 },
        { key: "className", label: "Class", flex: 0.9 },
        { key: "section", label: "Section", flex: 0.8, align: "center" },
        { key: "amount", label: "Total", flex: 1, align: "right" },
        { key: "paidAmount", label: "Paid", flex: 1, align: "right" },
        { key: "dueAmount", label: "Due", flex: 1, align: "right" },
        { key: "status", label: "Status", flex: 1, align: "center" },
        { key: "paymentMethod", label: "Method", flex: 1, align: "center" },
        { key: "date", label: "Date", flex: 1.1, align: "center" },
      ]}
      rows={records}
      notes={[
        "Amounts are shown using the active tenant currency settings.",
        "Overdue vouchers require follow-up from the accounts team.",
      ]}
    />
  );
}

