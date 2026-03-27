/* eslint-disable jsx-a11y/alt-text */
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

export interface PdfSchoolInfo {
  name: string;
  address: string;
  phone: string;
  email: string;
  logoUrl?: string;
}

export interface PdfFilterItem {
  label: string;
  value: string;
}

export interface PdfMetricItem {
  label: string;
  value: string;
  tone?: "default" | "success" | "warning" | "danger";
}

export interface PdfColumn {
  key: string;
  label: string;
  flex?: number;
  align?: "left" | "center" | "right";
}

export interface PdfReportTemplateProps {
  school: PdfSchoolInfo;
  title: string;
  subtitle?: string;
  generatedAt: string;
  dateRangeLabel: string;
  recordCount: number;
  filters: PdfFilterItem[];
  metrics: PdfMetricItem[];
  columns: PdfColumn[];
  rows: Array<Record<string, string | number>>;
  notes?: string[];
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingBottom: 28,
    paddingHorizontal: 24,
    backgroundColor: "#FFFFFF",
    color: "#0F172A",
    fontSize: 9,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottom: "2px solid #1D4ED8",
    paddingBottom: 12,
    marginBottom: 14,
  },
  schoolBlock: {
    flexDirection: "row",
    flex: 1,
  },
  logo: {
    width: 42,
    height: 42,
    objectFit: "cover",
    borderRadius: 6,
    marginRight: 10,
  },
  logoPlaceholder: {
    width: 42,
    height: 42,
    borderRadius: 6,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  logoPlaceholderText: {
    fontSize: 16,
  },
  schoolName: {
    fontSize: 16,
    fontWeight: 700,
    color: "#1D4ED8",
    marginBottom: 2,
  },
  schoolMeta: {
    color: "#475569",
    marginBottom: 1,
  },
  titleBlock: {
    alignItems: "flex-end",
    maxWidth: 230,
  },
  title: {
    fontSize: 15,
    fontWeight: 700,
    textTransform: "uppercase",
    marginBottom: 3,
  },
  subtitle: {
    color: "#475569",
    textAlign: "right",
    marginBottom: 2,
  },
  metaText: {
    fontSize: 8,
    color: "#64748B",
    textAlign: "right",
  },
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 700,
    marginBottom: 6,
    color: "#0F172A",
  },
  summaryGrid: {
    flexDirection: "row",
  },
  summaryCard: {
    width: "32%",
    border: "1px solid #CBD5E1",
    borderRadius: 8,
    padding: 8,
    backgroundColor: "#F8FAFC",
    marginRight: "2%",
  },
  summaryLabel: {
    fontSize: 8,
    color: "#64748B",
    marginBottom: 2,
    textTransform: "uppercase",
  },
  summaryValue: {
    fontSize: 10,
    fontWeight: 700,
  },
  filtersWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  filterChip: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: "#EFF6FF",
    border: "1px solid #BFDBFE",
    marginRight: 6,
    marginBottom: 6,
  },
  filterText: {
    fontSize: 8,
    color: "#1E3A8A",
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  metricCard: {
    width: "23%",
    border: "1px solid #E2E8F0",
    borderRadius: 8,
    padding: 8,
    marginRight: "2%",
    marginBottom: 8,
  },
  metricLabel: {
    fontSize: 8,
    color: "#64748B",
    marginBottom: 3,
  },
  metricValue: {
    fontSize: 12,
    fontWeight: 700,
  },
  table: {
    border: "1px solid #CBD5E1",
    borderRadius: 8,
    overflow: "hidden",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#1D4ED8",
    paddingVertical: 7,
    paddingHorizontal: 8,
  },
  tableHeaderText: {
    fontSize: 8,
    fontWeight: 700,
    color: "#FFFFFF",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderTop: "1px solid #E2E8F0",
  },
  tableRowAlt: {
    backgroundColor: "#F8FAFC",
  },
  tableCell: {
    fontSize: 8,
    color: "#0F172A",
  },
  note: {
    fontSize: 8,
    color: "#475569",
    marginBottom: 3,
  },
  footer: {
    marginTop: 10,
    paddingTop: 8,
    borderTop: "1px solid #E2E8F0",
    flexDirection: "row",
    justifyContent: "space-between",
    color: "#64748B",
    fontSize: 8,
  },
});

