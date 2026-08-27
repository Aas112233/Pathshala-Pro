import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

export interface SalaryPayslipPDFData {
  schoolName: string;
  schoolAddress?: string;
  schoolPhone?: string;
  currencySymbol: string;
  payslipId: string;
  staffId: string;
  staffName: string;
  designation: string;
  department: string;
  bankName?: string;
  bankAccountNo?: string;
  month: string; // e.g. "August"
  year: number;
  paymentDate: string;
  paymentMethod: string;
  status: string;
  // Earnings
  baseSalary: number;
  allowances: { title: string; amount: number }[];
  totalEarnings: number;
  // Deductions
  deductions: { title: string; amount: number }[];
  advances: number;
  totalDeductions: number;
  // Net
  netSalary: number;
  paidAmount: number;
  remarks?: string;
}

const styles = StyleSheet.create({
  page: {
    padding: 30,
    backgroundColor: "#ffffff",
    fontFamily: "Helvetica",
    fontSize: 8.5,
    color: "#0f172a",
  },
  header: {
    borderBottomWidth: 2,
    borderBottomColor: "#312e81",
    paddingBottom: 10,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  schoolName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#312e81",
    textTransform: "uppercase",
  },
  docTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#4338ca",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  subText: {
    fontSize: 7.5,
    color: "#64748b",
    marginTop: 2,
  },
  payslipBadge: {
    fontSize: 8,
    fontWeight: "bold",
    backgroundColor: "#e0e7ff",
    color: "#3730a3",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 3,
    marginTop: 4,
    textAlign: "right",
  },
  employeeCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 6,
    padding: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  empGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  empCol: {
    width: "48%",
  },
  infoRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  infoLabel: {
    width: "40%",
    color: "#64748b",
    fontSize: 8,
    fontWeight: "bold",
  },
  infoVal: {
    width: "60%",
    color: "#1e293b",
    fontSize: 8,
    fontWeight: "bold",
  },
  ledgerContainer: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 4,
    marginBottom: 14,
    overflow: "hidden",
  },
  ledgerCol: {
    width: "50%",
  },
  ledgerColRight: {
    width: "50%",
    borderLeftWidth: 1,
    borderLeftColor: "#cbd5e1",
  },
  tableHeader: {
    backgroundColor: "#f1f5f9",
    borderBottomWidth: 1,
    borderBottomColor: "#cbd5e1",
    paddingVertical: 5,
    paddingHorizontal: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    fontWeight: "bold",
    color: "#1e293b",
    fontSize: 8,
  },
  tableRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 0.5,
    borderBottomColor: "#f1f5f9",
    paddingVertical: 4.5,
    paddingHorizontal: 8,
    color: "#334155",
  },
  tableTotalRow: {
    backgroundColor: "#f8fafc",
    borderTopWidth: 1,
    borderTopColor: "#cbd5e1",
    paddingVertical: 6,
    paddingHorizontal: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    fontWeight: "bold",
    color: "#0f172a",
  },
  netSalaryBox: {
    backgroundColor: "#eef2ff",
    borderRadius: 6,
    padding: 12,
    borderWidth: 1.5,
    borderColor: "#a5b4fc",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  netLabel: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#312e81",
  },
  netAmount: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#4338ca",
    fontFamily: "Helvetica-Bold",
  },
  statusBadge: {
    fontSize: 8,
    fontWeight: "bold",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  footer: {
    marginTop: 20,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#cbd5e1",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sigBlock: {
    width: "28%",
    textAlign: "center",
    fontSize: 7.5,
    color: "#64748b",
  },
});

