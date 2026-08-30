/* eslint-disable jsx-a11y/alt-text */
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { PdfSchoolInfo } from "./report-base";

export interface AdmitCardExamSchedule {
  date: string;
  day?: string;
  subject: string;
  subjectCode?: string;
  time: string;
  venue?: string;
}

export interface ExamAdmitCardData {
  examName: string;
  examType?: string;
  academicYear: string;
  rollNumber: string;
  admissionNumber: string;
  studentName: string;
  fatherName?: string;
  className: string;
  section?: string;
  dateOfBirth?: string;
  photoUrl?: string;
  examCenter?: string;
  centerCode?: string;
  schedule: AdmitCardExamSchedule[];
  instructions?: string[];
  admitCardNumber?: string;
  issueDate?: string;
}

export interface ExamAdmitCardProps {
  school: PdfSchoolInfo;
  data: ExamAdmitCardData;
  verificationUrl?: string;
  labels?: Partial<typeof defaultLabels>;
}

const defaultLabels = {
  title: "Examination Admit Card",
  subtitle: "Roll Number Slip",
  admitCardNo: "Admit Card No.",
  exam: "Examination",
  academicYear: "Academic Year",
  studentName: "Student Name",
  fatherName: "Father's Name",
  admissionNo: "Admission No.",
  rollNo: "Roll No.",
  classSection: "Class & Section",
  dob: "Date of Birth",
  examCenter: "Examination Center",
  centerCode: "Center Code",
  scheduleTitle: "Examination Schedule",
  colDate: "Date",
  colDay: "Day",
  colSubject: "Subject",
  colCode: "Code",
  colTime: "Time",
  colVenue: "Venue",
  instructionsTitle: "Important Instructions",
  defaultInstructions: [
    "Bring this admit card to the examination hall on every exam day.",
    "Arrive at the center at least 30 minutes before the scheduled time.",
    "Electronic devices, calculators (unless permitted) and study material are strictly prohibited.",
    "Follow all invigilator instructions and maintain discipline.",
  ],
  verificationNote: "Scan QR to verify",
  controller: "Controller of Examinations",
  principal: "Principal",
  seal: "Official Seal",
  computerGenerated: "Computer-generated admit card - valid with school seal and signature.",
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 18,
    paddingBottom: 18,
    paddingHorizontal: 20,
    backgroundColor: "#FFFFFF",
    color: "#0F172A",
    fontSize: 8,
    fontFamily: "Helvetica",
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #1D4ED8", paddingBottom: 8, marginBottom: 8 },
  schoolBlock: { flexDirection: "row", flex: 1, alignItems: "center" },
  logo: { width: 38, height: 38, objectFit: "cover", borderRadius: 6, marginRight: 8 },
  logoPlaceholder: { width: 38, height: 38, borderRadius: 6, backgroundColor: "#DBEAFE", alignItems: "center", justifyContent: "center", marginRight: 8 },
  logoPlaceholderText: { fontSize: 16, color: "#1D4ED8", fontWeight: 700 },
  schoolName: { fontSize: 13, fontWeight: 700, color: "#1D4ED8", marginBottom: 1 },
  schoolMeta: { fontSize: 7, color: "#475569", marginBottom: 1 },
  titleBlock: { alignItems: "flex-end", maxWidth: 220 },
  badge: { backgroundColor: "#1D4ED8", color: "#FFFFFF", fontSize: 7, fontWeight: 700, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 3, textTransform: "uppercase" },
  metaText: { fontSize: 6.5, color: "#64748B", marginTop: 2, textAlign: "right" },
  titleSection: { alignItems: "center", marginBottom: 8 },
  title: { fontSize: 15, fontWeight: 700, color: "#0F172A", textTransform: "uppercase", letterSpacing: 1.2 },
  subtitle: { fontSize: 8, color: "#1D4ED8", fontWeight: 700, textTransform: "uppercase", marginTop: 2, border: "1px solid #BFDBFE", backgroundColor: "#EFF6FF", paddingVertical: 2, paddingHorizontal: 10, borderRadius: 3 },
  topGrid: { flexDirection: "row", gap: 10, marginBottom: 8 },
  photoCard: { width: 90, alignItems: "center", border: "1px solid #E2E8F0", borderRadius: 6, padding: 6, backgroundColor: "#F8FAFC" },
  photo: { width: 72, height: 84, borderRadius: 4, border: "1px solid #CBD5E1", objectFit: "cover" },
  photoPlaceholder: { width: 72, height: 84, borderRadius: 4, border: "1px dashed #CBD5E1", backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  photoCap: { fontSize: 6, color: "#64748B", marginTop: 4, textAlign: "center" },
  infoCard: { flex: 1, border: "1px solid #E2E8F0", borderRadius: 6, padding: 8, backgroundColor: "#F8FAFC" },
  infoRow: { flexDirection: "row", marginBottom: 4 },
  infoLabel: { width: 105, fontSize: 7, color: "#64748B", fontWeight: 700, textTransform: "uppercase" },
  infoValue: { flex: 1, fontSize: 8, color: "#0F172A", fontWeight: 700 },
  rollHighlight: { backgroundColor: "#1D4ED8", color: "#FFFFFF", fontSize: 11, fontWeight: 700, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 3 },
  centerCard: { border: "1px solid #FDE68A", backgroundColor: "#FFFBEB", borderRadius: 6, padding: 6, marginBottom: 8, flexDirection: "row", justifyContent: "space-between" },
  table: { border: "1px solid #CBD5E1", borderRadius: 6, overflow: "hidden", marginBottom: 8 },
  tableHeader: { flexDirection: "row", backgroundColor: "#1D4ED8", paddingVertical: 6, paddingHorizontal: 6 },
  th: { fontSize: 7, fontWeight: 700, color: "#FFFFFF", textTransform: "uppercase" },
  tableRow: { flexDirection: "row", paddingVertical: 5, paddingHorizontal: 6, borderTop: "1px solid #E2E8F0" },
  tableRowAlt: { backgroundColor: "#F8FAFC" },
  td: { fontSize: 7.5, color: "#1E293B" },
  instructionsBox: { border: "1px solid #E2E8F0", borderRadius: 6, padding: 8, backgroundColor: "#FFFFFF", marginBottom: 8 },
  instTitle: { fontSize: 8, fontWeight: 700, color: "#1E293B", marginBottom: 4, textTransform: "uppercase" },
  instItem: { fontSize: 7, color: "#334155", marginBottom: 2, lineHeight: 1.4 },
  footerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 10 },
  qrBox: { alignItems: "center", width: 100 },
  qrImage: { width: 68, height: 68, border: "1px solid #E2E8F0" },
  qrCaption: { fontSize: 6, color: "#64748B", textAlign: "center", marginTop: 3 },
  sigBlock: { alignItems: "center", width: 120 },
  sigLine: { width: "100%", borderTop: "1px solid #0F172A", marginBottom: 4 },
  sigTitle: { fontSize: 7, color: "#475569", fontWeight: 700 },
  officialFooter: { marginTop: 8, paddingTop: 6, borderTop: "1px solid #E2E8F0", flexDirection: "row", justifyContent: "space-between", color: "#64748B", fontSize: 6.5 },
});

