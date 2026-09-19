/* eslint-disable jsx-a11y/alt-text */
import { Document, Page, View, Text, StyleSheet, Image } from "@react-pdf/renderer";
import { StudentPerformanceOverview } from "@/lib/student-performance";
import { getPdfFontFamily, pdfTextSample } from "@/lib/pdf-fonts";
import { formatDateWithSettings } from "@/lib/tenant-settings";

export interface PerformancePDFSchoolInfo {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  logoUrl?: string;
  website?: string;
  motto?: string;
}

export interface PerformancePDFProps {
  performance: StudentPerformanceOverview;
  studentName?: string;
  studentRollNumber?: string;
  school?: PerformancePDFSchoolInfo;
  locale?: string;
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 24,
    paddingBottom: 24,
    paddingHorizontal: 24,
    backgroundColor: "#FFFFFF",
    fontFamily: "NotoSans",
    fontSize: 8,
    color: "#0F172A",
  },
  // Outer decorative border
  borderOuter: {
    position: "absolute",
    top: 10,
    left: 10,
    right: 10,
    bottom: 10,
    border: "1.5px solid #1D4ED8",
    borderRadius: 6,
  },
  borderInner: {
    position: "absolute",
    top: 13,
    left: 13,
    right: 13,
    bottom: 13,
    border: "0.5px solid #93C5FD",
    borderRadius: 4,
  },
  watermark: {
    position: "absolute",
    top: 340,
    left: 40,
    right: 40,
    textAlign: "center",
    fontSize: 48,
    fontWeight: 700,
    color: "#DBEAFE",
    opacity: 0.22,
    transform: "rotate(-28deg)",
  },

  // Institutional Header
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottom: "2px solid #1D4ED8",
    paddingBottom: 8,
    marginBottom: 8,
  },
  schoolBlock: {
    flexDirection: "row",
    flex: 1,
    alignItems: "center",
  },
  schoolLogo: {
    width: 38,
    height: 38,
    borderRadius: 6,
    objectFit: "cover",
    marginRight: 8,
  },
  schoolLogoPlaceholder: {
    width: 38,
    height: 38,
    borderRadius: 6,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  schoolLogoPlaceholderText: {
    fontSize: 16,
    color: "#1D4ED8",
    fontWeight: 700,
  },
  schoolName: {
    fontSize: 13,
    fontWeight: 700,
    color: "#1D4ED8",
  },
  schoolMeta: {
    fontSize: 6.8,
    color: "#475569",
    marginTop: 1,
  },
  headerMetaBlock: {
    alignItems: "flex-end",
    maxWidth: 220,
  },
  reportBadge: {
    backgroundColor: "#EFF6FF",
    border: "1px solid #BFDBFE",
    borderRadius: 4,
    paddingVertical: 3,
    paddingHorizontal: 7,
  },
  reportBadgeText: {
    fontSize: 7,
    color: "#1E3A8A",
    fontWeight: 700,
    textTransform: "uppercase",
  },
  reportDateText: {
    fontSize: 6.5,
    color: "#64748B",
    marginTop: 2,
    textAlign: "right",
  },

  // Title Banner
  titleBanner: {
    alignItems: "center",
    marginBottom: 8,
    marginTop: 2,
  },
  titleMain: {
    fontSize: 14,
    fontWeight: 700,
    color: "#0F172A",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    borderBottom: "2px solid #1D4ED8",
    paddingBottom: 2,
    marginBottom: 2,
  },
  titleSub: {
    fontSize: 7,
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },

  // Student Profile Card
  profileCard: {
    backgroundColor: "#F8FAFC",
    border: "1px solid #E2E8F0",
    borderRadius: 6,
    padding: 8,
    marginBottom: 8,
  },
  profileRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 4,
  },
  profileCol: {
    width: "25%",
    paddingRight: 6,
  },
  profileColWide: {
    width: "50%",
    paddingRight: 6,
  },
  fieldLabel: {
    fontSize: 6.5,
    color: "#64748B",
    textTransform: "uppercase",
    fontWeight: 700,
    marginBottom: 1,
  },
  fieldValue: {
    fontSize: 8,
    fontWeight: 700,
    color: "#0F172A",
  },

  // KPI Metrics Summary Grid (4 Pillars)
  kpiGrid: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 8,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: "#FAFAFA",
    border: "1px solid #E2E8F0",
    borderRadius: 6,
    padding: 6,
    alignItems: "center",
  },
  kpiLabel: {
    fontSize: 6.5,
    color: "#64748B",
    textTransform: "uppercase",
    fontWeight: 700,
    marginBottom: 2,
  },
  kpiValue: {
    fontSize: 12,
    fontWeight: 700,
    color: "#1D4ED8",
    marginBottom: 1,
  },
  kpiSub: {
    fontSize: 6.5,
    color: "#475569",
    fontWeight: 600,
  },

  // Sections & Headings
  sectionContainer: {
    marginBottom: 8,
    border: "1px solid #E2E8F0",
    borderRadius: 6,
    overflow: "hidden",
  },
  sectionHeaderBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#1E3A8A",
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  sectionHeaderText: {
    color: "#FFFFFF",
    fontSize: 7.5,
    fontWeight: 700,
    textTransform: "uppercase",
  },
  sectionHeaderBadge: {
    color: "#93C5FD",
    fontSize: 6.5,
    fontWeight: 600,
  },

  // Tables
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#1E293B",
    paddingVertical: 3.5,
    paddingHorizontal: 6,
  },
  thText: {
    color: "#FFFFFF",
    fontSize: 6.5,
    fontWeight: 700,
    textTransform: "uppercase",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 3.5,
    paddingHorizontal: 6,
    borderTop: "1px solid #F1F5F9",
    alignItems: "center",
  },
  tableRowAlt: {
    backgroundColor: "#F8FAFC",
  },
  tdText: {
    fontSize: 7,
    color: "#1E293B",
  },

  // Insights & Qualitative Section
  insightsContainer: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 8,
  },
  insightBox: {
    flex: 1,
    borderRadius: 6,
    padding: 6,
    border: "1px solid #E2E8F0",
    backgroundColor: "#F8FAFC",
  },
  insightBoxHeader: {
    fontSize: 7,
    fontWeight: 700,
    textTransform: "uppercase",
    marginBottom: 3,
  },
  bulletRow: {
    flexDirection: "row",
    marginBottom: 2,
  },
  bulletDot: {
    width: 8,
    fontSize: 7,
    color: "#64748B",
  },
  bulletContent: {
    flex: 1,
    fontSize: 6.8,
    color: "#334155",
    lineHeight: 1.3,
  },

  // Risk Badge
  riskPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    fontSize: 6.5,
    fontWeight: 700,
  },
  riskLow: {
    backgroundColor: "#DCFCE7",
    color: "#166534",
  },
  riskModerate: {
    backgroundColor: "#FEF3C7",
    color: "#92400E",
  },
  riskHigh: {
    backgroundColor: "#FEE2E2",
    color: "#991B1B",
  },

  // Signatures & Official Footer
  signatureRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: 10,
    paddingTop: 8,
  },
  signatureBox: {
    width: 130,
    alignItems: "center",
  },
  signatureLine: {
    width: "100%",
    borderTop: "1px solid #0F172A",
    marginBottom: 3,
  },
  signatureLabel: {
    fontSize: 7,
    color: "#475569",
    fontWeight: 700,
    textTransform: "uppercase",
  },
  officialFooter: {
    marginTop: 6,
    paddingTop: 4,
    borderTop: "0.5px solid #E2E8F0",
    flexDirection: "row",
    justifyContent: "space-between",
    color: "#94A3B8",
    fontSize: 6,
  },
});