export function SalaryPayslipDocument({ data }: { data: SalaryPayslipPDFData }) {
  return (
    <Document title={`Payslip_${data.staffId}_${data.month}_${data.year}`}>
      <Page size="A4" orientation="portrait" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.schoolName}>{data.schoolName}</Text>
            {data.schoolAddress && (
              <Text style={styles.subText}>{data.schoolAddress} • Ph: {data.schoolPhone || "N/A"}</Text>
            )}
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.docTitle}>Monthly Salary Payslip</Text>
            <Text style={styles.payslipBadge}>
              {data.month} {data.year}
            </Text>
          </View>
        </View>

        {/* Employee Particulars Card */}
        <View style={styles.employeeCard}>
          <View style={styles.empGrid}>
            <View style={styles.empCol}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Employee Name:</Text>
                <Text style={styles.infoVal}>{data.staffName}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Staff ID:</Text>
                <Text style={styles.infoVal}>{data.staffId}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Designation:</Text>
                <Text style={styles.infoVal}>{data.designation}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Department:</Text>
                <Text style={styles.infoVal}>{data.department}</Text>
              </View>
            </View>

            <View style={styles.empCol}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Payslip No:</Text>
                <Text style={styles.infoVal}>{data.payslipId}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Disbursement Date:</Text>
                <Text style={styles.infoVal}>{data.paymentDate || "Pending"}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Payment Mode:</Text>
                <Text style={styles.infoVal}>{data.paymentMethod || "Bank Transfer"}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Bank Account:</Text>
                <Text style={styles.infoVal}>
                  {data.bankAccountNo ? `${data.bankName ? `${data.bankName} - ` : ""}${data.bankAccountNo}` : "Direct Payment"}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Earnings & Deductions 2-Column Ledger */}
        <View style={styles.ledgerContainer}>
          {/* Earnings Column */}
          <View style={styles.ledgerCol}>
            <View style={styles.tableHeader}>
              <Text>EARNINGS & ALLOWANCES</Text>
              <Text>AMOUNT ({data.currencySymbol})</Text>
            </View>

            <View style={styles.tableRow}>
              <Text>Base Basic Salary</Text>
              <Text>{data.baseSalary.toFixed(2)}</Text>
            </View>

            {data.allowances.map((al, i) => (
              <View key={i} style={styles.tableRow}>
                <Text>{al.title}</Text>
                <Text>{al.amount.toFixed(2)}</Text>
              </View>
            ))}

            <View style={styles.tableTotalRow}>
              <Text>GROSS EARNINGS</Text>
              <Text>{data.totalEarnings.toFixed(2)}</Text>
            </View>
          </View>

          {/* Deductions Column */}
          <View style={styles.ledgerColRight}>
            <View style={styles.tableHeader}>
              <Text>DEDUCTIONS & ADVANCES</Text>
              <Text>AMOUNT ({data.currencySymbol})</Text>
            </View>

            {data.advances > 0 && (
              <View style={styles.tableRow}>
                <Text>Salary Advance Recovery</Text>
                <Text>{data.advances.toFixed(2)}</Text>
              </View>
            )}

            {data.deductions.map((d, i) => (
              <View key={i} style={styles.tableRow}>
                <Text>{d.title}</Text>
                <Text>{d.amount.toFixed(2)}</Text>
              </View>
            ))}

            {data.deductions.length === 0 && data.advances === 0 && (
              <View style={styles.tableRow}>
                <Text style={{ color: "#64748b" }}>No Deductions</Text>
                <Text>0.00</Text>
              </View>
            )}

            <View style={styles.tableTotalRow}>
              <Text>TOTAL DEDUCTIONS</Text>
              <Text>{data.totalDeductions.toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {/* Net Salary Payable Box */}
        <View style={styles.netSalaryBox}>
          <View>
            <Text style={styles.netLabel}>NET DISBURSED SALARY</Text>
            <Text style={styles.subText}>Status: {data.status === "PAID" ? "DISBURSED / SETTLED" : "PAYMENT PENDING"}</Text>
          </View>
          <Text style={styles.netAmount}>
            {data.currencySymbol} {data.netSalary.toFixed(2)}
          </Text>
        </View>

        {/* Remarks / Confidentiality */}
        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 7, color: "#64748b" }}>
            * This is a system-generated confidential payroll document. Any discrepancy should be reported to the Accounts Department within 7 days.
          </Text>
        </View>

        {/* Triple Signatures */}
        <View style={styles.footer}>
          <View style={styles.sigBlock}>
            <Text>___________________________</Text>
            <Text style={{ marginTop: 4 }}>Employee Signature</Text>
          </View>
          <View style={styles.sigBlock}>
            <Text>___________________________</Text>
            <Text style={{ marginTop: 4 }}>Accounts Officer</Text>
          </View>
          <View style={styles.sigBlock}>
            <Text>___________________________</Text>
            <Text style={{ marginTop: 4 }}>Principal / Director Stamp</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

