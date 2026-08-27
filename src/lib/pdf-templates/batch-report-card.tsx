import React from "react";
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { reportCardStyles } from "./report-card";

export interface BatchStudentResult {
  student: {
    id: string;
    name: string;
    admissionNumber: string;
    rollNumber: string;
    className: string;
    section: string;
    guardianName?: string;
    guardianContact?: string;
  };
  examName: string;
  academicYear: string;
  subjects: Array<{
    subjectName: string;
    subjectCode: string;
    maxMarks: number;
    passMarks: number;
    obtainedMarks: number;
    grade: string;
    gradePoint: number;
    remarks?: string;
  }>;
  totalMaxMarks: number;
  totalObtainedMarks: number;
  percentage: number;
  gpa: number;
  letterGrade: string;
  rank: number;
  rankLabel: string;
  totalStudentsInClass: number;
  passed: boolean;
  attendance?: {
    present: number;
    total: number;
    percentage: number;
  };
  teacherRemarks?: string;
  principalRemarks?: string;
}

export interface BatchReportCardProps {
  school: {
    name: string;
    address: string;
    phone: string;
    email: string;
  };
  students: BatchStudentResult[];
}

const styles = StyleSheet.create({
  ...reportCardStyles,
  pageContainer: {
    padding: 24,
    backgroundColor: "#FFFFFF",
    fontSize: 9,
    fontFamily: "Helvetica",
  },
  headerBox: {
    borderBottom: "2px solid #1e3a8a",
    paddingBottom: 8,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  schoolName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1e3a8a",
  },
  schoolMeta: {
    fontSize: 8,
    color: "#475569",
    marginTop: 2,
  },
  examBadgeBox: {
    backgroundColor: "#eff6ff",
    border: "1px solid #bfdbfe",
    borderRadius: 4,
    padding: 6,
    alignItems: "flex-end",
  },
  examTitleText: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#1d4ed8",
  },
  sessionText: {
    fontSize: 8,
    color: "#64748b",
    marginTop: 1,
  },
  studentProfileGrid: {
    backgroundColor: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 4,
    padding: 8,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  profileCol: {
    flex: 1,
  },
  profileRow: {
    flexDirection: "row",
    marginBottom: 3,
  },
  profileLabel: {
    fontSize: 8,
    color: "#64748b",
    width: 75,
    fontWeight: "bold",
  },
  profileVal: {
    fontSize: 8,
    color: "#0f172a",
    fontWeight: "bold",
  },
  rankBadge: {
    backgroundColor: "#fef3c7",
    border: "1px solid #fde68a",
    borderRadius: 4,
    padding: "4px 8px",
    alignItems: "center",
    justifyContent: "center",
  },
  rankNumber: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#92400e",
  },
  rankCaption: {
    fontSize: 7,
    color: "#b45309",
    marginTop: 1,
  },
  table: {
    border: "1px solid #cbd5e1",
    borderRadius: 4,
    marginBottom: 10,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#1e293b",
    padding: "5px 6px",
  },
  thText: {
    color: "#ffffff",
    fontSize: 8,
    fontWeight: "bold",
  },
  tableRow: {
    flexDirection: "row",
    borderTop: "1px solid #e2e8f0",
    padding: "4px 6px",
  },
  tableRowAlt: {
    backgroundColor: "#f8fafc",
  },
  tdText: {
    fontSize: 8,
    color: "#1e293b",
  },
  summaryGrid: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: "#f1f5f9",
    border: "1px solid #cbd5e1",
    borderRadius: 4,
    padding: 6,
    alignItems: "center",
  },
  summaryCardLabel: {
    fontSize: 7,
    color: "#64748b",
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  summaryCardVal: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#0f172a",
    marginTop: 2,
  },
  remarksSection: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  remarkBox: {
    flex: 1,
    border: "1px solid #e2e8f0",
    borderRadius: 4,
    padding: 6,
    backgroundColor: "#ffffff",
  },
  remarkLabel: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#475569",
    marginBottom: 2,
    textTransform: "uppercase",
  },
  remarkText: {
    fontSize: 8,
    color: "#1e293b",
    fontStyle: "italic",
  },
  footerSignatures: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 15,
    paddingTop: 10,
    borderTop: "1px dashed #cbd5e1",
  },
  signBlock: {
    alignItems: "center",
    width: 120,
  },
  signLine: {
    width: "100%",
    borderBottom: "1px solid #94a3b8",
    marginBottom: 4,
  },
  signTitle: {
    fontSize: 7,
    color: "#475569",
    fontWeight: "bold",
  },
  gradingScaleLegend: {
    fontSize: 6.5,
    color: "#94a3b8",
    textAlign: "center",
    marginTop: 8,
  },
});

