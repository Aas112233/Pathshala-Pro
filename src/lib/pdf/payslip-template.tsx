import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

export interface SalaryBreakdownItem {
  title: string;
  amount: number;
}

export interface PayslipData {
  instituteName: string;
  instituteAddress?: string;
  payslipNumber: string;
  monthYear: string; // e.g. "September 2026"
  employeeId: string;
  employeeName: string;
  designation: string;
  department: string;
  joiningDate?: string;
  bankAccountNumber?: string;
  panOrTaxId?: string;
  totalWorkingDays: number;
  payableDays: number;
  leavesTaken: number;
  earnings: SalaryBreakdownItem[];
  deductions: SalaryBreakdownItem[];
  grossEarnings: number;
  totalDeductions: number;
  netPayable: number;
  netPayableInWords?: string;
  currencySymbol: string;
}

const styles = StyleSheet.create({
  page: {
    padding: 28,
    fontSize: 8.5,
    fontFamily: "Helvetica",
    color: "#0f172a",
    backgroundColor: "#ffffff",
  },
  header: {
    borderBottomWidth: 2,
    borderBottomColor: "#0f172a",
    paddingBottom: 8,
    marginBottom: 12,
    alignItems: "center",
  },
  instituteTitle: {
    fontSize: 15,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  instituteSubtitle: {
    fontSize: 8,
    color: "#64748b",
    marginBottom: 4,
  },
  documentTitle: {
    fontSize: 10.5,
    fontFamily: "Helvetica-Bold",
    color: "#1e40af",
    textTransform: "uppercase",
  },
  metaGrid: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 4,
    padding: 8,
    marginBottom: 14,
    backgroundColor: "#f8fafc",
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  metaCol: {
    width: "48%",
    flexDirection: "row",
  },
  metaLabel: {
    width: "40%",
    fontFamily: "Helvetica-Bold",
    color: "#475569",
    fontSize: 8,
  },
  metaValue: {
    width: "60%",
    fontFamily: "Helvetica",
    fontSize: 8,
  },
  breakdownContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  breakdownBox: {
    width: "48.5%",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 4,
  },
  boxHeader: {
    backgroundColor: "#0f172a",
    color: "#ffffff",
    fontFamily: "Helvetica-Bold",
    paddingVertical: 4,
    paddingHorizontal: 8,
    fontSize: 8.5,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  boxRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  boxTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
    paddingHorizontal: 8,
    backgroundColor: "#f8fafc",
    borderTopWidth: 1,
    borderTopColor: "#cbd5e1",
    fontFamily: "Helvetica-Bold",
  },
  netPayContainer: {
    borderWidth: 1.5,
    borderColor: "#1e40af",
    backgroundColor: "#eff6ff",
    borderRadius: 4,
    padding: 10,
    marginBottom: 20,
  },
  netPayRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  netPayLabel: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#1e40af",
  },
  netPayAmount: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: "#1e40af",
  },
  wordsText: {
    fontSize: 8,
    fontFamily: "Helvetica-Oblique",
    color: "#475569",
    marginTop: 4,
  },
  signaturesContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 35,
    paddingHorizontal: 20,
  },
  sigBlock: {
    width: "35%",
    alignItems: "center",
  },
  sigLine: {
    width: "100%",
    borderTopWidth: 1,
    borderTopColor: "#94a3b8",
    marginBottom: 3,
  },
  sigText: {
    fontSize: 8,
    color: "#475569",
  },
});

export const StaffPayslipPDF: React.FC<{ data: PayslipData }> = ({ data }) => {
  return (
    <Document title={`Payslip-${data.monthYear}-${data.employeeName}`}>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.instituteTitle}>{data.instituteName}</Text>
          {data.instituteAddress && (
            <Text style={styles.instituteSubtitle}>{data.instituteAddress}</Text>
          )}
          <Text style={styles.documentTitle}>
            Salary Payslip for the Month of {data.monthYear}
          </Text>
        </View>

        {/* Employee Info Grid */}
        <View style={styles.metaGrid}>
          <View style={styles.metaRow}>
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>Employee Name:</Text>
              <Text style={styles.metaValue}>{data.employeeName}</Text>
            </View>
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>Payslip No:</Text>
              <Text style={styles.metaValue}>{data.payslipNumber}</Text>
            </View>
          </View>
          <View style={styles.metaRow}>
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>Employee ID:</Text>
              <Text style={styles.metaValue}>{data.employeeId}</Text>
            </View>
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>Department:</Text>
              <Text style={styles.metaValue}>{data.department}</Text>
            </View>
          </View>
          <View style={styles.metaRow}>
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>Designation:</Text>
              <Text style={styles.metaValue}>{data.designation}</Text>
            </View>
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>Payable / Working Days:</Text>
              <Text style={styles.metaValue}>
                {data.payableDays} / {data.totalWorkingDays} Days
              </Text>
            </View>
          </View>
        </View>

        {/* Earnings & Deductions Two-Column Breakdown */}
        <View style={styles.breakdownContainer}>
          {/* Earnings Box */}
          <View style={styles.breakdownBox}>
            <View style={styles.boxHeader}>
              <Text>Earnings</Text>
              <Text>Amount ({data.currencySymbol})</Text>
            </View>
            {data.earnings.map((item, idx) => (
              <View key={idx} style={styles.boxRow}>
                <Text>{item.title}</Text>
                <Text>{item.amount.toFixed(2)}</Text>
              </View>
            ))}
            <View style={styles.boxTotalRow}>
              <Text>Gross Earnings:</Text>
              <Text>{data.grossEarnings.toFixed(2)}</Text>
            </View>
          </View>

          {/* Deductions Box */}
          <View style={styles.breakdownBox}>
            <View style={styles.boxHeader}>
              <Text>Deductions</Text>
              <Text>Amount ({data.currencySymbol})</Text>
            </View>
            {data.deductions.map((item, idx) => (
              <View key={idx} style={styles.boxRow}>
                <Text>{item.title}</Text>
                <Text>{item.amount.toFixed(2)}</Text>
              </View>
            ))}
            <View style={styles.boxTotalRow}>
              <Text>Total Deductions:</Text>
              <Text>{data.totalDeductions.toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {/* Net Payable Banner */}
        <View style={styles.netPayContainer}>
          <View style={styles.netPayRow}>
            <Text style={styles.netPayLabel}>Net Salary Disbursed:</Text>
            <Text style={styles.netPayAmount}>
              {data.currencySymbol} {data.netPayable.toFixed(2)}
            </Text>
          </View>
          {data.netPayableInWords && (
            <Text style={styles.wordsText}>In Words: {data.netPayableInWords}</Text>
          )}
        </View>

        {/* Signatures */}
        <View style={styles.signaturesContainer}>
          <View style={styles.sigBlock}>
            <View style={styles.sigLine} />
            <Text style={styles.sigText}>Employee Signature</Text>
          </View>
          <View style={styles.sigBlock}>
            <View style={styles.sigLine} />
            <Text style={styles.sigText}>Finance & Accounts / HR</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
};
