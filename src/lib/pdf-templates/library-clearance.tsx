/* eslint-disable jsx-a11y/alt-text */
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { PdfSchoolInfo } from "./report-base";

export interface LibraryClearanceData {
  certificateNumber: string;
  issueDate: string;
  studentName: string;
  fatherName?: string;
  admissionNumber: string;
  rollNumber: string;
  className: string;
  section?: string;
  academicYear: string;
  libraryDues: { checked: boolean; label: string; note?: string }[];
  totalBooksIssued: number;
  totalBooksReturned: number;
  pendingBooks: number;
  fineDue: number;
  currencySymbol: string;
  isClear: boolean;
  remarks?: string;
  librarianName?: string;
}

export interface LibraryClearanceProps {
  school: PdfSchoolInfo;
  data: LibraryClearanceData;
  verificationUrl?: string;
  labels?: Partial<typeof defaultLabels>;
}

const defaultLabels = {
  title: "Library Clearance Certificate",
  subtitle: "No-Dues Verification",
  certificateNo: "Certificate No.",
  issueDate: "Issue Date",
  studentName: "Student Name",
  fatherName: "Father's Name",
  admissionNo: "Admission No.",
  rollNo: "Roll No.",
  classSection: "Class & Section",
  academicYear: "Academic Year",
  checklist: "Clearance Checklist",
  status: "Status",
  booksIssued: "Books Issued",
  booksReturned: "Books Returned",
  pendingBooks: "Pending Books",
  fineDue: "Fine Due",
  cleared: "CLEARED — NO DUES",
  pending: "PENDING — DUES REMAIN",
  declarationClear: "Certified that the student has no outstanding library dues. All books have been returned and fines cleared.",
  declarationPending: "Student has pending library dues. Clearance withheld until all items are returned and fines paid.",
  librarian: "Librarian",
  principal: "Principal",
  seal: "Official Seal",
  verificationNote: "Scan QR to verify",
  computerGenerated: "Computer-generated clearance verifiable online.",
};

