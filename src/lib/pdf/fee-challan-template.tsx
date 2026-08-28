import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

export interface FeeChallanItem {
  title: string;
  amount: number;
}

export interface FeeChallanData {
  instituteName: string;
  instituteAddress?: string;
  bankName: string;
  bankAccountNumber: string;
  voucherNumber: string;
  studentName: string;
  studentId: string;
  rollNumber: string;
  className: string;
  sectionName?: string;
  billingPeriod: string; // e.g. "September 2026"
  issueDate: string;
  dueDate: string;
  items: FeeChallanItem[];
  subtotal: number;
  discountAmount: number;
  fineAmount: number;
  netPayable: number;
  currencySymbol: string;
  notes?: string;
}

const styles = StyleSheet.create({
  page: {
    padding: 16,
    fontSize: 7.5,
    fontFamily: "Helvetica",
    color: "#0f172a",
    backgroundColor: "#ffffff",
  },
  challanContainer: {
    flexDirection: "row",
    height: "100%",
    justifyContent: "space-between",
  },
  column: {
    width: "32%",
    borderWidth: 1,
    borderColor: "#94a3b8",
    borderRadius: 3,
    padding: 6,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
  },
  tearLine: {
    width: "1%",
    borderRightWidth: 1,
    borderRightColor: "#cbd5e1",
    borderStyle: "dashed",
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: "#0f172a",
    paddingBottom: 4,
    marginBottom: 6,
    alignItems: "center",
  },
  copyTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    backgroundColor: "#0f172a",
    color: "#ffffff",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 2,
    marginBottom: 4,
    textAlign: "center",
    textTransform: "uppercase",
  },
  instituteTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    marginBottom: 1,
  },
  bankInfo: {
    fontSize: 7,
    color: "#475569",
    textAlign: "center",
    marginBottom: 3,
  },
  metaGrid: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 2,
    padding: 4,
    marginBottom: 6,
    backgroundColor: "#f8fafc",
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  metaLabel: {
    fontFamily: "Helvetica-Bold",
    color: "#475569",
    fontSize: 7,
  },
  metaValue: {
    fontFamily: "Helvetica",
    fontSize: 7,
  },
  itemsTable: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    marginBottom: 6,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#e2e8f0",
    fontFamily: "Helvetica-Bold",
    fontSize: 7,
    paddingVertical: 2,
    paddingHorizontal: 3,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    paddingVertical: 2,
    paddingHorizontal: 3,
  },
  colHead: { width: "70%" },
  colAmount: { width: "30%", textAlign: "right" },

  totalsBox: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#f8fafc",
    padding: 4,
    marginBottom: 6,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 1,
  },
  netPayableRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#0f172a",
    paddingTop: 2,
    marginTop: 2,
    fontFamily: "Helvetica-Bold",
  },
  netPayableText: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: "#1e40af",
  },
  footer: {
    marginTop: "auto",
  },
  signatureRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 18,
  },
  sigBlock: {
    width: "45%",
    alignItems: "center",
  },
  sigLine: {
    width: "100%",
    borderTopWidth: 1,
    borderTopColor: "#94a3b8",
    marginBottom: 2,
  },
  sigText: {
    fontSize: 6.5,
    color: "#64748b",
  },
});

const ChallanPart: React.FC<{ copyName: string; data: FeeChallanData }> = ({ copyName, data }) => (
  <View style={styles.column}>
    {/* Top Header */}
    <View>
      <Text style={styles.copyTitle}>{copyName}</Text>
      <View style={styles.header}>
        <Text style={styles.instituteTitle}>{data.instituteName}</Text>
        <Text style={styles.bankInfo}>
          {data.bankName} | A/C: {data.bankAccountNumber}
        </Text>
      </View>

      {/* Metadata */}
      <View style={styles.metaGrid}>
        <View style={styles.totalRow}>
          <Text style={styles.metaLabel}>Challan No:</Text>
          <Text style={styles.metaValue}>{data.voucherNumber}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.metaLabel}>Student:</Text>
          <Text style={styles.metaValue}>{data.studentName}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.metaLabel}>ID / Roll:</Text>
          <Text style={styles.metaValue}>
            {data.studentId} | {data.rollNumber}
          </Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.metaLabel}>Class:</Text>
          <Text style={styles.metaValue}>
            {data.className} {data.sectionName ? `(${data.sectionName})` : ""}
          </Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.metaLabel}>Period:</Text>
          <Text style={styles.metaValue}>{data.billingPeriod}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.metaLabel}>Due Date:</Text>
          <Text style={[styles.metaValue, { color: "#dc2626", fontFamily: "Helvetica-Bold" }]}>
            {data.dueDate}
          </Text>
        </View>
      </View>

      {/* Itemized Fee Breakdown */}
      <View style={styles.itemsTable}>
        <View style={styles.tableHeader}>
          <Text style={styles.colHead}>Fee Particulars</Text>
          <Text style={styles.colAmount}>Amount</Text>
        </View>
        {data.items.map((item, idx) => (
          <View key={idx} style={styles.tableRow}>
            <Text style={styles.colHead}>{item.title}</Text>
            <Text style={styles.colAmount}>{item.amount.toFixed(2)}</Text>
          </View>
        ))}
      </View>

      {/* Summary / Total */}
      <View style={styles.totalsBox}>
        <View style={styles.totalRow}>
          <Text style={styles.metaLabel}>Subtotal:</Text>
          <Text style={styles.metaValue}>{data.subtotal.toFixed(2)}</Text>
        </View>
        {data.discountAmount > 0 && (
          <View style={styles.totalRow}>
            <Text style={styles.metaLabel}>Concession / Waiver:</Text>
            <Text style={[styles.metaValue, { color: "#16a34a" }]}>
              -{data.discountAmount.toFixed(2)}
            </Text>
          </View>
        )}
        {data.fineAmount > 0 && (
          <View style={styles.totalRow}>
            <Text style={styles.metaLabel}>Late Surcharge:</Text>
            <Text style={[styles.metaValue, { color: "#dc2626" }]}>
              +{data.fineAmount.toFixed(2)}
            </Text>
          </View>
        )}
        <View style={styles.netPayableRow}>
          <Text style={styles.netPayableText}>Net Payable:</Text>
          <Text style={styles.netPayableText}>
            {data.currencySymbol} {data.netPayable.toFixed(2)}
          </Text>
        </View>
      </View>
    </View>

    {/* Signatures */}
    <View style={styles.footer}>
      <View style={styles.signatureRow}>
        <View style={styles.sigBlock}>
          <View style={styles.sigLine} />
          <Text style={styles.sigText}>Bank Officer</Text>
        </View>
        <View style={styles.sigBlock}>
          <View style={styles.sigLine} />
          <Text style={styles.sigText}>Authorized Signatory</Text>
        </View>
      </View>
    </View>
  </View>
);

export const ThreePartFeeChallanPDF: React.FC<{ data: FeeChallanData }> = ({ data }) => {
  return (
    <Document title={`Challan-${data.voucherNumber}-${data.studentName}`}>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.challanContainer}>
          <ChallanPart copyName="Bank Copy" data={data} />
          <View style={styles.tearLine} />
          <ChallanPart copyName="Institute Copy" data={data} />
          <View style={styles.tearLine} />
          <ChallanPart copyName="Student Copy" data={data} />
        </View>
      </Page>
    </Document>
  );
};