export function BatchSalaryPayslipPDFDocument({ payslips }: { payslips: SalaryPayslipPDFData[] }) {
  return (
    <Document title="Commercial Staff Salary Payslips Booklet">
      {payslips.map((payslip, idx) => (
        <Page key={idx} size="A4" orientation="portrait" style={styles.page}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.schoolName}>{payslip.schoolName}</Text>
              {payslip.schoolAddress && (
                <Text style={styles.subText}>{payslip.schoolAddress} • Ph: {payslip.schoolPhone || "N/A"}</Text>
              )}
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.docTitle}>Monthly Salary Payslip</Text>
              <Text style={styles.payslipBadge}>
                {payslip.month} {payslip.year}
              </Text>
            </View>
          </View>

          {/* Employee Particulars Card */}
          <View style={styles.employeeCard}>
            <View style={styles.empGrid}>
              <View style={styles.empCol}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Employee Name:</Text>
                  <Text style={styles.infoVal}>{payslip.staffName}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Staff ID:</Text>
                  <Text style={styles.infoVal}>{payslip.staffId}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Designation:</Text>
                  <Text style={styles.infoVal}>{payslip.designation}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Department:</Text>
                  <Text style={styles.infoVal}>{payslip.department}</Text>
                </View>
              </View>

              <View style={styles.empCol}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Payslip No:</Text>
                  <Text style={styles.infoVal}>{payslip.payslipId}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Disbursement Date:</Text>
                  <Text style={styles.infoVal}>{payslip.paymentDate || "Pending"}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Payment Mode:</Text>
                  <Text style={styles.infoVal}>{payslip.paymentMethod || "Bank Transfer"}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Bank Account:</Text>
                  <Text style={styles.infoVal}>
                    {payslip.bankAccountNo ? `${payslip.bankName ? `${payslip.bankName} - ` : ""}${payslip.bankAccountNo}` : "Direct Payment"}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Earnings & Deductions Ledger */}
          <View style={styles.ledgerContainer}>
            <View style={styles.ledgerCol}>
              <View style={styles.tableHeader}>
                <Text>EARNINGS & ALLOWANCES</Text>
                <Text>AMOUNT ({payslip.currencySymbol})</Text>
              </View>

              <View style={styles.tableRow}>
                <Text>Base Basic Salary</Text>
                <Text>{payslip.baseSalary.toFixed(2)}</Text>
              </View>

              {payslip.allowances.map((al, i) => (
                <View key={i} style={styles.tableRow}>
                  <Text>{al.title}</Text>
                  <Text>{al.amount.toFixed(2)}</Text>
                </View>
              ))}

              <View style={styles.tableTotalRow}>
                <Text>GROSS EARNINGS</Text>
                <Text>{payslip.totalEarnings.toFixed(2)}</Text>
              </View>
            </View>

            <View style={styles.ledgerColRight}>
              <View style={styles.tableHeader}>
                <Text>DEDUCTIONS & ADVANCES</Text>
                <Text>AMOUNT ({payslip.currencySymbol})</Text>
              </View>

              {payslip.advances > 0 && (
                <View style={styles.tableRow}>
                  <Text>Salary Advance Recovery</Text>
                  <Text>{payslip.advances.toFixed(2)}</Text>
                </View>
              )}

              {payslip.deductions.map((d, i) => (
                <View key={i} style={styles.tableRow}>
                  <Text>{d.title}</Text>
                  <Text>{d.amount.toFixed(2)}</Text>
                </View>
              ))}

              {payslip.deductions.length === 0 && payslip.advances === 0 && (
                <View style={styles.tableRow}>
                  <Text style={{ color: "#64748b" }}>No Deductions</Text>
                  <Text>0.00</Text>
                </View>
              )}

              <View style={styles.tableTotalRow}>
                <Text>TOTAL DEDUCTIONS</Text>
                <Text>{payslip.totalDeductions.toFixed(2)}</Text>
              </View>
            </View>
          </View>

          {/* Net Salary Box */}
          <View style={styles.netSalaryBox}>
            <View>
              <Text style={styles.netLabel}>NET DISBURSED SALARY</Text>
              <Text style={styles.subText}>Status: {payslip.status === "PAID" ? "DISBURSED / SETTLED" : "PAYMENT PENDING"}</Text>
            </View>
            <Text style={styles.netAmount}>
              {payslip.currencySymbol} {payslip.netSalary.toFixed(2)}
            </Text>
          </View>

          {/* Triple Signatures */}
          <View style={styles.footer}>
            <View style={styles.sigBlock}>
              <Text>___________________________</Text>
              <Text style={{ marginTop: 4 }}>Employee Signature</Text>
            </View>
            <View style={styles.sigBlock}>
              <Text>___________________________</Text>
              <Text style={{ marginTop: 4 }}>Accounts Officer</Text>
            </View>
            <View style={styles.sigBlock}>
              <Text>___________________________</Text>
              <Text style={{ marginTop: 4 }}>Principal / Director Stamp</Text>
            </View>
          </View>
        </Page>
      ))}
    </Document>
  );
}
