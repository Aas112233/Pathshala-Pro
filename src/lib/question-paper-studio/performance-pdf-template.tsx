import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { StudentPerformanceOverview } from "@/lib/student-performance";

interface PerformancePDFProps {
  performance: StudentPerformanceOverview;
  studentName: string;
  studentRollNumber: string;
}

const performancePDFStyles = StyleSheet.create({
  page: {
    padding: 24,
    backgroundColor: "#FFFFFF",
    fontFamily: "Helvetica",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    borderBottom: "2px solid #1E40AF",
    paddingBottom: 12,
    marginBottom: 12,
  },
  instituteName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1E40AF",
    marginBottom: 2,
  },
  subInstituteText: {
    fontSize: 10,
    color: "#6B7280",
  },
  studentInfoBanner: {
    backgroundColor: "#F8FAFC",
    borderRadius: 6,
    padding: 10,
    marginBottom: 12,
  },
  studentInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  studentLabel: {
    fontSize: 9,
    color: "#6B7280",
  },
  studentValue: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#1F2937",
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  metricCard: {
    width: "48%",
    border: "1px solid #E5E7EB",
    borderRadius: 6,
    padding: 8,
    backgroundColor: "#FAFAFA",
  },
  metricTitle: {
    fontSize: 8,
    color: "#6B7280",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 2,
  },
  metricSubtitle: {
    fontSize: 8,
    color: "#6B7280",
  },
  section: {
    marginBottom: 12,
    borderBottom: "1px solid #E5E7EB",
    paddingBottom: 8,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#1E40AF",
    marginBottom: 6,
  },
  tableRow: {
    flexDirection: "row",
    borderBottom: "1px solid #F3F4F6",
    paddingVertical: 4,
  },
  tableHeader: {
    backgroundColor: "#F3F4F6",
    borderBottom: "1px solid #E5E7EB",
    paddingVertical: 5,
  },
  tableCell: {
    fontSize: 8,
    color: "#1F2937",
    textAlign: "center",
  },
  insightsCard: {
    padding: 8,
    backgroundColor: "#F8FAFC",
    borderRadius: 6,
    border: "1px solid #E5E7EB",
    marginBottom: 12,
  },
  insightsTitle: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#374151",
    marginBottom: 4,
  },
  insightItem: {
    fontSize: 8,
    color: "#4B5563",
    marginBottom: 2,
  },
  recommendationItem: {
    fontSize: 8,
    color: "#1F2937",
    marginBottom: 2,
  },
  riskBadge: {
    fontSize: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: "#FEE2E2",
    color: "#991B1B",
    fontWeight: "bold",
  },
  signatureSection: {
    marginTop: 16,
    paddingTop: 12,
    borderTop: "1px solid #E5E7EB",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  signatureBlock: {
    width: "40%",
    alignItems: "center",
  },
  signatureLine: {
    width: "100%",
    height: 1,
    borderBottom: "1px solid #6B7280",
    marginBottom: 4,
  },
});