export function StudentPerformancePDF({
  performance,
  studentName,
  studentRollNumber,
  school,
  locale = "en",
}: PerformancePDFProps) {
  const finalStudentName =
    studentName ||
    `${performance.student.firstName} ${performance.student.lastName}`.trim() ||
    "Student";
  const finalRollNumber = studentRollNumber || performance.student.rollNumber || "N/A";
  const schoolName = school?.name || "PATHSHALA PRO SCHOOL MANAGEMENT";
  const schoolAddress = school?.address || "Comprehensive Multi-Tenant Academic ERP";
  const contactText = [school?.phone, school?.email].filter(Boolean).join("  |  ");
  const isUrdu = String(locale).toLowerCase().startsWith("ur");

  const fontFamily = getPdfFontFamily(
    locale,
    schoolName,
    schoolAddress,
    finalStudentName,
    performance.student.className,
    performance.student.sectionName,
    performance.student.firstNameBn,
    performance.student.lastNameBn,
    pdfTextSample(performance.subjectMastery),
    pdfTextSample(performance.examProgression)
  );

  return (
    <Document
      title={`Performance-Report-${performance.student.studentId || "Student"}`}
      author={schoolName}
    >
      <Page
        size="A4"
        style={[
          styles.page,
          {
            fontFamily,
            direction: isUrdu ? ("rtl" as any) : ("ltr" as any),
          },
        ]}
      >
        {/* Double-line Security Perimeter */}
        <View style={styles.borderOuter} fixed />
        <View style={styles.borderInner} fixed />

        {/* Subtle Watermark */}
        <Text style={styles.watermark} fixed>
          PATHSHALA PRO
        </Text>

        {/* 1. Institutional Header */}
        <View style={styles.headerContainer}>
          <View style={styles.schoolBlock}>
            {school?.logoUrl ? (
              <Image src={school.logoUrl} style={styles.schoolLogo} />
            ) : (
              <View style={styles.schoolLogoPlaceholder}>
                <Text style={styles.schoolLogoPlaceholderText}>
                  {schoolName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View>
              <Text style={styles.schoolName}>{schoolName}</Text>
              <Text style={styles.schoolMeta}>{schoolAddress}</Text>
              {contactText ? <Text style={styles.schoolMeta}>{contactText}</Text> : null}
            </View>
          </View>

          <View style={styles.headerMetaBlock}>
            <View style={styles.reportBadge}>
              <Text style={styles.reportBadgeText}>Official Performance Analytics</Text>
            </View>
            <Text style={styles.reportDateText}>
              Session: {performance.academicYear.label}
            </Text>
            <Text style={styles.reportDateText}>
              Generated: {formatDateWithSettings(new Date())}
            </Text>
          </View>
        </View>

        {/* 2. Document Title Banner */}
        <View style={styles.titleBanner}>
          <Text style={styles.titleMain}>360° Academic Performance Transcript</Text>
          <Text style={styles.titleSub}>
            Holistic Evaluation • Subject Mastery Matrix • Examination Progress • Attendance Analytics
          </Text>
        </View>

        {/* 3. Comprehensive Student Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileRow}>
            <View style={styles.profileColWide}>
              <Text style={styles.fieldLabel}>Student Name</Text>
              <Text style={styles.fieldValue}>
                {finalStudentName}
                {performance.student.firstNameBn
                  ? ` (${performance.student.firstNameBn} ${performance.student.lastNameBn || ""})`
                  : ""}
              </Text>
            </View>
            <View style={styles.profileCol}>
              <Text style={styles.fieldLabel}>Student ID</Text>
              <Text style={styles.fieldValue}>{performance.student.studentId || "N/A"}</Text>
            </View>
            <View style={styles.profileCol}>
              <Text style={styles.fieldLabel}>Roll Number</Text>
              <Text style={styles.fieldValue}>{finalRollNumber}</Text>
            </View>

            <View style={styles.profileCol}>
              <Text style={styles.fieldLabel}>Class & Section</Text>
              <Text style={styles.fieldValue}>
                {performance.student.className}
                {performance.student.sectionName ? ` - ${performance.student.sectionName}` : ""}
              </Text>
            </View>
            <View style={styles.profileCol}>
              <Text style={styles.fieldLabel}>Academic Group</Text>
              <Text style={styles.fieldValue}>{performance.student.groupName || "General"}</Text>
            </View>
            <View style={styles.profileCol}>
              <Text style={styles.fieldLabel}>Enrollment Status</Text>
              <Text style={styles.fieldValue}>{performance.student.status}</Text>
            </View>
            <View style={styles.profileCol}>
              <Text style={styles.fieldLabel}>Risk Standing</Text>
              <View
                style={[
                  styles.riskPill,
                  performance.insights.riskLevel === "LOW"
                    ? styles.riskLow
                    : performance.insights.riskLevel === "MODERATE"
                    ? styles.riskModerate
                    : styles.riskHigh,
                  { alignSelf: "flex-start" },
                ]}
              >
                <Text>{performance.insights.riskLevel} RISK</Text>
              </View>
            </View>
          </View>
        </View>

        {/* 4. Core Performance KPI Metric Cards (4 Pillars) */}
        <View style={styles.kpiGrid}>
          {/* Cumulative GPA */}
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Cumulative GPA</Text>
            <Text style={styles.kpiValue}>
              {performance.metrics.cumulativeGpa.toFixed(2)} / {performance.metrics.maxGpa.toFixed(1)}
            </Text>
            <Text style={styles.kpiSub}>
              Grade {performance.metrics.letterGrade} ({performance.metrics.overallPercentage}%)
            </Text>
          </View>

          {/* Class Merit Rank */}
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Class Merit Rank</Text>
            <Text style={styles.kpiValue}>{performance.metrics.meritRankLabel}</Text>
            <Text style={styles.kpiSub}>
              Top {performance.metrics.percentile}% of {performance.metrics.totalClassStudents} Students
            </Text>
          </View>

          {/* Attendance Rate */}
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Attendance Rate</Text>
            <Text style={styles.kpiValue}>{performance.attendance.attendanceRate}%</Text>
            <Text style={styles.kpiSub}>
              {performance.attendance.presentDays} / {performance.attendance.totalDays} Days ({performance.attendance.status})
            </Text>
          </View>

          {/* Homework Completion */}
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Homework Rate</Text>
            <Text style={styles.kpiValue}>{performance.homework.completionRate}%</Text>
            <Text style={styles.kpiSub}>
              {performance.homework.onTimeCount} On-Time | Avg {performance.homework.averageScorePercentage}%
            </Text>
          </View>
        </View>

        {/* 5. Subject Mastery Matrix & Benchmarking */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeaderBar}>
            <Text style={styles.sectionHeaderText}>Curriculum Subject Mastery Matrix</Text>
            <Text style={styles.sectionHeaderBadge}>
              {performance.metrics.totalSubjectsPassed} Passed • {performance.metrics.totalSubjectsFailed} Needing Support
            </Text>
          </View>

          <View style={styles.tableHeader}>
            <Text style={[styles.thText, { flex: 3.2 }]}>Subject</Text>
            <Text style={[styles.thText, { flex: 1.1 }]}>Code</Text>
            <Text style={[styles.thText, { flex: 1, textAlign: "right" }]}>Obtained</Text>
            <Text style={[styles.thText, { flex: 1, textAlign: "right" }]}>Max</Text>
            <Text style={[styles.thText, { flex: 1, textAlign: "right" }]}>Score %</Text>
            <Text style={[styles.thText, { flex: 1.1, textAlign: "right" }]}>Class Avg</Text>
            <Text style={[styles.thText, { flex: 1, textAlign: "center" }]}>Grade</Text>
            <Text style={[styles.thText, { flex: 1, textAlign: "right" }]}>GPA</Text>
          </View>

          {performance.subjectMastery.length === 0 ? (
            <View style={styles.tableRow}>
              <Text style={[styles.tdText, { flex: 1, textAlign: "center", color: "#64748B" }]}>
                No subject evaluation records recorded for this session.
              </Text>
            </View>
          ) : (
            performance.subjectMastery.map((sub, index) => {
              const isPassing = sub.percentage >= 40;
              return (
                <View
                  key={sub.subjectId || index}
                  style={[styles.tableRow, index % 2 === 1 ? styles.tableRowAlt : {}]}
                >
                  <Text style={[styles.tdText, { flex: 3.2, fontWeight: 700 }]}>
                    {sub.subjectName}
                  </Text>
                  <Text style={[styles.tdText, { flex: 1.1, color: "#64748B" }]}>
                    {sub.subjectCode || "—"}
                  </Text>
                  <Text
                    style={[
                      styles.tdText,
                      {
                        flex: 1,
                        textAlign: "right",
                        fontWeight: 700,
                        color: isPassing ? "#0F172A" : "#DC2626",
                      },
                    ]}
                  >
                    {sub.obtainedMarks}
                  </Text>
                  <Text style={[styles.tdText, { flex: 1, textAlign: "right", color: "#64748B" }]}>
                    {sub.maxMarks}
                  </Text>
                  <Text
                    style={[
                      styles.tdText,
                      {
                        flex: 1,
                        textAlign: "right",
                        fontWeight: 700,
                        color: isPassing ? "#1E40AF" : "#DC2626",
                      },
                    ]}
                  >
                    {sub.percentage}%
                  </Text>
                  <Text style={[styles.tdText, { flex: 1.1, textAlign: "right", color: "#64748B" }]}>
                    {sub.classAveragePercentage ? `${sub.classAveragePercentage}%` : "—"}
                  </Text>
                  <Text
                    style={[
                      styles.tdText,
                      {
                        flex: 1,
                        textAlign: "center",
                        fontWeight: 700,
                        color: isPassing ? "#15803D" : "#DC2626",
                      },
                    ]}
                  >
                    {sub.letterGrade}
                  </Text>
                  <Text style={[styles.tdText, { flex: 1, textAlign: "right", fontWeight: 700 }]}>
                    {sub.gradePoint.toFixed(2)}
                  </Text>
                </View>
              );
            })
          )}
        </View>

        {/* 6. Examination Progression Timeline */}
        {performance.examProgression.length > 0 && (
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeaderBar}>
              <Text style={styles.sectionHeaderText}>Chronological Examination Progression</Text>
              <Text style={styles.sectionHeaderBadge}>
                {performance.examProgression.length} Examination Assessments Recorded
              </Text>
            </View>

            <View style={styles.tableHeader}>
              <Text style={[styles.thText, { flex: 3.2 }]}>Exam Title</Text>
              <Text style={[styles.thText, { flex: 1.2 }]}>Term / Type</Text>
              <Text style={[styles.thText, { flex: 1.2, textAlign: "right" }]}>Obtained</Text>
              <Text style={[styles.thText, { flex: 1, textAlign: "right" }]}>Max</Text>
              <Text style={[styles.thText, { flex: 1, textAlign: "right" }]}>%</Text>
              <Text style={[styles.thText, { flex: 1, textAlign: "center" }]}>Grade</Text>
              <Text style={[styles.thText, { flex: 1, textAlign: "right" }]}>GPA</Text>
            </View>

            {performance.examProgression.map((ex, index) => (
              <View
                key={ex.examId || index}
                style={[styles.tableRow, index % 2 === 1 ? styles.tableRowAlt : {}]}
              >
                <Text style={[styles.tdText, { flex: 3.2, fontWeight: 700 }]}>
                  {ex.examTitle}
                </Text>
                <Text style={[styles.tdText, { flex: 1.2, color: "#64748B" }]}>
                  {ex.term || ex.examType || "Term"}
                </Text>
                <Text style={[styles.tdText, { flex: 1.2, textAlign: "right", fontWeight: 700 }]}>
                  {ex.totalMarksObtained}
                </Text>
                <Text style={[styles.tdText, { flex: 1, textAlign: "right", color: "#64748B" }]}>
                  {ex.totalMaxMarks}
                </Text>
                <Text
                  style={[
                    styles.tdText,
                    { flex: 1, textAlign: "right", fontWeight: 700, color: "#1E40AF" },
                  ]}
                >
                  {ex.percentage}%
                </Text>
                <Text
                  style={[
                    styles.tdText,
                    { flex: 1, textAlign: "center", fontWeight: 700, color: "#15803D" },
                  ]}
                >
                  {ex.letterGrade}
                </Text>
                <Text style={[styles.tdText, { flex: 1, textAlign: "right", fontWeight: 700 }]}>
                  {ex.gpa.toFixed(2)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* 7. Actionable Academic Insights & Interventions */}
        <View style={styles.insightsContainer}>
          {/* Core Strengths */}
          <View style={[styles.insightBox, { borderColor: "#BBF7D0", backgroundColor: "#F0FDF4" }]}>
            <Text style={[styles.insightBoxHeader, { color: "#15803D" }]}>Core Academic Strengths</Text>
            {performance.insights.strengths.length === 0 ? (
              <Text style={{ fontSize: 6.5, color: "#166534" }}>Consistent foundational performance.</Text>
            ) : (
              performance.insights.strengths.map((str, idx) => (
                <View key={idx} style={styles.bulletRow}>
                  <Text style={[styles.bulletDot, { color: "#15803D" }]}>✓</Text>
                  <Text style={styles.bulletContent}>{str}</Text>
                </View>
              ))
            )}
          </View>

          {/* Areas for Focus */}
          <View style={[styles.insightBox, { borderColor: "#FED7AA", backgroundColor: "#FFFBEB" }]}>
            <Text style={[styles.insightBoxHeader, { color: "#B45309" }]}>Priority Focus Areas</Text>
            {performance.insights.focusAreas.length === 0 ? (
              <Text style={{ fontSize: 6.5, color: "#92400E" }}>No critical subject deficits identified.</Text>
            ) : (
              performance.insights.focusAreas.map((foc, idx) => (
                <View key={idx} style={styles.bulletRow}>
                  <Text style={[styles.bulletDot, { color: "#B45309" }]}>▲</Text>
                  <Text style={styles.bulletContent}>{foc}</Text>
                </View>
              ))
            )}
          </View>

          {/* Actionable Recommendations */}
          <View style={[styles.insightBox, { borderColor: "#BFDBFE", backgroundColor: "#EFF6FF" }]}>
            <Text style={[styles.insightBoxHeader, { color: "#1D4ED8" }]}>Advisory & Next Steps</Text>
            {performance.insights.actionableRecommendations.length === 0 ? (
              <Text style={{ fontSize: 6.5, color: "#1E40AF" }}>Maintain current study routine.</Text>
            ) : (
              performance.insights.actionableRecommendations.map((rec, idx) => (
                <View key={idx} style={styles.bulletRow}>
                  <Text style={[styles.bulletDot, { color: "#1D4ED8" }]}>→</Text>
                  <Text style={styles.bulletContent}>{rec}</Text>
                </View>
              ))
            )}
          </View>
        </View>

        {/* 8. Institutional Signature Section */}
        <View style={styles.signatureRow}>
          <View style={styles.signatureBox}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>Class Teacher</Text>
          </View>
          <View style={styles.signatureBox}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>Academic Coordinator</Text>
          </View>
          <View style={styles.signatureBox}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>Principal / Headmaster</Text>
          </View>
        </View>

        {/* 9. Verifiable Computer-Generated System Footer */}
        <View style={styles.officialFooter}>
          <Text>Official Student Performance Analytics Transcript • Pathshala-Pro ERP</Text>
          <Text>This is a certified system record • Page 1 of 1</Text>
        </View>
      </Page>
    </Document>
  );
}

export default StudentPerformancePDF;