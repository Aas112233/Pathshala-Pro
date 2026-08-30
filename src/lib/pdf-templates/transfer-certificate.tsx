/* eslint-disable jsx-a11y/alt-text */
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { PdfSchoolInfo } from "./report-base";

export interface TransferCertificateData {
  certificateNumber: string;
  issueDate: string;
  studentName: string;
  fatherName?: string;
  motherName?: string;
  admissionNumber: string;
  rollNumber: string;
  className: string;
  section?: string;
  dateOfBirth?: string;
  gender?: string;
  admissionDate: string;
  leavingDate: string;
  lastClassAttended: string;
  academicYear: string;
  reasonForLeaving: string;
  conduct: string;
  remarks?: string;
  guardianName?: string;
}

export interface TransferCertificateProps {
  school: PdfSchoolInfo;
  data: TransferCertificateData;
  verificationUrl?: string;
  labels?: Partial<typeof defaultLabels>;
}

const defaultLabels = {
  title: "Transfer Certificate",
  subtitle: "School Leaving Certificate",
  certificateNo: "Certificate No.",
  issueDate: "Issue Date",
  certifiedThat: "This is to certify that",
  sonDaughterOf: "Son/Daughter of",
  admissionNo: "Admission No.",
  rollNo: "Roll No.",
  classSection: "Class & Section",
  dob: "Date of Birth",
  admissionDate: "Date of Admission",
  leavingDate: "Date of Leaving",
  lastClass: "Last Class Attended",
  academicYear: "Academic Year",
  reasonLeaving: "Reason for Leaving",
  conduct: "General Conduct",
  remarks: "Remarks",
  declaration:
    "The above information is true to the best of our records. The student has cleared all dues and returned all library books and school property.",
  verificationNote: "Scan QR to verify authenticity at",
  principal: "Principal / Headmaster",
  seal: "Official Seal",
  preparedBy: "Prepared By",
  computerGenerated: "This is a computer-generated certificate and does not require a physical signature if verified online.",
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
    left: 60,
    right: 60,
    textAlign: "center",
    fontSize: 68,
    fontWeight: 700,
    color: "#DBEAFE",
    opacity: 0.35,
    transform: "rotate(-30deg)",
  },
  borderOuter: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    bottom: 12,
    border: "1.5px solid #1D4ED8",
    borderRadius: 6,
  },
  borderInner: {
    position: "absolute",
    top: 15,
    left: 15,
    right: 15,
    bottom: 15,
    border: "0.5px solid #93C5FD",
    borderRadius: 4,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottom: "2px solid #1D4ED8",
    paddingBottom: 10,
    marginBottom: 10,
  },
  schoolBlock: { flexDirection: "row", flex: 1, alignItems: "center" },
  logo: { width: 44, height: 44, objectFit: "cover", borderRadius: 6, marginRight: 10 },
  logoPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 6,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  logoPlaceholderText: { fontSize: 18, color: "#1D4ED8", fontWeight: 700 },
  schoolName: { fontSize: 15, fontWeight: 700, color: "#1D4ED8", marginBottom: 1 },
  schoolMeta: { fontSize: 7.5, color: "#475569", marginBottom: 1 },
  titleBlock: { alignItems: "flex-end", maxWidth: 220 },
  certNoBox: { backgroundColor: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 4, paddingVertical: 4, paddingHorizontal: 8, marginTop: 4 },
  certNoText: { fontSize: 7, color: "#1E3A8A", fontWeight: 700 },
  titleSection: { alignItems: "center", marginBottom: 10, marginTop: 4 },
  title: { fontSize: 18, fontWeight: 700, color: "#1E293B", textTransform: "uppercase", letterSpacing: 1.5, borderBottom: "2px solid #1D4ED8", paddingBottom: 4, marginBottom: 3 },
  subtitle: { fontSize: 8, color: "#64748B", textTransform: "uppercase", letterSpacing: 1 },
  bodyCard: { border: "1px solid #E2E8F0", borderRadius: 6, padding: 12, backgroundColor: "#F8FAFC", marginBottom: 10 },
  para: { fontSize: 9, color: "#1E293B", lineHeight: 1.55, textAlign: "justify", marginBottom: 8 },
  bold: { fontWeight: 700, color: "#0F172A" },
  fieldRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 6 },
  fieldItem: { width: "50%", flexDirection: "row", marginBottom: 5, paddingRight: 8 },
  fieldLabel: { fontSize: 7, color: "#64748B", fontWeight: 700, width: 110, textTransform: "uppercase" },
  fieldValue: { fontSize: 8.5, color: "#0F172A", fontWeight: 700, flex: 1 },
  divider: { borderTop: "1px dashed #CBD5E1", marginVertical: 8 },
  remarksBox: { backgroundColor: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 4, padding: 7, marginTop: 6 },
  footerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 16 },
  qrBox: { alignItems: "center", width: 110 },
  qrImage: { width: 70, height: 70, border: "1px solid #E2E8F0" },
  qrCaption: { fontSize: 6, color: "#64748B", textAlign: "center", marginTop: 3 },
  sigBlock: { alignItems: "center", width: 140 },
  sigLine: { width: "100%", borderTop: "1px solid #0F172A", marginBottom: 4 },
  sigTitle: { fontSize: 7, color: "#475569", fontWeight: 700 },
  sigName: { fontSize: 7, color: "#94A3B8", marginTop: 1 },
  officialFooter: { marginTop: 12, paddingTop: 6, borderTop: "1px solid #E2E8F0", flexDirection: "row", justifyContent: "space-between", color: "#64748B", fontSize: 6.5 },
});

