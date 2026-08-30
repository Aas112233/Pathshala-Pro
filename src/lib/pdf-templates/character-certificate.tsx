/* eslint-disable jsx-a11y/alt-text */
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { PdfSchoolInfo } from "./report-base";

export interface CharacterCertificateData {
  certificateNumber: string;
  issueDate: string;
  studentName: string;
  fatherName?: string;
  admissionNumber: string;
  rollNumber: string;
  className: string;
  section?: string;
  academicYear: string;
  sessionFrom: string;
  sessionTo: string;
  conduct: string;
  characterRating?: string;
  attendancePercentage?: string;
  achievements?: string;
  remarks?: string;
}

export interface CharacterCertificateProps {
  school: PdfSchoolInfo;
  data: CharacterCertificateData;
  verificationUrl?: string;
  labels?: Partial<typeof defaultLabels>;
}

const defaultLabels = {
  title: "Character Certificate",
  subtitle: "Certificate of Moral Character & Conduct",
  certificateNo: "Certificate No.",
  issueDate: "Date of Issue",
  toWhom: "To Whom It May Concern",
  certifiedThat: "This is to certify that",
  sonDaughterOf: "son/daughter of",
  wasStudent: "was a bonafide student of this institution during the academic session",
  studyingIn: "Studying in Class",
  admissionNo: "Admission No.",
  rollNo: "Roll No.",
  academicYear: "Academic Year",
  periodOfStudy: "Period of Study",
  conduct: "General Conduct",
  character: "Character & Discipline",
  attendance: "Attendance",
  achievements: "Achievements & Remarks",
  declaration:
    "To the best of our knowledge and belief, the bearer bears a good moral character and has not been involved in any disciplinary issue during his/her stay. We wish him/her every success in future endeavors.",
  verificationNote: "Scan QR to verify authenticity",
  principal: "Principal / Headmaster",
  seal: "Official Seal",
  issuedBy: "Issued By",
  computerGenerated: "This is a computer-generated certificate verifiable online.",
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 22,
    paddingBottom: 22,
    paddingHorizontal: 26,
    backgroundColor: "#FFFFFF",
    color: "#0F172A",
    fontSize: 9,
    fontFamily: "Helvetica",
  },
  watermark: {
    position: "absolute",
    top: 300,
    left: 40,
    right: 40,
    textAlign: "center",
    fontSize: 64,
    fontWeight: 700,
    color: "#DBEAFE",
    opacity: 0.32,
    transform: "rotate(-30deg)",
  },
  borderOuter: { position: "absolute", top: 12, left: 12, right: 12, bottom: 12, border: "1.5px solid #1D4ED8", borderRadius: 6 },
  borderInner: { position: "absolute", top: 15, left: 15, right: 15, bottom: 15, border: "0.5px solid #93C5FD", borderRadius: 4 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #1D4ED8", paddingBottom: 10, marginBottom: 10 },
  schoolBlock: { flexDirection: "row", flex: 1, alignItems: "center" },
  logo: { width: 44, height: 44, objectFit: "cover", borderRadius: 6, marginRight: 10 },
  logoPlaceholder: { width: 44, height: 44, borderRadius: 6, backgroundColor: "#DBEAFE", alignItems: "center", justifyContent: "center", marginRight: 10 },
  logoPlaceholderText: { fontSize: 18, color: "#1D4ED8", fontWeight: 700 },
  schoolName: { fontSize: 15, fontWeight: 700, color: "#1D4ED8", marginBottom: 1 },
  schoolMeta: { fontSize: 7.5, color: "#475569", marginBottom: 1 },
  titleBlock: { alignItems: "flex-end", maxWidth: 220 },
  certNoBox: { backgroundColor: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 4, paddingVertical: 4, paddingHorizontal: 8, marginTop: 4 },
  certNoText: { fontSize: 7, color: "#1E3A8A", fontWeight: 700 },
  titleSection: { alignItems: "center", marginBottom: 8, marginTop: 4 },
  title: { fontSize: 18, fontWeight: 700, color: "#1E293B", textTransform: "uppercase", letterSpacing: 1.5, borderBottom: "2px solid #1D4ED8", paddingBottom: 4, marginBottom: 3 },
  subtitle: { fontSize: 8, color: "#64748B", textTransform: "uppercase", letterSpacing: 1 },
  toWhom: { textAlign: "center", fontSize: 10, fontWeight: 700, color: "#334155", marginBottom: 10, letterSpacing: 0.5, textTransform: "uppercase" },
  bodyCard: { border: "1px solid #E2E8F0", borderRadius: 6, padding: 14, backgroundColor: "#F8FAFC", marginBottom: 10 },
  para: { fontSize: 9.5, color: "#1E293B", lineHeight: 1.65, textAlign: "justify", marginBottom: 10 },
  bold: { fontWeight: 700, color: "#0F172A" },
  highlight: { backgroundColor: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 4, paddingVertical: 2, paddingHorizontal: 4 },
  fieldGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: 6, borderTop: "1px dashed #CBD5E1", paddingTop: 8 },
  fieldItem: { width: "50%", flexDirection: "row", marginBottom: 5, paddingRight: 8 },
  fieldLabel: { fontSize: 7, color: "#64748B", fontWeight: 700, width: 120, textTransform: "uppercase" },
  fieldValue: { fontSize: 8.5, color: "#0F172A", fontWeight: 700, flex: 1 },
  conductBox: { flexDirection: "row", justifyContent: "space-between", marginTop: 10, gap: 8 },
  conductCard: { flex: 1, border: "1px solid #E2E8F0", borderRadius: 6, padding: 8, backgroundColor: "#FFFFFF", alignItems: "center" },
  conductLabel: { fontSize: 7, color: "#64748B", textTransform: "uppercase", fontWeight: 700, marginBottom: 4 },
  conductValue: { fontSize: 11, fontWeight: 700, color: "#1D4ED8" },
  remarksBox: { backgroundColor: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 4, padding: 8, marginTop: 8 },
  footerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 18 },
  qrBox: { alignItems: "center", width: 110 },
  qrImage: { width: 70, height: 70, border: "1px solid #E2E8F0" },
  qrCaption: { fontSize: 6, color: "#64748B", textAlign: "center", marginTop: 3 },
  sigBlock: { alignItems: "center", width: 140 },
  sigLine: { width: "100%", borderTop: "1px solid #0F172A", marginBottom: 4 },
  sigTitle: { fontSize: 7, color: "#475569", fontWeight: 700 },
  officialFooter: { marginTop: 12, paddingTop: 6, borderTop: "1px solid #E2E8F0", flexDirection: "row", justifyContent: "space-between", color: "#64748B", fontSize: 6.5 },
});

