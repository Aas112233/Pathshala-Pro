import { describe, it, expect } from "vitest";
import {
  calculateClassMeritRankings,
  calculateGradeFromPercentage,
  formatRankLabel,
} from "@/lib/grading";

describe("Examinations & Class Merit Ranking Suite", () => {
  describe("Rank Label Formatting", () => {
    it("formats 1st, 2nd, 3rd, 4th through 13th correctly", () => {
      expect(formatRankLabel(1)).toBe("1st");
      expect(formatRankLabel(2)).toBe("2nd");
      expect(formatRankLabel(3)).toBe("3rd");
      expect(formatRankLabel(4)).toBe("4th");
      expect(formatRankLabel(11)).toBe("11th");
      expect(formatRankLabel(12)).toBe("12th");
      expect(formatRankLabel(13)).toBe("13th");
      expect(formatRankLabel(21)).toBe("21st");
      expect(formatRankLabel(22)).toBe("22nd");
      expect(formatRankLabel(23)).toBe("23rd");
      expect(formatRankLabel(30)).toBe("30th");
    });
  });

  describe("Grade & GPA Mapping", () => {
    it("maps percentage ranges to correct letter grade and GPA points", () => {
      expect(calculateGradeFromPercentage(95)).toEqual({
        letterGrade: "A+",
        gpa: 4.0,
        remarks: "Outstanding / High Distinction",
      });
      expect(calculateGradeFromPercentage(85)).toEqual({
        letterGrade: "A",
        gpa: 3.8,
        remarks: "Excellent",
      });
      expect(calculateGradeFromPercentage(75)).toEqual({
        letterGrade: "B",
        gpa: 3.3,
        remarks: "Very Good",
      });
      expect(calculateGradeFromPercentage(65)).toEqual({
        letterGrade: "C",
        gpa: 2.7,
        remarks: "Good / Satisfactory",
      });
      expect(calculateGradeFromPercentage(52)).toEqual({
        letterGrade: "D",
        gpa: 2.0,
        remarks: "Pass",
      });
      expect(calculateGradeFromPercentage(44)).toEqual({
        letterGrade: "E",
        gpa: 1.0,
        remarks: "Marginal Pass",
      });
      expect(calculateGradeFromPercentage(30)).toEqual({
        letterGrade: "F",
        gpa: 0.0,
        remarks: "Needs Immediate Improvement",
      });
    });
  });

  describe("Class Merit Rankings Algorithm", () => {
    const mockCohort = [
      {
        studentProfileId: "st-1",
        studentName: "Aisha Khan",
        rollNumber: "01",
        results: [
          { subjectName: "Mathematics", subjectCode: "MTH", maxMarks: 100, obtainedMarks: 95 },
          { subjectName: "Science", subjectCode: "SCI", maxMarks: 100, obtainedMarks: 90 },
          { subjectName: "English", subjectCode: "ENG", maxMarks: 100, obtainedMarks: 85 },
        ],
      },
      {
        studentProfileId: "st-2",
        studentName: "Bilal Ahmed",
        rollNumber: "02",
        results: [
          { subjectName: "Mathematics", subjectCode: "MTH", maxMarks: 100, obtainedMarks: 70 },
          { subjectName: "Science", subjectCode: "SCI", maxMarks: 100, obtainedMarks: 65 },
          { subjectName: "English", subjectCode: "ENG", maxMarks: 100, obtainedMarks: 60 },
        ],
      },
      {
        studentProfileId: "st-3",
        studentName: "Zainab Fatima",
        rollNumber: "03",
        results: [
          { subjectName: "Mathematics", subjectCode: "MTH", maxMarks: 100, obtainedMarks: 98 },
          { subjectName: "Science", subjectCode: "SCI", maxMarks: 100, obtainedMarks: 96 },
          { subjectName: "English", subjectCode: "ENG", maxMarks: 100, obtainedMarks: 94 },
        ],
      },
    ];

    it("ranks cohort descending by total percentage and assigns 1st, 2nd, 3rd positions", () => {
      const ranked = calculateClassMeritRankings(mockCohort);

      expect(ranked.length).toBe(3);
      // Zainab (288 / 300 = 96%) should be 1st
      expect(ranked[0].studentName).toBe("Zainab Fatima");
      expect(ranked[0].rank).toBe(1);
      expect(ranked[0].rankLabel).toBe("1st");
      expect(ranked[0].percentage).toBe(96);
      expect(ranked[0].letterGrade).toBe("A+");
      expect(ranked[0].passed).toBe(true);

      // Aisha (270 / 300 = 90%) should be 2nd
      expect(ranked[1].studentName).toBe("Aisha Khan");
      expect(ranked[1].rank).toBe(2);
      expect(ranked[1].rankLabel).toBe("2nd");
      expect(ranked[1].percentage).toBe(90);

      // Bilal (195 / 300 = 65%) should be 3rd
      expect(ranked[2].studentName).toBe("Bilal Ahmed");
      expect(ranked[2].rank).toBe(3);
      expect(ranked[2].rankLabel).toBe("3rd");
      expect(ranked[2].percentage).toBe(65);
    });

    it("marks student as failed if any subject score is under 33%", () => {
      const failCohort = [
        {
          studentProfileId: "st-fail",
          studentName: "Test Student",
          rollNumber: "99",
          results: [
            { subjectName: "Math", subjectCode: "MTH", maxMarks: 100, obtainedMarks: 80 },
            { subjectName: "Science", subjectCode: "SCI", maxMarks: 100, obtainedMarks: 20 }, // Fail
          ],
        },
      ];

      const ranked = calculateClassMeritRankings(failCohort);
      expect(ranked[0].passed).toBe(false);
    });
  });
});