const styles = StyleSheet.create({
  page: { paddingTop: 22, paddingBottom: 22, paddingHorizontal: 26, backgroundColor: "#FFFFFF", color: "#0F172A", fontSize: 8.5, fontFamily: "Helvetica" },
  watermark: { position: "absolute", top: 300, left: 50, right: 50, textAlign: "center", fontSize: 60, fontWeight: 700, color: "#DBEAFE", opacity: 0.32, transform: "rotate(-30deg)" },
  borderOuter: { position: "absolute", top: 12, left: 12, right: 12, bottom: 12, border: "1.5px solid #1D4ED8", borderRadius: 6 },
  borderInner: { position: "absolute", top: 15, left: 15, right: 15, bottom: 15, border: "0.5px solid #93C5FD", borderRadius: 4 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #1D4ED8", paddingBottom: 10, marginBottom: 10 },
  schoolBlock: { flexDirection: "row", flex: 1, alignItems: "center" },
  logo: { width: 42, height: 42, borderRadius: 6, objectFit: "cover", marginRight: 10 },
  logoPlaceholder: { width: 42, height: 42, borderRadius: 6, backgroundColor: "#DBEAFE", alignItems: "center", justifyContent: "center", marginRight: 10 },
  logoPlaceholderText: { fontSize: 18, color: "#1D4ED8", fontWeight: 700 },
  schoolName: { fontSize: 14, fontWeight: 700, color: "#1D4ED8" },
  schoolMeta: { fontSize: 7, color: "#475569", marginTop: 1 },
  titleBlock: { alignItems: "flex-end", maxWidth: 220 },
  certNoBox: { backgroundColor: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 4, paddingVertical: 4, paddingHorizontal: 8, marginTop: 4 },
  certNoText: { fontSize: 7, color: "#1E3A8A", fontWeight: 700 },
  titleSection: { alignItems: "center", marginBottom: 8, marginTop: 4 },
  title: { fontSize: 16, fontWeight: 700, color: "#0F172A", textTransform: "uppercase", letterSpacing: 1.2, borderBottom: "2px solid #1D4ED8", paddingBottom: 4, marginBottom: 3 },
  subtitle: { fontSize: 7.5, color: "#64748B", textTransform: "uppercase", letterSpacing: 1 },
  profileCard: { border: "1px solid #E2E8F0", borderRadius: 6, padding: 10, backgroundColor: "#F8FAFC", marginBottom: 10, flexDirection: "row", flexWrap: "wrap" },
  fieldItem: { width: "50%", flexDirection: "row", marginBottom: 4, paddingRight: 8 },
  fieldLabel: { fontSize: 6.5, color: "#64748B", fontWeight: 700, width: 100, textTransform: "uppercase" },
  fieldValue: { fontSize: 8, color: "#0F172A", fontWeight: 700, flex: 1 },
  statusBanner: { borderRadius: 6, paddingVertical: 8, paddingHorizontal: 12, alignItems: "center", marginBottom: 10, borderWidth: 1.5 },
  statusText: { fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8 },
  checklist: { border: "1px solid #E2E8F0", borderRadius: 6, overflow: "hidden", marginBottom: 8 },
  checklistHeader: { flexDirection: "row", backgroundColor: "#1E293B", paddingVertical: 6, paddingHorizontal: 8 },
  th: { color: "#FFFFFF", fontSize: 7, fontWeight: 700, textTransform: "uppercase" },
  checklistRow: { flexDirection: "row", paddingVertical: 6, paddingHorizontal: 8, borderTop: "1px solid #E2E8F0", alignItems: "center" },
  checklistRowAlt: { backgroundColor: "#F8FAFC" },
  td: { fontSize: 7.5, color: "#1E293B" },
  badge: { fontSize: 6.5, fontWeight: 700, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 3, textTransform: "uppercase" },
  statsGrid: { flexDirection: "row", gap: 6, marginBottom: 8 },
  statCard: { flex: 1, border: "1px solid #E2E8F0", borderRadius: 6, padding: 7, alignItems: "center", backgroundColor: "#FFFFFF" },
  statValue: { fontSize: 13, fontWeight: 700, color: "#0F172A" },
  statLabel: { fontSize: 6.5, color: "#64748B", fontWeight: 700, textTransform: "uppercase", marginTop: 2 },
  footerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 14 },
  qrBox: { alignItems: "center", width: 100 },
  qrImage: { width: 66, height: 66, border: "1px solid #E2E8F0" },
  qrCaption: { fontSize: 6, color: "#64748B", textAlign: "center", marginTop: 3 },
  sigBlock: { alignItems: "center", width: 120 },
  sigLine: { width: "100%", borderTop: "1px solid #0F172A", marginBottom: 4 },
  sigTitle: { fontSize: 7, color: "#475569", fontWeight: 700 },
  officialFooter: { marginTop: 10, paddingTop: 6, borderTop: "1px solid #E2E8F0", flexDirection: "row", justifyContent: "space-between", color: "#64748B", fontSize: 6.5 },
});