export function TransferCertificateTemplate({ school, data, verificationUrl, labels: l }: TransferCertificateProps) {
  const L = { ...defaultLabels, ...l };
  const qrSrc = verificationUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(verificationUrl)}`
    : undefined;

  return (
    <Document title={`TC-${data.certificateNumber}`} author={school.name}>
      <Page size="A4" style={styles.page}>
        <View style={styles.borderOuter} />
        <View style={styles.borderInner} />
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

        <View style={styles.bodyCard}>
          <Text style={styles.para}>
            {L.certifiedThat} <Text style={styles.bold}>{data.studentName}</Text>
            {data.fatherName ? <> {L.sonDaughterOf} <Text style={styles.bold}>{data.fatherName}</Text></> : null}
            {data.motherName ? <>, Mother: <Text style={styles.bold}>{data.motherName}</Text></> : null} has been a bonafide student of this institution.
            The details as per school records are as follows:
          </Text>

          <View style={styles.fieldRow}>
            <View style={styles.fieldItem}><Text style={styles.fieldLabel}>{L.admissionNo}</Text><Text style={styles.fieldValue}>{data.admissionNumber}</Text></View>
            <View style={styles.fieldItem}><Text style={styles.fieldLabel}>{L.rollNo}</Text><Text style={styles.fieldValue}>{data.rollNumber}</Text></View>
            <View style={styles.fieldItem}><Text style={styles.fieldLabel}>{L.classSection}</Text><Text style={styles.fieldValue}>{data.className}{data.section ? ` - ${data.section}` : ""}</Text></View>
            <View style={styles.fieldItem}><Text style={styles.fieldLabel}>{L.lastClass}</Text><Text style={styles.fieldValue}>{data.lastClassAttended}</Text></View>
            {data.dateOfBirth ? <View style={styles.fieldItem}><Text style={styles.fieldLabel}>{L.dob}</Text><Text style={styles.fieldValue}>{data.dateOfBirth}</Text></View> : null}
            <View style={styles.fieldItem}><Text style={styles.fieldLabel}>{L.admissionDate}</Text><Text style={styles.fieldValue}>{data.admissionDate}</Text></View>
            <View style={styles.fieldItem}><Text style={styles.fieldLabel}>{L.leavingDate}</Text><Text style={styles.fieldValue}>{data.leavingDate}</Text></View>
            <View style={styles.fieldItem}><Text style={styles.fieldLabel}>{L.academicYear}</Text><Text style={styles.fieldValue}>{data.academicYear}</Text></View>
            <View style={styles.fieldItem}><Text style={styles.fieldLabel}>{L.reasonLeaving}</Text><Text style={styles.fieldValue}>{data.reasonForLeaving}</Text></View>
            <View style={styles.fieldItem}><Text style={styles.fieldLabel}>{L.conduct}</Text><Text style={styles.fieldValue}>{data.conduct}</Text></View>
          </View>

          <View style={styles.divider} />
          <Text style={{ fontSize: 7.5, color: "#334155", lineHeight: 1.5 }}>{L.declaration}</Text>
          {data.remarks ? (
            <View style={styles.remarksBox}><Text style={{ fontSize: 7, color: "#64748B", fontWeight: 700, marginBottom: 2 }}>{L.remarks}:</Text><Text style={{ fontSize: 8, color: "#1E293B" }}>{data.remarks}</Text></View>
          ) : null}
        </View>

        <View style={styles.footerRow}>
          <View style={styles.qrBox}>
            {qrSrc ? <Image src={qrSrc} style={styles.qrImage} /> : <View style={[styles.qrImage, { alignItems: "center", justifyContent: "center", backgroundColor: "#F1F5F9" }]}><Text style={{ fontSize: 6, color: "#94A3B8" }}>QR</Text></View>}
            <Text style={styles.qrCaption}>{L.verificationNote}</Text>
            {verificationUrl ? <Text style={[styles.qrCaption, { color: "#1D4ED8", fontSize: 5.5 }]}>{verificationUrl}</Text> : null}
          </View>
          <View style={styles.sigBlock}><View style={styles.sigLine} /><Text style={styles.sigTitle}>{L.preparedBy}</Text></View>
          <View style={styles.sigBlock}><View style={styles.sigLine} /><Text style={styles.sigTitle}>{L.seal}</Text><Text style={styles.sigName}>(Stamp)</Text></View>
          <View style={styles.sigBlock}><View style={styles.sigLine} /><Text style={styles.sigTitle}>{L.principal}</Text><Text style={styles.sigName}>{school.name}</Text></View>
        </View>

        <View style={styles.officialFooter} fixed>
          <Text>{L.computerGenerated}</Text>
          <Text>{school.name} • {data.certificateNumber}</Text>
        </View>
      </Page>
    </Document>
  );
}
