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
});
