import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

export interface ManifestStudent {
  rollNumber: string;
  studentName: string;
  className: string;
  sectionName?: string;
  stopName: string;
  guardianName?: string;
  guardianPhone?: string;
}

export interface TransportManifestPDFData {
  schoolName: string;
  schoolAddress?: string;
  schoolPhone?: string;
  routeName: string;
  vehicleNo: string;
  vehicleType: string;
  driverName?: string;
  driverPhone?: string;
  totalAllocated: number;
  capacity: number;
  stops: string[];
  students: ManifestStudent[];
  generatedDate: string;
}

const styles = StyleSheet.create({
  page: {
    padding: 24,
    backgroundColor: "#ffffff",
    fontFamily: "Helvetica",
    fontSize: 8,
    color: "#0f172a",
  },
  header: {
    borderBottomWidth: 1.5,
    borderBottomColor: "#4338ca",
    paddingBottom: 8,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  schoolName: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#312e81",
    textTransform: "uppercase",
  },
  docTitle: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#4338ca",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  subText: {
    fontSize: 7.5,
    color: "#64748b",
    marginTop: 2,
  },
  metaGrid: {
    flexDirection: "row",
    backgroundColor: "#f8fafc",
    borderRadius: 4,
    padding: 8,
    marginBottom: 12,
    borderWidth: 0.5,
    borderColor: "#e2e8f0",
    justifyContent: "space-between",
  },
  metaCol: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 6.5,
    color: "#64748b",
    textTransform: "uppercase",
    fontWeight: "bold",
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#1e293b",
  },
  stopsBar: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    backgroundColor: "#eef2ff",
    padding: 6,
    borderRadius: 4,
    marginBottom: 12,
    borderWidth: 0.5,
    borderColor: "#c7d2fe",
    alignItems: "center",
  },
  stopsLabel: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#3730a3",
    marginRight: 4,
  },
  stopPill: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#4338ca",
    borderWidth: 0.5,
    borderColor: "#a5b4fc",
  },
  table: {
    width: "100%",
    borderWidth: 0.5,
    borderColor: "#cbd5e1",
    borderRadius: 3,
    overflow: "hidden",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    borderBottomWidth: 1,
    borderBottomColor: "#cbd5e1",
    paddingVertical: 4,
    paddingHorizontal: 6,
    fontWeight: "bold",
    color: "#334155",
    fontSize: 7,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#f1f5f9",
    paddingVertical: 4,
    paddingHorizontal: 6,
    alignItems: "center",
  },
  tableRowAlt: {
    backgroundColor: "#f8fafc",
  },
  colCheck: {
    width: "6%",
    textAlign: "center",
  },
  colRoll: {
    width: "8%",
  },
  colName: {
    width: "24%",
    fontWeight: "bold",
  },
  colClass: {
    width: "14%",
  },
  colStop: {
    width: "20%",
    color: "#4338ca",
    fontWeight: "bold",
  },
  colContact: {
    width: "28%",
    fontSize: 7,
    color: "#475569",
  },
  footer: {
    marginTop: 16,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: "#cbd5e1",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sigBlock: {
    width: "30%",
    textAlign: "center",
    fontSize: 7,
    color: "#64748b",
  },
});

export function TransportManifestPDFDocument({ manifest }: { manifest: TransportManifestPDFData }) {
  return (
    <Document title={`Transport_Manifest_${manifest.routeName.replace(/\s+/g, "_")}`}>
      <Page size="A4" orientation="portrait" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.schoolName}>{manifest.schoolName}</Text>
            {manifest.schoolAddress && (
              <Text style={styles.subText}>{manifest.schoolAddress} • Ph: {manifest.schoolPhone || "N/A"}</Text>
            )}
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.docTitle}>Driver Passenger Manifest</Text>
            <Text style={styles.subText}>Date: {manifest.generatedDate}</Text>
          </View>
        </View>

        {/* Route & Vehicle Meta */}
        <View style={styles.metaGrid}>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Route Name</Text>
            <Text style={styles.metaValue}>{manifest.routeName}</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Vehicle #</Text>
            <Text style={styles.metaValue}>
              {manifest.vehicleNo} ({manifest.vehicleType})
            </Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Driver / Contact</Text>
            <Text style={styles.metaValue}>
              {manifest.driverName || "Assigned Driver"} ({manifest.driverPhone || "N/A"})
            </Text>
          </View>
          <View style={[styles.metaCol, { alignItems: "flex-end" }]}>
            <Text style={styles.metaLabel}>Occupancy</Text>
            <Text style={[styles.metaValue, { color: manifest.totalAllocated > manifest.capacity ? "#b91c1c" : "#15803d" }]}>
              {manifest.totalAllocated} / {manifest.capacity} Seats ({Math.round((manifest.totalAllocated / Math.max(1, manifest.capacity)) * 100)}%)
            </Text>
          </View>
        </View>

        {/* Route Stops Sequence */}
        {manifest.stops && manifest.stops.length > 0 && (
          <View style={styles.stopsBar}>
            <Text style={styles.stopsLabel}>Route Stops:</Text>
            {manifest.stops.map((stop, i) => (
              <Text key={i} style={styles.stopPill}>
                {i + 1}. {stop}
              </Text>
            ))}
          </View>
        )}

        {/* Student Manifest Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.colCheck}>AM</Text>
            <Text style={styles.colCheck}>PM</Text>
            <Text style={styles.colRoll}>Roll #</Text>
            <Text style={styles.colName}>Student Name</Text>
            <Text style={styles.colClass}>Class</Text>
            <Text style={styles.colStop}>Designated Stop</Text>
            <Text style={styles.colContact}>Guardian / Emergency Contact</Text>
          </View>

          {manifest.students.length === 0 ? (
            <View style={[styles.tableRow, { justifyContent: "center", paddingVertical: 14 }]}>
              <Text style={{ color: "#64748b" }}>No students currently allocated to this route</Text>
            </View>
          ) : (
            manifest.students.map((student, idx) => (
              <View key={idx} style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}>
                <Text style={styles.colCheck}>[  ]</Text>
                <Text style={styles.colCheck}>[  ]</Text>
                <Text style={styles.colRoll}>{student.rollNumber || "—"}</Text>
                <Text style={styles.colName}>{student.studentName}</Text>
                <Text style={styles.colClass}>
                  {student.className} {student.sectionName ? `(${student.sectionName})` : ""}
                </Text>
                <Text style={styles.colStop}>{student.stopName}</Text>
                <Text style={styles.colContact}>
                  {student.guardianName ? `${student.guardianName}: ` : ""}
                  {student.guardianPhone || "No contact"}
                </Text>
              </View>
            ))
          )}
        </View>

        {/* Footer & Signatures */}
        <View style={styles.footer}>
          <View style={styles.sigBlock}>
            <Text>___________________________</Text>
            <Text style={{ marginTop: 3 }}>Driver / Conductor Signature</Text>
          </View>
          <View style={styles.sigBlock}>
            <Text>___________________________</Text>
            <Text style={{ marginTop: 3 }}>Transport Manager</Text>
          </View>
          <View style={styles.sigBlock}>
            <Text>___________________________</Text>
            <Text style={{ marginTop: 3 }}>School Principal Stamp</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
