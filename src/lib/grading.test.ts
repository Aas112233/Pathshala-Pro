import { describe, it, expect } from "vitest";
import {
  calculateGradeFromPercentage,
  formatRankLabel,
  calculateClassMeritRankings,
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

    it("assigns F for failing scores under 40%", () => {
      const res = calculateGradeFromPercentage(35);
      expect(res.letterGrade).toBe("F");
      expect(res.gpa).toBe(0.0);
      expect(res.remarks).toContain("Improvement");
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
  });
});
