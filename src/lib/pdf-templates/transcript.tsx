/* eslint-disable jsx-a11y/alt-text */
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { PdfSchoolInfo } from "./report-base";

export interface TranscriptYear {
  academicYear: string;
  className: string;
  section?: string;
  rollNumber: string;
  examName?: string;
  subjects: Array<{
    subjectName: string;
    subjectCode: string;
    maxMarks: number;
    obtainedMarks: number;
    grade: string;
    gradePoint: number;
  }>;
  totalMax: number;
  totalObtained: number;
  percentage: number;
  gpa: number;
  grade: string;
  rank?: number;
  totalStudents?: number;
  result: string;
  remarks?: string;
}

export interface TranscriptData {
  studentName: string;
  fatherName?: string;
  motherName?: string;
  admissionNumber: string;
  rollNumber: string;
  dateOfBirth?: string;
  gender?: string;
  photoUrl?: string;
  years: TranscriptYear[];
  cumulativeGpa?: number;
  cumulativePercentage?: number;
  overallGrade?: string;
  issueDate: string;
  transcriptNumber: string;
}

export interface TranscriptProps {
  school: PdfSchoolInfo;
  data: TranscriptData;
  verificationUrl?: string;
  labels?: Partial<typeof defaultLabels>;
}

const defaultLabels = {
  title: "Academic Transcript",
  subtitle: "Comprehensive Multi-Year Academic Record",
  transcriptNo: "Transcript No.",
  issueDate: "Issue Date",
  studentInfo: "Student Information",
  studentName: "Student Name",
  fatherName: "Father's Name",
  motherName: "Mother's Name",
  admissionNo: "Admission No.",
  rollNo: "Roll No.",
  dob: "Date of Birth",
  gender: "Gender",
  academicHistory: "Academic History",
  year: "Academic Year",
  class: "Class",
  subjects: "Subjects",
  total: "Total",
  percentage: "Percentage",
  gpa: "GPA",
  grade: "Grade",
  result: "Result",
  cumulative: "Cumulative Summary",
  cgpa: "Cumulative GPA",
  overallGrade: "Overall Grade",
  declaration: "This is a true and complete record as per school archives. Any discrepancy should be reported within 15 days.",
  controller: "Controller of Examinations",
  principal: "Principal",
  seal: "Official Seal",
  verificationNote: "Scan QR to verify",
  computerGenerated: "Computer-generated transcript verifiable online.",
};

