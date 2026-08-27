import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

export interface FeeVoucherPDFData {
  schoolName: string;
  schoolCode?: string;
  schoolAddress?: string;
  currencySymbol: string;
  voucherId: string;
  issueDate: string;
  dueDate: string;
  studentName: string;
  studentId: string;
  rollNumber: string;
  className: string;
  sectionName?: string;
  feeType: string;
  academicYear: string;
  baseAmount: number;
  discountAmount: number;
  arrears: number;
  totalDue: number;
  bankAccountDetails?: string;
}

const styles = StyleSheet.create({
  page: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    padding: 15,
    fontFamily: "Helvetica",
  },
  column: {
    flex: 1,
    padding: 10,
    borderRightWidth: 1,
    borderRightColor: "#cbd5e1",
    borderRightStyle: "dashed",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
  },
  lastColumn: {
    flex: 1,
    padding: 10,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: "#0f172a",
    paddingBottom: 5,
    marginBottom: 6,
    textAlign: "center",
  },
  schoolName: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#0f172a",
    textTransform: "uppercase",
  },
  schoolSub: {
    fontSize: 6,
    color: "#64748b",
    marginTop: 1,
  },
  copyBadge: {
    fontSize: 7,
    fontWeight: "bold",
    backgroundColor: "#f1f5f9",
    color: "#334155",
    padding: 2,
    marginTop: 3,
    textAlign: "center",
    borderRadius: 2,
  },
  voucherMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
    fontSize: 6.5,
    color: "#334155",
  },
  voucherCode: {
    fontFamily: "Courier-Bold",
    fontSize: 7.5,
    color: "#4338ca",
  },
  studentInfoBox: {
    backgroundColor: "#f8fafc",
    padding: 4,
    borderRadius: 3,
    marginBottom: 6,
    borderWidth: 0.5,
    borderColor: "#e2e8f0",
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 6.5,
    marginBottom: 2,
  },
  infoLabel: {
    color: "#64748b",
  },
  infoVal: {
    fontWeight: "bold",
    color: "#0f172a",
  },
  table: {
    width: "100%",
    marginBottom: 6,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    borderBottomWidth: 0.5,
    borderBottomColor: "#cbd5e1",
    paddingVertical: 2,
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#1e293b",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#f1f5f9",
    paddingVertical: 2,
    fontSize: 6.5,
    color: "#334155",
  },
  colDesc: {
    flex: 2,
  },
  colAmt: {
    flex: 1,
    textAlign: "right",
  },
  totalBox: {
    backgroundColor: "#eef2ff",
    padding: 4,
    borderRadius: 2,
    borderWidth: 0.5,
    borderColor: "#c7d2fe",
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#312e81",
    marginBottom: 6,
  },
  instructions: {
    fontSize: 5.5,
    color: "#64748b",
    lineHeight: 1.3,
    marginBottom: 8,
  },
  signatures: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 0.5,
    borderTopColor: "#cbd5e1",
  },
  sigBlock: {
    width: "45%",
    textAlign: "center",
    fontSize: 5.5,
    color: "#64748b",
  },
});

function VoucherSlip({
  copyType,
  data,
  isLast = false,
}: {
  copyType: string;
  data: FeeVoucherPDFData;
  isLast?: boolean;
}) {
  return (
    <View style={isLast ? styles.lastColumn : styles.column}>
      <View>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.schoolName}>{data.schoolName}</Text>
          {data.schoolAddress && <Text style={styles.schoolSub}>{data.schoolAddress}</Text>}
          <Text style={styles.copyBadge}>{copyType}</Text>
        </View>

        {/* Voucher Meta */}
        <View style={styles.voucherMeta}>
          <View>
            <Text style={styles.infoLabel}>Voucher #</Text>
            <Text style={styles.voucherCode}>{data.voucherId}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.infoLabel}>Due Date</Text>
            <Text style={{ color: "#dc2626", fontWeight: "bold" }}>{data.dueDate}</Text>
          </View>
        </View>

        {/* Student Particulars */}
        <View style={styles.studentInfoBox}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Student Name:</Text>
            <Text style={styles.infoVal}>{data.studentName}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Student ID / Roll:</Text>
            <Text style={styles.infoVal}>
              {data.studentId} (Roll #{data.rollNumber})
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Class & Section:</Text>
            <Text style={styles.infoVal}>
              {data.className} {data.sectionName ? `(${data.sectionName})` : ""}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Session / Period:</Text>
            <Text style={styles.infoVal}>{data.academicYear}</Text>
          </View>
        </View>

        {/* Particulars Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.colDesc}>Fee Particulars</Text>
            <Text style={styles.colAmt}>Amount ({data.currencySymbol})</Text>
          </View>

          <View style={styles.tableRow}>
            <Text style={styles.colDesc}>{data.feeType} Fee</Text>
            <Text style={styles.colAmt}>{data.baseAmount.toFixed(2)}</Text>
          </View>

          {data.arrears > 0 && (
            <View style={styles.tableRow}>
              <Text style={[styles.colDesc, { color: "#b91c1c" }]}>Previous Unpaid Arrears</Text>
              <Text style={[styles.colAmt, { color: "#b91c1c" }]}>+{data.arrears.toFixed(2)}</Text>
            </View>
          )}

          {data.discountAmount > 0 && (
            <View style={styles.tableRow}>
              <Text style={[styles.colDesc, { color: "#15803d" }]}>Concession / Scholarship</Text>
              <Text style={[styles.colAmt, { color: "#15803d" }]}>-{data.discountAmount.toFixed(2)}</Text>
            </View>
          )}
        </View>

        {/* Total Payable Box */}
        <View style={styles.totalBox}>
          <Text>NET PAYABLE:</Text>
          <Text>
            {data.currencySymbol} {data.totalDue.toFixed(2)}
          </Text>
        </View>

        {/* Bank Instructions */}
        <Text style={styles.instructions}>
          * Payable at any authorized bank branch or digital payment portal before the due date.
          {"\n"}* Surcharge applies after the due date. Fee once paid is non-refundable.
        </Text>
      </View>

      {/* Signature Section */}
      <View style={styles.signatures}>
        <View style={styles.sigBlock}>
          <Text>___________________</Text>
          <Text style={{ marginTop: 2 }}>Cashier / Bank Stamp</Text>
        </View>
        <View style={styles.sigBlock}>
          <Text>___________________</Text>
          <Text style={{ marginTop: 2 }}>Accounts Officer</Text>
        </View>
      </View>
    </View>
  );
}

export function FeeVoucherPDFDocument({ vouchers }: { vouchers: FeeVoucherPDFData[] }) {
  return (
    <Document title="Commercial 3-Part Fee Vouchers">
      {vouchers.map((voucher, idx) => (
        <Page key={idx} size="A4" orientation="landscape" style={styles.page}>
          <VoucherSlip copyType="BANK COPY" data={voucher} />
          <VoucherSlip copyType="SCHOOL COPY" data={voucher} />
          <VoucherSlip copyType="STUDENT COPY" data={voucher} isLast />
        </Page>
      ))}
    </Document>
  );
}
