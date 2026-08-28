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
  rankLabel: string;
  passed: boolean;
}

export type GradingSystemType =
  | "GPA"
  | "PERCENTAGE"
  | "LETTER"
  | "CBSE_9_POINT"
  | "NCTB_GPA_5"
  | "FBISE_MARKS";

export interface GradeBand {
  min: number;
  grade: string;
  point: number;
  remarks?: string;
}

// -------------------------------------------------------------
// 1. Standard Grade Band Presets
// -------------------------------------------------------------

export const DEFAULT_GPA_BANDS: GradeBand[] = [
  { min: 90, grade: "A+", point: 4.0, remarks: "Outstanding / High Distinction" },
  { min: 80, grade: "A", point: 3.8, remarks: "Excellent" },
  { min: 70, grade: "B", point: 3.3, remarks: "Very Good" },
  { min: 60, grade: "C", point: 2.7, remarks: "Good / Satisfactory" },
  { min: 50, grade: "D", point: 2.0, remarks: "Pass" },
  { min: 40, grade: "E", point: 1.0, remarks: "Marginal Pass" },
  { min: 0, grade: "F", point: 0.0, remarks: "Needs Immediate Improvement" },
];

export const NCTB_GPA_BANDS: GradeBand[] = [
  { min: 80, grade: "A+", point: 5.0, remarks: "Outstanding / অসাধারণ" },
  { min: 70, grade: "A", point: 4.0, remarks: "Excellent / চমৎকার" },
  { min: 60, grade: "A-", point: 3.5, remarks: "Very Good / খুব ভালো" },
  { min: 50, grade: "B", point: 3.0, remarks: "Good / ভালো" },
  { min: 40, grade: "C", point: 2.0, remarks: "Satisfactory / সন্তোষজনক" },
  { min: 33, grade: "D", point: 1.0, remarks: "Minimum Pass / সর্বনিম্ন পাস" },
  { min: 0, grade: "F", point: 0.0, remarks: "Fail / ফেল" },
];

export const CBSE_9POINT_BANDS: GradeBand[] = [
  { min: 91, grade: "A1", point: 10.0, remarks: "Top 1/8th of passed candidates / उत्कृष्ट" },
  { min: 81, grade: "A2", point: 9.0, remarks: "Excellent / बहुत अच्छा" },
  { min: 71, grade: "B1", point: 8.0, remarks: "Very Good / अच्छा" },
  { min: 61, grade: "B2", point: 7.0, remarks: "Good / औसत से ऊपर" },
  { min: 51, grade: "C1", point: 6.0, remarks: "Above Average / संतोषजनक" },
  { min: 41, grade: "C2", point: 5.0, remarks: "Average / औसत" },
  { min: 33, grade: "D", point: 4.0, remarks: "Marginal Pass / न्यूनतम उत्तीर्ण" },
  { min: 0, grade: "E", point: 0.0, remarks: "Failed / Needs Improvement / अनुत्तीर्ण" },
];

export const FBISE_MATRIC_BANDS: GradeBand[] = [
  { min: 80, grade: "A+", point: 4.0, remarks: "Outstanding / شاندار" },
  { min: 70, grade: "A", point: 3.7, remarks: "Excellent / بہت اچھا" },
  { min: 60, grade: "B", point: 3.0, remarks: "Very Good / اچھا" },
  { min: 50, grade: "C", point: 2.3, remarks: "Good / تسلی بخش" },
  { min: 40, grade: "D", point: 1.7, remarks: "Satisfactory / پاس" },
  { min: 33, grade: "E", point: 1.0, remarks: "Minimum Pass / کم از کم پاس" },
  { min: 0, grade: "F", point: 0.0, remarks: "Fail / فیل" },
];

// -------------------------------------------------------------
// 2. Grade Lookup Helpers
// -------------------------------------------------------------

