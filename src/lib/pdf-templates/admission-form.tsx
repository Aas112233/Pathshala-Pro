/* eslint-disable jsx-a11y/alt-text */
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { PdfSchoolInfo } from "./report-base";
import { getPdfFontFamily, pdfTextSample } from "./pdf-fonts";

export interface AdmissionFormProps {
  locale?: string;
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
  applicationDate: "Application Date",
  legendRequired: "* Required fields must be completed by the applicant",
  sectionPersonal: "1. Personal Information of Applicant",
  sectionGuardian: "2. Parent / Guardian Information",
  sectionAcademic: "3. Academic Preference",
  sectionDocs: "4. Documents Checklist",
  declaration: "Declaration: I hereby declare that the information furnished above is true to the best of my knowledge. I agree to abide by the rules and discipline of the institution.",
  officeUse: "For Office Use Only",
  principal: "Principal",
  admissionOfficer: "Admission Officer",
  photograph: "Photograph\n3.5 × 4.5 cm\n(Paste Here)",
  applicantSignature: "Applicant Signature",
  guardianSignature: "Guardian Signature & Date",
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: 22,
    backgroundColor: "#FFFFFF",
    color: "#0F172A",
    fontSize: 8,
    fontFamily: "NotoSans",
  },

  /* Header */
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: "2.5px solid #1D4ED8",
    paddingBottom: 9,
    marginBottom: 9,
  },
  schoolBlock: { flexDirection: "row", flex: 1, alignItems: "center" },
  logo: { width: 44, height: 44, borderRadius: 6, objectFit: "cover", marginRight: 10 },
  logoPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 6,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  logoInitial: { fontSize: 17, color: "#1D4ED8", fontWeight: 700 },
  schoolName: { fontSize: 15, fontWeight: 700, color: "#1D4ED8" },
  schoolMeta: { fontSize: 7, color: "#475569", marginTop: 1.5 },

  formMetaBox: {
    alignItems: "flex-end",
    borderLeft: "1px solid #E2E8F0",
    paddingLeft: 10,
    minWidth: 132,
  },
  formNoText: {
    fontSize: 7.5,
    color: "#1E3A8A",
    fontWeight: 700,
    backgroundColor: "#EFF6FF",
    border: "1px solid #BFDBFE",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginBottom: 4,
  },
  formMetaText: { fontSize: 6.5, color: "#64748B", marginTop: 1 },

  /* Title band */
  titleBox: {
    alignItems: "center",
    backgroundColor: "#1D4ED8",
    paddingVertical: 7,
    borderRadius: 5,
    marginBottom: 5,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 0.9,
  },
  subtitle: { color: "#BFDBFE", fontSize: 6.5, marginTop: 2.5 },

  legend: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 7,
  },
  legendText: { fontSize: 6.5, color: "#94A3B8" },

  /* Sections */
  section: {
    border: "1px solid #E2E8F0",
    borderRadius: 5,
    marginBottom: 8,
  },
  sectionHeader: {
    backgroundColor: "#F1F5F9",
    borderBottom: "1px solid #E2E8F0",
    borderLeft: "3px solid #1D4ED8",
    paddingVertical: 4.5,
    paddingHorizontal: 8,
    borderTopLeftRadius: 4,
  },
  sectionTitle: {
    fontSize: 8,
    fontWeight: 700,
    color: "#1E293B",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  sectionBody: { flexDirection: "row", padding: 7 },

  fieldGrid: { flex: 1, flexDirection: "row", flexWrap: "wrap" },
  field: { width: "50%", paddingRight: 8, marginBottom: 7 },
  fieldFull: { width: "100%", paddingRight: 8, marginBottom: 7 },
  fieldLabel: {
    fontSize: 6.5,
    color: "#64748B",
    fontWeight: 700,
    textTransform: "uppercase",
    marginBottom: 2.5,
  },
  dottedLine: { borderBottom: "1px dotted #94A3B8", height: 12, marginTop: 1 },
  smallLine: { borderBottom: "1px dotted #94A3B8", height: 10, marginTop: 1 },

  /* Photo column */
  photoCol: { width: 84, paddingLeft: 8, alignItems: "center" },
  photoBox: {
    width: 76,
    height: 96,
    border: "1.5px dashed #94A3B8",
    borderRadius: 4,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
    padding: 4,
  },
  photoText: { fontSize: 6, color: "#94A3B8", textAlign: "center", lineHeight: 1.4 },
  photoSigLine: {
    width: 76,
    borderTop: "1px solid #0F172A",
    marginTop: 18,
    paddingTop: 3,
  },
  photoSigText: { fontSize: 6, color: "#64748B", textAlign: "center" },

  /* Checkboxes */
  checklistRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "50%",
    marginBottom: 4,
    paddingRight: 8,
  },
  checkBox: {
    width: 9,
    height: 9,
    border: "1px solid #64748B",
    borderRadius: 2,
    marginRight: 6,
  },
  checklistText: { fontSize: 7, color: "#1E293B" },
  inlineOption: { flexDirection: "row", alignItems: "center", marginRight: 12 },
  inlineOptionText: { fontSize: 7, color: "#1E293B" },

  /* Declaration */
  declarationBox: {
    border: "1px solid #E2E8F0",
    borderRadius: 5,
    padding: 8,
    marginBottom: 8,
    backgroundColor: "#F8FAFC",
  },
  declarationText: { fontSize: 7, color: "#334155", lineHeight: 1.5, textAlign: "justify" },
  sigRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 14 },
  sigBlock: { width: 128, alignItems: "center" },
  sigLine: { width: "100%", borderTop: "1px solid #0F172A", marginBottom: 4 },
  sigTitle: { fontSize: 7, color: "#475569", fontWeight: 700 },

  /* Office use */
  officeBox: {
    border: "1.5px solid #1D4ED8",
    borderRadius: 5,
    padding: 9,
    marginTop: 4,
    backgroundColor: "#EFF6FF",
  },
  officeTitle: {
    fontSize: 7.5,
    fontWeight: 700,
    color: "#1E3A8A",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 7,
    textAlign: "center",
  },
  officeGrid: { flexDirection: "row", flexWrap: "wrap" },
  officeField: { width: "33.33%", paddingRight: 8, marginBottom: 7 },

  footer: {
    marginTop: 8,
    paddingTop: 6,
    borderTop: "1px solid #E2E8F0",
    flexDirection: "row",
    justifyContent: "space-between",
    color: "#64748B",
    fontSize: 6,
  },
});