function AdmitCardPage({ school, data, verificationUrl, L }: { school: PdfSchoolInfo; data: ExamAdmitCardData; verificationUrl?: string; L: typeof defaultLabels }) {
  const qrSrc = verificationUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(verificationUrl)}`
    : undefined;
  const instructions = data.instructions && data.instructions.length > 0 ? data.instructions : L.defaultInstructions;
  return (
    <Page size="A4" style={styles.page}>
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
            <Text style={styles.badge}>{data.examType || "Examination"}</Text>
            <Text style={styles.metaText}>{L.academicYear}: {data.academicYear}</Text>
            {data.admitCardNumber ? <Text style={styles.metaText}>{L.admitCardNo} {data.admitCardNumber}</Text> : null}
            {data.issueDate ? <Text style={styles.metaText}>Issued: {data.issueDate}</Text> : null}
          </View>
        </View>

        <View style={styles.titleSection}>
          <Text style={styles.title}>{L.title}</Text>
          <Text style={styles.subtitle}>{L.subtitle} — {data.examName}</Text>
        </View>

        <View style={styles.topGrid}>
          <View style={styles.photoCard}>
            {data.photoUrl ? <Image src={data.photoUrl} style={styles.photo} /> : (
              <View style={styles.photoPlaceholder}><Text style={{ fontSize: 6, color: "#94A3B8" }}>Photo</Text></View>
            )}
            <Text style={styles.photoCap}>Candidate Photo</Text>
            <View style={{ marginTop: 6, alignItems: "center" }}>
              <Text style={{ fontSize: 6, color: "#64748B", textTransform: "uppercase", fontWeight: 700 }}>{L.rollNo}</Text>
              <Text style={styles.rollHighlight}>{data.rollNumber}</Text>
            </View>
          </View>

          <View style={styles.infoCard}>
            <View style={styles.infoRow}><Text style={styles.infoLabel}>{L.studentName}</Text><Text style={styles.infoValue}>{data.studentName}</Text></View>
            {data.fatherName ? <View style={styles.infoRow}><Text style={styles.infoLabel}>{L.fatherName}</Text><Text style={styles.infoValue}>{data.fatherName}</Text></View> : null}
            <View style={styles.infoRow}><Text style={styles.infoLabel}>{L.admissionNo}</Text><Text style={styles.infoValue}>{data.admissionNumber}</Text></View>
            <View style={styles.infoRow}><Text style={styles.infoLabel}>{L.classSection}</Text><Text style={styles.infoValue}>{data.className}{data.section ? ` - ${data.section}` : ""}</Text></View>
            {data.dateOfBirth ? <View style={styles.infoRow}><Text style={styles.infoLabel}>{L.dob}</Text><Text style={styles.infoValue}>{data.dateOfBirth}</Text></View> : null}
            <View style={styles.infoRow}><Text style={styles.infoLabel}>{L.exam}</Text><Text style={styles.infoValue}>{data.examName}</Text></View>
            <View style={styles.infoRow}><Text style={styles.infoLabel}>{L.academicYear}</Text><Text style={styles.infoValue}>{data.academicYear}</Text></View>
            <View style={{ borderTop: "1px dashed #CBD5E1", marginTop: 6, paddingTop: 6 }}>
              <Text style={{ fontSize: 6, color: "#64748B", fontWeight: 700, textTransform: "uppercase", marginBottom: 2 }}>Candidate Signature</Text>
              <View style={{ borderTop: "1px solid #94A3B8", width: 160, marginTop: 12 }} />
            </View>
          </View>
        </View>

        {(data.examCenter || data.centerCode) ? (
          <View style={styles.centerCard}>
            <View><Text style={{ fontSize: 7, color: "#92400E", fontWeight: 700, textTransform: "uppercase" }}>{L.examCenter}</Text><Text style={{ fontSize: 9, color: "#78350F", fontWeight: 700, marginTop: 2 }}>{data.examCenter || "—"}</Text></View>
            {data.centerCode ? <View style={{ alignItems: "flex-end" }}><Text style={{ fontSize: 7, color: "#92400E", fontWeight: 700, textTransform: "uppercase" }}>{L.centerCode}</Text><Text style={{ fontSize: 9, color: "#78350F", fontWeight: 700, marginTop: 2 }}>{data.centerCode}</Text></View> : null}
          </View>
        ) : null}

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.th, { flex: 1.2 }]}>{L.colDate}</Text>
            <Text style={[styles.th, { flex: 1 }]}>{L.colDay}</Text>
            <Text style={[styles.th, { flex: 3 }]}>{L.colSubject}</Text>
            <Text style={[styles.th, { flex: 1 }]}>{L.colCode}</Text>
            <Text style={[styles.th, { flex: 1.5, textAlign: "right" }]}>{L.colTime}</Text>
            <Text style={[styles.th, { flex: 1.2, textAlign: "right" }]}>{L.colVenue}</Text>
          </View>
          {data.schedule.length > 0 ? data.schedule.map((row, i) => (
            <View key={`${row.date}-${i}`} style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}>
              <Text style={[styles.td, { flex: 1.2, fontWeight: 700 }]}>{row.date}</Text>
              <Text style={[styles.td, { flex: 1, color: "#64748B" }]}>{row.day || "-"}</Text>
              <Text style={[styles.td, { flex: 3, fontWeight: 700 }]}>{row.subject}</Text>
              <Text style={[styles.td, { flex: 1, color: "#64748B" }]}>{row.subjectCode || "-"}</Text>
              <Text style={[styles.td, { flex: 1.5, textAlign: "right" }]}>{row.time}</Text>
              <Text style={[styles.td, { flex: 1.2, textAlign: "right", color: "#475569" }]}>{row.venue || "-"}</Text>
            </View>
          )) : (
            <View style={styles.tableRow}><Text style={styles.td}>No schedule available for this examination.</Text></View>
          )}
        </View>

        <View style={styles.instructionsBox}>
          <Text style={styles.instTitle}>{L.instructionsTitle}</Text>
          {instructions.map((inst, idx) => (
            <Text key={idx} style={styles.instItem}>{idx + 1}. {inst}</Text>
          ))}
        </View>

        <View style={styles.footerRow}>
          <View style={styles.qrBox}>
            {qrSrc ? <Image src={qrSrc} style={styles.qrImage} /> : <View style={[styles.qrImage, { alignItems: "center", justifyContent: "center", backgroundColor: "#F1F5F9" }]}><Text style={{ fontSize: 6, color: "#94A3B8" }}>QR</Text></View>}
            <Text style={styles.qrCaption}>{L.verificationNote}</Text>
            {verificationUrl ? <Text style={[styles.qrCaption, { color: "#1D4ED8", fontSize: 5.5 }]}>{verificationUrl}</Text> : null}
          </View>
          <View style={styles.sigBlock}><View style={styles.sigLine} /><Text style={styles.sigTitle}>{L.controller}</Text></View>
          <View style={styles.sigBlock}><View style={styles.sigLine} /><Text style={styles.sigTitle}>{L.seal}</Text><Text style={{ fontSize: 6, color: "#94A3B8", marginTop: 1 }}>(Stamp)</Text></View>
          <View style={styles.sigBlock}><View style={styles.sigLine} /><Text style={styles.sigTitle}>{L.principal}</Text><Text style={{ fontSize: 6, color: "#94A3B8", marginTop: 1 }}>{school.name}</Text></View>
        </View>

        <View style={styles.officialFooter} fixed>
          <Text>{L.computerGenerated}</Text>
          <Text>{data.examName} • {data.rollNumber}</Text>
        </View>
      </Page>
  );
}

export function ExamAdmitCardTemplate({ school, data, verificationUrl, labels: l }: ExamAdmitCardProps) {
  const L = { ...defaultLabels, ...l };
  return (
    <Document title={`Admit-${data.rollNumber}-${data.examName}`} author={school.name}>
      <AdmitCardPage school={school} data={data} verificationUrl={verificationUrl} L={L} />
    </Document>
  );
}

export interface BatchAdmitCardProps {
  school: PdfSchoolInfo;
  cards: ExamAdmitCardData[];
  verificationBaseUrl?: string;
  labels?: Partial<typeof defaultLabels>;
}

export function BatchAdmitCardDocument({ school, cards, verificationBaseUrl, labels: l }: BatchAdmitCardProps) {
  const L = { ...defaultLabels, ...l };
  return (
    <Document title={`Batch-Admit-${cards.length}`} author={school.name}>
      {cards.map((data, idx) => {
        const url = verificationBaseUrl ? `${verificationBaseUrl}/verify/certificate/${data.admissionNumber}` : undefined;
        return <AdmitCardPage key={data.rollNumber + idx} school={school} data={data} verificationUrl={url} L={L} />;
      })}
    </Document>
  );
}
