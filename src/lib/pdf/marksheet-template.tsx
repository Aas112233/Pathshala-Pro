import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

export type BoardCurriculum = "NCTB" | "CBSE" | "FBISE" | "GENERAL";

export interface MarksheetSubjectRow {
  code: string;
  name: string;
  theoryObtained?: number;
  practicalObtained?: number;
  mcqObtained?: number;
  internalObtained?: number;
  boardObtained?: number;
  part1Obtained?: number;
  part2Obtained?: number;
  totalObtained: number;
  maxMarks: number;
  grade: string;
  gradePoint?: number;
  isFourthSubject?: boolean;
  isReplaced?: boolean;
  remarks?: string;
}

export interface MarksheetData {
  instituteName: string;
  instituteAddress?: string;
  curriculum: BoardCurriculum;
  academicYear: string;
  examName: string;
  studentName: string;
  rollNumber: string;
  className: string;
  sectionName?: string;
  studentId: string;
  dateOfIssue: string;
  subjects: MarksheetSubjectRow[];
  totalObtained: number;
  totalMax: number;
  percentage: number;
  gpa?: number;
  overallGrade: string;
  resultStatus: "PASSED" | "FAILED" | "WITHHELD";
  fourthSubjectBonus?: number;
  positionRank?: string;
}

const styles = StyleSheet.create({
  page: {
    padding: 24,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: "#1e293b",
    backgroundColor: "#ffffff",
  },
  header: {
    borderBottomWidth: 2,
    borderBottomColor: "#0f172a",
    paddingBottom: 8,
    marginBottom: 12,
    alignItems: "center",
  },
  instituteTitle: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  instituteSubtitle: {
    fontSize: 8,
    color: "#64748b",
    marginBottom: 4,
  },
  documentTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#1e40af",
    textTransform: "uppercase",
    marginTop: 4,
  },
  metaGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 4,
    padding: 8,
    marginBottom: 12,
  },
  metaCol: {
    flex: 1,
  },
  metaRow: {
    flexDirection: "row",
    marginBottom: 3,
  },
  metaLabel: {
    fontFamily: "Helvetica-Bold",
    width: 65,
    color: "#475569",
    fontSize: 8,
  },
  metaValue: {
    fontFamily: "Helvetica",
    color: "#0f172a",
    fontSize: 8,
  },
  table: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    marginBottom: 12,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#0f172a",
    color: "#ffffff",
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    paddingVertical: 5,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingVertical: 4,
  },
  tableRowEven: {
    backgroundColor: "#f8fafc",
  },
  tableRowFourth: {
    backgroundColor: "#eff6ff",
  },
  colCode: { width: "12%", paddingHorizontal: 4, textAlign: "center" },
  colName: { width: "32%", paddingHorizontal: 4 },
  colSub: { width: "10%", paddingHorizontal: 2, textAlign: "right" },
  colTotal: { width: "12%", paddingHorizontal: 4, textAlign: "right" },
  colMax: { width: "10%", paddingHorizontal: 4, textAlign: "right" },
  colGrade: { width: "12%", paddingHorizontal: 4, textAlign: "center" },
  colGpa: { width: "12%", paddingHorizontal: 4, textAlign: "center" },

  summaryContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  summaryBox: {
    width: "55%",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 4,
    padding: 8,
  },
  scoreRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  resultBadge: {
    width: "40%",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderRadius: 6,
    padding: 8,
  },
  resultPass: {
    borderColor: "#16a34a",
    backgroundColor: "#f0fdf4",
  },
  resultFail: {
    borderColor: "#dc2626",
    backgroundColor: "#fef2f2",
  },
  resultTextPass: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: "#16a34a",
  },
  resultTextFail: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: "#dc2626",
  },
  signaturesContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 35,
    paddingHorizontal: 12,
  },
  sigBlock: {
    alignItems: "center",
    width: "28%",
  },
  sigLine: {
    width: "100%",
    borderTopWidth: 1,
    borderTopColor: "#94a3b8",
    marginBottom: 4,
  },
  sigText: {
    fontSize: 8,
    color: "#475569",
  },
});

