import { describe, it, expect } from "vitest";
import { calculateStudentPerformanceInsights } from "@/lib/student-performance";

describe("Student 360-Degree Performance Analytics Engine", () => {
  const mockStudent = {
    id: "stu-1",
    studentId: "STD-2025-001",
    rollNumber: "C1-R1",
    firstName: "Rahim",
    lastName: "Hassan",
    class: { id: "cls-1", name: "Class 1", classNumber: 1 },
    section: { id: "sec-1", name: "Section A" },
    admissionDate: new Date("2025-01-01"),
    status: "ACTIVE",
  };

  const mockAcademicYear = {
    id: "ay-2025",
    label: "2025-2026 Academic Session",
  };

  const mockExamResults = [
    {
      id: "er-1",
      examId: "exam-1",
      examTitle: "Term 1 Final Examination",
      term: "Term 1",
      subjectId: "sub-math",
      subjectName: "Mathematics",
      subjectCode: "MATH101",
      obtainedMarks: 92,
      maxMarks: 100,
    },
    {
      id: "er-2",
      examId: "exam-1",
      examTitle: "Term 1 Final Examination",
      term: "Term 1",
      subjectId: "sub-eng",
      subjectName: "English Literature",
      subjectCode: "ENG101",
      obtainedMarks: 85,
      maxMarks: 100,
    },
    {
      id: "er-3",
      examId: "exam-1",
      examTitle: "Term 1 Final Examination",
      term: "Term 1",
      subjectId: "sub-sci",
      subjectName: "General Science",
      subjectCode: "SCI101",
      obtainedMarks: 78,
      maxMarks: 100,
    },
  ];

  const mockClassmates = [
    {
      studentProfileId: "stu-1",
      studentName: "Rahim Hassan",
      rollNumber: "C1-R1",
      results: [
        { subjectName: "Mathematics", subjectCode: "MATH101", maxMarks: 100, obtainedMarks: 92 },
        { subjectName: "English Literature", subjectCode: "ENG101", maxMarks: 100, obtainedMarks: 85 },
        { subjectName: "General Science", subjectCode: "SCI101", maxMarks: 100, obtainedMarks: 78 },
      ],
    },
    {
      studentProfileId: "stu-2",
      studentName: "Karim Uddin",
      rollNumber: "C1-R2",
      results: [
        { subjectName: "Mathematics", subjectCode: "MATH101", maxMarks: 100, obtainedMarks: 70 },
        { subjectName: "English Literature", subjectCode: "ENG101", maxMarks: 100, obtainedMarks: 65 },
        { subjectName: "General Science", subjectCode: "SCI101", maxMarks: 100, obtainedMarks: 60 },
      ],
    },
  ];

  const mockAttendances = [
    { status: "PRESENT" },
    { status: "PRESENT" },
    { status: "PRESENT" },
    { status: "LATE" },
    { status: "ABSENT" },
  ];

  const mockHomework = [
    { isLate: false, marksObtained: 10, maxMarks: 10 },
    { isLate: false, marksObtained: 9, maxMarks: 10 },
    { isLate: true, marksObtained: 8, maxMarks: 10 },
  ];

  it("computes cumulative academic summary with accurate GPA and letter grade", () => {
    const perf = calculateStudentPerformanceInsights({
      student: mockStudent,
      academicYear: mockAcademicYear,
      examResults: mockExamResults,
      classmateResults: mockClassmates,
      attendances: mockAttendances,
      homeworkSubmissions: mockHomework,
      totalClassHomeworkCount: 4,
      gradingSystem: "GPA",
    });

    expect(perf.student.studentId).toBe("STD-2025-001");
    expect(perf.metrics.overallPercentage).toBe(85);
    expect(perf.metrics.letterGrade).toBe("A");
    expect(perf.metrics.meritRank).toBe(1);
    expect(perf.metrics.meritRankLabel).toBe("1st");
    expect(perf.metrics.totalSubjectsPassed).toBe(3);
    expect(perf.metrics.totalSubjectsFailed).toBe(0);
  });

  it("breaks down subject mastery and compares with class average", () => {
    const perf = calculateStudentPerformanceInsights({
      student: mockStudent,
      academicYear: mockAcademicYear,
      examResults: mockExamResults,
      classmateResults: mockClassmates,
      attendances: mockAttendances,
      homeworkSubmissions: mockHomework,
    });

    expect(perf.subjectMastery).toHaveLength(3);
    const math = perf.subjectMastery.find((s) => s.subjectName === "Mathematics");
    expect(math).toBeDefined();
    expect(math?.percentage).toBe(92);
    expect(math?.letterGrade).toBe("A+");
    expect(math?.masteryLevel).toBe("EXCELLENT");
    expect(math?.classAveragePercentage).toBe(81); // (92 + 70) / 2
  });

  it("calculates attendance rate and punctuality statistics", () => {
    const perf = calculateStudentPerformanceInsights({
      student: mockStudent,
      academicYear: mockAcademicYear,
      examResults: mockExamResults,
      classmateResults: mockClassmates,
      attendances: mockAttendances,
      homeworkSubmissions: mockHomework,
    });

    expect(perf.attendance.totalDays).toBe(5);
    expect(perf.attendance.presentDays).toBe(3);
    expect(perf.attendance.lateDays).toBe(1);
    expect(perf.attendance.absentDays).toBe(1);
    // (3 present + 0.5 late) / 5 = 3.5 / 5 = 70%
    expect(perf.attendance.attendanceRate).toBe(70);
    expect(perf.attendance.status).toBe("AVERAGE");
  });

  it("detects strengths and generates actionable academic guidance", () => {
    const perf = calculateStudentPerformanceInsights({
      student: mockStudent,
      academicYear: mockAcademicYear,
      examResults: mockExamResults,
      classmateResults: mockClassmates,
      attendances: mockAttendances,
      homeworkSubmissions: mockHomework,
    });

    expect(perf.insights.strengths.length).toBeGreaterThan(0);
    expect(perf.insights.strengths[0]).toContain("Mathematics");
    expect(perf.insights.actionableRecommendations.length).toBeGreaterThan(0);
  });
});
