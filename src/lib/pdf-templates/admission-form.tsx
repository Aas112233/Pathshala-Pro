/* eslint-disable jsx-a11y/alt-text */
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { PdfSchoolInfo } from "./report-base";

export interface AdmissionFormProps {
  school: PdfSchoolInfo;
  academicYear?: string;
  formNumber?: string;
  labels?: Partial<typeof defaultLabels>;
}

const defaultLabels = {
  title: "Admission Application Form",
  subtitle: "For Office Use Only — Attach Recent Passport Size Photograph",
  formNo: "Form No.",
  academicYear: "Academic Year",
  sectionPersonal: "1. Personal Information of Applicant",
  sectionGuardian: "2. Parent / Guardian Information",
  sectionAcademic: "3. Academic Preference",
  sectionDocs: "4. Documents Checklist",
  declaration: "Declaration: I hereby declare that the information furnished above is true to the best of my knowledge. I agree to abide by the rules and discipline of the institution.",
  officeUse: "For Office Use Only",
  principal: "Principal",
  admissionOfficer: "Admission Officer",
};

const styles = StyleSheet.create({
  page: { paddingTop: 18, paddingBottom: 18, paddingHorizontal: 20, backgroundColor: "#FFFFFF", color: "#0F172A", fontSize: 8, fontFamily: "Helvetica" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2.5px solid #1D4ED8", paddingBottom: 8, marginBottom: 8 },
  schoolBlock: { flexDirection: "row", flex: 1, alignItems: "center" },
  logo: { width: 42, height: 42, borderRadius: 6, objectFit: "cover", marginRight: 8 },
  logoPlaceholder: { width: 42, height: 42, borderRadius: 6, backgroundColor: "#DBEAFE", alignItems: "center", justifyContent: "center", marginRight: 8 },
  schoolName: { fontSize: 14, fontWeight: 700, color: "#1D4ED8" },
  schoolMeta: { fontSize: 7, color: "#475569", marginTop: 1 },
  formNoBox: { alignItems: "flex-end" },
  formNoText: { fontSize: 7, color: "#1E3A8A", fontWeight: 700, backgroundColor: "#EFF6FF", border: "1px solid #BFDBFE", paddingVertical: 3, paddingHorizontal: 7, borderRadius: 4, marginBottom: 3 },
  titleBox: { alignItems: "center", backgroundColor: "#1D4ED8", paddingVertical: 6, borderRadius: 4, marginBottom: 8 },
  title: { color: "#FFFFFF", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8 },
  subtitle: { color: "#BFDBFE", fontSize: 6.5, marginTop: 2 },
  section: { border: "1px solid #E2E8F0", borderRadius: 6, marginBottom: 7, overflow: "hidden" },
  sectionHeader: { backgroundColor: "#F1F5F9", borderBottom: "1px solid #E2E8F0", paddingVertical: 4, paddingHorizontal: 8 },
  sectionTitle: { fontSize: 8, fontWeight: 700, color: "#1E293B", textTransform: "uppercase" },
  fieldGrid: { flexDirection: "row", flexWrap: "wrap", padding: 6 },
  field: { width: "50%", paddingRight: 6, marginBottom: 6 },
  fieldFull: { width: "100%", paddingRight: 6, marginBottom: 6 },
  fieldLabel: { fontSize: 6.5, color: "#64748B", fontWeight: 700, textTransform: "uppercase", marginBottom: 2 },
  dottedLine: { borderBottom: "1px dotted #94A3B8", height: 12, marginTop: 1 },
  smallLine: { borderBottom: "1px dotted #94A3B8", height: 10, marginTop: 1 },
  photoBox: { position: "absolute", top: 74, right: 20, width: 78, height: 96, border: "1.5px dashed #94A3B8", borderRadius: 4, backgroundColor: "#F8FAFC", alignItems: "center", justifyContent: "center" },
  checklistRow: { flexDirection: "row", alignItems: "center", width: "50%", marginBottom: 3, paddingRight: 6 },
  checkBox: { width: 9, height: 9, border: "1px solid #64748B", borderRadius: 2, marginRight: 5 },
  checklistText: { fontSize: 7, color: "#1E293B" },
  declarationBox: { border: "1px solid #E2E8F0", borderRadius: 6, padding: 7, marginBottom: 7, backgroundColor: "#F8FAFC" },
  declarationText: { fontSize: 7, color: "#334155", lineHeight: 1.5, textAlign: "justify" },
  sigRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  sigBlock: { width: 120, alignItems: "center" },
  sigLine: { width: "100%", borderTop: "1px solid #0F172A", marginBottom: 4 },
  sigTitle: { fontSize: 7, color: "#475569", fontWeight: 700 },
  officeBox: { border: "1.5px solid #1D4ED8", borderRadius: 6, padding: 8, marginTop: 8, backgroundColor: "#EFF6FF" },
  officeTitle: { fontSize: 7, fontWeight: 700, color: "#1E3A8A", textTransform: "uppercase", marginBottom: 6, textAlign: "center" },
  officeGrid: { flexDirection: "row", flexWrap: "wrap" },
  officeField: { width: "33.33%", paddingRight: 6, marginBottom: 6 },
  footer: { marginTop: 6, paddingTop: 5, borderTop: "1px solid #E2E8F0", flexDirection: "row", justifyContent: "space-between", color: "#64748B", fontSize: 6 },
});

export function AdmissionFormTemplate({ school, academicYear, formNumber, labels: l }: AdmissionFormProps) {
  const L = { ...defaultLabels, ...l };
  return (
    <Document title="Admission_Form" author={school.name}>
      <Page size="A4" style={styles.page}>
        {/* Photo box absolute */}
        <View style={styles.photoBox}>
          <Text style={{ fontSize: 6, color: "#94A3B8", textAlign: "center" }}>Photograph{"\n"}3.5 × 4.5 cm</Text>
          <Text style={{ fontSize: 6, color: "#94A3B8", marginTop: 2 }}>(Paste Here)</Text>
        </View>

        <View style={styles.header}>
          <View style={styles.schoolBlock}>
            {school.logoUrl ? <Image src={school.logoUrl} style={styles.logo} /> : (
              <View style={styles.logoPlaceholder}><Text style={{ fontSize: 16, color: "#1D4ED8", fontWeight: 700 }}>{school.name?.charAt(0) || "S"}</Text></View>
            )}
            <View>
              <Text style={styles.schoolName}>{school.name || "Pathshala Pro School"}</Text>
              {school.address ? <Text style={styles.schoolMeta}>{school.address}</Text> : null}
              <Text style={styles.schoolMeta}>{[school.phone, school.email].filter(Boolean).join("  |  ")}</Text>
            </View>
          </View>
          <View style={styles.formNoBox}>
            <Text style={styles.formNoText}>{L.formNo} {formNumber || "________"}</Text>
            <Text style={{ fontSize: 6.5, color: "#64748B" }}>{L.academicYear}: {academicYear || "________"}</Text>
          </View>
        </View>

        <View style={styles.titleBox}>
          <Text style={styles.title}>{L.title}</Text>
          <Text style={styles.subtitle}>{L.subtitle}</Text>
        </View>

        {/* Section 1 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{L.sectionPersonal}</Text></View>
          <View style={[styles.fieldGrid, { paddingRight: 86 }]}>
            <View style={styles.field}><Text style={styles.fieldLabel}>Student Full Name (English) *</Text><View style={styles.dottedLine} /></View>
            <View style={styles.field}><Text style={styles.fieldLabel}>Student Name (Bangla / Hindi / Urdu)</Text><View style={styles.dottedLine} /></View>
            <View style={styles.field}><Text style={styles.fieldLabel}>Date of Birth (DD/MM/YYYY) *</Text><View style={styles.dottedLine} /></View>
            <View style={styles.field}><Text style={styles.fieldLabel}>Gender *</Text>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}><View style={styles.checkBox} /><Text style={{ fontSize: 7 }}>Male</Text><View style={styles.checkBox} /><Text style={{ fontSize: 7 }}>Female</Text><View style={styles.checkBox} /><Text style={{ fontSize: 7 }}>Other</Text></View>
            </View>
            <View style={styles.field}><Text style={styles.fieldLabel}>Blood Group</Text><View style={styles.dottedLine} /></View>
            <View style={styles.field}><Text style={styles.fieldLabel}>Birth Certificate No.</Text><View style={styles.dottedLine} /></View>
            <View style={styles.fieldFull}><Text style={styles.fieldLabel}>Present Address *</Text><View style={styles.dottedLine} /><View style={[styles.dottedLine, { marginTop: 4 }]} /></View>
            <View style={styles.fieldFull}><Text style={styles.fieldLabel}>Permanent Address</Text><View style={styles.dottedLine} /></View>
          </View>
        </View>

        {/* Section 2 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{L.sectionGuardian}</Text></View>
          <View style={styles.fieldGrid}>
            <View style={styles.field}><Text style={styles.fieldLabel}>Father's Name *</Text><View style={styles.dottedLine} /></View>
            <View style={styles.field}><Text style={styles.fieldLabel}>Mother's Name *</Text><View style={styles.dottedLine} /></View>
            <View style={styles.field}><Text style={styles.fieldLabel}>Guardian Name (if other)</Text><View style={styles.dottedLine} /></View>
            <View style={styles.field}><Text style={styles.fieldLabel}>Guardian Contact *</Text><View style={styles.dottedLine} /></View>
            <View style={styles.field}><Text style={styles.fieldLabel}>Guardian Email</Text><View style={styles.dottedLine} /></View>
            <View style={styles.field}><Text style={styles.fieldLabel}>Emergency Contact</Text><View style={styles.dottedLine} /></View>
            <View style={styles.fieldFull}><Text style={styles.fieldLabel}>Parent Occupation / Annual Income</Text><View style={styles.dottedLine} /></View>
          </View>
        </View>

        {/* Section 3 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{L.sectionAcademic}</Text></View>
          <View style={styles.fieldGrid}>
            <View style={styles.field}><Text style={styles.fieldLabel}>Class Applied For *</Text><View style={styles.dottedLine} /></View>
            <View style={styles.field}><Text style={styles.fieldLabel}>Group / Section Preference</Text><View style={styles.dottedLine} /></View>
            <View style={styles.field}><Text style={styles.fieldLabel}>Previous School Name</Text><View style={styles.dottedLine} /></View>
            <View style={styles.field}><Text style={styles.fieldLabel}>Previous Class & Result</Text><View style={styles.dottedLine} /></View>
            <View style={styles.fieldFull}><Text style={styles.fieldLabel}>Reason for Admission</Text><View style={styles.dottedLine} /></View>
          </View>
        </View>

        {/* Section 4 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{L.sectionDocs}</Text></View>
          <View style={[styles.fieldGrid, { paddingBottom: 2 }]}>
            {["Birth Certificate Copy", "Parent NID Copy", "Previous Mark Sheet", "Passport Photos (2)", "Transfer Certificate (if any)", "Character Certificate"].map((doc) => (
              <View key={doc} style={styles.checklistRow}>
                <View style={styles.checkBox} />
                <Text style={styles.checklistText}>{doc}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.declarationBox}>
          <Text style={styles.declarationText}>{L.declaration}</Text>
          <View style={styles.sigRow}>
            <View style={styles.sigBlock}><View style={styles.sigLine} /><Text style={styles.sigTitle}>Guardian Signature & Date</Text></View>
            <View style={styles.sigBlock}><View style={styles.sigLine} /><Text style={styles.sigTitle}>Student Signature</Text></View>
          </View>
        </View>

        <View style={styles.officeBox}>
          <Text style={styles.officeTitle}>{L.officeUse}</Text>
          <View style={styles.officeGrid}>
            <View style={styles.officeField}><Text style={styles.fieldLabel}>Admission No.</Text><View style={styles.smallLine} /></View>
            <View style={styles.officeField}><Text style={styles.fieldLabel}>Roll No. Allotted</Text><View style={styles.smallLine} /></View>
            <View style={styles.officeField}><Text style={styles.fieldLabel}>Class / Section</Text><View style={styles.smallLine} /></View>
            <View style={styles.officeField}><Text style={styles.fieldLabel}>Fee Received</Text><View style={styles.smallLine} /></View>
            <View style={styles.officeField}><Text style={styles.fieldLabel}>Receipt No.</Text><View style={styles.smallLine} /></View>
            <View style={styles.officeField}><Text style={styles.fieldLabel}>Date</Text><View style={styles.smallLine} /></View>
          </View>
          <View style={[styles.sigRow, { marginTop: 12 }]}>
            <View style={styles.sigBlock}><View style={styles.sigLine} /><Text style={styles.sigTitle}>{L.admissionOfficer}</Text></View>
            <View style={styles.sigBlock}><View style={[styles.sigLine, { borderTopColor: "#1D4ED8" }]} /><Text style={[styles.sigTitle, { color: "#1D4ED8" }]}>{L.principal} Seal</Text></View>
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text>{school.name} • {school.address}</Text>
          <Text>Form valid for {academicYear || new Date().getFullYear().toString()} only</Text>
        </View>
      </Page>
    </Document>
  );
}
