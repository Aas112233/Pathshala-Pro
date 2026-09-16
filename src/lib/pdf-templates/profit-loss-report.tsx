import {
  PdfFilterItem,
  PdfSchoolInfo,
  PdfCommonLabels,
  ReportBaseTemplate,
} from "./report-base";
import type { ProfitLossStatementRow } from "@/lib/profit-loss-export";

export interface ProfitLossReportTemplateProps {
  locale?: string;
  school: PdfSchoolInfo;
  title: string;
  subtitle?: string;
  generatedAt: string;
  dateRangeLabel: string;
  filters: PdfFilterItem[];
  metrics: Array<{ label: string; value: string; tone?: "default" | "success" | "warning" | "danger" }>;
  columns: { section: string; lineItem: string; amount: string; share: string };
  rows: ProfitLossStatementRow[];
  notes?: string[];
  labels?: PdfCommonLabels;
}

/**
 * Profit & Loss statement PDF. Rows come from `buildProfitLossStatement` so the
 * PDF and the Excel workbook render the identical figures — the page used to
 * offer only `window.print()`, which produced whatever the screen layout
 * happened to be.
 */
export function ProfitLossReportTemplate({
  locale,
  school,
  title,
  subtitle,
  generatedAt,
  dateRangeLabel,
  filters,
  metrics,
  columns,
  rows,
  notes,
  labels,
}: ProfitLossReportTemplateProps) {
  return (
    <ReportBaseTemplate
      locale={locale}
      school={school}
      title={title}
      subtitle={subtitle}
      generatedAt={generatedAt}
      dateRangeLabel={dateRangeLabel}
      recordCount={rows.filter((row) => row.kind === "line").length}
      filters={filters}
      metrics={metrics}
      columns={[
        { key: "section", label: columns.section, flex: 1 },
        { key: "lineItem", label: columns.lineItem, flex: 2 },
        { key: "amount", label: columns.amount, flex: 1, align: "right" },
        { key: "share", label: columns.share, flex: 0.7, align: "right" },
      ]}
      rows={rows}
      labels={labels}
      notes={notes}
    />
  );
}