export const StudentMarksheetPDF: React.FC<{ data: MarksheetData }> = ({ data }) => {
  return (
    <Document title={`Marksheet-${data.rollNumber}-${data.studentName}`}>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.instituteTitle}>{data.instituteName}</Text>
          {data.instituteAddress && (
            <Text style={styles.instituteSubtitle}>{data.instituteAddress}</Text>
          )}
          <Text style={styles.documentTitle}>
            Academic Progress Report ({data.curriculum} Scale) — {data.examName}
          </Text>
        </View>

        {/* Student Information Grid */}
        <View style={styles.metaGrid}>
          <View style={styles.metaCol}>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Student Name:</Text>
              <Text style={styles.metaValue}>{data.studentName}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Student ID:</Text>
              <Text style={styles.metaValue}>{data.studentId}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Class / Section:</Text>
              <Text style={styles.metaValue}>
                {data.className} {data.sectionName ? `- ${data.sectionName}` : ""}
              </Text>
            </View>
          </View>
          <View style={styles.metaCol}>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Roll Number:</Text>
              <Text style={styles.metaValue}>{data.rollNumber}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Academic Year:</Text>
              <Text style={styles.metaValue}>{data.academicYear}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Date of Issue:</Text>
              <Text style={styles.metaValue}>{data.dateOfIssue}</Text>
            </View>
          </View>
        </View>

        {/* Subjects Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.colCode}>Code</Text>
            <Text style={styles.colName}>Subject Name</Text>
            {data.curriculum === "NCTB" && <Text style={styles.colSub}>Theory</Text>}
            {data.curriculum === "NCTB" && <Text style={styles.colSub}>Prac/MCQ</Text>}
            {data.curriculum === "CBSE" && <Text style={styles.colSub}>Internal</Text>}
            {data.curriculum === "CBSE" && <Text style={styles.colSub}>Board</Text>}
            {data.curriculum === "FBISE" && <Text style={styles.colSub}>Part-I</Text>}
            {data.curriculum === "FBISE" && <Text style={styles.colSub}>Part-II</Text>}
            <Text style={styles.colTotal}>Obtained</Text>
            <Text style={styles.colMax}>Max</Text>
            <Text style={styles.colGrade}>Grade</Text>
            <Text style={styles.colGpa}>Point</Text>
          </View>

          {data.subjects.map((sub, idx) => (
            <View
              key={sub.code || idx}
              style={[
                styles.tableRow,
                idx % 2 === 1 ? styles.tableRowEven : {},
                sub.isFourthSubject ? styles.tableRowFourth : {},
              ]}
            >
              <Text style={styles.colCode}>{sub.code}</Text>
              <Text style={styles.colName}>
                {sub.name} {sub.isFourthSubject ? "(4th Subject)" : ""}
              </Text>
              {data.curriculum === "NCTB" && (
                <Text style={styles.colSub}>{sub.theoryObtained ?? "-"}</Text>
              )}
              {data.curriculum === "NCTB" && (
                <Text style={styles.colSub}>{sub.practicalObtained ?? sub.mcqObtained ?? "-"}</Text>
              )}
              {data.curriculum === "CBSE" && (
                <Text style={styles.colSub}>{sub.internalObtained ?? "-"}</Text>
              )}
              {data.curriculum === "CBSE" && (
                <Text style={styles.colSub}>{sub.boardObtained ?? "-"}</Text>
              )}
              {data.curriculum === "FBISE" && (
                <Text style={styles.colSub}>{sub.part1Obtained ?? "-"}</Text>
              )}
              {data.curriculum === "FBISE" && (
                <Text style={styles.colSub}>{sub.part2Obtained ?? "-"}</Text>
              )}
              <Text style={styles.colTotal}>{sub.totalObtained}</Text>
              <Text style={styles.colMax}>{sub.maxMarks}</Text>
              <Text style={styles.colGrade}>{sub.grade}</Text>
              <Text style={styles.colGpa}>{sub.gradePoint !== undefined ? sub.gradePoint.toFixed(2) : "-"}</Text>
            </View>
          ))}
        </View>

        {/* Summary & Overall Result */}
        <View style={styles.summaryContainer}>
          <View style={styles.summaryBox}>
            <View style={styles.scoreRow}>
              <Text style={styles.metaLabel}>Total Marks:</Text>
              <Text style={styles.metaValue}>
                {data.totalObtained} / {data.totalMax} ({data.percentage.toFixed(2)}%)
              </Text>
            </View>
            {data.gpa !== undefined && (
              <View style={styles.scoreRow}>
                <Text style={styles.metaLabel}>Grade Point Average (GPA):</Text>
                <Text style={styles.metaValue}>{data.gpa.toFixed(2)}</Text>
              </View>
            )}
            {data.fourthSubjectBonus !== undefined && data.fourthSubjectBonus > 0 && (
              <View style={styles.scoreRow}>
                <Text style={styles.metaLabel}>4th Subject Bonus Points:</Text>
                <Text style={styles.metaValue}>+{data.fourthSubjectBonus.toFixed(2)} GP</Text>
              </View>
            )}
            {data.positionRank && (
              <View style={styles.scoreRow}>
                <Text style={styles.metaLabel}>Merit Position:</Text>
                <Text style={styles.metaValue}>{data.positionRank}</Text>
              </View>
            )}
          </View>

          <View
            style={[
              styles.resultBadge,
              data.resultStatus === "PASSED" ? styles.resultPass : styles.resultFail,
            ]}
          >
            <Text
              style={
                data.resultStatus === "PASSED"
                  ? styles.resultTextPass
                  : styles.resultTextFail
              }
            >
              {data.resultStatus === "PASSED"
                ? `PASSED (${data.overallGrade})`
                : `RESULT: ${data.resultStatus}`}
            </Text>
          </View>
        </View>

        {/* Signature Blocks */}
        <View style={styles.signaturesContainer}>
          <View style={styles.sigBlock}>
            <View style={styles.sigLine} />
            <Text style={styles.sigText}>Class Teacher</Text>
          </View>
          <View style={styles.sigBlock}>
            <View style={styles.sigLine} />
            <Text style={styles.sigText}>Controller of Examinations</Text>
          </View>
          <View style={styles.sigBlock}>
            <View style={styles.sigLine} />
            <Text style={styles.sigText}>Headmaster / Principal</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
};