export function StudentPerformancePDF({ performance, studentName, studentRollNumber }: PerformancePDFProps) {
  return (
    <Document>
      <Page size="A4" style={performancePDFStyles.page}>
        {/* Institutional Header */}
        <View style={performancePDFStyles.header}>
          <View>
            <Text style={performancePDFStyles.instituteName}>PATHSHALA PRO SCHOOL MANAGEMENT</Text>
            <Text style={performancePDFStyles.subInstituteText}>Comprehensive Student Performance Analytics</Text>
          </View>
        </View>

        {/* Student Information Banner */}
        <View style={performancePDFStyles.studentInfoBanner}>
          <View style={performancePDFStyles.studentInfoRow}>
            <Text style={performancePDFStyles.studentLabel}>Student:</Text>
            <Text style={performancePDFStyles.studentValue}>{studentName}</Text>
          </View>
          <View style={performancePDFStyles.studentInfoRow}>
            <Text style={performancePDFStyles.studentLabel}>Roll No / ID:</Text>
            <Text style={performancePDFStyles.studentValue}>{studentRollNumber}</Text>
          </View>
          <View style={performancePDFStyles.studentInfoRow}>
            <Text style={performancePDFStyles.studentLabel}>Academic Year:</Text>
            <Text style={performancePDFStyles.studentValue}>{performance.academicYear.label}</Text>
          </View>
        </View>

        {/* Core KPI Summary Grid */}
        <View style={performancePDFStyles.metricsGrid}>
          <View style={performancePDFStyles.metricCard}>
            <Text style={performancePDFStyles.metricTitle}>Cumulative GPA</Text>
            <Text style={performancePDFStyles.metricValue}>{performance.metrics.cumulativeGpa.toFixed(2)}</Text>
            <Text style={performancePDFStyles.metricSubtitle}>{performance.metrics.letterGrade} Grade</Text>
          </View>

          <View style={performancePDFStyles.metricCard}>
            <Text style={performancePDFStyles.metricTitle}>Merit Rank</Text>
            <Text style={performancePDFStyles.metricValue}>{performance.metrics.meritRankLabel}</Text>
            <Text style={performancePDFStyles.metricSubtitle}>Top {performance.metrics.percentile}%</Text>
          </View>

          <View style={performancePDFStyles.metricCard}>
            <Text style={performancePDFStyles.metricTitle}>Attendance Rate</Text>
            <Text style={performancePDFStyles.metricValue}>{performance.attendance.attendanceRate}%</Text>
            <Text style={performancePDFStyles.metricSubtitle}>{performance.attendance.status}</Text>
          </View>

          <View style={performancePDFStyles.metricCard}>
            <Text style={performancePDFStyles.metricTitle}>Homework Completion</Text>
            <Text style={performancePDFStyles.metricValue}>{performance.homework.completionRate}%</Text>
            <Text style={performancePDFStyles.metricSubtitle}>
              {performance.homework.onTimeCount} On-Time / {performance.homework.totalAssigned} Assigned
            </Text>
          </View>
        </View>

        {/* Subject Mastery Matrix */}
        <View style={performancePDFStyles.section}>
          <Text style={performancePDFStyles.sectionHeader}>Subject Mastery Matrix</Text>

          <View style={[performancePDFStyles.tableRow, performancePDFStyles.tableHeader]}>
            <Text style={[performancePDFStyles.tableCell, { flex: 3, textAlign: "left" }]}>Subject</Text>
            <Text style={[performancePDFStyles.tableCell, { flex: 1 }]}>Obtained</Text>
            <Text style={[performancePDFStyles.tableCell, { flex: 1 }]}>Max</Text>
            <Text style={[performancePDFStyles.tableCell, { flex: 1 }]}>%</Text>
            <Text style={[performancePDFStyles.tableCell, { flex: 1 }]}>Grade</Text>
            <Text style={[performancePDFStyles.tableCell, { flex: 1 }]}>GPA</Text>
          </View>

          {performance.subjectMastery.map((sub) => (
            <View key={sub.subjectId} style={performancePDFStyles.tableRow}>
              <View style={[performancePDFStyles.tableCell, { flex: 3, textAlign: "left" }]}>
                <Text style={{ fontWeight: "bold" }}>{sub.subjectName}</Text>
              </View>
              <Text style={[performancePDFStyles.tableCell, { flex: 1 }]}>{sub.obtainedMarks}</Text>
              <Text style={[performancePDFStyles.tableCell, { flex: 1 }]}>{sub.maxMarks}</Text>
              <Text style={[performancePDFStyles.tableCell, { flex: 1, fontWeight: "bold" }]}>{sub.percentage}%</Text>
              <Text style={[performancePDFStyles.tableCell, { flex: 1, color: "#1E40AF", fontWeight: "bold" }]}>
                {sub.letterGrade}
              </Text>
              <Text style={[performancePDFStyles.tableCell, { flex: 1 }]}>{sub.gradePoint.toFixed(2)}</Text>
            </View>
          ))}
        </View>

        {/* Exam Progression Timeline */}
        <View style={performancePDFStyles.section}>
          <Text style={performancePDFStyles.sectionHeader}>Exam Progression Timeline</Text>

          <View style={[performancePDFStyles.tableRow, performancePDFStyles.tableHeader]}>
            <Text style={[performancePDFStyles.tableCell, { flex: 3, textAlign: "left" }]}>Exam</Text>
            <Text style={[performancePDFStyles.tableCell, { flex: 1.5 }]}>Term</Text>
            <Text style={[performancePDFStyles.tableCell, { flex: 1 }]}>Grade</Text>
            <Text style={[performancePDFStyles.tableCell, { flex: 1 }]}>GPA</Text>
            <Text style={[performancePDFStyles.tableCell, { flex: 1 }]}>%</Text>
          </View>

          {performance.examProgression.map((ex) => (
            <View key={ex.examId} style={performancePDFStyles.tableRow}>
              <Text style={[performancePDFStyles.tableCell, { flex: 3, textAlign: "left", fontWeight: "bold" }]}>
                {ex.examTitle}
              </Text>
              <Text style={[performancePDFStyles.tableCell, { flex: 1.5 }]}>{ex.term || "—"}</Text>
              <Text style={[performancePDFStyles.tableCell, { flex: 1 }]}>{ex.letterGrade}</Text>
              <Text style={[performancePDFStyles.tableCell, { flex: 1 }]}>{ex.gpa.toFixed(2)}</Text>
              <Text style={[performancePDFStyles.tableCell, { flex: 1 }]}>{ex.percentage}%</Text>
            </View>
          ))}
        </View>

        {/* Insights and Recommendations */}
        <View style={performancePDFStyles.insightsCard}>
          <Text style={performancePDFStyles.insightsTitle}>Key Strengths</Text>
          {performance.insights.strengths.map((str, idx) => (
            <Text key={idx} style={performancePDFStyles.insightItem}>• {str}</Text>
          ))}

          <Text style={[performancePDFStyles.insightsTitle, { marginTop: 4 }]}>Focus Areas</Text>
          {performance.insights.focusAreas.map((foc, idx) => (
            <Text key={idx} style={performancePDFStyles.insightItem}>• {foc}</Text>
          ))}

          <View style={{ marginTop: 4, flexDirection: "row", alignItems: "center" }}>
            <Text style={{ fontSize: 8, color: "#6B7280", marginRight: 4 }}>Risk Level:</Text>
            <Text style={performancePDFStyles.riskBadge}>{performance.insights.riskLevel}</Text>
          </View>
        </View>

        {/* Signature Section */}
        <View style={performancePDFStyles.signatureSection}>
          <View style={performancePDFStyles.signatureBlock}>
            <View style={performancePDFStyles.signatureLine} />
            <Text style={{ fontSize: 8, color: "#6B7280" }}>Class Teacher</Text>
          </View>
          <View style={performancePDFStyles.signatureBlock}>
            <View style={performancePDFStyles.signatureLine} />
            <Text style={{ fontSize: 8, color: "#6B7280" }}>Principal / Headmaster</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

export default StudentPerformancePDF;