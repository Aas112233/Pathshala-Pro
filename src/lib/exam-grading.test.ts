import { describe, it, expect } from "vitest";
import { gradeExamResult } from "./exam-grading";

describe("gradeExamResult (single source of truth for ExamResult grading)", () => {
  it("clamps marks above maxMarks so a percentage over 100 can never be persisted", () => {
    const graded = gradeExamResult({ obtainedMarks: 150, maxMarks: 100 });
    expect(graded.percentage).toBe(100);
    expect(graded.grade).toBe("A+");
    expect(graded.status).toBe("PASS");
  });

  it("clamps negative marks to zero", () => {
    const graded = gradeExamResult({ obtainedMarks: -10, maxMarks: 100 });
    expect(graded.percentage).toBe(0);
    expect(graded.grade).toBe("F");
    expect(graded.status).toBe("FAIL");
  });

  it("applies the canonical band boundaries consistently", () => {
    expect(gradeExamResult({ obtainedMarks: 80, maxMarks: 100 }).grade).toBe("A+");
    expect(gradeExamResult({ obtainedMarks: 80, maxMarks: 100 }).gradePoint).toBe(5);
    expect(gradeExamResult({ obtainedMarks: 79.99, maxMarks: 100 }).grade).toBe("A");
    expect(gradeExamResult({ obtainedMarks: 70, maxMarks: 100 }).grade).toBe("A");
    expect(gradeExamResult({ obtainedMarks: 60, maxMarks: 100 }).grade).toBe("A-");
    expect(gradeExamResult({ obtainedMarks: 50, maxMarks: 100 }).grade).toBe("B");
    expect(gradeExamResult({ obtainedMarks: 40, maxMarks: 100 }).grade).toBe("C");
    expect(gradeExamResult({ obtainedMarks: 33, maxMarks: 100 }).grade).toBe("D");
    expect(gradeExamResult({ obtainedMarks: 32.99, maxMarks: 100 }).grade).toBe("F");
  });

  it("honours the per exam-subject pass threshold", () => {
    expect(gradeExamResult({ obtainedMarks: 35, maxMarks: 100, passMarks: 33 }).status).toBe("PASS");
    expect(gradeExamResult({ obtainedMarks: 35, maxMarks: 100, passMarks: 40 }).status).toBe("FAIL");
  });

  it("falls back to the 33% threshold when the mapping omits passMarks", () => {
    expect(gradeExamResult({ obtainedMarks: 33, maxMarks: 100 }).status).toBe("PASS");
    expect(gradeExamResult({ obtainedMarks: 32, maxMarks: 100 }).status).toBe("FAIL");
    expect(gradeExamResult({ obtainedMarks: 40, maxMarks: 100, passMarks: null }).status).toBe("PASS");
  });

  it("records absence explicitly instead of fabricating a zero score", () => {
    const graded = gradeExamResult({ obtainedMarks: 0, maxMarks: 100, status: "ABSENT" });
    expect(graded.status).toBe("ABSENT");
    expect(graded.percentage).toBe(0);
    expect(graded.grade).toBe("F");
    expect(graded.gradePoint).toBe(0);
  });

  it("rejects a non-positive maxMarks ceiling", () => {
    expect(() => gradeExamResult({ obtainedMarks: 5, maxMarks: 0 })).toThrow();
    expect(() => gradeExamResult({ obtainedMarks: 5, maxMarks: -1 })).toThrow();
  });

  it("rounds percentages to two decimals", () => {
    expect(gradeExamResult({ obtainedMarks: 2, maxMarks: 3 }).percentage).toBe(66.67);
  });
});
