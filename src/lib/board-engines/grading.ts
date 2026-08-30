import { safePercentage } from "@/lib/math-utils";

/**
 * Deterministic grading — single source for all boards.
 * Default NCTB GPA bands; CBSE/FBISE reuse same bands unless tenant overrides gpaScale JSON.
 */

export interface GradeBand { min: number; grade: string; point: number }

export const DEFAULT_GPA_BANDS: GradeBand[] = [
  { min: 80, grade: 'A+', point: 5.0 },
  { min: 70, grade: 'A',  point: 4.0 },
  { min: 60, grade: 'A-', point: 3.5 },
  { min: 50, grade: 'B',  point: 3.0 },
  { min: 40, grade: 'C',  point: 2.0 },
  { min: 33, grade: 'D',  point: 1.0 },
  { min: 0,  grade: 'F',  point: 0.0 },
];

export const toPercentage = (obtained: number, max: number): number => {
  return safePercentage(obtained, max);
};

export const toGrade = (percentage: number, bands: GradeBand[] = DEFAULT_GPA_BANDS): { grade: string; point: number } => {
  // Defensively sort a copy descending by `min` — a tenant-supplied
  // `gpaScale` table isn't guaranteed to already be in descending order,
  // and `find(b => percentage >= b.min)` silently picks the wrong band
  // otherwise.
  const sorted = [...bands].sort((a, b) => b.min - a.min);
  const band = sorted.find(b => percentage >= b.min) ?? sorted[sorted.length - 1];
  return { grade: band.grade, point: band.point };
};

export const weightedObtained = (components: {obtained:number; max:number; weightage?:number}[]): number => {
  // If no components, caller uses subject.obtained directly
  if (!components.length) return 0;
  // Weighted: (obtained/max * weightage * max) sum — when weights sum to 1, result is weighted obtained; max is weighted max sum
  // Simpler: obtained already weighted externally; here sum obtained
  return components.reduce((acc, c) => acc + c.obtained, 0);
};

export const weightedMax = (components: {max:number; weightage?:number}[]): number => {
  if (!components.length) return 0;
  return components.reduce((acc,c)=> acc + c.max, 0);
};