export const BatchReportCardDocument: React.FC<BatchReportCardProps> = ({
  school,
  students,
}) => {
  return (
    <Document title="Class Batch Report Cards" author="Pathshala Pro ERP">
      {students.map((data, index) => (
        <Page key={data.student.id || index} size="A4" style={styles.pageContainer}>
          {/* Header */}
          <View style={styles.headerBox}>
            <View>
              <Text style={styles.schoolName}>{school.name}</Text>
              <Text style={styles.schoolMeta}>
                {school.address} • Phone: {school.phone} • Email: {school.email}
              </Text>
            </View>
            <View style={styles.examBadgeBox}>
              <Text style={styles.examTitleText}>{data.examName}</Text>
              <Text style={styles.sessionText}>Academic Session: {data.academicYear}</Text>
            </View>
          </View>

          {/* Student Profile & Rank Badge */}
          <View style={styles.studentProfileGrid}>
            <View style={styles.profileCol}>
              <View style={styles.profileRow}>
                <Text style={styles.profileLabel}>Student Name:</Text>
                <Text style={styles.profileVal}>{data.student.name}</Text>
              </View>
              <View style={styles.profileRow}>
                <Text style={styles.profileLabel}>Roll Number:</Text>
                <Text style={styles.profileVal}>{data.student.rollNumber}</Text>
              </View>
              <View style={styles.profileRow}>
                <Text style={styles.profileLabel}>Admission No:</Text>
                <Text style={styles.profileVal}>{data.student.admissionNumber}</Text>
              </View>
            </View>

            <View style={styles.profileCol}>
              <View style={styles.profileRow}>
                <Text style={styles.profileLabel}>Class & Section:</Text>
                <Text style={styles.profileVal}>
                  {data.student.className} {data.student.section ? `(${data.student.section})` : ""}
                </Text>
              </View>
              <View style={styles.profileRow}>
                <Text style={styles.profileLabel}>Guardian:</Text>
                <Text style={styles.profileVal}>{data.student.guardianName || "—"}</Text>
              </View>
              <View style={styles.profileRow}>
                <Text style={styles.profileLabel}>Attendance:</Text>
                <Text style={styles.profileVal}>
                  {data.attendance ? `${data.attendance.percentage}% (${data.attendance.present}/${data.attendance.total} Days)` : "N/A"}
                </Text>
              </View>
            </View>

            <View style={styles.rankBadge}>
              <Text style={styles.rankNumber}>{data.rankLabel}</Text>
              <Text style={styles.rankCaption}>
                Rank in Class ({data.totalStudentsInClass} Pupils)
              </Text>
            </View>
          </View>

          {/* Subject Marks Table */}
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.thText, { flex: 3 }]}>Subject</Text>
              <Text style={[styles.thText, { flex: 1.5 }]}>Code</Text>
              <Text style={[styles.thText, { flex: 1, textAlign: "right" }]}>Max</Text>
              <Text style={[styles.thText, { flex: 1, textAlign: "right" }]}>Pass</Text>
              <Text style={[styles.thText, { flex: 1.2, textAlign: "right" }]}>Obtained</Text>
              <Text style={[styles.thText, { flex: 1, textAlign: "center" }]}>Grade</Text>
              <Text style={[styles.thText, { flex: 1, textAlign: "right" }]}>GP</Text>
              <Text style={[styles.thText, { flex: 2, textAlign: "left", paddingLeft: 4 }]}>
                Remarks
              </Text>
            </View>

            {data.subjects.map((sub, sIdx) => (
              <View
                key={sub.subjectCode || sIdx}
                style={[styles.tableRow, sIdx % 2 === 1 ? styles.tableRowAlt : {}]}
              >
                <Text style={[styles.tdText, { flex: 3, fontWeight: "bold" }]}>
                  {sub.subjectName}
                </Text>
                <Text style={[styles.tdText, { flex: 1.5, color: "#64748b" }]}>
                  {sub.subjectCode}
                </Text>
                <Text style={[styles.tdText, { flex: 1, textAlign: "right" }]}>
                  {sub.maxMarks}
                </Text>
                <Text style={[styles.tdText, { flex: 1, textAlign: "right", color: "#64748b" }]}>
                  {sub.passMarks}
                </Text>
                <Text
                  style={[
                    styles.tdText,
                    {
                      flex: 1.2,
                      textAlign: "right",
                      fontWeight: "bold",
                      color: sub.obtainedMarks < sub.passMarks ? "#dc2626" : "#0f172a",
                    },
                  ]}
                >
                  {sub.obtainedMarks}
                </Text>
                <Text
                  style={[
                    styles.tdText,
                    {
                      flex: 1,
                      textAlign: "center",
                      fontWeight: "bold",
                      color: sub.grade === "F" ? "#dc2626" : "#1e40af",
                    },
                  ]}
                >
                  {sub.grade}
                </Text>
                <Text style={[styles.tdText, { flex: 1, textAlign: "right" }]}>
                  {sub.gradePoint.toFixed(1)}
                </Text>
                <Text
                  style={[
                    styles.tdText,
                    { flex: 2, textAlign: "left", paddingLeft: 4, color: "#475569" },
                  ]}
                >
                  {sub.remarks || (sub.obtainedMarks >= sub.passMarks ? "Passed" : "Needs Support")}
                </Text>
              </View>
            ))}
          </View>

          {/* Performance Summary Cards */}
          <View style={styles.summaryGrid}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryCardLabel}>Total Obtained</Text>
              <Text style={styles.summaryCardVal}>
                {data.totalObtainedMarks} / {data.totalMaxMarks}
              </Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryCardLabel}>Overall Percentage</Text>
              <Text
                style={[
                  styles.summaryCardVal,
                  { color: data.percentage >= 60 ? "#16a34a" : "#dc2626" },
                ]}
              >
                {data.percentage}%
              </Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryCardLabel}>GPA / Point</Text>
              <Text style={styles.summaryCardVal}>{data.gpa.toFixed(2)}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryCardLabel}>Final Result</Text>
              <Text
                style={[
                  styles.summaryCardVal,
                  { color: data.passed ? "#16a34a" : "#dc2626" },
                ]}
              >
                {data.passed ? "PASSED" : "FAILED"} ({data.letterGrade})
              </Text>
            </View>
          </View>

          {/* Remarks Section */}
          <View style={styles.remarksSection}>
            <View style={styles.remarkBox}>
              <Text style={styles.remarkLabel}>Class Teacher Remarks</Text>
              <Text style={styles.remarkText}>
                {data.teacherRemarks ||
                  (data.percentage >= 80
                    ? "Exemplary academic progress and commendable dedication."
                    : data.percentage >= 60
                    ? "Consistent performance with good potential for further advancement."
                    : "Encouraged to dedicate focused attention to core subject fundamentals.")}
              </Text>
            </View>
            <View style={styles.remarkBox}>
              <Text style={styles.remarkLabel}>Principal Observations</Text>
              <Text style={styles.remarkText}>
                {data.principalRemarks ||
                  (data.passed
                    ? "Promoted / Eligible for next academic level. Well done!"
                    : "Conditional review required with subject teacher and parent consultation.")}
              </Text>
            </View>
          </View>

          {/* Signatures */}
          <View style={styles.footerSignatures}>
            <View style={styles.signBlock}>
              <View style={styles.signLine} />
              <Text style={styles.signTitle}>Class Teacher</Text>
            </View>
            <View style={styles.signBlock}>
              <View style={styles.signLine} />
              <Text style={styles.signTitle}>Controller of Examinations</Text>
            </View>
            <View style={styles.signBlock}>
              <View style={styles.signLine} />
              <Text style={styles.signTitle}>Principal / Headmaster</Text>
            </View>
          </View>

          {/* Grading Scale */}
          <Text style={styles.gradingScaleLegend}>
            Grading Scale: A+ (90-100%, GP 4.0) | A (80-89%, GP 3.8) | B (70-79%, GP 3.3) | C (60-69%, GP 2.7) | D (50-59%, GP 2.0) | E (40-49%, GP 1.0) | F (&lt;40%, GP 0.0)
          </Text>
        </Page>
      ))}
    </Document>
  );
};