export function LibraryClearanceTemplate({ school, data, verificationUrl, labels: l }: LibraryClearanceProps) {
  const L = { ...defaultLabels, ...l };
  const qrSrc = verificationUrl ? `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(verificationUrl)}` : undefined;
  const clear = data.isClear;
  return (
    <Document title={`Clearance-${data.certificateNumber}`} author={school.name}>
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

        <View style={styles.profileCard}>
          <View style={styles.fieldItem}><Text style={styles.fieldLabel}>{L.studentName}</Text><Text style={styles.fieldValue}>{data.studentName}</Text></View>
          {data.fatherName ? <View style={styles.fieldItem}><Text style={styles.fieldLabel}>{L.fatherName}</Text><Text style={styles.fieldValue}>{data.fatherName}</Text></View> : null}
          <View style={styles.fieldItem}><Text style={styles.fieldLabel}>{L.admissionNo}</Text><Text style={styles.fieldValue}>{data.admissionNumber}</Text></View>
          <View style={styles.fieldItem}><Text style={styles.fieldLabel}>{L.rollNo}</Text><Text style={styles.fieldValue}>{data.rollNumber}</Text></View>
          <View style={styles.fieldItem}><Text style={styles.fieldLabel}>{L.classSection}</Text><Text style={styles.fieldValue}>{data.className}{data.section ? ` - ${data.section}` : ""}</Text></View>
          <View style={styles.fieldItem}><Text style={styles.fieldLabel}>{L.academicYear}</Text><Text style={styles.fieldValue}>{data.academicYear}</Text></View>
        </View>

        <View style={[styles.statusBanner, { backgroundColor: clear ? "#ECFDF5" : "#FEF2F2", borderColor: clear ? "#86EFAC" : "#FECACA" }]}>
          <Text style={[styles.statusText, { color: clear ? "#15803D" : "#DC2626" }]}>{clear ? L.cleared : L.pending}</Text>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}><Text style={styles.statValue}>{data.totalBooksIssued}</Text><Text style={styles.statLabel}>{L.booksIssued}</Text></View>
          <View style={styles.statCard}><Text style={styles.statValue}>{data.totalBooksReturned}</Text><Text style={styles.statLabel}>{L.booksReturned}</Text></View>
          <View style={[styles.statCard, { borderColor: data.pendingBooks > 0 ? "#FECACA" : "#E2E8F0", backgroundColor: data.pendingBooks > 0 ? "#FEF2F2" : "#FFFFFF" }]}><Text style={[styles.statValue, { color: data.pendingBooks > 0 ? "#DC2626" : "#0F172A" }]}>{data.pendingBooks}</Text><Text style={styles.statLabel}>{L.pendingBooks}</Text></View>
          <View style={[styles.statCard, { borderColor: data.fineDue > 0 ? "#FECACA" : "#E2E8F0", backgroundColor: data.fineDue > 0 ? "#FEF2F2" : "#FFFFFF" }]}><Text style={[styles.statValue, { color: data.fineDue > 0 ? "#DC2626" : "#15803D" }]}>{data.currencySymbol}{data.fineDue.toFixed(2)}</Text><Text style={styles.statLabel}>{L.fineDue}</Text></View>
        </View>

        <View style={styles.checklist}>
          <View style={styles.checklistHeader}>
            <Text style={[styles.th, { flex: 3 }]}>{L.checklist}</Text>
            <Text style={[styles.th, { flex: 1.5, textAlign: "center" }]}>{L.status}</Text>
            <Text style={[styles.th, { flex: 2, textAlign: "left", paddingLeft: 6 }]}>Note</Text>
          </View>
          {data.libraryDues.map((item, i) => (
            <View key={i} style={[styles.checklistRow, i % 2 === 1 ? styles.checklistRowAlt : {}]}>
              <Text style={[styles.td, { flex: 3, fontWeight: item.checked ? 400 : 700, color: item.checked ? "#1E293B" : "#DC2626" }]}>{item.checked ? "✓ " : "✗ "}{item.label}</Text>
              <View style={{ flex: 1.5, alignItems: "center" }}>
                <Text style={[styles.badge, { backgroundColor: item.checked ? "#ECFDF5" : "#FEF2F2", color: item.checked ? "#15803D" : "#DC2626", border: item.checked ? "1px solid #86EFAC" : "1px solid #FECACA" }]}>{item.checked ? "Cleared" : "Pending"}</Text>
              </View>
              <Text style={[styles.td, { flex: 2, paddingLeft: 6, color: "#64748B", fontSize: 6.5 }]}>{item.note || "-"}</Text>
            </View>
          ))}
        </View>

        <Text style={{ fontSize: 8, color: clear ? "#15803D" : "#DC2626", textAlign: "center", fontWeight: 700, marginBottom: 4 }}>{clear ? L.declarationClear : L.declarationPending}</Text>
        {data.remarks ? <Text style={{ fontSize: 7, color: "#475569", fontStyle: "italic", textAlign: "center", marginBottom: 6 }}>{data.remarks}</Text> : null}

        <View style={styles.footerRow}>
          <View style={styles.qrBox}>
            {qrSrc ? <Image src={qrSrc} style={styles.qrImage} /> : <View style={[styles.qrImage, { alignItems: "center", justifyContent: "center", backgroundColor: "#F1F5F9" }]}><Text style={{ fontSize: 6, color: "#94A3B8" }}>QR</Text></View>}
            <Text style={styles.qrCaption}>{L.verificationNote}</Text>
            {verificationUrl ? <Text style={[styles.qrCaption, { color: "#1D4ED8", fontSize: 5 }]}>{verificationUrl}</Text> : null}
          </View>
          <View style={styles.sigBlock}><View style={styles.sigLine} /><Text style={styles.sigTitle}>{L.librarian}</Text>{data.librarianName ? <Text style={{ fontSize: 6, color: "#94A3B8", marginTop: 1 }}>{data.librarianName}</Text> : null}</View>
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
