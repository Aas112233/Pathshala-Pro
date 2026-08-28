import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

export interface StudentIDCardData {
  instituteName: string;
  instituteAddress?: string;
  studentId: string;
  studentName: string;
  rollNumber: string;
  className: string;
  sectionName?: string;
  academicYear: string;
  bloodGroup?: string;
  dateOfBirth?: string;
  guardianName: string;
  guardianPhone: string;
  emergencyPhone?: string;
  validUntil: string;
  photoUrl?: string;
}

const styles = StyleSheet.create({
  page: {
    padding: 20,
    backgroundColor: "#f1f5f9",
    fontFamily: "Helvetica",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  cardContainer: {
    width: "48%",
    height: 220,
    backgroundColor: "#ffffff",
    borderWidth: 1.5,
    borderColor: "#0f172a",
    borderRadius: 6,
    marginBottom: 16,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
  },
  cardHeader: {
    backgroundColor: "#0f172a",
    color: "#ffffff",
    paddingVertical: 6,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  instituteTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    color: "#ffffff",
    textAlign: "center",
  },
  instituteSub: {
    fontSize: 6.5,
    color: "#94a3b8",
    marginTop: 1,
    textAlign: "center",
  },
  cardBody: {
    padding: 8,
    flexDirection: "row",
    flex: 1,
  },
  photoContainer: {
    width: "32%",
    alignItems: "center",
    justifyContent: "center",
    borderRightWidth: 1,
    borderRightColor: "#e2e8f0",
    paddingRight: 6,
  },
  photoBox: {
    width: 60,
    height: 70,
    backgroundColor: "#e2e8f0",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  photoText: {
    fontSize: 7,
    color: "#64748b",
  },
  studentDetails: {
    width: "68%",
    paddingLeft: 8,
    justifyContent: "center",
  },
  studentName: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: "row",
    marginBottom: 2,
  },
  metaLabel: {
    width: 55,
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: "#475569",
  },
  metaValue: {
    fontSize: 7,
    color: "#0f172a",
    flex: 1,
  },
  bloodGroupBadge: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: "#dc2626",
  },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
    paddingVertical: 4,
    paddingHorizontal: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  validityText: {
    fontSize: 6.5,
    color: "#64748b",
  },
  sigBlock: {
    alignItems: "center",
  },
  sigText: {
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
  },
});

export const SingleStudentIDCard: React.FC<{ data: StudentIDCardData }> = ({ data }) => (
  <View style={styles.cardContainer}>
    {/* Top Header */}
    <View style={styles.cardHeader}>
      <Text style={styles.instituteTitle}>{data.instituteName}</Text>
      {data.instituteAddress && (
        <Text style={styles.instituteSub}>{data.instituteAddress}</Text>
      )}
    </View>

    {/* Body */}
    <View style={styles.cardBody}>
      <View style={styles.photoContainer}>
        <View style={styles.photoBox}>
          <Text style={styles.photoText}>PHOTO</Text>
        </View>
      </View>

      <View style={styles.studentDetails}>
        <Text style={styles.studentName}>{data.studentName}</Text>

        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Student ID:</Text>
          <Text style={[styles.metaValue, { fontFamily: "Helvetica-Bold" }]}>
            {data.studentId}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Class / Roll:</Text>
          <Text style={styles.metaValue}>
            {data.className} {data.sectionName ? `(${data.sectionName})` : ""} | Roll: {data.rollNumber}
          </Text>
        </View>
        {data.bloodGroup && (
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Blood Group:</Text>
            <Text style={[styles.metaValue, styles.bloodGroupBadge]}>
              {data.bloodGroup}
            </Text>
          </View>
        )}
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Guardian:</Text>
          <Text style={styles.metaValue}>{data.guardianName}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Contact:</Text>
          <Text style={styles.metaValue}>{data.guardianPhone}</Text>
        </View>
      </View>
    </View>

    {/* Footer */}
    <View style={styles.cardFooter}>
      <Text style={styles.validityText}>Valid Until: {data.validUntil}</Text>
      <View style={styles.sigBlock}>
        <Text style={styles.sigText}>Principal Signature</Text>
      </View>
    </View>
  </View>
);

export const StudentIDCardSheetPDF: React.FC<{ cards: StudentIDCardData[] }> = ({ cards }) => {
  return (
    <Document title="Student-ID-Cards">
      <Page size="A4" style={styles.page}>
        {cards.map((card, idx) => (
          <SingleStudentIDCard key={card.studentId || idx} data={card} />
        ))}
      </Page>
    </Document>
  );
};