export function AdmissionFormTemplate({ locale, school, academicYear, formNumber, labels: l }: AdmissionFormProps) {
  const L = { ...defaultLabels, ...l };
  const currentYear = academicYear || new Date().getFullYear().toString();

  return (
    <Document title="Admission_Form" author={school.name}>
      <Page
        size="A4"
        style={[
          styles.page,
          { fontFamily: getPdfFontFamily(locale, school?.name, school?.address, pdfTextSample([L])) },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.schoolBlock}>
            {school.logoUrl ? (
              <Image src={school.logoUrl} style={styles.logo} />
            ) : (
              <View style={styles.logoPlaceholder}>
                <Text style={styles.logoInitial}>{school.name?.charAt(0) || "S"}</Text>
              </View>
            )}
            <View>
              <Text style={styles.schoolName}>{school.name || "Pathshala Pro School"}</Text>
              {school.address ? <Text style={styles.schoolMeta}>{school.address}</Text> : null}
              <Text style={styles.schoolMeta}>
                {[school.phone, school.email].filter(Boolean).join("  |  ")}
              </Text>
            </View>
          </View>

          <View style={styles.formMetaBox}>
            <Text style={styles.formNoText}>
              {L.formNo} {formNumber || "________"}
            </Text>
            <Text style={styles.formMetaText}>
              {L.academicYear}: {currentYear}
            </Text>
            <Text style={styles.formMetaText}>
              {L.applicationDate}: ____ / ____ / ________
            </Text>
          </View>
        </View>

        {/* Title band */}
        <View style={styles.titleBox}>
          <Text style={styles.title}>{L.title}</Text>
          <Text style={styles.subtitle}>{L.subtitle}</Text>
        </View>

        <View style={styles.legend}>
          <Text style={styles.legendText}>{L.legendRequired}</Text>
        </View>

        {/* Section 1 — Personal */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{L.sectionPersonal}</Text>
          </View>
          <View style={styles.sectionBody}>
            <View style={styles.fieldGrid}>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Student Full Name (English) *</Text>
                <View style={styles.dottedLine} />
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Student Name (Bangla / Hindi / Urdu)</Text>
                <View style={styles.dottedLine} />
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Date of Birth (DD/MM/YYYY) *</Text>
                <View style={styles.dottedLine} />
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Gender *</Text>
                <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
                  <View style={styles.inlineOption}>
                    <View style={styles.checkBox} />
                    <Text style={styles.inlineOptionText}>Male</Text>
                  </View>
                  <View style={styles.inlineOption}>
                    <View style={styles.checkBox} />
                    <Text style={styles.inlineOptionText}>Female</Text>
                  </View>
                  <View style={styles.inlineOption}>
                    <View style={styles.checkBox} />
                    <Text style={styles.inlineOptionText}>Other</Text>
                  </View>
                </View>
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Blood Group</Text>
                <View style={styles.dottedLine} />
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Birth Certificate No.</Text>
                <View style={styles.dottedLine} />
              </View>
              <View style={styles.fieldFull}>
                <Text style={styles.fieldLabel}>Present Address *</Text>
                <View style={styles.dottedLine} />
                <View style={[styles.dottedLine, { marginTop: 5 }]} />
              </View>
              <View style={styles.fieldFull}>
                <Text style={styles.fieldLabel}>Permanent Address</Text>
                <View style={styles.dottedLine} />
              </View>
            </View>

            <View style={styles.photoCol}>
              <View style={styles.photoBox}>
                <Text style={styles.photoText}>{L.photograph}</Text>
              </View>
              <View style={styles.photoSigLine}>
                <Text style={styles.photoSigText}>{L.applicantSignature}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Section 2 — Guardian */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{L.sectionGuardian}</Text>
          </View>
          <View style={styles.sectionBody}>
            <View style={styles.fieldGrid}>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Father&apos;s Name *</Text>
                <View style={styles.dottedLine} />
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Mother&apos;s Name *</Text>
                <View style={styles.dottedLine} />
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Guardian Name (if other)</Text>
                <View style={styles.dottedLine} />
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Guardian Contact *</Text>
                <View style={styles.dottedLine} />
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Guardian Email</Text>
                <View style={styles.dottedLine} />
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Emergency Contact</Text>
                <View style={styles.dottedLine} />
              </View>
              <View style={styles.fieldFull}>
                <Text style={styles.fieldLabel}>Parent Occupation / Annual Income</Text>
                <View style={styles.dottedLine} />
              </View>
            </View>
          </View>
        </View>

        {/* Section 3 — Academic */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{L.sectionAcademic}</Text>
          </View>
          <View style={styles.sectionBody}>
            <View style={styles.fieldGrid}>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Class Applied For *</Text>
                <View style={styles.dottedLine} />
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Group / Section Preference</Text>
                <View style={styles.dottedLine} />
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Previous School Name</Text>
                <View style={styles.dottedLine} />
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Previous Class &amp; Result</Text>
                <View style={styles.dottedLine} />
              </View>
              <View style={styles.fieldFull}>
                <Text style={styles.fieldLabel}>Reason for Admission</Text>
                <View style={styles.dottedLine} />
              </View>
            </View>
          </View>
        </View>

        {/* Section 4 — Documents */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{L.sectionDocs}</Text>
          </View>
          <View style={styles.sectionBody}>
            <View style={styles.fieldGrid}>
              {[
                "Birth Certificate Copy",
                "Parent NID Copy",
                "Previous Mark Sheet",
                "Passport Photos (2)",
                "Transfer Certificate (if any)",
                "Character Certificate",
              ].map((doc) => (
                <View key={doc} style={styles.checklistRow}>
                  <View style={styles.checkBox} />
                  <Text style={styles.checklistText}>{doc}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Declaration */}
        <View style={styles.declarationBox}>
          <Text style={styles.declarationText}>{L.declaration}</Text>
          <View style={styles.sigRow}>
            <View style={styles.sigBlock}>
              <View style={styles.sigLine} />
              <Text style={styles.sigTitle}>{L.guardianSignature}</Text>
            </View>
            <View style={styles.sigBlock}>
              <View style={styles.sigLine} />
              <Text style={styles.sigTitle}>{L.applicantSignature}</Text>
            </View>
          </View>
        </View>

        {/* Office use */}
        <View style={styles.officeBox}>
          <Text style={styles.officeTitle}>{L.officeUse}</Text>
          <View style={styles.officeGrid}>
            <View style={styles.officeField}>
              <Text style={styles.fieldLabel}>Admission No.</Text>
              <View style={styles.smallLine} />
            </View>
            <View style={styles.officeField}>
              <Text style={styles.fieldLabel}>Roll No. Allotted</Text>
              <View style={styles.smallLine} />
            </View>
            <View style={styles.officeField}>
              <Text style={styles.fieldLabel}>Class / Section</Text>
              <View style={styles.smallLine} />
            </View>
            <View style={styles.officeField}>
              <Text style={styles.fieldLabel}>Fee Received</Text>
              <View style={styles.smallLine} />
            </View>
            <View style={styles.officeField}>
              <Text style={styles.fieldLabel}>Receipt No.</Text>
              <View style={styles.smallLine} />
            </View>
            <View style={styles.officeField}>
              <Text style={styles.fieldLabel}>Date</Text>
              <View style={styles.smallLine} />
            </View>
          </View>
          <View style={[styles.sigRow, { marginTop: 12 }]}>
            <View style={styles.sigBlock}>
              <View style={styles.sigLine} />
              <Text style={styles.sigTitle}>{L.admissionOfficer}</Text>
            </View>
            <View style={styles.sigBlock}>
              <View style={[styles.sigLine, { borderTopColor: "#1D4ED8" }]} />
              <Text style={[styles.sigTitle, { color: "#1D4ED8" }]}>{L.principal} Seal</Text>
            </View>
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text>
            {[school.name, school.address].filter(Boolean).join(" • ")}
          </Text>
          <Text>Form valid for {currentYear} only</Text>
        </View>
      </Page>
    </Document>
  );
}
