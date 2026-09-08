import { safePercentage } from "@/lib/math-utils";
import {
  calculateGradeFromPercentage,
  calculateClassMeritRankings,
  formatRankLabel,
  GradingSystemType,
  SubjectResult,
} from "@/lib/grading";

export interface StudentPerformanceOverview {
  student: {
    id: string;
    studentId: string;
    rollNumber: string;
    firstName: string;
    lastName: string;
    firstNameBn?: string | null;
    lastNameBn?: string | null;
    gender?: string | null;
    avatarUrl?: string | null;
    className: string;
    classNumber?: number;
    sectionName?: string;
    groupName?: string;
    admissionDate: Date | string;
    status: string;
  };
  academicYear: {
    id: string;
    label: string;
  };
  metrics: {
    cumulativeGpa: number;
    maxGpa: number;
    overallPercentage: number;
    letterGrade: string;
    remarks: string;
    meritRank: number;
    meritRankLabel: string;
    totalClassStudents: number;
    percentile: number;
    totalExamsTaken: number;
    totalSubjectsPassed: number;
    totalSubjectsFailed: number;
  };
  attendance: {
    totalDays: number;
    presentDays: number;
    absentDays: number;
    lateDays: number;
    excusedDays: number;
    attendanceRate: number;
    punctualityRate: number;
    status: "EXCELLENT" | "GOOD" | "AVERAGE" | "POOR";
  };
  homework: {
    totalAssigned: number;
    submittedCount: number;
    onTimeCount: number;
    completionRate: number;
    averageScorePercentage: number;
  };
  subjectMastery: Array<{
    subjectId: string;
    subjectName: string;
    subjectCode: string;
    obtainedMarks: number;
    maxMarks: number;
    percentage: number;
    letterGrade: string;
    gradePoint: number;
    classAveragePercentage: number;
    masteryLevel: "EXCELLENT" | "PROFICIENT" | "DEVELOPING" | "NEEDS_SUPPORT";
    trend: "IMPROVING" | "STABLE" | "DECLINING";
  }>;
  examProgression: Array<{
    examId: string;
    examTitle: string;
    examType: string;
    term?: string;
    examDate?: Date | string;
    totalMarksObtained: number;
    totalMaxMarks: number;
    percentage: number;
    gpa: number;
    letterGrade: string;
    rankInExam: number;
  }>;
  insights: {
    strengths: string[];
    focusAreas: string[];
    actionableRecommendations: string[];
    riskLevel: "LOW" | "MODERATE" | "HIGH";
  };
}

/**
 * Compute 360-degree performance insights for a single student
 */