export function getGradeFromBands(
  percentage: number,
  bands: GradeBand[] = DEFAULT_GPA_BANDS
): { letterGrade: string; gpa: number; remarks: string } {
  const rounded = Math.round(percentage * 100) / 100;
  for (const band of bands) {
    if (rounded >= band.min) {
      return {
        letterGrade: band.grade,
        gpa: band.point,
        remarks: band.remarks ?? "",
      };
    }
  }
  const last = bands[bands.length - 1];
  return {
    letterGrade: last.grade,
    gpa: last.point,
    remarks: last.remarks ?? "",
  };
}

export function calculateFbiseGrade(percentage: number) {
  return getGradeFromBands(percentage, FBISE_MATRIC_BANDS);
}

export function calculateCbseGrade(percentage: number) {
  return getGradeFromBands(percentage, CBSE_9POINT_BANDS);
}

export function calculateNctbGrade(percentage: number) {
  return getGradeFromBands(percentage, NCTB_GPA_BANDS);
}

export function calculateGradeFromPercentage(
  percentage: number,
  gradingSystem: GradingSystemType = "GPA"
): { letterGrade: string; gpa: number; remarks: string } {
  if (gradingSystem === "CBSE_9_POINT") return calculateCbseGrade(percentage);
  if (gradingSystem === "NCTB_GPA_5") return calculateNctbGrade(percentage);
  if (gradingSystem === "FBISE_MARKS") return calculateFbiseGrade(percentage);
  return getGradeFromBands(percentage, DEFAULT_GPA_BANDS);
}

// -------------------------------------------------------------
// 3. Sub-Component Pass / Fail Cascade Engine
// -------------------------------------------------------------

export interface SubjectComponentInput {
  componentName: string; // e.g. "Theory", "Practical", "MCQ", "Assignment"
  obtained: number;
  max: number;
  passMarks: number;
  isMandatory?: boolean; // Default true
  weightage?: number;    // e.g. 70 for 70%
}

export interface ComponentEvaluationResult {
  componentName: string;
  obtained: number;
  max: number;
  passMarks: number;
  percentage: number;
  contribution: number;
  passed: boolean;
  isMandatory: boolean;
}

export interface SubjectEvaluationResult {
  totalMax: number;
  totalObtained: number;
  percentage: number;
  letterGrade: string;
  gpa: number;
  remarks: string;
  passed: boolean;
  failedComponents: string[];
  componentResults: ComponentEvaluationResult[];
}

/**
 * Evaluates subject components with mandatory pass cascades and weighted contributions.
 *
 * Rules:
 * 1. Each component must meet its passMarks (if mandatory).
 * 2. If any mandatory component fails -> Subject grade is F / 0.0 GPA.
 * 3. If weightage is supplied, contribution = (obtained / max) * weightage.
 * 4. Otherwise, sums raw obtained and max marks.
 */
