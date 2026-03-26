import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";

interface SubjectResult {
  subject: string;
  subjectCode: string;
  maxMarks: number;
  obtainedMarks: number;
  grade: string;
  gradePoint: number;
  remarks?: string;
}

interface TermResult {
  termName: string;
  subjects: SubjectResult[];
  totalMarks: number;
  obtainedMarks: number;
  percentage: number;
  grade: string;
  rank?: number;
  totalStudents?: number;
}

interface AttendanceRecord {
  month: string;
  present: number;
  total: number;
}

interface ReportCardProps {
  student: {
    name: string;
    admissionNumber: string;
    rollNumber: string;
    className: string;
    section: string;
    dateOfBirth: string;
    gender: string;
    bloodGroup?: string;
    guardianName: string;
    guardianContact: string;
    address?: string;
    photoUrl?: string;
  };
  academicYear: string;
  terms: TermResult[];
  attendance: AttendanceRecord[];
  coCurricular?: {
    activity: string;
    grade: string;
    remarks?: string;
  }[];
  teacherRemarks?: string;
  principalRemarks?: string;
  school: {
    name: string;
    address: string;
    phone: string;
    email: string;
    logoUrl?: string;
  };
}

const reportCardStyles = StyleSheet.create({
  page: {
    padding: 25,
    backgroundColor: "#FFFFFF",
  },
  // Header Styles
  header: {
    flexDirection: "row",
    alignItems: "center",
    borderBottom: "3px solid #1E40AF",
    paddingBottom: 12,
    marginBottom: 15,
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
    fontSize: 16,
    fontWeight: 700,
    color: "#1E40AF",
    marginBottom: 2,
  },
  schoolAddress: {
    fontSize: 7,
    color: "#64748B",
    marginBottom: 1,
  },
  contact: {
    fontSize: 6,
    color: "#64748B",
  },
  reportTitle: {
    textAlign: "center" as const,
    fontSize: 12,
    fontWeight: 700,
    color: "#1E293B",
    marginTop: 8,
    textTransform: "uppercase" as const,
    letterSpacing: 1.5,
  },
  academicYear: {
    textAlign: "center" as const,
    fontSize: 8,
    color: "#64748B",
    marginTop: 2,
  },
  // Student Profile Section
  studentProfile: {
    flexDirection: "row",
    backgroundColor: "#F8FAFC",
    padding: 10,
    borderRadius: 6,
    marginBottom: 12,
    border: "1px solid #E2E8F0",
  },
  studentPhoto: {
    width: 80,
    height: 90,
    border: "2px solid #1E40AF",
    borderRadius: 4,
    marginRight: 12,
  },
  photoPlaceholder: {
    width: 80,
    height: 90,
    border: "2px dashed #CBD5E1",
    borderRadius: 4,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  photoPlaceholderText: {
    fontSize: 7,
    color: "#94A3B8",
  },
  studentDetails: {
    flex: 1,
  },
  studentName: {
    fontSize: 12,
    fontWeight: 700,
    color: "#1E293B",
    marginBottom: 6,
  },
  detailsGrid: {
    flexDirection: "row",
    flexWrap: "wrap" as const,
  },
  detailItem: {
    width: "50%",
    marginBottom: 3,
  },
  detailLabel: {
    fontSize: 6,
    color: "#64748B",
    marginBottom: 1,
  },
  detailValue: {
    fontSize: 7,
    color: "#1E293B",
    fontWeight: 500,
  },
  // Term Section
  termSection: {
    marginBottom: 12,
    border: "1px solid #E2E8F0",
    borderRadius: 6,
    overflow: "hidden",
  },
  termHeader: {
    backgroundColor: "#1E40AF",
    paddingVertical: 6,
    paddingHorizontal: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  termTitle: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: 700,
    textTransform: "uppercase" as const,
  },
  termResult: {
    color: "#FFFFFF",
    fontSize: 8,
    fontWeight: 600,
  },
  marksTable: {
    padding: 8,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderBottom: "1px solid #E2E8F0",
  },
  headerCell: {
    fontSize: 6,
    color: "#475569",
    fontWeight: 600,
    textTransform: "uppercase" as const,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderBottom: "1px solid #F1F5F9",
  },
  tableRowAlt: {
    backgroundColor: "#F8FAFC",
  },
  tableCell: {
    fontSize: 7,
    color: "#1E293B",
  },
  // Summary Section
  summarySection: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#F0FDF4",
    padding: 10,
    borderRadius: 6,
    marginBottom: 12,
    border: "1px solid #86EFAC",
  },
  summaryItem: {
    alignItems: "center",
  },
  summaryLabel: {
    fontSize: 6,
    color: "#166534",
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: 11,
    fontWeight: 700,
    color: "#15803D",
  },
  // Attendance Section
  attendanceSection: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 9,
    fontWeight: 700,
    color: "#1E293B",
    marginBottom: 6,
    textTransform: "uppercase" as const,
  },
  attendanceGrid: {
    flexDirection: "row",
    flexWrap: "wrap" as const,
    gap: 4,
  },
  attendanceMonth: {
    width: "16%",
    backgroundColor: "#F8FAFC",
    padding: 6,
    borderRadius: 4,
    border: "1px solid #E2E8F0",
    alignItems: "center",
  },
  attendanceMonthName: {
    fontSize: 6,
    color: "#64748B",
    marginBottom: 2,
  },
  attendanceValue: {
    fontSize: 8,
    fontWeight: 600,
    color: "#1E293B",
  },
  // Co-Curricular Section
  coCurricularSection: {
    marginBottom: 12,
  },
  coCurricularTable: {
    border: "1px solid #E2E8F0",
    borderRadius: 6,
    overflow: "hidden",
  },
  // Remarks Section
  remarksSection: {
    marginBottom: 12,
  },
  remarkBox: {
    backgroundColor: "#F8FAFC",
    padding: 8,
    borderRadius: 4,
    marginBottom: 6,
    border: "1px solid #E2E8F0",
  },
  remarkLabel: {
    fontSize: 6,
    color: "#64748B",
    fontWeight: 600,
    marginBottom: 3,
    textTransform: "uppercase" as const,
  },
  remarkText: {
    fontSize: 7,
    color: "#1E293B",
    lineHeight: 1.4,
  },
  // Footer
  footer: {
    marginTop: 15,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTop: "1px solid #E2E8F0",
    paddingTop: 15,
  },
  signature: {
    alignItems: "center",
  },
  signatureLine: {
    width: 120,
    borderTop: "1px solid #1E293B",
    marginBottom: 3,
  },
  signatureText: {
    fontSize: 6,
    color: "#64748B",
  },
  // Legend
  legend: {
    fontSize: 5,
    color: "#94A3B8",
    marginTop: 10,
    lineHeight: 1.3,
  },
  // Badge
  resultBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 3,
    fontSize: 7,
    fontWeight: 700,
  },
  passBadge: {
    backgroundColor: "#22C55E",
    color: "#FFFFFF",
  },
  failBadge: {
    backgroundColor: "#EF4444",
    color: "#FFFFFF",
  },
});

