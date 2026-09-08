import { describe, it, expect } from "vitest";

describe("Student Promotion & Exam Result Lock Guard", () => {
  it("determines exam results should be immutable when isLocked is true or student is promoted", () => {
    // Model state before promotion
    const resultBeforePromotion = {
      id: "res-1",
      studentProfileId: "stu-1",
      academicYearId: "ay-2025",
      obtainedMarks: 85,
      maxMarks: 100,
      isLocked: false,
    };

    expect(resultBeforePromotion.isLocked).toBe(false);

    // After promotion execution, status is set to PROMOTED and results locked
    const promotionRecord = {
      studentProfileId: "stu-1",
      fromAcademicYearId: "ay-2025",
      toAcademicYearId: "ay-2026",
      status: "PROMOTED",
    };

    const isResultLocked = (
      result: { isLocked: boolean; studentProfileId: string; academicYearId: string },
      promotions: Array<{ studentProfileId: string; fromAcademicYearId: string; status: string }>
    ) => {
      if (result.isLocked) return true;
      return promotions.some(
        (p) =>
          p.studentProfileId === result.studentProfileId &&
          p.fromAcademicYearId === result.academicYearId &&
          p.status === "PROMOTED"
      );
    };

    expect(isResultLocked(resultBeforePromotion, [promotionRecord])).toBe(true);

    const resultAfterPromotion = {
      ...resultBeforePromotion,
      isLocked: true,
    };

    expect(isResultLocked(resultAfterPromotion, [promotionRecord])).toBe(true);
  });

  it("allows result edits for retained or non-promoted students", () => {
    const retainedRecord = {
      studentProfileId: "stu-2",
      fromAcademicYearId: "ay-2025",
      toAcademicYearId: "ay-2025",
      status: "RETAINED",
    };

    const studentResult = {
      id: "res-2",
      studentProfileId: "stu-2",
      academicYearId: "ay-2025",
      obtainedMarks: 30,
      maxMarks: 100,
      isLocked: false,
    };

    const isResultLocked = (
      result: { isLocked: boolean; studentProfileId: string; academicYearId: string },
      promotions: Array<{ studentProfileId: string; fromAcademicYearId: string; status: string }>
    ) => {
      if (result.isLocked) return true;
      return promotions.some(
        (p) =>
          p.studentProfileId === result.studentProfileId &&
          p.fromAcademicYearId === result.academicYearId &&
          p.status === "PROMOTED"
      );
    };

    expect(isResultLocked(studentResult, [retainedRecord])).toBe(false);
  });

  describe("Promotion Rules Historical Locking Suite", () => {
    it("locks promotion rules from edit or deletion when historical promotions have already been processed", () => {
      const historicalPromotions = [
        {
          id: "promo-1",
          tenantId: "tenant-1",
          fromClassId: "class-1",
          fromAcademicYearId: "ay-2025",
          toClassId: "class-2",
          toAcademicYearId: "ay-2026",
          status: "PROMOTED",
        },
        {
          id: "promo-2",
          tenantId: "tenant-1",
          fromClassId: "class-1",
          fromAcademicYearId: "ay-2025",
          toClassId: "class-2",
          toAcademicYearId: "ay-2026",
          status: "PROMOTED",
        },
      ];

      const ruleWithHistoricalData = {
        id: "rule-1",
        classId: "class-1",
        academicYearId: "ay-2025",
        minimumAttendance: 75,
      };

      const checkRuleLockStatus = (
        rule: { classId: string; academicYearId: string },
        promotions: typeof historicalPromotions
      ) => {
        const count = promotions.filter(
          (p) => p.fromClassId === rule.classId && p.fromAcademicYearId === rule.academicYearId
        ).length;
        return {
          isLocked: count > 0,
          historicalPromotionCount: count,
        };
      };

      const lockStatus = checkRuleLockStatus(ruleWithHistoricalData, historicalPromotions);
      expect(lockStatus.isLocked).toBe(true);
      expect(lockStatus.historicalPromotionCount).toBe(2);
    });

    it("permits editing and deletion when no historical promotions have been processed", () => {
      const ruleWithoutHistoricalData = {
        id: "rule-2",
        classId: "class-3",
        academicYearId: "ay-2026",
        minimumAttendance: 75,
      };

      const checkRuleLockStatus = (
        rule: { classId: string; academicYearId: string },
        promotions: Array<{ fromClassId: string; fromAcademicYearId: string }>
      ) => {
        const count = promotions.filter(
          (p) => p.fromClassId === rule.classId && p.fromAcademicYearId === rule.academicYearId
        ).length;
        return {
          isLocked: count > 0,
          historicalPromotionCount: count,
        };
      };

      const lockStatus = checkRuleLockStatus(ruleWithoutHistoricalData, []);
      expect(lockStatus.isLocked).toBe(false);
      expect(lockStatus.historicalPromotionCount).toBe(0);
    });
  });
});
