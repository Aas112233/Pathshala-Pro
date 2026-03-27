"use client";

import { Document, Page, Text, View, StyleSheet, pdf } from "@react-pdf/renderer";
import { useCallback } from "react";
import type { SalaryLedgerWithDetails } from "@/types/entities";

interface SalarySlipProps {
  salary: SalaryLedgerWithDetails;
  schoolName: string;
  schoolAddress?: string;
  schoolPhone?: string;
  schoolEmail?: string;
  currencySymbol: string;
}

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: "Helvetica",
  },
  header: {
    marginBottom: 20,
    borderBottom: "2 solid #333",
    paddingBottom: 15,
  },
  schoolName: {
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 5,
  },
  schoolInfo: {
    fontSize: 10,
    textAlign: "center",
    color: "#666",
  },
  title: {
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
    marginVertical: 15,
    textDecoration: "underline",
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 8,
    backgroundColor: "#f0f0f0",
    padding: 5,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    borderBottom: "1 solid #e0e0e0",
  },
  label: {
    fontSize: 10,
    color: "#666",
    width: "50%",
  },
  value: {
    fontSize: 10,
    fontWeight: "bold",
    width: "50%",
    textAlign: "right",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    backgroundColor: "#f5f5f5",
    marginTop: 10,
  },
  totalLabel: {
    fontSize: 11,
    fontWeight: "bold",
    width: "50%",
  },
  totalValue: {
    fontSize: 12,
    fontWeight: "bold",
    width: "50%",
    textAlign: "right",
    color: "#0066cc",
  },
  footer: {
    marginTop: 30,
    paddingTop: 15,
    borderTop: "1 solid #ddd",
    fontSize: 9,
    color: "#999",
    textAlign: "center",
  },
  stamp: {
    marginTop: 30,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  stampBox: {
    width: "30%",
    height: 60,
    border: "1 solid #999",
    marginTop: 30,
  },
  stampText: {
    fontSize: 9,
    textAlign: "center",
    marginTop: 20,
    color: "#666",
  },
});

export function SalarySlip({
  salary,
  schoolName,
  schoolAddress,
  schoolPhone,
  schoolEmail,
  currencySymbol,
}: SalarySlipProps) {
  const formatCurrency = (amount: number) => {
    return `${currencySymbol}${amount.toFixed(2)}`;
  };

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.schoolName}>{schoolName}</Text>
          {schoolAddress && <Text style={styles.schoolInfo}>{schoolAddress}</Text>}
          {(schoolPhone || schoolEmail) && (
            <Text style={styles.schoolInfo}>
              {[schoolPhone, schoolEmail].filter(Boolean).join(" | ")}
            </Text>
          )}
          <Text style={styles.title}>Salary Slip</Text>
        </View>

        {/* Staff Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Staff Information</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Staff ID:</Text>
            <Text style={styles.value}>{salary.staffProfile?.staffId}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Name:</Text>
            <Text style={styles.value}>
              {salary.staffProfile?.firstName} {salary.staffProfile?.lastName}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Designation:</Text>
            <Text style={styles.value}>{salary.staffProfile?.designation}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Department:</Text>
            <Text style={styles.value}>{salary.staffProfile?.department || "N/A"}</Text>
          </View>
        </View>

        {/* Pay Period */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pay Period</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Month:</Text>
            <Text style={styles.value}>{monthNames[salary.month - 1]}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Year:</Text>
            <Text style={styles.value}>{salary.year}</Text>
          </View>
          {salary.academicYear && (
            <View style={styles.row}>
              <Text style={styles.label}>Academic Year:</Text>
              <Text style={styles.value}>{salary.academicYear.label}</Text>
            </View>
          )}
        </View>

        {/* Earnings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Earnings</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Base Salary:</Text>
            <Text style={styles.value}>{formatCurrency(salary.baseSalary)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Gross Earnings:</Text>
            <Text style={styles.totalValue}>{formatCurrency(salary.baseSalary)}</Text>
          </View>
        </View>

        {/* Deductions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Deductions</Text>
          {salary.deductions > 0 ? (
            <View style={styles.row}>
              <Text style={styles.label}>Total Deductions:</Text>
              <Text style={styles.value}>{formatCurrency(salary.deductions)}</Text>
            </View>
          ) : (
            <View style={styles.row}>
              <Text style={styles.label}>No deductions</Text>
              <Text style={styles.value}>-</Text>
            </View>
          )}
          {salary.advances > 0 && (
            <View style={styles.row}>
              <Text style={styles.label}>Advances:</Text>
              <Text style={styles.value}>{formatCurrency(salary.advances)}</Text>
            </View>
          )}
        </View>

        {/* Net Pay */}
        <View style={styles.section}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>NET PAYABLE:</Text>
            <Text style={styles.totalValue}>{formatCurrency(salary.netPayable)}</Text>
          </View>
          {salary.paidAmount > 0 && (
            <>
              <View style={styles.row}>
                <Text style={styles.label}>Amount Paid:</Text>
                <Text style={styles.value}>{formatCurrency(salary.paidAmount)}</Text>
              </View>
              {salary.netPayable - salary.paidAmount > 0 && (
                <View style={styles.row}>
                  <Text style={styles.label}>Balance Due:</Text>
                  <Text style={styles.value}>
                    {formatCurrency(salary.netPayable - salary.paidAmount)}
                  </Text>
                </View>
              )}
            </>
          )}
          {salary.status === "PAID" && salary.paidAt && (
            <View style={styles.row}>
              <Text style={styles.label}>Payment Date:</Text>
              <Text style={styles.value}>
                {new Date(salary.paidAt).toLocaleDateString()}
              </Text>
            </View>
          )}
        </View>

        {/* Status */}
        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.label}>Status:</Text>
            <Text style={styles.value}>{salary.status}</Text>
          </View>
        </View>

        {/* Stamp Area */}
        <View style={styles.stamp}>
          <View>
            <View style={styles.stampBox} />
            <Text style={styles.stampText}>Employee Signature</Text>
          </View>
          <View>
            <View style={styles.stampBox} />
            <Text style={styles.stampText}>Authorized Signature</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>This is a computer-generated document. No signature is required.</Text>
          <Text>Generated on {new Date().toLocaleDateString()}</Text>
        </View>
      </Page>
    </Document>
  );
}

interface GenerateSalarySlipOptions {
  salary: SalaryLedgerWithDetails;
  schoolName: string;
  schoolAddress?: string;
  schoolPhone?: string;
  schoolEmail?: string;
  currencySymbol: string;
}

export async function generateSalarySlipPdf(options: GenerateSalarySlipOptions) {
  const doc = <SalarySlip {...options} />;
  const blob = await pdf(doc).toBlob();
  return blob;
}
