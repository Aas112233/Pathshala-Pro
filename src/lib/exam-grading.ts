import { safePercentage } from "@/lib/math-utils";
import type { GradeBand } from "@/lib/grading";

/**
 * Exam-result grading — the single server-authoritative source of truth.
 *
 * Every write path (`POST`/`PUT` on `/api/exam-results`) MUST derive
 * percentage / grade / gradePoint / status through this module so persisted
 * rows, report cards, and tabulation sheets can never disagree.
 */

export interface GradedResult {
  percentage: number;
  grade: string;
  gradePoint: number;
  status: "PASS" | "FAIL" | "ABSENT";
}

/** Canonical grade bands (5.0 scale) — matches the historical ExamResult data. */
const GRADING_SCALE = [
  { minPercentage: 80, grade: "A+", point: 5.0 },
  { minPercentage: 70, grade: "A", point: 4.5 },
  { minPercentage: 60, grade: "A-", point: 4.0 },
  { minPercentage: 50, grade: "B", point: 3.5 },
  { minPercentage: 40, grade: "C", point: 3.0 },
  { minPercentage: 33, grade: "D", point: 2.0 },
  { minPercentage: 0, grade: "F", point: 0.0 },
] as const;

/**
 * Grade a single subject result.
 * - `passMarks` is the per exam-subject threshold (absolute marks), falling
 *   back to 33% of maxMarks when the mapping omits it.
 * - Marks are clamped into [0, maxMarks] so no row can ever persist a
 *   percentage above 100.
 * - `status: "ABSENT"` bypasses marks entirely and is passed through so an
 *   absent student can be recorded explicitly instead of as a silent zero.
 * - `bands` overrides the canonical NCTB table (e.g. a tenant board scale
 *   from grading.ts). Omitted means NCTB, which is what all historical rows
 *   were graded with — pass a scale explicitly rather than changing this
 *   default, or history and new rows will disagree.
 */
export function gradeExamResult(input: {
  obtainedMarks: number;
  maxMarks: number;
  passMarks?: number | null;
  status?: string | null;
  bands?: GradeBand[];
}): GradedResult {
  if (input.status === "ABSENT") {
    return { percentage: 0, grade: "F", gradePoint: 0, status: "ABSENT" };
  }

  const maxMarks = Number.isFinite(input.maxMarks) && input.maxMarks > 0 ? input.maxMarks : 0;
  if (maxMarks <= 0) {
    throw new Error("maxMarks must be a positive number");
  }

  const clamped = Math.min(Math.max(input.obtainedMarks, 0), maxMarks);
  const percentage = safePercentage(clamped, maxMarks);
  const passMarks =
    typeof input.passMarks === "number" && input.passMarks > 0
      ? input.passMarks
      : (maxMarks * 33) / 100;
  const bands = input.bands ?? GRADING_SCALE;
  // Canonical table keys on minPercentage, grading.ts tables on min —
  // normalise so either shape works, and sort defensively since a
  // tenant-supplied table may not arrive pre-sorted (same rule as grading.ts).
  const table = bands.map((g: any) => ({
    min: (g.minPercentage ?? g.min) as number,
    grade: g.grade as string,
    point: g.point as number,
  }));
  const sorted = table.sort((a, b) => b.min - a.min);
  const band = sorted.find((g) => percentage >= g.min) ?? sorted[sorted.length - 1];

  return {
    percentage,
    grade: band.grade,
    gradePoint: band.point,
    status: clamped >= passMarks ? "PASS" : "FAIL",
  };
}