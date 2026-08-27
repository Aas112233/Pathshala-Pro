export interface SubjectResult {
  subjectName: string;
  subjectCode: string;
  maxMarks: number;
  obtainedMarks: number;
  grade?: string;
  gradePoint?: number;
  remarks?: string;
}

export interface StudentMeritRank {
  studentProfileId: string;
  studentName: string;
  rollNumber: string;
  totalMaxMarks: number;
  totalObtainedMarks: number;
  percentage: number;
  gpa: number;
  letterGrade: string;
  rank: number;
  rankLabel: string; // e.g. "1st", "2nd", "3rd", "4th"
  passed: boolean;
}

/**
 * Calculates letter grade and GPA points from percentage
 */
export function calculateGradeFromPercentage(
  percentage: number,
  gradingSystem: "GPA" | "PERCENTAGE" | "LETTER" = "GPA"
): { letterGrade: string; gpa: number; remarks: string } {
  if (percentage >= 90) return { letterGrade: "A+", gpa: 4.0, remarks: "Outstanding / High Distinction" };
  if (percentage >= 80) return { letterGrade: "A", gpa: 3.8, remarks: "Excellent" };
  if (percentage >= 70) return { letterGrade: "B", gpa: 3.3, remarks: "Very Good" };
  if (percentage >= 60) return { letterGrade: "C", gpa: 2.7, remarks: "Good / Satisfactory" };
  if (percentage >= 50) return { letterGrade: "D", gpa: 2.0, remarks: "Pass" };
  if (percentage >= 40) return { letterGrade: "E", gpa: 1.0, remarks: "Marginal Pass" };
  return { letterGrade: "F", gpa: 0.0, remarks: "Needs Immediate Improvement" };
}

/**
 * Calculates merit rank suffix (1st, 2nd, 3rd, 4th...)
 */
export function formatRankLabel(rank: number): string {
  const j = rank % 10;
  const k = rank % 100;
  if (j === 1 && k !== 11) return `${rank}st`;
  if (j === 2 && k !== 12) return `${rank}nd`;
  if (j === 3 && k !== 13) return `${rank}rd`;
  return `${rank}th`;
}

/**
 * Takes raw exam results for a cohort/class and calculates merit ranking positions
 */
export function calculateClassMeritRankings(
  studentsData: Array<{
    studentProfileId: string;
    studentName: string;
    rollNumber: string;
    results: SubjectResult[];
  }>
): StudentMeritRank[] {
  const scored = studentsData.map((st) => {
    const totalMax = st.results.reduce((acc, r) => acc + r.maxMarks, 0);
    const totalObtained = st.results.reduce((acc, r) => acc + r.obtainedMarks, 0);
    const percentage = totalMax > 0 ? Number(((totalObtained / totalMax) * 100).toFixed(2)) : 0;
    const { letterGrade, gpa } = calculateGradeFromPercentage(percentage);
    const passed = !st.results.some((r) => r.maxMarks > 0 && (r.obtainedMarks / r.maxMarks) < 0.33);

    return {
      studentProfileId: st.studentProfileId,
      studentName: st.studentName,
      rollNumber: st.rollNumber,
      totalMaxMarks: totalMax,
      totalObtainedMarks: totalObtained,
      percentage,
      gpa,
      letterGrade,
      passed,
      rank: 0,
      rankLabel: "",
    };
  });

  // Sort descending by percentage
  scored.sort((a, b) => b.percentage - a.percentage);

  // Assign ranks
  scored.forEach((item, idx) => {
    item.rank = idx + 1;
    item.rankLabel = formatRankLabel(idx + 1);
  });

  return scored;
}