export function calculateStudentPerformanceInsights(params: {
  student: {
    id: string;
    studentId: string;
    rollNumber: string;
    firstName: string;
    lastName: string;
    firstNameBn?: string | null;
    lastNameBn?: string | null;
    gender?: string | null;
    avatarUrl?: string | null;
    class?: { id: string; name: string; classNumber?: number } | null;
    section?: { id: string; name: string } | null;
    group?: { id: string; name: string } | null;
    admissionDate: Date | string;
    status: string;
  };
  academicYear: {
    id: string;
    label: string;
  };
  examResults: Array<{
    id: string;
    examId: string;
    examTitle?: string;
    examType?: string;
    examDate?: Date | string;
    term?: string;
    subjectId: string;
    subjectName: string;
    subjectCode: string;
    obtainedMarks: number;
    maxMarks: number;
  }>;
  classmateResults: Array<{
    studentProfileId: string;
    studentName: string;
    rollNumber: string;
    results: SubjectResult[];
  }>;
  attendances: Array<{
    status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED" | string;
  }>;
  homeworkSubmissions: Array<{
    status?: string;
    isLate?: boolean;
    marksObtained?: number | null;
    maxMarks?: number | null;
  }>;
  totalClassHomeworkCount?: number;
  gradingSystem?: GradingSystemType;
}): StudentPerformanceOverview {
  const {
    student,
    academicYear,
    examResults,
    classmateResults,
    attendances,
    homeworkSubmissions,
    totalClassHomeworkCount = 0,
    gradingSystem = "GPA",
  } = params;

  // 1. Group Exam Results by Subject
  const subjectMap = new Map<
    string,
    {
      subjectName: string;
      subjectCode: string;
      totalObtained: number;
      totalMax: number;
      records: Array<{ obtained: number; max: number }>;
    }
  >();

  examResults.forEach((res) => {
    const existing = subjectMap.get(res.subjectId) || {
      subjectName: res.subjectName || "Subject",
      subjectCode: res.subjectCode || "SUB",
      totalObtained: 0,
      totalMax: 0,
      records: [],
    };
    existing.totalObtained += res.obtainedMarks;
    existing.totalMax += res.maxMarks;
    existing.records.push({ obtained: res.obtainedMarks, max: res.maxMarks });
    subjectMap.set(res.subjectId, existing);
  });

  // Calculate Class-wide subject averages from classmateResults
  const classSubjectAverages = new Map<string, { totalPct: number; count: number }>();
  classmateResults.forEach((cm) => {
    cm.results.forEach((r) => {
      const pct = safePercentage(r.obtainedMarks, r.maxMarks);
      const curr = classSubjectAverages.get(r.subjectName) || { totalPct: 0, count: 0 };
      curr.totalPct += pct;
      curr.count += 1;
      classSubjectAverages.set(r.subjectName, curr);
    });
  });

  let totalStudentObtained = 0;
  let totalStudentMax = 0;
  let subjectsPassed = 0;
  let subjectsFailed = 0;

  const subjectMastery: StudentPerformanceOverview["subjectMastery"] = [];

  subjectMap.forEach((sub, subjectId) => {
    const percentage = safePercentage(sub.totalObtained, sub.totalMax);
    const gradeInfo = calculateGradeFromPercentage(percentage, gradingSystem);

    totalStudentObtained += sub.totalObtained;
    totalStudentMax += sub.totalMax;

    if (percentage >= 33) {
      subjectsPassed += 1;
    } else {
      subjectsFailed += 1;
    }

    const classAvgData = classSubjectAverages.get(sub.subjectName);
    const classAvgPct = classAvgData && classAvgData.count > 0
      ? Math.round((classAvgData.totalPct / classAvgData.count) * 10) / 10
      : percentage;

    let masteryLevel: StudentPerformanceOverview["subjectMastery"][0]["masteryLevel"] = "DEVELOPING";
    if (percentage >= 80) masteryLevel = "EXCELLENT";
    else if (percentage >= 60) masteryLevel = "PROFICIENT";
    else if (percentage >= 40) masteryLevel = "DEVELOPING";
    else masteryLevel = "NEEDS_SUPPORT";

    // Check trend across sequential assessments
    let trend: "IMPROVING" | "STABLE" | "DECLINING" = "STABLE";
    if (sub.records.length >= 2) {
      const first = safePercentage(sub.records[0].obtained, sub.records[0].max);
      const last = safePercentage(sub.records[sub.records.length - 1].obtained, sub.records[sub.records.length - 1].max);
      if (last - first >= 5) trend = "IMPROVING";
      else if (first - last >= 5) trend = "DECLINING";
    }

    subjectMastery.push({
      subjectId,
      subjectName: sub.subjectName,
      subjectCode: sub.subjectCode,
      obtainedMarks: Math.round(sub.totalObtained * 100) / 100,
      maxMarks: Math.round(sub.totalMax * 100) / 100,
      percentage,
      letterGrade: gradeInfo.letterGrade,
      gradePoint: gradeInfo.gpa,
      classAveragePercentage: classAvgPct,
      masteryLevel,
      trend,
    });
  });

  // Sort subjects by percentage descending
  subjectMastery.sort((a, b) => b.percentage - a.percentage);

  // 2. Exam Progression & Term Progression
  const examGroups = new Map<
    string,
    {
      examTitle: string;
      examType: string;
      term?: string;
      examDate?: Date | string;
      obtained: number;
      max: number;
    }
  >();

  examResults.forEach((r) => {
    const key = r.examId || r.examTitle || "General Exam";
    const curr = examGroups.get(key) || {
      examTitle: r.examTitle || "Assessment",
      examType: r.examType || "TERM",
      term: r.term,
      examDate: r.examDate,
      obtained: 0,
      max: 0,
    };
    curr.obtained += r.obtainedMarks;
    curr.max += r.maxMarks;
    examGroups.set(key, curr);
  });

  const examProgression: StudentPerformanceOverview["examProgression"] = [];
  let examIndex = 1;
  examGroups.forEach((eg, examId) => {
    const pct = safePercentage(eg.obtained, eg.max);
    const gr = calculateGradeFromPercentage(pct, gradingSystem);
    examProgression.push({
      examId,
      examTitle: eg.examTitle,
      examType: eg.examType,
      term: eg.term || `Term ${examIndex}`,
      examDate: eg.examDate,
      totalMarksObtained: Math.round(eg.obtained * 100) / 100,
      totalMaxMarks: Math.round(eg.max * 100) / 100,
      percentage: pct,
      gpa: gr.gpa,
      letterGrade: gr.letterGrade,
      rankInExam: 1, // Normalized
    });
    examIndex++;
  });

  // 3. Class Merit Rank Calculation
  const rankings = calculateClassMeritRankings(classmateResults, gradingSystem);
  const myRank = rankings.find((r) => r.studentProfileId === student.id);
  const totalClassStudents = Math.max(rankings.length, 1);
  const studentRank = myRank ? myRank.rank : 1;
  const meritRankLabel = myRank ? myRank.rankLabel : formatRankLabel(studentRank);
  const percentile = totalClassStudents > 1
    ? Math.round(((totalClassStudents - studentRank) / (totalClassStudents - 1)) * 100)
    : 100;

  const overallPercentage = safePercentage(totalStudentObtained, totalStudentMax);
  const overallGrade = calculateGradeFromPercentage(overallPercentage, gradingSystem);
  const cumulativeGpa = overallGrade.gpa;

  // 4. Attendance Statistics
  const totalDays = attendances.length;
  const presentDays = attendances.filter((a) => a.status === "PRESENT").length;
  const absentDays = attendances.filter((a) => a.status === "ABSENT").length;
  const lateDays = attendances.filter((a) => a.status === "LATE").length;
  const excusedDays = attendances.filter((a) => a.status === "EXCUSED").length;
  const attendanceRate = safePercentage(presentDays + (lateDays * 0.5) + excusedDays, totalDays);
  const punctualityRate = safePercentage(presentDays, Math.max(presentDays + lateDays, 1));

  let attStatus: StudentPerformanceOverview["attendance"]["status"] = "GOOD";
  if (attendanceRate >= 90) attStatus = "EXCELLENT";
  else if (attendanceRate >= 75) attStatus = "GOOD";
  else if (attendanceRate >= 60) attStatus = "AVERAGE";
  else attStatus = "POOR";

  // 5. Homework & Engagement Statistics
  const totalAssigned = Math.max(totalClassHomeworkCount, homeworkSubmissions.length);
  const submittedCount = homeworkSubmissions.length;
  const onTimeCount = homeworkSubmissions.filter((h) => !h.isLate).length;
  const completionRate = safePercentage(submittedCount, totalAssigned);

  let hwMarksSum = 0;
  let hwMaxSum = 0;
  homeworkSubmissions.forEach((h) => {
    if (typeof h.marksObtained === "number" && typeof h.maxMarks === "number" && h.maxMarks > 0) {
      hwMarksSum += h.marksObtained;
      hwMaxSum += h.maxMarks;
    }
  });
  const averageHwScore = hwMaxSum > 0 ? safePercentage(hwMarksSum, hwMaxSum) : 85;

  // 6. Strengths, Focus Areas & Automated Recommendations
  const strengths = subjectMastery
    .filter((s) => s.percentage >= 70)
    .slice(0, 3)
    .map((s) => `${s.subjectName} (${s.percentage}%) - ${s.letterGrade}`);

  const focusAreas = subjectMastery
    .filter((s) => s.percentage < 55)
    .map((s) => `${s.subjectName} (${s.percentage}%) - Requires Practice`);

  const recommendations: string[] = [];
  if (attendanceRate < 75) {
    recommendations.push("Attendance is below institutional 75% threshold. Recommend parental counseling and regular tracking.");
  }
  if (focusAreas.length > 0) {
    recommendations.push(`Provide remedial support and weekly tutorials for: ${focusAreas.join(", ")}.`);
  }
  if (completionRate < 80) {
    recommendations.push("Encourage structured homework habits to boost assignment completion rate.");
  }
  if (strengths.length > 0 && focusAreas.length === 0) {
    recommendations.push("Excellent consistent performance across curriculum. Eligible for advanced academic challenges and honors.");
  }
  if (recommendations.length === 0) {
    recommendations.push("Steady academic progress. Continue regular revision and subject participation.");
  }

  let riskLevel: "LOW" | "MODERATE" | "HIGH" = "LOW";
  if (subjectsFailed >= 2 || overallPercentage < 40 || attendanceRate < 60) {
    riskLevel = "HIGH";
  } else if (subjectsFailed === 1 || overallPercentage < 55 || attendanceRate < 75) {
    riskLevel = "MODERATE";
  }

  return {
    student: {
      id: student.id,
      studentId: student.studentId,
      rollNumber: student.rollNumber,
      firstName: student.firstName,
      lastName: student.lastName,
      firstNameBn: student.firstNameBn,
      lastNameBn: student.lastNameBn,
      gender: student.gender,
      avatarUrl: student.avatarUrl,
      className: student.class?.name || "General Class",
      classNumber: student.class?.classNumber,
      sectionName: student.section?.name,
      groupName: student.group?.name,
      admissionDate: student.admissionDate,
      status: student.status,
    },
    academicYear,
    metrics: {
      cumulativeGpa,
      maxGpa: gradingSystem === "NCTB_GPA_5" ? 5.0 : 4.0,
      overallPercentage,
      letterGrade: overallGrade.letterGrade,
      remarks: overallGrade.remarks || "Good Progress",
      meritRank: studentRank,
      meritRankLabel,
      totalClassStudents,
      percentile,
      totalExamsTaken: examProgression.length,
      totalSubjectsPassed: subjectsPassed,
      totalSubjectsFailed: subjectsFailed,
    },
    attendance: {
      totalDays,
      presentDays,
      absentDays,
      lateDays,
      excusedDays,
      attendanceRate,
      punctualityRate,
      status: attStatus,
    },
    homework: {
      totalAssigned,
      submittedCount,
      onTimeCount,
      completionRate,
      averageScorePercentage: averageHwScore,
    },
    subjectMastery,
    examProgression,
    insights: {
      strengths: strengths.length > 0 ? strengths : ["Broad foundation across subjects"],
      focusAreas: focusAreas.length > 0 ? focusAreas : ["None detected — consistent performance"],
      actionableRecommendations: recommendations,
      riskLevel,
    },
  };
}