const styles = StyleSheet.create({
  page: { paddingTop: 20, paddingBottom: 20, paddingHorizontal: 22, backgroundColor: "#FFFFFF", color: "#0F172A", fontSize: 8, fontFamily: "Helvetica" },
  watermark: { position: "absolute", top: 320, left: 50, right: 50, textAlign: "center", fontSize: 64, fontWeight: 700, color: "#DBEAFE", opacity: 0.30, transform: "rotate(-30deg)" },
  borderOuter: { position: "absolute", top: 10, left: 10, right: 10, bottom: 10, border: "1.5px solid #1D4ED8", borderRadius: 6 },
  borderInner: { position: "absolute", top: 13, left: 13, right: 13, bottom: 13, border: "0.5px solid #93C5FD", borderRadius: 4 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #1D4ED8", paddingBottom: 8, marginBottom: 8 },
  schoolBlock: { flexDirection: "row", flex: 1, alignItems: "center" },
  logo: { width: 38, height: 38, borderRadius: 6, objectFit: "cover", marginRight: 8 },
  logoPlaceholder: { width: 38, height: 38, borderRadius: 6, backgroundColor: "#DBEAFE", alignItems: "center", justifyContent: "center", marginRight: 8 },
  logoPlaceholderText: { fontSize: 16, color: "#1D4ED8", fontWeight: 700 },
  schoolName: { fontSize: 13, fontWeight: 700, color: "#1D4ED8" },
  schoolMeta: { fontSize: 7, color: "#475569", marginTop: 1 },
  titleBlock: { alignItems: "flex-end", maxWidth: 230 },
  certNoBox: { backgroundColor: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 4, paddingVertical: 3, paddingHorizontal: 7, marginTop: 3 },
  certNoText: { fontSize: 7, color: "#1E3A8A", fontWeight: 700 },
  titleSection: { alignItems: "center", marginBottom: 6, marginTop: 4 },
  title: { fontSize: 16, fontWeight: 700, color: "#0F172A", textTransform: "uppercase", letterSpacing: 1.2, borderBottom: "2px solid #1D4ED8", paddingBottom: 3, marginBottom: 2 },
  subtitle: { fontSize: 7.5, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.8 },
  profileGrid: { flexDirection: "row", gap: 8, marginBottom: 8 },
  photoCard: { width: 80, alignItems: "center", border: "1px solid #E2E8F0", borderRadius: 6, padding: 6, backgroundColor: "#F8FAFC" },
  photo: { width: 64, height: 74, borderRadius: 4, border: "1px solid #CBD5E1", objectFit: "cover" },
  photoPlaceholder: { width: 64, height: 74, borderRadius: 4, border: "1px dashed #CBD5E1", backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  infoCard: { flex: 1, border: "1px solid #E2E8F0", borderRadius: 6, padding: 8, backgroundColor: "#F8FAFC" },
  infoRow: { flexDirection: "row", marginBottom: 3 },
  infoLabel: { width: 95, fontSize: 7, color: "#64748B", fontWeight: 700, textTransform: "uppercase" },
  infoValue: { flex: 1, fontSize: 8, color: "#0F172A", fontWeight: 700 },
  yearBlock: { border: "1px solid #E2E8F0", borderRadius: 6, marginBottom: 8, overflow: "hidden" },
  yearHeader: { flexDirection: "row", justifyContent: "space-between", backgroundColor: "#1E3A8A", paddingVertical: 5, paddingHorizontal: 8 },
  yearHeaderText: { color: "#FFFFFF", fontSize: 8, fontWeight: 700 },
  yearMeta: { flexDirection: "row", justifyContent: "space-between", backgroundColor: "#EFF6FF", paddingVertical: 4, paddingHorizontal: 8, borderBottom: "1px solid #BFDBFE" },
  yearMetaText: { fontSize: 7, color: "#1E3A8A", fontWeight: 700 },
  tableHeader: { flexDirection: "row", backgroundColor: "#1E293B", paddingVertical: 4, paddingHorizontal: 6 },
  th: { color: "#FFFFFF", fontSize: 6.5, fontWeight: 700, textTransform: "uppercase" },
  tableRow: { flexDirection: "row", paddingVertical: 3.5, paddingHorizontal: 6, borderTop: "1px solid #E2E8F0" },
  tableRowAlt: { backgroundColor: "#F8FAFC" },
  td: { fontSize: 7, color: "#1E293B" },
  summaryGrid: { flexDirection: "row", gap: 6, marginBottom: 8 },
  summaryCard: { flex: 1, backgroundColor: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 6, padding: 6, alignItems: "center" },
  summaryLabel: { fontSize: 6.5, color: "#64748B", fontWeight: 700, textTransform: "uppercase" },
  summaryValue: { fontSize: 11, fontWeight: 700, color: "#1D4ED8", marginTop: 2 },
  footerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 10 },
  qrBox: { alignItems: "center", width: 100 },
  qrImage: { width: 66, height: 66, border: "1px solid #E2E8F0" },
  qrCaption: { fontSize: 6, color: "#64748B", textAlign: "center", marginTop: 3 },
  sigBlock: { alignItems: "center", width: 120 },
  sigLine: { width: "100%", borderTop: "1px solid #0F172A", marginBottom: 4 },
  sigTitle: { fontSize: 7, color: "#475569", fontWeight: 700 },
  officialFooter: { marginTop: 8, paddingTop: 6, borderTop: "1px solid #E2E8F0", flexDirection: "row", justifyContent: "space-between", color: "#64748B", fontSize: 6.5 },
});

export function TranscriptTemplate({ school, data, verificationUrl, labels: l }: TranscriptProps) {
  const L = { ...defaultLabels, ...l };
  const qrSrc = verificationUrl ? `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(verificationUrl)}` : undefined;
  return (
    <Document title={`Transcript-${data.transcriptNumber}`} author={school.name}>
      <Page size="A4" style={styles.page}>
        <View style={styles.borderOuter} /><View style={styles.borderInner} />
        <Text style={styles.watermark}>{school.name?.split(" ")[0]?.toUpperCase() || "SCHOOL"}</Text>

        <View style={styles.header}>
          <View style={styles.schoolBlock}>
            {school.logoUrl ? <Image src={school.logoUrl} style={styles.logo} /> : (
              <View style={styles.logoPlaceholder}><Text style={styles.logoPlaceholderText}>{school.name?.charAt(0)?.toUpperCase() || "S"}</Text></View>
            )}
            <View>
              <Text style={styles.schoolName}>{school.name || "Pathshala Pro School"}</Text>
              {school.address ? <Text style={styles.schoolMeta}>{school.address}</Text> : null}
              <Text style={styles.schoolMeta}>{[school.phone, school.email].filter(Boolean).join("  |  ")}</Text>
            </View>
          </View>
          <View style={styles.titleBlock}>
            <View style={styles.certNoBox}><Text style={styles.certNoText}>{L.transcriptNo} {data.transcriptNumber}</Text></View>
            <Text style={{ fontSize: 6.5, color: "#64748B", marginTop: 2, textAlign: "right" }}>{L.issueDate}: {data.issueDate}</Text>
          </View>
        </View>

        <View style={styles.titleSection}>
          <Text style={styles.title}>{L.title}</Text>
          <Text style={styles.subtitle}>{L.subtitle}</Text>
        </View>

        <View style={styles.profileGrid}>
          <View style={styles.photoCard}>
            {data.photoUrl ? <Image src={data.photoUrl} style={styles.photo} /> : (
              <View style={styles.photoPlaceholder}><Text style={{ fontSize: 6, color: "#94A3B8" }}>Photo</Text></View>
            )}
            <Text style={{ fontSize: 5.5, color: "#64748B", marginTop: 3 }}>Student Photo</Text>
          </View>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}><Text style={styles.infoLabel}>{L.studentName}</Text><Text style={styles.infoValue}>{data.studentName}</Text></View>
            {data.fatherName ? <View style={styles.infoRow}><Text style={styles.infoLabel}>{L.fatherName}</Text><Text style={styles.infoValue}>{data.fatherName}</Text></View> : null}
            {data.motherName ? <View style={styles.infoRow}><Text style={styles.infoLabel}>{L.motherName}</Text><Text style={styles.infoValue}>{data.motherName}</Text></View> : null}
            <View style={styles.infoRow}><Text style={styles.infoLabel}>{L.admissionNo}</Text><Text style={styles.infoValue}>{data.admissionNumber}</Text></View>
            <View style={styles.infoRow}><Text style={styles.infoLabel}>{L.rollNo}</Text><Text style={styles.infoValue}>{data.rollNumber}</Text></View>
            {data.dateOfBirth ? <View style={styles.infoRow}><Text style={styles.infoLabel}>{L.dob}</Text><Text style={styles.infoValue}>{data.dateOfBirth}</Text></View> : null}
            {data.gender ? <View style={styles.infoRow}><Text style={styles.infoLabel}>{L.gender}</Text><Text style={styles.infoValue}>{data.gender}</Text></View> : null}
          </View>
        </View>

        {/* Per-year blocks */}
        {data.years.map((yr, yi) => (
          <View key={yi} style={styles.yearBlock} break={yi > 0 && yi % 2 === 0}>
            <View style={styles.yearHeader}>
              <Text style={styles.yearHeaderText}>{L.year}: {yr.academicYear} — {L.class}: {yr.className}{yr.section ? ` (${yr.section})` : ""}</Text>
              <Text style={styles.yearHeaderText}>{yr.examName || `${L.result}: ${yr.result}`}</Text>
            </View>
            <View style={styles.yearMeta}>
              <Text style={styles.yearMetaText}>{L.rollNo}: {yr.rollNumber}</Text>
              <Text style={styles.yearMetaText}>{L.total}: {yr.totalObtained}/{yr.totalMax} • {yr.percentage}% • {L.gpa}: {yr.gpa.toFixed(2)} • {L.grade}: {yr.grade}</Text>
              {yr.rank ? <Text style={styles.yearMetaText}>Rank: {yr.rank}{yr.totalStudents ? `/${yr.totalStudents}` : ""}</Text> : null}
            </View>
            <View style={styles.tableHeader}>
              <Text style={[styles.th, { flex: 3 }]}>Subject</Text>
              <Text style={[styles.th, { flex: 1.2 }]}>Code</Text>
              <Text style={[styles.th, { flex: 1, textAlign: "right" }]}>Max</Text>
              <Text style={[styles.th, { flex: 1.2, textAlign: "right" }]}>Obtained</Text>
              <Text style={[styles.th, { flex: 1, textAlign: "center" }]}>Grade</Text>
              <Text style={[styles.th, { flex: 1, textAlign: "right" }]}>GP</Text>
            </View>
            {yr.subjects.map((s, si) => (
              <View key={si} style={[styles.tableRow, si % 2 === 1 ? styles.tableRowAlt : {}]}>
                <Text style={[styles.td, { flex: 3, fontWeight: 700 }]}>{s.subjectName}</Text>
                <Text style={[styles.td, { flex: 1.2, color: "#64748B" }]}>{s.subjectCode}</Text>
                <Text style={[styles.td, { flex: 1, textAlign: "right" }]}>{s.maxMarks}</Text>
                <Text style={[styles.td, { flex: 1.2, textAlign: "right", fontWeight: 700, color: s.obtainedMarks < s.maxMarks * 0.33 ? "#DC2626" : "#0F172A" }]}>{s.obtainedMarks}</Text>
                <Text style={[styles.td, { flex: 1, textAlign: "center", fontWeight: 700, color: s.grade === "F" ? "#DC2626" : "#1D4ED8" }]}>{s.grade}</Text>
                <Text style={[styles.td, { flex: 1, textAlign: "right" }]}>{s.gradePoint.toFixed(1)}</Text>
              </View>
            ))}
          </View>
        ))}

        {(data.cumulativeGpa !== undefined || data.cumulativePercentage !== undefined) ? (
          <View style={styles.summaryGrid}>
            {data.cumulativeGpa !== undefined ? <View style={styles.summaryCard}><Text style={styles.summaryLabel}>{L.cgpa}</Text><Text style={styles.summaryValue}>{data.cumulativeGpa.toFixed(2)}</Text></View> : null}
            {data.cumulativePercentage !== undefined ? <View style={styles.summaryCard}><Text style={styles.summaryLabel}>{L.percentage}</Text><Text style={styles.summaryValue}>{data.cumulativePercentage}%</Text></View> : null}
            {data.overallGrade ? <View style={styles.summaryCard}><Text style={styles.summaryLabel}>{L.overallGrade}</Text><Text style={styles.summaryValue}>{data.overallGrade}</Text></View> : null}
            <View style={styles.summaryCard}><Text style={styles.summaryLabel}>Years</Text><Text style={styles.summaryValue}>{data.years.length}</Text></View>
          </View>
        ) : null}

        <Text style={{ fontSize: 7, color: "#334155", textAlign: "center", marginBottom: 6 }}>{L.declaration}</Text>

        <View style={styles.footerRow}>
          <View style={styles.qrBox}>
            {qrSrc ? <Image src={qrSrc} style={styles.qrImage} /> : <View style={[styles.qrImage, { alignItems: "center", justifyContent: "center", backgroundColor: "#F1F5F9" }]}><Text style={{ fontSize: 6, color: "#94A3B8" }}>QR</Text></View>}
            <Text style={styles.qrCaption}>{L.verificationNote}</Text>
            {verificationUrl ? <Text style={[styles.qrCaption, { color: "#1D4ED8", fontSize: 5 }]}>{verificationUrl}</Text> : null}
          </View>
          <View style={styles.sigBlock}><View style={styles.sigLine} /><Text style={styles.sigTitle}>{L.controller}</Text></View>
          <View style={styles.sigBlock}><View style={styles.sigLine} /><Text style={styles.sigTitle}>{L.seal}</Text><Text style={{ fontSize: 6, color: "#94A3B8", marginTop: 1 }}>(Stamp)</Text></View>
          <View style={styles.sigBlock}><View style={styles.sigLine} /><Text style={styles.sigTitle}>{L.principal}</Text><Text style={{ fontSize: 6, color: "#94A3B8", marginTop: 1 }}>{school.name}</Text></View>
        </View>

        <View style={styles.officialFooter} fixed>
          <Text>{L.computerGenerated}</Text>
          <Text>{school.name} • {data.transcriptNumber}</Text>
        </View>
      </Page>
    </Document>
  );
}
