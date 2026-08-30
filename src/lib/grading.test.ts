import { describe, it, expect } from "vitest";
import {
  calculateGradeFromPercentage,
  formatRankLabel,
  calculateClassMeritRankings,
  evaluateSubjectComponents,
  DEFAULT_GPA_BANDS,
  NCTB_GPA_BANDS,
  CBSE_9POINT_BANDS,
  FBISE_MATRIC_BANDS,
  type SubjectResult,
} from "@/lib/grading";

describe("Grading & Academic Merit Engine", () => {
  describe("calculateGradeFromPercentage", () => {
    it("assigns A+ for scores 90% and above", () => {
      const res95 = calculateGradeFromPercentage(95);
      expect(res95.letterGrade).toBe("A+");
      expect(res95.gpa).toBe(4.0);
      expect(res95.remarks).toContain("Distinction");

      const res90 = calculateGradeFromPercentage(90);
      expect(res90.letterGrade).toBe("A+");
      expect(res90.gpa).toBe(4.0);
    });

    it("assigns A for scores between 80% and 89.9%", () => {
      const res = calculateGradeFromPercentage(85);
      expect(res.letterGrade).toBe("A");
      expect(res.gpa).toBe(3.8);
    });

    it("assigns B for scores between 70% and 79.9%", () => {
      const res = calculateGradeFromPercentage(75);
      expect(res.letterGrade).toBe("B");
      expect(res.gpa).toBe(3.3);
    });

    it("assigns C for scores between 60% and 69.9%", () => {
      const res = calculateGradeFromPercentage(62);
      expect(res.letterGrade).toBe("C");
      expect(res.gpa).toBe(2.7);
    });

    it("assigns D for scores between 50% and 59.9%", () => {
      const res = calculateGradeFromPercentage(54);
      expect(res.letterGrade).toBe("D");
      expect(res.gpa).toBe(2.0);
    });

    it("assigns E for marginal scores between 40% and 49.9%", () => {
      const res = calculateGradeFromPercentage(45);
      expect(res.letterGrade).toBe("E");
      expect(res.gpa).toBe(1.0);
    });

    it("calculates CBSE 9-Point grading scale correctly", () => {
      expect(calculateGradeFromPercentage(95, "CBSE_9_POINT").letterGrade).toBe("A1");
      expect(calculateGradeFromPercentage(95, "CBSE_9_POINT").gpa).toBe(10.0);
      expect(calculateGradeFromPercentage(85, "CBSE_9_POINT").letterGrade).toBe("A2");
      expect(calculateGradeFromPercentage(35, "CBSE_9_POINT").letterGrade).toBe("D");
      expect(calculateGradeFromPercentage(25, "CBSE_9_POINT").letterGrade).toBe("E");
    });

    it("calculates Bangladesh NCTB GPA 5.0 scale correctly", () => {
      expect(calculateGradeFromPercentage(85, "NCTB_GPA_5").letterGrade).toBe("A+");
      expect(calculateGradeFromPercentage(85, "NCTB_GPA_5").gpa).toBe(5.0);
      expect(calculateGradeFromPercentage(75, "NCTB_GPA_5").letterGrade).toBe("A");
      expect(calculateGradeFromPercentage(65, "NCTB_GPA_5").letterGrade).toBe("A-");
      expect(calculateGradeFromPercentage(35, "NCTB_GPA_5").letterGrade).toBe("D");
      expect(calculateGradeFromPercentage(20, "NCTB_GPA_5").letterGrade).toBe("F");
    });

    it("calculates Pakistan FBISE Matric scale correctly", () => {
      expect(calculateGradeFromPercentage(85, "FBISE_MARKS").letterGrade).toBe("A+");
      expect(calculateGradeFromPercentage(65, "FBISE_MARKS").letterGrade).toBe("B");
      expect(calculateGradeFromPercentage(35, "FBISE_MARKS").letterGrade).toBe("E");
      expect(calculateGradeFromPercentage(30, "FBISE_MARKS").letterGrade).toBe("F");
    });
  });

  describe("formatRankLabel (Ordinal suffixes)", () => {
    it("handles first 3 ranks correctly (1st, 2nd, 3rd)", () => {
      expect(formatRankLabel(1)).toBe("1st");
      expect(formatRankLabel(2)).toBe("2nd");
      expect(formatRankLabel(3)).toBe("3rd");
      expect(formatRankLabel(4)).toBe("4th");
      expect(formatRankLabel(10)).toBe("10th");
    });

    it("correctly handles teen exceptions (11th, 12th, 13th)", () => {
      expect(formatRankLabel(11)).toBe("11th");
      expect(formatRankLabel(12)).toBe("12th");
      expect(formatRankLabel(13)).toBe("13th");
      expect(formatRankLabel(14)).toBe("14th");
    });

    it("correctly handles 20s and higher (21st, 22nd, 23rd, 101st)", () => {
      expect(formatRankLabel(21)).toBe("21st");
      expect(formatRankLabel(22)).toBe("22nd");
      expect(formatRankLabel(23)).toBe("23rd");
      expect(formatRankLabel(24)).toBe("24th");
      expect(formatRankLabel(101)).toBe("101st");
      expect(formatRankLabel(111)).toBe("111th");
      expect(formatRankLabel(112)).toBe("112th");
    });
  });

  describe("calculateClassMeritRankings", () => {
    const mockCohort = [
      {
        studentProfileId: "st-1",
        studentName: "Rahim Khan",
        rollNumber: "101",
        results: [
          { subjectName: "Math", subjectCode: "MTH", maxMarks: 100, obtainedMarks: 95 },
          { subjectName: "Science", subjectCode: "SCI", maxMarks: 100, obtainedMarks: 90 },
        ] as SubjectResult[],
      },
      {
        studentProfileId: "st-2",
        studentName: "Amina Begum",
        rollNumber: "102",
        results: [
          { subjectName: "Math", subjectCode: "MTH", maxMarks: 100, obtainedMarks: 75 },
          { subjectName: "Science", subjectCode: "SCI", maxMarks: 100, obtainedMarks: 80 },
        ] as SubjectResult[],
      },
      {
        studentProfileId: "st-3",
        studentName: "Farhan Ali",
        rollNumber: "103",
        results: [
          { subjectName: "Math", subjectCode: "MTH", maxMarks: 100, obtainedMarks: 98 },
          { subjectName: "Science", subjectCode: "SCI", maxMarks: 100, obtainedMarks: 96 },
        ] as SubjectResult[],
      },
      {
        studentProfileId: "st-4",
        studentName: "Zainab Shah",
        rollNumber: "104",
        results: [
          { subjectName: "Math", subjectCode: "MTH", maxMarks: 100, obtainedMarks: 20 },
          { subjectName: "Science", subjectCode: "SCI", maxMarks: 100, obtainedMarks: 80 },
        ] as SubjectResult[],
      },
    ];

    it("ranks students accurately in descending order of total score and percentage", () => {
      const rankings = calculateClassMeritRankings(mockCohort);
      expect(rankings).toHaveLength(4);

      // Rank 1: Farhan (97%)
      expect(rankings[0].studentName).toBe("Farhan Ali");
      expect(rankings[0].rank).toBe(1);
      expect(rankings[0].rankLabel).toBe("1st");
      expect(rankings[0].percentage).toBe(97);
      expect(rankings[0].letterGrade).toBe("A+");
      expect(rankings[0].passed).toBe(true);

      // Rank 2: Rahim (92.5%)
      expect(rankings[1].studentName).toBe("Rahim Khan");
      expect(rankings[1].rank).toBe(2);
      expect(rankings[1].rankLabel).toBe("2nd");
      expect(rankings[1].percentage).toBe(92.5);

      // Rank 3: Amina (77.5%)
      expect(rankings[2].studentName).toBe("Amina Begum");
      expect(rankings[2].rank).toBe(3);
      expect(rankings[2].rankLabel).toBe("3rd");
      expect(rankings[2].percentage).toBe(77.5);
      expect(rankings[2].letterGrade).toBe("B");

      // Rank 4: Zainab (Failed Math with 20/100 < 33%)
      expect(rankings[3].studentName).toBe("Zainab Shah");
      expect(rankings[3].rank).toBe(4);
      expect(rankings[3].passed).toBe(false);
    });

    it("handles empty results cohort gracefully", () => {
      const rankings = calculateClassMeritRankings([]);
      expect(rankings).toEqual([]);
    });

    it("uses standard competition ranking for equal percentages", () => {
      const rankings = calculateClassMeritRankings([
        { studentProfileId: "a", studentName: "A", rollNumber: "1", results: [{ subjectName: "Math", subjectCode: "M", maxMarks: 100, obtainedMarks: 92.4 }] },
        { studentProfileId: "b", studentName: "B", rollNumber: "2", results: [{ subjectName: "Math", subjectCode: "M", maxMarks: 100, obtainedMarks: 92.4 }] },
        { studentProfileId: "c", studentName: "C", rollNumber: "3", results: [{ subjectName: "Math", subjectCode: "M", maxMarks: 100, obtainedMarks: 88 }] },
      ]);
      expect(rankings.map((item) => item.rank)).toEqual([1, 1, 3]);
    });
  });

  describe("Sub-Component Pass / Fail Cascade Engine", () => {
    it("fails the whole subject when a mandatory component fails (even with high total score)", () => {
      const components = [
        { componentName: "Theory Exam", obtained: 68, max: 75, passMarks: 25, isMandatory: true },
        { componentName: "Practical Lab", obtained: 5, max: 25, passMarks: 10, isMandatory: true }, // FAILED
      ];

      const result = evaluateSubjectComponents(components, "NCTB_GPA_5");
      expect(result.passed).toBe(false);
      expect(result.letterGrade).toBe("F");
      expect(result.gpa).toBe(0.0);
      expect(result.failedComponents).toContain("Practical Lab");
      expect(result.remarks).toContain("Failed mandatory component");
    });

    it("calculates real weighted components contribution accurately", () => {
      const components = [
        // 70% weight Theory: 80/100 -> 0.8 * 70 = 56
        { componentName: "Theory Exam", obtained: 80, max: 100, passMarks: 33, weightage: 70 },
        // 30% weight Practical: 90/100 -> 0.9 * 30 = 27
        { componentName: "Practical Lab", obtained: 90, max: 100, passMarks: 33, weightage: 30 },
      ];

      // Overall: (56 + 27) / 100 * 100 = 83%
      const result = evaluateSubjectComponents(components, "CBSE_9_POINT");
      expect(result.passed).toBe(true);
      expect(result.percentage).toBe(83);
      expect(result.letterGrade).toBe("A2");
      expect(result.gpa).toBe(9.0);
      expect(result.componentResults[0].contribution).toBe(56);
      expect(result.componentResults[1].contribution).toBe(27);
    });

    it("falls back cleanly to raw marks addition when weights are omitted", () => {
      const components = [
        { componentName: "MCQ Section", obtained: 18, max: 20, passMarks: 7 },
        { componentName: "Descriptive Section", obtained: 62, max: 80, passMarks: 26 },
      ];

      // Total = 80/100 = 80%
      const result = evaluateSubjectComponents(components, "FBISE_MARKS");
      expect(result.passed).toBe(true);
      expect(result.totalObtained).toBe(80);
      expect(result.totalMax).toBe(100);
      expect(result.percentage).toBe(80);
      expect(result.letterGrade).toBe("A+");
      expect(result.gpa).toBe(4.0);
    });
  });
});
