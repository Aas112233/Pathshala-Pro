import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

export interface HostelResident {
  rollNumber: string;
  studentName: string;
  className: string;
  sectionName?: string;
  roomNumber: string;
  bedNumber?: string;
  roomType: string;
  guardianName?: string;
  guardianPhone?: string;
  allocationDate: string;
}

export interface HostelManifestPDFData {
  schoolName: string;
  hostelName: string;
  hostelType: string; // BOYS, GIRLS, COMBINED
  wardenName?: string;
  wardenPhone?: string;
  address?: string;
  totalCapacity: number;
  totalOccupied: number;
  totalRooms: number;
  generatedDate: string;
  residents: HostelResident[];
}

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 8.5,
    fontFamily: "Helvetica",
    backgroundColor: "#ffffff",
    color: "#0f172a",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 2,
    borderBottomColor: "#0f766e",
    paddingBottom: 8,
    marginBottom: 10,
  },
  schoolName: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: "#0f766e",
  },
  docTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#334155",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 2,
  },
  kpiRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  kpiCard: {
    flex: 1,
    padding: 6,
    borderRadius: 4,
    backgroundColor: "#f0fdfa",
    borderWidth: 1,
    borderColor: "#ccfbf1",
  },
  kpiLabel: {
    fontSize: 7,
    color: "#0f766e",
    textTransform: "uppercase",
    fontFamily: "Helvetica-Bold",
  },
  kpiValue: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#134e4a",
    marginTop: 1,
  },
  metaGrid: {
    flexDirection: "row",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 4,
    padding: 6,
    marginBottom: 10,
  },
  metaCol: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 7,
    color: "#64748b",
    textTransform: "uppercase",
  },
  metaValue: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: "#1e293b",
    marginTop: 1,
  },
  table: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 4,
    overflow: "hidden",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#0f766e",
    color: "#ffffff",
    fontFamily: "Helvetica-Bold",
    paddingVertical: 5,
    paddingHorizontal: 4,
    fontSize: 7.5,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#e2e8f0",
    paddingVertical: 4.5,
    paddingHorizontal: 4,
    alignItems: "center",
  },
  tableRowAlt: {
    backgroundColor: "#f8fafc",
  },
  colNo: { width: "5%", textAlign: "center" },
  colRoom: { width: "12%" },
  colRoll: { width: "12%" },
  colName: { width: "26%" },
  colClass: { width: "15%" },
  colGuardian: { width: "18%" },
  colCheck: { width: "12%", textAlign: "center" },
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
    paddingTop: 8,
  },
  sigBox: {
    alignItems: "center",
    width: 140,
  },
  sigLine: {
    width: 130,
    borderBottomWidth: 1,
    borderBottomColor: "#94a3b8",
    marginBottom: 3,
  },
  sigLabel: {
    fontSize: 7,
    color: "#64748b",
  },
});

export function HostelManifestPDFDocument({ data }: { data: HostelManifestPDFData }) {
  const occupancyPercent =
    data.totalCapacity > 0
      ? Math.round((data.totalOccupied / data.totalCapacity) * 100)
      : 0;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.schoolName}>{data.schoolName}</Text>
            <Text style={styles.docTitle}>Hostel Resident & Evacuation Manifest</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", color: "#0f766e" }}>
              {data.hostelName} ({data.hostelType})
            </Text>
            <Text style={{ fontSize: 7.5, color: "#64748b", marginTop: 2 }}>
              Date: {data.generatedDate}
            </Text>
          </View>
        </View>

        {/* Operational KPIs */}
        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Total Rooms</Text>
            <Text style={styles.kpiValue}>{data.totalRooms} Rooms</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Total Beds</Text>
            <Text style={styles.kpiValue}>{data.totalCapacity} Beds</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Allocated Residents</Text>
            <Text style={styles.kpiValue}>{data.totalOccupied} Students</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Occupancy Ratio</Text>
            <Text style={styles.kpiValue}>{occupancyPercent}% Occupied</Text>
          </View>
        </View>

        {/* Warden & Location Meta */}
        <View style={styles.metaGrid}>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Hostel Warden</Text>
            <Text style={styles.metaValue}>{data.wardenName || "Assigned Warden"}</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Emergency Contact</Text>
            <Text style={styles.metaValue}>{data.wardenPhone || "Campus Security"}</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Premises Address</Text>
            <Text style={styles.metaValue}>{data.address || "Main Campus Dormitory Wing"}</Text>
          </View>
        </View>

        {/* Resident Roster Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.colNo}>#</Text>
            <Text style={styles.colRoom}>Room / Bed</Text>
            <Text style={styles.colRoll}>Roll No</Text>
            <Text style={styles.colName}>Resident Name</Text>
            <Text style={styles.colClass}>Class & Section</Text>
            <Text style={styles.colGuardian}>Guardian Contact</Text>
            <Text style={styles.colCheck}>Roll Call</Text>
          </View>

          {data.residents.length === 0 ? (
            <View style={{ padding: 12, alignItems: "center" }}>
              <Text style={{ color: "#94a3b8", fontSize: 8 }}>
                No students currently allocated to this hostel block.
              </Text>
            </View>
          ) : (
            data.residents.map((r, i) => (
              <View
                key={i}
                style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}
              >
                <Text style={styles.colNo}>{i + 1}</Text>
                <Text style={[styles.colRoom, { fontFamily: "Helvetica-Bold" }]}>
                  {r.roomNumber} {r.bedNumber ? `(${r.bedNumber})` : ""}
                </Text>
                <Text style={styles.colRoll}>{r.rollNumber}</Text>
                <Text style={[styles.colName, { fontFamily: "Helvetica-Bold" }]}>
                  {r.studentName}
                </Text>
                <Text style={styles.colClass}>
                  {r.className} {r.sectionName ? `- ${r.sectionName}` : ""}
                </Text>
                <Text style={styles.colGuardian}>
                  {r.guardianPhone || r.guardianName || "—"}
                </Text>
                <Text style={[styles.colCheck, { color: "#cbd5e1" }]}>[  ]</Text>
              </View>
            ))
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.sigBox}>
            <View style={styles.sigLine} />
            <Text style={styles.sigLabel}>Hostel Warden Signature</Text>
          </View>
          <Text style={{ fontSize: 7, color: "#94a3b8" }}>
            Generated on {new Date().toLocaleDateString()} · Pathshala-Pro ERP
          </Text>
          <View style={styles.sigBox}>
            <View style={styles.sigLine} />
            <Text style={styles.sigLabel}>Principal / Campus Administrator</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
