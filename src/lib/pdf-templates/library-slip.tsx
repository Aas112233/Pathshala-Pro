import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

export interface LibraryIssueSlipData {
  schoolName: string;
  slipNumber: string;
  issueDate: string;
  dueDate: string;
  returnDate?: string;
  borrowerName: string;
  borrowerIdNo: string;
  borrowerType: "STUDENT" | "STAFF";
  className?: string;
  sectionName?: string;
  bookTitle: string;
  bookAuthor: string;
  accessionNo: string;
  isbn?: string;
  shelfLocation?: string;
  status: "ISSUED" | "RETURNED" | "OVERDUE";
  fineAmount?: number;
  currencySymbol?: string;
  issuedByName?: string;
}

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 9,
    fontFamily: "Helvetica",
    backgroundColor: "#ffffff",
    color: "#1e293b",
  },
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "#1e3a8a",
    paddingBottom: 10,
    marginBottom: 12,
  },
  schoolName: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: "#1e3a8a",
  },
  slipTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
  },
  badgeIssued: {
    backgroundColor: "#dbeafe",
    color: "#1e40af",
  },
  badgeReturned: {
    backgroundColor: "#dcfce7",
    color: "#166534",
  },
  badgeOverdue: {
    backgroundColor: "#fee2e2",
    color: "#991b1b",
  },
  section: {
    marginBottom: 12,
    padding: 10,
    borderRadius: 6,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  sectionTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#334155",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: "#cbd5e1",
    paddingBottom: 3,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  col2: {
    width: "50%",
    marginBottom: 4,
  },
  col3: {
    width: "33.33%",
    marginBottom: 4,
  },
  label: {
    fontSize: 7.5,
    color: "#64748b",
    textTransform: "uppercase",
    marginBottom: 1,
  },
  value: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
  },
  noticeBox: {
    marginTop: 10,
    padding: 8,
    backgroundColor: "#eff6ff",
    borderRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: "#2563eb",
  },
  noticeText: {
    fontSize: 8,
    color: "#1e40af",
    lineHeight: 1.3,
  },
  footer: {
    position: "absolute",
    bottom: 25,
    left: 30,
    right: 30,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 10,
  },
  signatureBox: {
    alignItems: "center",
    width: 130,
  },
  sigLine: {
    width: 120,
    borderBottomWidth: 1,
    borderBottomColor: "#94a3b8",
    marginBottom: 4,
  },
  sigLabel: {
    fontSize: 7.5,
    color: "#64748b",
  },
});

export function LibraryIssueSlipDocument({ data }: { data: LibraryIssueSlipData }) {
  const isOverdue = data.status === "OVERDUE";
  const isReturned = data.status === "RETURNED";
  const curr = data.currencySymbol || "$";

  return (
    <Document>
      <Page size="A5" orientation="landscape" style={styles.page}>
        {/* Header */}
        <View style={styles.headerContainer}>
          <View>
            <Text style={styles.schoolName}>{data.schoolName}</Text>
            <Text style={styles.slipTitle}>Official Library Circulation Slip</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text
              style={[
                styles.badge,
                isReturned
                  ? styles.badgeReturned
                  : isOverdue
                  ? styles.badgeOverdue
                  : styles.badgeIssued,
              ]}
            >
              {data.status}
            </Text>
            <Text style={{ fontSize: 7.5, color: "#64748b", marginTop: 3 }}>
              Slip #{data.slipNumber}
            </Text>
          </View>
        </View>

        {/* Borrower & Loan Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Borrower Profile</Text>
          <View style={styles.grid}>
            <View style={styles.col3}>
              <Text style={styles.label}>Borrower Name</Text>
              <Text style={styles.value}>{data.borrowerName}</Text>
            </View>
            <View style={styles.col3}>
              <Text style={styles.label}>
                {data.borrowerType === "STUDENT" ? "Roll / Student ID" : "Staff ID"}
              </Text>
              <Text style={styles.value}>{data.borrowerIdNo}</Text>
            </View>
            <View style={styles.col3}>
              <Text style={styles.label}>Borrower Type</Text>
              <Text style={styles.value}>
                {data.borrowerType}
                {data.className ? ` (${data.className})` : ""}
              </Text>
            </View>
          </View>
        </View>

        {/* Book Catalog Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cataloged Item</Text>
          <View style={styles.grid}>
            <View style={styles.col2}>
              <Text style={styles.label}>Book Title</Text>
              <Text style={styles.value}>{data.bookTitle}</Text>
            </View>
            <View style={styles.col2}>
              <Text style={styles.label}>Author</Text>
              <Text style={styles.value}>{data.bookAuthor}</Text>
            </View>
            <View style={styles.col3}>
              <Text style={styles.label}>Accession No</Text>
              <Text style={styles.value}>{data.accessionNo}</Text>
            </View>
            <View style={styles.col3}>
              <Text style={styles.label}>Shelf Location</Text>
              <Text style={styles.value}>{data.shelfLocation || "General Stack"}</Text>
            </View>
            <View style={styles.col3}>
              <Text style={styles.label}>ISBN</Text>
              <Text style={styles.value}>{data.isbn || "—"}</Text>
            </View>
          </View>
        </View>

        {/* Circulation Dates & Fine */}
        <View style={[styles.section, { backgroundColor: isOverdue ? "#fef2f2" : "#f8fafc" }]}>
          <Text style={styles.sectionTitle}>Circulation Schedule</Text>
          <View style={styles.grid}>
            <View style={styles.col3}>
              <Text style={styles.label}>Issued Date</Text>
              <Text style={styles.value}>{data.issueDate}</Text>
            </View>
            <View style={styles.col3}>
              <Text style={styles.label}>Due Date</Text>
              <Text style={[styles.value, isOverdue ? { color: "#dc2626" } : {}]}>
                {data.dueDate}
              </Text>
            </View>
            <View style={styles.col3}>
              <Text style={styles.label}>
                {isReturned ? "Returned Date" : "Accrued Overdue Fine"}
              </Text>
              <Text
                style={[
                  styles.value,
                  data.fineAmount && data.fineAmount > 0 ? { color: "#dc2626" } : {},
                ]}
              >
                {isReturned
                  ? data.returnDate || "Returned"
                  : data.fineAmount && data.fineAmount > 0
                  ? `${curr}${data.fineAmount.toFixed(2)}`
                  : "No Fines"}
              </Text>
            </View>
          </View>
        </View>

        {/* Library Rule Policy */}
        <View style={styles.noticeBox}>
          <Text style={styles.noticeText}>
            • Please return cataloged material on or before the due date to avoid recurring daily late fees.
            {"\n"}• Lost or damaged books will be charged at the full replacement cost plus processing fees.
          </Text>
        </View>

        {/* Footer & Signatures */}
        <View style={styles.footer}>
          <View style={styles.signatureBox}>
            <View style={styles.sigLine} />
            <Text style={styles.sigLabel}>Borrower Signature</Text>
          </View>
          <Text style={{ fontSize: 7, color: "#94a3b8" }}>
            Generated on {new Date().toLocaleDateString()} · Pathshala-Pro ERP
          </Text>
          <View style={styles.signatureBox}>
            <View style={styles.sigLine} />
            <Text style={styles.sigLabel}>
              {data.issuedByName ? `Librarian: ${data.issuedByName}` : "Authorized Librarian"}
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