const metricTones: Record<NonNullable<PdfMetricItem["tone"]>, string> = {
  default: "#0F172A",
  success: "#15803D",
  warning: "#B45309",
  danger: "#B91C1C",
};

export function ReportBaseTemplate({
  school,
  title,
  subtitle,
  generatedAt,
  dateRangeLabel,
  recordCount,
  filters,
  metrics,
  columns,
  rows,
  notes,
}: PdfReportTemplateProps) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.schoolBlock}>
            {school.logoUrl ? (
              <Image src={school.logoUrl} style={styles.logo} />
            ) : (
              <View style={styles.logoPlaceholder}>
                <Text style={styles.logoPlaceholderText}>S</Text>
              </View>
            )}
            <View>
              <Text style={styles.schoolName}>{school.name || "School Report"}</Text>
              {school.address ? <Text style={styles.schoolMeta}>{school.address}</Text> : null}
              <Text style={styles.schoolMeta}>
                {[school.phone, school.email].filter(Boolean).join(" | ")}
              </Text>
            </View>
          </View>

          <View style={styles.titleBlock}>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            <Text style={styles.metaText}>Period: {dateRangeLabel}</Text>
            <Text style={styles.metaText}>Generated: {generatedAt}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Report Summary</Text>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Report period</Text>
              <Text style={styles.summaryValue}>{dateRangeLabel}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Generated at</Text>
              <Text style={styles.summaryValue}>{generatedAt}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Records</Text>
              <Text style={styles.summaryValue}>{recordCount.toLocaleString()}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Applied Filters</Text>
          <View style={styles.filtersWrap}>
            {(filters.length > 0 ? filters : [{ label: "Filters", value: "No extra filters" }]).map(
              (filter) => (
                <View key={`${filter.label}-${filter.value}`} style={styles.filterChip}>
                  <Text style={styles.filterText}>
                    {filter.label}: {filter.value}
                  </Text>
                </View>
              )
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Key Metrics</Text>
          <View style={styles.metricsGrid}>
            {metrics.map((metric) => (
              <View key={metric.label} style={styles.metricCard}>
                <Text style={styles.metricLabel}>{metric.label}</Text>
                <Text
                  style={[
                    styles.metricValue,
                    { color: metricTones[metric.tone || "default"] },
                  ]}
                >
                  {metric.value}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Detailed Records</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              {columns.map((column) => (
                <View key={column.key} style={{ flex: column.flex || 1 }}>
                  <Text
                    style={[
                      styles.tableHeaderText,
                      { textAlign: column.align || "left" },
                    ]}
                  >
                    {column.label}
                  </Text>
                </View>
              ))}
            </View>

            {rows.length > 0 ? (
              rows.map((row, index) => (
                <View
                  key={`${String(row[columns[0]?.key] ?? index)}-${index}`}
                  style={[styles.tableRow, index % 2 === 1 ? styles.tableRowAlt : {}]}
                >
                  {columns.map((column) => (
                    <View key={column.key} style={{ flex: column.flex || 1 }}>
                      <Text
                        style={[
                          styles.tableCell,
                          { textAlign: column.align || "left" },
                        ]}
                      >
                        {String(row[column.key] ?? "-")}
                      </Text>
                    </View>
                  ))}
                </View>
              ))
            ) : (
              <View style={styles.tableRow}>
                <Text style={styles.tableCell}>No data available for the selected filters.</Text>
              </View>
            )}
          </View>
        </View>

        {notes && notes.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            {notes.map((note) => (
              <Text key={note} style={styles.note}>
                • {note}
              </Text>
            ))}
          </View>
        ) : null}

        <View style={styles.footer} fixed>
          <Text>{school.name || "School Report"}</Text>
          <Text>Computer-generated report</Text>
        </View>
      </Page>
    </Document>
  );
}