export const ReportCardTemplate: React.FC<ReportCardProps> = ({
  student,
  academicYear,
  terms,
  attendance,
  coCurricular,
  teacherRemarks,
  principalRemarks,
  school,
}) => {
  const overallTotal = terms.reduce((sum, t) => sum + t.totalMarks, 0);
  const overallObtained = terms.reduce((sum, t) => sum + t.obtainedMarks, 0);
  const overallPercentage = overallTotal > 0 ? ((overallObtained / overallTotal) * 100).toFixed(1) : "0";
  const allPassed = terms.every(t => t.grade !== "F");

  return (
    <Document>
      <Page size="A4" style={reportCardStyles.page}>
        {/* Header */}
        <View style={reportCardStyles.header}>
          {school.logoUrl ? (
            <Image src={school.logoUrl} style={reportCardStyles.logo} />
          ) : (
            <View style={reportCardStyles.logo}>
              <Text style={{ fontSize: 30, textAlign: "center" }}>🏫</Text>
            </View>
          )}
          <View style={reportCardStyles.schoolInfo}>
            <Text style={reportCardStyles.schoolName}>{school.name.toUpperCase()}</Text>
            <Text style={reportCardStyles.schoolAddress}>{school.address}</Text>
            <Text style={reportCardStyles.contact}>
              📞 {school.phone}  |  ✉️ {school.email}
            </Text>
          </View>
        </View>

        <Text style={reportCardStyles.reportTitle}>Progress Report Card</Text>
        <Text style={reportCardStyles.academicYear}>Academic Year: {academicYear}</Text>

        {/* Student Profile */}
        <View style={reportCardStyles.studentProfile}>
          {student.photoUrl ? (
            <Image src={student.photoUrl} style={reportCardStyles.studentPhoto} />
          ) : (
            <View style={reportCardStyles.photoPlaceholder}>
              <Text style={reportCardStyles.photoPlaceholderText}>Student Photo</Text>
            </View>
          )}
          <View style={reportCardStyles.studentDetails}>
            <Text style={reportCardStyles.studentName}>{student.name}</Text>
            <View style={reportCardStyles.detailsGrid}>
              <View style={reportCardStyles.detailItem}>
                <Text style={reportCardStyles.detailLabel}>Admission No.</Text>
                <Text style={reportCardStyles.detailValue}>{student.admissionNumber}</Text>
              </View>
              <View style={reportCardStyles.detailItem}>
                <Text style={reportCardStyles.detailLabel}>Roll Number</Text>
                <Text style={reportCardStyles.detailValue}>{student.rollNumber}</Text>
              </View>
              <View style={reportCardStyles.detailItem}>
                <Text style={reportCardStyles.detailLabel}>Class & Section</Text>
                <Text style={reportCardStyles.detailValue}>{student.className} - {student.section}</Text>
              </View>
              <View style={reportCardStyles.detailItem}>
                <Text style={reportCardStyles.detailLabel}>Date of Birth</Text>
                <Text style={reportCardStyles.detailValue}>{student.dateOfBirth}</Text>
              </View>
              <View style={reportCardStyles.detailItem}>
                <Text style={reportCardStyles.detailLabel}>Gender</Text>
                <Text style={reportCardStyles.detailValue}>{student.gender}</Text>
              </View>
              {student.bloodGroup && (
                <View style={reportCardStyles.detailItem}>
                  <Text style={reportCardStyles.detailLabel}>Blood Group</Text>
                  <Text style={reportCardStyles.detailValue}>{student.bloodGroup}</Text>
                </View>
              )}
              <View style={reportCardStyles.detailItem}>
                <Text style={reportCardStyles.detailLabel}>Guardian</Text>
                <Text style={reportCardStyles.detailValue}>{student.guardianName}</Text>
              </View>
              <View style={reportCardStyles.detailItem}>
                <Text style={reportCardStyles.detailLabel}>Contact</Text>
                <Text style={reportCardStyles.detailValue}>{student.guardianContact}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Term-wise Results */}
        {terms.map((term, termIndex) => (
          <View key={termIndex} style={reportCardStyles.termSection}>
            <View style={reportCardStyles.termHeader}>
              <Text style={reportCardStyles.termTitle}>{term.termName}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Text style={reportCardStyles.termResult}>
                  {term.obtainedMarks}/{term.totalMarks} ({term.percentage}%)
                </Text>
                <View style={[
                  reportCardStyles.resultBadge,
                  term.grade === "F" ? reportCardStyles.failBadge : reportCardStyles.passBadge
                ]}>
                  Grade: {term.grade}
                </View>
                {term.rank && (
                  <Text style={reportCardStyles.termResult}>
                    Rank: {term.rank}/{term.totalStudents}
                  </Text>
                )}
              </View>
            </View>
            <View style={reportCardStyles.marksTable}>
              {/* Table Header */}
              <View style={reportCardStyles.tableHeader}>
                <Text style={[reportCardStyles.headerCell, { width: 40 }]} fixed>Code</Text>
                <Text style={[reportCardStyles.headerCell, { flex: 2 }]} fixed>Subject</Text>
                <Text style={[reportCardStyles.headerCell, { width: 35 }]} fixed>Max</Text>
                <Text style={[reportCardStyles.headerCell, { width: 35 }]} fixed>Obt</Text>
                <Text style={[reportCardStyles.headerCell, { width: 30 }]} fixed>Grade</Text>
                <Text style={[reportCardStyles.headerCell, { width: 35 }]} fixed>GP</Text>
                <Text style={[reportCardStyles.headerCell, { flex: 1 }]} fixed>Remarks</Text>
              </View>
              {/* Table Rows */}
              {term.subjects.map((subject, subjIndex) => (
                <View
                  key={subjIndex}
                  style={subjIndex % 2 === 1 ? [reportCardStyles.tableRow, reportCardStyles.tableRowAlt] : [reportCardStyles.tableRow]}
                >
                  <Text style={[reportCardStyles.tableCell, { width: 40 }]} fixed>{subject.subjectCode}</Text>
                  <Text style={[reportCardStyles.tableCell, { flex: 2 }]} fixed>{subject.subject}</Text>
                  <Text style={[reportCardStyles.tableCell, { width: 35 }]} fixed>{subject.maxMarks}</Text>
                  <Text style={[reportCardStyles.tableCell, { width: 35 }]} fixed>{subject.obtainedMarks}</Text>
                  <Text style={[reportCardStyles.tableCell, { width: 30 }]} fixed>{subject.grade}</Text>
                  <Text style={[reportCardStyles.tableCell, { width: 35 }]} fixed>{subject.gradePoint.toFixed(1)}</Text>
                  <Text style={[reportCardStyles.tableCell, { flex: 1 }]} fixed>{subject.remarks || "-"}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}

        {/* Overall Summary */}
        <View style={reportCardStyles.summarySection}>
          <View style={reportCardStyles.summaryItem}>
            <Text style={reportCardStyles.summaryLabel}>Total Marks</Text>
            <Text style={reportCardStyles.summaryValue}>{overallObtained} / {overallTotal}</Text>
          </View>
          <View style={reportCardStyles.summaryItem}>
            <Text style={reportCardStyles.summaryLabel}>Overall %</Text>
            <Text style={reportCardStyles.summaryValue}>{overallPercentage}%</Text>
          </View>
          <View style={reportCardStyles.summaryItem}>
            <Text style={reportCardStyles.summaryLabel}>Final Result</Text>
            <Text style={[reportCardStyles.summaryValue, {
              color: allPassed ? "#15803D" : "#DC2626"
            }]}>
              {allPassed ? "PASS" : "FAIL"}
            </Text>
          </View>
        </View>

        {/* Attendance */}
        <View style={reportCardStyles.attendanceSection}>
          <Text style={reportCardStyles.sectionTitle}>Attendance Record</Text>
          <View style={reportCardStyles.attendanceGrid}>
            {attendance.map((month, index) => (
              <View key={index} style={reportCardStyles.attendanceMonth}>
                <Text style={reportCardStyles.attendanceMonthName}>{month.month}</Text>
                <Text style={reportCardStyles.attendanceValue}>
                  {month.present}/{month.total}
                </Text>
                <Text style={{ fontSize: 5, color: month.present / month.total >= 0.75 ? "#22C55E" : "#EF4444" }}>
                  {((month.present / month.total) * 100).toFixed(0)}%
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Co-Curricular Activities */}
        {coCurricular && coCurricular.length > 0 && (
          <View style={reportCardStyles.coCurricularSection}>
            <Text style={reportCardStyles.sectionTitle}>Co-Curricular Activities</Text>
            <View style={reportCardStyles.coCurricularTable}>
              {coCurricular.map((activity, index) => (
                <View key={index} style={index % 2 === 1 ? [reportCardStyles.tableRow, reportCardStyles.tableRowAlt] : [reportCardStyles.tableRow]}>
                  <Text style={[reportCardStyles.tableCell, { flex: 2 }]} fixed>{activity.activity}</Text>
                  <Text style={[reportCardStyles.tableCell, { width: 50 }]} fixed>Grade: {activity.grade}</Text>
                  <Text style={[reportCardStyles.tableCell, { flex: 2 }]} fixed>{activity.remarks || "-"}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Remarks */}
        <View style={reportCardStyles.remarksSection}>
          {teacherRemarks && (
            <View style={reportCardStyles.remarkBox}>
              <Text style={reportCardStyles.remarkLabel}>Class Teacher's Remarks</Text>
              <Text style={reportCardStyles.remarkText}>{teacherRemarks}</Text>
            </View>
          )}
          {principalRemarks && (
            <View style={reportCardStyles.remarkBox}>
              <Text style={reportCardStyles.remarkLabel}>Principal's Remarks</Text>
              <Text style={reportCardStyles.remarkText}>{principalRemarks}</Text>
            </View>
          )}
        </View>

        {/* Footer - Signatures */}
        <View style={reportCardStyles.footer}>
          <View style={reportCardStyles.signature}>
            <View style={reportCardStyles.signatureLine} />
            <Text style={reportCardStyles.signatureText}>Class Teacher</Text>
          </View>
          <View style={reportCardStyles.signature}>
            <View style={reportCardStyles.signatureLine} />
            <Text style={reportCardStyles.signatureText}>Examination In-charge</Text>
          </View>
          <View style={reportCardStyles.signature}>
            <View style={reportCardStyles.signatureLine} />
            <Text style={reportCardStyles.signatureText}>Principal</Text>
          </View>
        </View>

        {/* Legend */}
        <Text style={reportCardStyles.legend}>
          Grade Scale: A+ (90%+, GP 4.0), A (80-89%, GP 3.7), B (70-79%, GP 3.3), C (60-69%, GP 3.0), D (40-59%, GP 2.0), F (Below 40%, GP 0.0)
        </Text>
      </Page>
    </Document>
  );
};

export { reportCardStyles };
