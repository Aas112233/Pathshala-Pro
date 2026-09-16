import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import { useTranslations } from "next-intl";
import { getPdfFontFamily, pdfTextSample } from "./pdf-fonts";

interface Mark {
  subject: string;
  subjectCode: string;
  maxMarks: number;
  obtainedMarks: number;
  passMarks: number;
  grade: string;
  remarks?: string;
}

interface MarkSheetProps {
  locale?: string;
  student: {
    name: string;
    admissionNumber: string;
    rollNumber: string;
    className: string;
    section: string;
    dateOfBirth: string;
    guardianName: string;
  };
  exam: {
    name: string;
    type: string;
    academicYear: string;
    date: string;
  };
  marks: Mark[];
  school: {
    name: string;
    address: string;
    phone: string;
    email: string;
    logoUrl?: string;
  };
}

const markSheetStyles = StyleSheet.create({
  page: {
    padding: 30,
    backgroundColor: "#FFFFFF",
    fontFamily: "NotoSans",
  },
  header: {
    borderBottom: "3px solid #1E40AF",
    paddingBottom: 15,
    marginBottom: 20,
  },
  logoSection: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  logo: {
    width: 50,
    height: 50,
    marginRight: 15,
  },
  schoolInfo: {
    flex: 1,
  },
  schoolName: {
    fontSize: 18,
    fontWeight: 700,
    color: "#1E40AF",
    marginBottom: 3,
  },
  schoolAddress: {
    fontSize: 8,
    color: "#64748B",
    marginBottom: 2,
  },
  contact: {
    fontSize: 7,
    color: "#64748B",
  },
  title: {
    textAlign: "center",
    fontSize: 14,
    fontWeight: 700,
    color: "#1E293B",
    marginTop: 10,
    textTransform: "uppercase" as const,
    letterSpacing: 2,
  },
  subtitle: {
    textAlign: "center",
    fontSize: 9,
    color: "#64748B",
    marginTop: 3,
  },
  studentInfo: {
    backgroundColor: "#F8FAFC",
    padding: 12,
    borderRadius: 6,
    marginBottom: 15,
    border: "1px solid #E2E8F0",
  },
  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap" as const,
  },
  infoItem: {
    width: "33.33%",
    marginBottom: 6,
  },
  infoLabel: {
    fontSize: 7,
    color: "#64748B",
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 9,
    color: "#1E293B",
    fontWeight: 600,
  },
  table: {
    marginBottom: 15,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#1E40AF",
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  headerCell: {
    color: "#FFFFFF",
    fontSize: 8,
    fontWeight: 700,
    textTransform: "uppercase" as const,
  },
  headerCellSmall: {
    width: 60,
  },
  headerCellMedium: {
    width: 50,
  },
  headerCellSmall2: {
    width: 40,
  },
  headerCellFlex: {
    flex: 2,
  },
  headerCellFlex1: {
    flex: 1,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottom: "1px solid #E2E8F0",
  },
  tableRowAlt: {
    backgroundColor: "#F8FAFC",
  },
  tableCell: {
    fontSize: 8,
    color: "#1E293B",
  },
  tableFooter: {
    flexDirection: "row",
    backgroundColor: "#F8FAFC",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderTop: "2px solid #1E40AF",
  },
  resultSection: {
    backgroundColor: "#F0FDF4",
    padding: 12,
    borderRadius: 6,
    marginBottom: 15,
    border: "1px solid #86EFAC",
  },
  resultGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  resultItem: {
    alignItems: "center",
  },
  resultLabel: {
    fontSize: 7,
    color: "#166534",
    marginBottom: 3,
  },
  resultValue: {
    fontSize: 14,
    fontWeight: 700,
    color: "#15803D",
  },
  footer: {
    marginTop: 30,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTop: "1px solid #E2E8F0",
    paddingTop: 20,
  },
  signature: {
    alignItems: "center",
  },
  signatureLine: {
    width: 150,
    borderTop: "1px solid #1E293B",
    marginBottom: 5,
  },
  signatureText: {
    fontSize: 8,
    color: "#64748B",
  },
  disclaimer: {
    fontSize: 6,
    color: "#94A3B8",
    textAlign: "center" as const,
    marginTop: 15,
  },
  gradeLegend: {
    fontSize: 6,
    color: "#64748B",
    marginTop: 10,
    lineHeight: 1.4,
  },
});

