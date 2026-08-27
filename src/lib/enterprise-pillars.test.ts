import { describe, it, expect } from "vitest";
import { batchFeeInvoicingSchema } from "@/lib/schemas";
import {
  calculateGradeFromPercentage,
  formatRankLabel,
  calculateClassMeritRankings,
} from "@/lib/grading";

describe("Enterprise Pillars & Enhancements", () => {
  describe("Pillar 1: Batch Fee Invoicing Schema", () => {
    it("validates valid batch fee invoicing payload", () => {
      const payload = {
        academicYearId: "ay-2026",
        feeType: "TUITION",
        dueDate: "2026-09-15",
        baseAmount: 4500,
        target: "CLASS",
        classId: "class-10",
        carryForwardArrears: true,
      };

      const result = batchFeeInvoicingSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it("rejects negative fee amounts", () => {
      const invalid = {
        academicYearId: "ay-2026",
        dueDate: "2026-09-15",
        baseAmount: -100,
      };

      const result = batchFeeInvoicingSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe("Pillar 2 & 3: Academic Grading & Merit Ranking Engine", () => {
    it("computes letter grades and GPAs correctly", () => {
      expect(calculateGradeFromPercentage(95)).toEqual({
        letterGrade: "A+",
        gpa: 4.0,
        remarks: "Outstanding / High Distinction",
      });
      expect(calculateGradeFromPercentage(85).letterGrade).toBe("A");
      expect(calculateGradeFromPercentage(72).letterGrade).toBe("B");
      expect(calculateGradeFromPercentage(55).letterGrade).toBe("D");
      expect(calculateGradeFromPercentage(30).letterGrade).toBe("F");
    });

    it("formats rank labels with appropriate ordinal suffixes", () => {
      expect(formatRankLabel(1)).toBe("1st");
      expect(formatRankLabel(2)).toBe("2nd");
      expect(formatRankLabel(3)).toBe("3rd");
      expect(formatRankLabel(4)).toBe("4th");
      expect(formatRankLabel(11)).toBe("11th");
      expect(formatRankLabel(21)).toBe("21st");
      expect(formatRankLabel(22)).toBe("22nd");
      expect(formatRankLabel(23)).toBe("23rd");
    });

    it("accurately sorts and ranks a class cohort by merit percentage", () => {
      const studentsCohort = [
        {
          studentProfileId: "st-1",
          studentName: "Ali Khan",
          rollNumber: "101",
          results: [
            { subjectName: "Math", subjectCode: "MTH", maxMarks: 100, obtainedMarks: 80 },
            { subjectName: "English", subjectCode: "ENG", maxMarks: 100, obtainedMarks: 75 },
          ],
        },
        {
          studentProfileId: "st-2",
          studentName: "Sara Ahmed",
          rollNumber: "102",
          results: [
            { subjectName: "Math", subjectCode: "MTH", maxMarks: 100, obtainedMarks: 95 },
            { subjectName: "English", subjectCode: "ENG", maxMarks: 100, obtainedMarks: 92 },
          ],
        },
        {
          studentProfileId: "st-3",
          studentName: "Zainab Bibi",
          rollNumber: "103",
          results: [
            { subjectName: "Math", subjectCode: "MTH", maxMarks: 100, obtainedMarks: 60 },
            { subjectName: "English", subjectCode: "ENG", maxMarks: 100, obtainedMarks: 65 },
          ],
        },
      ];

      const ranked = calculateClassMeritRankings(studentsCohort);

      expect(ranked[0].studentName).toBe("Sara Ahmed");
      expect(ranked[0].rank).toBe(1);
      expect(ranked[0].rankLabel).toBe("1st");
      expect(ranked[0].percentage).toBe(93.5);

      expect(ranked[1].studentName).toBe("Ali Khan");
      expect(ranked[1].rank).toBe(2);
      expect(ranked[1].rankLabel).toBe("2nd");

      expect(ranked[2].studentName).toBe("Zainab Bibi");
      expect(ranked[2].rank).toBe(3);
      expect(ranked[2].rankLabel).toBe("3rd");
    });
  });
});