export function evaluateSubjectComponents(
  components: SubjectComponentInput[],
  gradingSystemOrBands: GradingSystemType | GradeBand[] = "GPA"
): SubjectEvaluationResult {
  if (!components || components.length === 0) {
    return {
      totalMax: 0,
      totalObtained: 0,
      percentage: 0,
      letterGrade: "F",
      gpa: 0,
      remarks: "No components provided",
      passed: false,
      failedComponents: [],
      componentResults: [],
    };
  }

  const failedComponents: string[] = [];
  const evaluatedComponents: ComponentEvaluationResult[] = [];
  let hasWeights = true;
  let totalRawMax = 0;
  let totalRawObtained = 0;
  let totalWeightedContribution = 0;
  let totalWeightage = 0;

  for (const comp of components) {
    const isMandatory = comp.isMandatory !== false;
    const isPassed = comp.obtained >= comp.passMarks;
    const compPercentage = comp.max > 0 ? (comp.obtained / comp.max) * 100 : 0;

    let contribution: number;
    if (typeof comp.weightage === "number" && comp.weightage > 0) {
      contribution = comp.max > 0 ? (comp.obtained / comp.max) * comp.weightage : 0;
      totalWeightedContribution += contribution;
      totalWeightage += comp.weightage;
    } else {
      hasWeights = false;
      contribution = comp.obtained;
    }

    totalRawMax += comp.max;
    totalRawObtained += comp.obtained;

    if (isMandatory && !isPassed) {
      failedComponents.push(comp.componentName);
    }

    evaluatedComponents.push({
      componentName: comp.componentName,
      obtained: comp.obtained,
      max: comp.max,
      passMarks: comp.passMarks,
      percentage: Number(compPercentage.toFixed(2)),
      contribution: Number(contribution.toFixed(2)),
      passed: isPassed,
      isMandatory,
    });
  }

  // Calculate final percentage
  let overallPercentage = 0;
  if (hasWeights && totalWeightage > 0) {
    overallPercentage = (totalWeightedContribution / totalWeightage) * 100;
  } else if (totalRawMax > 0) {
    overallPercentage = (totalRawObtained / totalRawMax) * 100;
  }
  overallPercentage = Number(overallPercentage.toFixed(2));

  // Determine active grade bands
  let activeBands: GradeBand[];
  if (Array.isArray(gradingSystemOrBands)) {
    activeBands = gradingSystemOrBands;
  } else if (gradingSystemOrBands === "CBSE_9_POINT") {
    activeBands = CBSE_9POINT_BANDS;
  } else if (gradingSystemOrBands === "NCTB_GPA_5") {
    activeBands = NCTB_GPA_BANDS;
  } else if (gradingSystemOrBands === "FBISE_MARKS") {
    activeBands = FBISE_MATRIC_BANDS;
  } else {
    activeBands = DEFAULT_GPA_BANDS;
  }

  const isFailedByCascade = failedComponents.length > 0;
  const isFailedOverall = isFailedByCascade || overallPercentage < (activeBands[activeBands.length - 2]?.min ?? 33);

  if (isFailedByCascade) {
    const failingBand = activeBands[activeBands.length - 1];
    return {
      totalMax: totalRawMax,
      totalObtained: totalRawObtained,
      percentage: overallPercentage,
      letterGrade: failingBand.grade,
      gpa: failingBand.point,
      remarks: `Failed mandatory component(s): ${failedComponents.join(", ")}`,
      passed: false,
      failedComponents,
      componentResults: evaluatedComponents,
    };
  }

  const gradeInfo = getGradeFromBands(overallPercentage, activeBands);

  return {
    totalMax: totalRawMax,
    totalObtained: totalRawObtained,
    percentage: overallPercentage,
    letterGrade: gradeInfo.letterGrade,
    gpa: gradeInfo.gpa,
    remarks: gradeInfo.remarks,
    passed: !isFailedOverall,
    failedComponents,
    componentResults: evaluatedComponents,
  };
}

// -------------------------------------------------------------
// 4. Cohort Merit Ranking Generator
// -------------------------------------------------------------

export function formatRankLabel(rank: number): string {
  const j = rank % 10;
  const k = rank % 100;
  if (j === 1 && k !== 11) return `${rank}st`;
  if (j === 2 && k !== 12) return `${rank}nd`;
  if (j === 3 && k !== 13) return `${rank}rd`;
  return `${rank}th`;
}

export function calculateClassMeritRankings(
  studentsData: Array<{
    studentProfileId: string;
    studentName: string;
    rollNumber: string;
    results: SubjectResult[];
  }>,
  gradingSystem: GradingSystemType = "GPA"
): StudentMeritRank[] {
  const scored = studentsData.map((st) => {
    const totalMax = st.results.reduce((acc, r) => acc + r.maxMarks, 0);
    const totalObtained = st.results.reduce((acc, r) => acc + r.obtainedMarks, 0);
    const percentage = totalMax > 0 ? Number(((totalObtained / totalMax) * 100).toFixed(2)) : 0;
    const { letterGrade, gpa } = calculateGradeFromPercentage(percentage, gradingSystem);
    const passed = !st.results.some((r) => r.maxMarks > 0 && r.obtainedMarks / r.maxMarks < 0.33);

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

  scored.sort((a, b) => b.percentage - a.percentage);

  scored.forEach((item, idx) => {
    item.rank = idx + 1;
    item.rankLabel = formatRankLabel(idx + 1);
  });

  return scored;
}