export const MarkSheetTemplate: React.FC<MarkSheetProps> = ({
  locale,
  student,
  exam,
  marks,
  school,
}) => {
  const t = useTranslations("pdfDocs.markSheet");
  const totalMaxMarks = marks.reduce((sum, m) => sum + m.maxMarks, 0);
  const totalObtained = marks.reduce((sum, m) => sum + m.obtainedMarks, 0);
  const percentage = totalMaxMarks > 0 ? ((totalObtained / totalMaxMarks) * 100).toFixed(2) : "0";
  const allPassed = marks.every(m => m.obtainedMarks >= m.passMarks);
  const result = allPassed ? t("passResult") : t("failResult");

  return (
    <Document>
      <Page
        size="A4"
        style={[
          markSheetStyles.page,
          { fontFamily: getPdfFontFamily(locale, school?.name, school?.address, student?.name, pdfTextSample(marks)) },
        ]}
      >
        {/* Header */}
        <View style={markSheetStyles.header}>
          <View style={markSheetStyles.logoSection}>
            {school.logoUrl ? (
              <Image src={school.logoUrl} style={markSheetStyles.logo} />
            ) : (
              <View style={[markSheetStyles.logo, { backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center" }]}>
                <Text style={{ fontSize: 20, color: "#1E3A8A", fontWeight: "bold" }}>
                  {school.name ? school.name.charAt(0).toUpperCase() : "S"}
                </Text>
              </View>
            )}
            <View style={markSheetStyles.schoolInfo}>
              <Text style={markSheetStyles.schoolName}>{school.name.toUpperCase()}</Text>
              <Text style={markSheetStyles.schoolAddress}>{school.address}</Text>
              <Text style={markSheetStyles.contact}>
                {t("tel")}: {school.phone}  |  {t("email")}: {school.email}
              </Text>
            </View>
          </View>
          <Text style={markSheetStyles.title}>{t("title")}</Text>
          <Text style={markSheetStyles.subtitle}>
            {exam.academicYear} • {exam.type}
          </Text>
        </View>

        {/* Student Information */}
        <View style={markSheetStyles.studentInfo}>
          <View style={markSheetStyles.infoGrid}>
            <View style={markSheetStyles.infoItem}>
              <Text style={markSheetStyles.infoLabel}>{t("studentName")}</Text>
              <Text style={markSheetStyles.infoValue}>{student.name}</Text>
            </View>
            <View style={markSheetStyles.infoItem}>
              <Text style={markSheetStyles.infoLabel}>{t("admissionNumber")}</Text>
              <Text style={markSheetStyles.infoValue}>{student.admissionNumber}</Text>
            </View>
            <View style={markSheetStyles.infoItem}>
              <Text style={markSheetStyles.infoLabel}>{t("rollNumber")}</Text>
              <Text style={markSheetStyles.infoValue}>{student.rollNumber}</Text>
            </View>
            <View style={markSheetStyles.infoItem}>
              <Text style={markSheetStyles.infoLabel}>{t("class")}</Text>
              <Text style={markSheetStyles.infoValue}>{student.className} - {student.section}</Text>
            </View>
            <View style={markSheetStyles.infoItem}>
              <Text style={markSheetStyles.infoLabel}>{t("dateOfBirth")}</Text>
              <Text style={markSheetStyles.infoValue}>{student.dateOfBirth}</Text>
            </View>
            <View style={markSheetStyles.infoItem}>
              <Text style={markSheetStyles.infoLabel}>{t("guardian")}</Text>
              <Text style={markSheetStyles.infoValue}>{student.guardianName}</Text>
            </View>
          </View>
        </View>

        {/* Marks Table */}
        <View style={markSheetStyles.table}>
          {/* Table Header */}
          <View style={markSheetStyles.tableHeader}>
            <Text style={[markSheetStyles.headerCell, { width: 60 }]} fixed>{t("code")}</Text>
            <Text style={[markSheetStyles.headerCell, { flex: 2 }]} fixed>{t("subject")}</Text>
            <Text style={[markSheetStyles.headerCell, { width: 50 }]} fixed>{t("max")}</Text>
            <Text style={[markSheetStyles.headerCell, { width: 50 }]} fixed>{t("obtained")}</Text>
            <Text style={[markSheetStyles.headerCell, { width: 40 }]} fixed>{t("pass")}</Text>
            <Text style={[markSheetStyles.headerCell, { width: 40 }]} fixed>{t("grade")}</Text>
            <Text style={[markSheetStyles.headerCell, { flex: 1 }]} fixed>{t("remarks")}</Text>
          </View>

          {/* Table Rows */}
          {marks.map((mark, index) => (
            <View
              key={index}
              style={index % 2 === 1 ? [markSheetStyles.tableRow, markSheetStyles.tableRowAlt] : [markSheetStyles.tableRow]}
            >
              <Text style={[markSheetStyles.tableCell, { width: 60 }]} fixed>{mark.subjectCode}</Text>
              <Text style={[markSheetStyles.tableCell, { flex: 2 }]} fixed>{mark.subject}</Text>
              <Text style={[markSheetStyles.tableCell, { width: 50 }]} fixed>{mark.maxMarks}</Text>
              <Text style={[markSheetStyles.tableCell, { width: 50 }]} fixed>{mark.obtainedMarks}</Text>
              <Text style={[markSheetStyles.tableCell, { width: 40 }]} fixed>{mark.passMarks}</Text>
              <Text style={[markSheetStyles.tableCell, { width: 40 }]} fixed>{mark.grade}</Text>
              <Text style={[markSheetStyles.tableCell, { flex: 1 }]} fixed>{mark.remarks || "-"}</Text>
            </View>
          ))}

          {/* Table Footer - Totals */}
          <View style={markSheetStyles.tableFooter}>
            <Text style={[markSheetStyles.tableCell, { width: 60 }]} fixed></Text>
            <Text style={[markSheetStyles.tableCell, { flex: 2, fontWeight: 700 }]} fixed>{t("total")}</Text>
            <Text style={[markSheetStyles.tableCell, { width: 50, fontWeight: 700 }]} fixed>{totalMaxMarks}</Text>
            <Text style={[markSheetStyles.tableCell, { width: 50, fontWeight: 700 }]} fixed>{totalObtained}</Text>
            <Text style={[markSheetStyles.tableCell, { width: 40 }]} fixed></Text>
            <Text style={[markSheetStyles.tableCell, { width: 40 }]} fixed></Text>
            <Text style={[markSheetStyles.tableCell, { flex: 1 }]} fixed></Text>
          </View>
        </View>

        {/* Result Summary */}
        <View style={markSheetStyles.resultSection}>
          <View style={markSheetStyles.resultGrid}>
            <View style={markSheetStyles.resultItem}>
              <Text style={markSheetStyles.resultLabel}>{t("totalMarks")}</Text>
              <Text style={markSheetStyles.resultValue}>{totalObtained} / {totalMaxMarks}</Text>
            </View>
            <View style={markSheetStyles.resultItem}>
              <Text style={markSheetStyles.resultLabel}>{t("percentage")}</Text>
              <Text style={markSheetStyles.resultValue}>{percentage}%</Text>
            </View>
            <View style={markSheetStyles.resultItem}>
              <Text style={markSheetStyles.resultLabel}>{t("result")}</Text>
              <Text style={[markSheetStyles.resultValue, {
                color: result === t("passResult") ? "#15803D" : "#DC2626"
              }]}>
                {result}
              </Text>
            </View>
          </View>
        </View>

        {/* Footer - Signatures */}
        <View style={markSheetStyles.footer}>
          <View style={markSheetStyles.signature}>
            <View style={markSheetStyles.signatureLine} />
            <Text style={markSheetStyles.signatureText}>{t("classTeacher")}</Text>
          </View>
          <View style={markSheetStyles.signature}>
            <View style={markSheetStyles.signatureLine} />
            <Text style={markSheetStyles.signatureText}>{t("examController")}</Text>
          </View>
          <View style={markSheetStyles.signature}>
            <View style={markSheetStyles.signatureLine} />
            <Text style={markSheetStyles.signatureText}>{t("principal")}</Text>
          </View>
        </View>

        {/* Disclaimer */}
        <Text style={markSheetStyles.disclaimer}>
          {t("disclaimer")}
        </Text>

        {/* Grade Legend */}
        <View style={markSheetStyles.gradeLegend}>
          <Text>{t("gradeLegend")}</Text>
        </View>
      </Page>
    </Document>
  );
};

export { markSheetStyles };