export function CharacterCertificateTemplate({ school, data, verificationUrl, labels: l }: CharacterCertificateProps) {
  const L = { ...defaultLabels, ...l };
  const qrSrc = verificationUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(verificationUrl)}`
    : undefined;
  return (
    <Document title={`CC-${data.certificateNumber}`} author={school.name}>
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
            <View style={styles.certNoBox}><Text style={styles.certNoText}>{L.certificateNo} {data.certificateNumber}</Text></View>
            <Text style={{ fontSize: 7, color: "#64748B", marginTop: 3, textAlign: "right" }}>{L.issueDate}: {data.issueDate}</Text>
          </View>
        </View>

        <View style={styles.titleSection}>
          <Text style={styles.title}>{L.title}</Text>
          <Text style={styles.subtitle}>{L.subtitle}</Text>
        </View>
        <Text style={styles.toWhom}>{L.toWhom}</Text>

        <View style={styles.bodyCard}>
          <Text style={styles.para}>
            {L.certifiedThat} <Text style={styles.bold}>{data.studentName}</Text>
            {data.fatherName ? <> {L.sonDaughterOf} <Text style={styles.bold}>{data.fatherName}</Text></> : null},{" "}
            {L.wasStudent} <Text style={styles.bold}>{data.academicYear}</Text>, {L.studyingIn} <Text style={styles.bold}>{data.className}{data.section ? ` - ${data.section}` : ""}</Text>.
            The student bears Admission No. <Text style={styles.bold}>{data.admissionNumber}</Text> and Roll No. <Text style={styles.bold}>{data.rollNumber}</Text>.
          </Text>

          <View style={styles.fieldGrid}>
            <View style={styles.fieldItem}><Text style={styles.fieldLabel}>{L.admissionNo}</Text><Text style={styles.fieldValue}>{data.admissionNumber}</Text></View>
            <View style={styles.fieldItem}><Text style={styles.fieldLabel}>{L.rollNo}</Text><Text style={styles.fieldValue}>{data.rollNumber}</Text></View>
            <View style={styles.fieldItem}><Text style={styles.fieldLabel}>{L.periodOfStudy}</Text><Text style={styles.fieldValue}>{data.sessionFrom} — {data.sessionTo}</Text></View>
            <View style={styles.fieldItem}><Text style={styles.fieldLabel}>{L.academicYear}</Text><Text style={styles.fieldValue}>{data.academicYear}</Text></View>
          </View>

          <View style={styles.conductBox}>
            <View style={styles.conductCard}><Text style={styles.conductLabel}>{L.conduct}</Text><Text style={styles.conductValue}>{data.conduct}</Text></View>
            <View style={styles.conductCard}><Text style={styles.conductLabel}>{L.character}</Text><Text style={styles.conductValue}>{data.characterRating || data.conduct}</Text></View>
            {data.attendancePercentage ? <View style={styles.conductCard}><Text style={styles.conductLabel}>{L.attendance}</Text><Text style={styles.conductValue}>{data.attendancePercentage}</Text></View> : null}
          </View>

          <Text style={{ fontSize: 8, color: "#334155", lineHeight: 1.6, marginTop: 10, textAlign: "justify" }}>{L.declaration}</Text>

          {data.achievements || data.remarks ? (
            <View style={styles.remarksBox}>
              {data.achievements ? <><Text style={{ fontSize: 7, color: "#64748B", fontWeight: 700 }}>{L.achievements}:</Text><Text style={{ fontSize: 8, color: "#1E293B", marginBottom: 4 }}>{data.achievements}</Text></> : null}
              {data.remarks ? <Text style={{ fontSize: 7.5, color: "#475569", fontStyle: "italic" }}>{data.remarks}</Text> : null}
            </View>
          ) : null}
        </View>

        <View style={styles.footerRow}>
          <View style={styles.qrBox}>
            {qrSrc ? <Image src={qrSrc} style={styles.qrImage} /> : <View style={[styles.qrImage, { alignItems: "center", justifyContent: "center", backgroundColor: "#F1F5F9" }]}><Text style={{ fontSize: 6, color: "#94A3B8" }}>QR</Text></View>}
            <Text style={styles.qrCaption}>{L.verificationNote}</Text>
            {verificationUrl ? <Text style={[styles.qrCaption, { color: "#1D4ED8", fontSize: 5.5 }]}>{verificationUrl}</Text> : null}
          </View>
          <View style={styles.sigBlock}><View style={styles.sigLine} /><Text style={styles.sigTitle}>{L.issuedBy}</Text></View>
          <View style={styles.sigBlock}><View style={styles.sigLine} /><Text style={styles.sigTitle}>{L.seal}</Text><Text style={{ fontSize: 6, color: "#94A3B8", marginTop: 1 }}>(Stamp)</Text></View>
          <View style={styles.sigBlock}><View style={styles.sigLine} /><Text style={styles.sigTitle}>{L.principal}</Text><Text style={{ fontSize: 6, color: "#94A3B8", marginTop: 1 }}>{school.name}</Text></View>
        </View>

        <View style={styles.officialFooter} fixed>
          <Text>{L.computerGenerated}</Text>
          <Text>{school.name} • {data.certificateNumber}</Text>
        </View>
      </Page>
    </Document>
  );
}
