/* eslint-disable jsx-a11y/alt-text */
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { PdfSchoolInfo } from "./report-base";

export interface InventoryStockItem {
  code: string;
  name: string;
  category: string;
  unit: string;
  quantity: number;
  minStockLevel: number;
  location?: string;
  costPrice: number;
}

export interface InventoryStockReportProps {
  school: PdfSchoolInfo;
  generatedAt: string;
  items: InventoryStockItem[];
  labels?: Partial<typeof defaultLabels>;
}

const defaultLabels = {
  title: "Inventory Stock Statement",
  subtitle: "Current Store & Stock Ledger",
  generatedOn: "Generated on",
  totalItems: "Total Items",
  lowStock: "Low Stock Alerts",
  totalValue: "Estimated Stock Value",
  code: "Item Code",
  name: "Item Name",
  category: "Category",
  qty: "Qty",
  unit: "Unit",
  min: "Min",
  location: "Location",
  cost: "Cost Price",
  value: "Stock Value",
  status: "Status",
  ok: "OK",
  low: "LOW",
  footer: "Computer-generated stock statement",
};

const styles = StyleSheet.create({
  page: { paddingTop: 22, paddingBottom: 22, paddingHorizontal: 18, backgroundColor: "#FFFFFF", color: "#0F172A", fontSize: 7.5, fontFamily: "Helvetica" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #1D4ED8", paddingBottom: 8, marginBottom: 8 },
  schoolBlock: { flexDirection: "row", flex: 1, alignItems: "center" },
  logo: { width: 36, height: 36, borderRadius: 6, objectFit: "cover", marginRight: 8 },
  logoPlaceholder: { width: 36, height: 36, borderRadius: 6, backgroundColor: "#DBEAFE", alignItems: "center", justifyContent: "center", marginRight: 8 },
  schoolName: { fontSize: 13, fontWeight: 700, color: "#1D4ED8" },
  schoolMeta: { fontSize: 7, color: "#475569", marginTop: 1 },
  titleBlock: { alignItems: "flex-end", maxWidth: 220 },
  title: { fontSize: 13, fontWeight: 700, color: "#0F172A", textTransform: "uppercase" },
  subtitle: { fontSize: 7.5, color: "#64748B", marginTop: 2 },
  metaText: { fontSize: 6.5, color: "#64748B", marginTop: 1, textAlign: "right" },
  metrics: { flexDirection: "row", gap: 6, marginBottom: 8 },
  metricCard: { flex: 1, border: "1px solid #E2E8F0", borderRadius: 6, padding: 6, alignItems: "center", backgroundColor: "#F8FAFC" },
  metricVal: { fontSize: 12, fontWeight: 700, color: "#0F172A" },
  metricLabel: { fontSize: 6.5, color: "#64748B", fontWeight: 700, textTransform: "uppercase", marginTop: 2 },
  table: { border: "1px solid #CBD5E1", borderRadius: 6, overflow: "hidden", marginBottom: 8 },
  tableHeader: { flexDirection: "row", backgroundColor: "#1D4ED8", paddingVertical: 5, paddingHorizontal: 4 },
  th: { color: "#FFFFFF", fontSize: 6, fontWeight: 700, textTransform: "uppercase" },
  row: { flexDirection: "row", paddingVertical: 4, paddingHorizontal: 4, borderTop: "1px solid #E2E8F0", alignItems: "center" },
  rowAlt: { backgroundColor: "#F8FAFC" },
  td: { fontSize: 6.5, color: "#1E293B" },
  badge: { fontSize: 6, fontWeight: 700, paddingVertical: 1, paddingHorizontal: 4, borderRadius: 3, textTransform: "uppercase" },
  footer: { marginTop: 8, paddingTop: 6, borderTop: "1px solid #E2E8F0", flexDirection: "row", justifyContent: "space-between", color: "#64748B", fontSize: 6.5 },
});

export function InventoryStockReportTemplate({ school, generatedAt, items, labels: l }: InventoryStockReportProps) {
  const L = { ...defaultLabels, ...l };
  const lowCount = items.filter((i) => i.quantity <= i.minStockLevel).length;
  const totalValue = items.reduce((sum, i) => sum + i.quantity * i.costPrice, 0);
  return (
    <Document title="Inventory_Stock_Report" author={school.name}>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.schoolBlock}>
            {school.logoUrl ? <Image src={school.logoUrl} style={styles.logo} /> : (
              <View style={styles.logoPlaceholder}><Text style={{ fontSize: 14, color: "#1D4ED8", fontWeight: 700 }}>{school.name?.charAt(0) || "S"}</Text></View>
            )}
            <View>
              <Text style={styles.schoolName}>{school.name || "Pathshala Pro School"}</Text>
              {school.address ? <Text style={styles.schoolMeta}>{school.address}</Text> : null}
              <Text style={styles.schoolMeta}>{[school.phone, school.email].filter(Boolean).join("  |  ")}</Text>
            </View>
          </View>
          <View style={styles.titleBlock}>
            <Text style={styles.title}>{L.title}</Text>
            <Text style={styles.subtitle}>{L.subtitle}</Text>
            <Text style={styles.metaText}>{L.generatedOn}: {generatedAt}</Text>
          </View>
        </View>

        <View style={styles.metrics}>
          <View style={styles.metricCard}><Text style={styles.metricVal}>{items.length}</Text><Text style={styles.metricLabel}>{L.totalItems}</Text></View>
          <View style={[styles.metricCard, { borderColor: lowCount > 0 ? "#FECACA" : "#E2E8F0", backgroundColor: lowCount > 0 ? "#FEF2F2" : "#F8FAFC" }]}><Text style={[styles.metricVal, { color: lowCount > 0 ? "#DC2626" : "#0F172A" }]}>{lowCount}</Text><Text style={styles.metricLabel}>{L.lowStock}</Text></View>
          <View style={styles.metricCard}><Text style={styles.metricVal}>{totalValue.toFixed(2)}</Text><Text style={styles.metricLabel}>{L.totalValue}</Text></View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.th, { flex: 1.1 }]}>{L.code}</Text>
            <Text style={[styles.th, { flex: 2.5 }]}>{L.name}</Text>
            <Text style={[styles.th, { flex: 1.2 }]}>{L.category}</Text>
            <Text style={[styles.th, { flex: 0.6, textAlign: "right" }]}>{L.qty}</Text>
            <Text style={[styles.th, { flex: 0.6, textAlign: "center" }]}>{L.unit}</Text>
            <Text style={[styles.th, { flex: 0.6, textAlign: "right" }]}>{L.min}</Text>
            <Text style={[styles.th, { flex: 1 }]}>{L.location}</Text>
            <Text style={[styles.th, { flex: 1, textAlign: "right" }]}>{L.cost}</Text>
            <Text style={[styles.th, { flex: 1, textAlign: "right" }]}>{L.value}</Text>
            <Text style={[styles.th, { flex: 0.9, textAlign: "center" }]}>{L.status}</Text>
          </View>
          {items.length === 0 ? (
            <View style={styles.row}><Text style={styles.td}>No stock data</Text></View>
          ) : items.map((it, idx) => {
            const isLow = it.quantity <= it.minStockLevel;
            return (
              <View key={it.code + idx} style={[styles.row, idx % 2 === 1 ? styles.rowAlt : {}]}>
                <Text style={[styles.td, { flex: 1.1, fontWeight: 700 }]}>{it.code}</Text>
                <Text style={[styles.td, { flex: 2.5 }]}>{it.name}</Text>
                <Text style={[styles.td, { flex: 1.2, color: "#64748B" }]}>{it.category}</Text>
                <Text style={[styles.td, { flex: 0.6, textAlign: "right", fontWeight: 700, color: isLow ? "#DC2626" : "#0F172A" }]}>{it.quantity}</Text>
                <Text style={[styles.td, { flex: 0.6, textAlign: "center", color: "#64748B" }]}>{it.unit}</Text>
                <Text style={[styles.td, { flex: 0.6, textAlign: "right", color: "#64748B" }]}>{it.minStockLevel}</Text>
                <Text style={[styles.td, { flex: 1, color: "#64748B" }]}>{it.location || "-"}</Text>
                <Text style={[styles.td, { flex: 1, textAlign: "right" }]}>{it.costPrice.toFixed(2)}</Text>
                <Text style={[styles.td, { flex: 1, textAlign: "right", fontWeight: 700 }]}>{(it.quantity * it.costPrice).toFixed(2)}</Text>
                <View style={{ flex: 0.9, alignItems: "center" }}>
                  <Text style={[styles.badge, { backgroundColor: isLow ? "#FEF2F2" : "#ECFDF5", color: isLow ? "#DC2626" : "#15803D", border: isLow ? "1px solid #FECACA" : "1px solid #86EFAC" }]}>{isLow ? L.low : L.ok}</Text>
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.footer} fixed>
          <Text>{L.footer}</Text>
          <Text>{school.name} • {generatedAt}</Text>
        </View>
      </Page>
    </Document>
  );
}
