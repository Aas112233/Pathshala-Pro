/**
 * Pakistan FBISE Engine — Part-I (Class 11) + Part-II (Class 12) composite
 * Multi-year aggregation. Each year has same subject set. Composite % on sum max (typically 1100 or 600+500).
 * Base Subject Code Normalization strips Part indicators (PHY-1/PHY-2/PHY-I/PHY-II/PHY-11/PHY-12 -> PHY)
 * Pure, deterministic.
 */
import { toPercentage, toGrade, DEFAULT_GPA_BANDS } from './grading';
import type { SubjectMark, SubjectResult, BoardResult } from './types';
import type { GradeBand } from './grading';

export interface FbiseInput {
  part1: { subjects: SubjectMark[]; academicYearId: string };
  part2: { subjects: SubjectMark[]; academicYearId: string };
  gradingScale?: 'GPA' | 'PERCENTAGE';
}

/**
 * Normalizes subject codes by stripping Part indicators (e.g. PHY-1, PHY-2, PHY-I, PHY-II, PHY-11, PHY-12 -> PHY)
 */
export function normalizeFbiseSubjectCode(code: string): string {
  if (!code) return '';
  return code
    .trim()
    .toUpperCase()
    .replace(/[-_\s]?(1112|910)$/i, '')
    .replace(/[-_\s]?(PART[-_\s]?)?(I{1,3}|IV|V|1[0-2]|[1-9])$/i, '')
    .replace(/[\s_-]/g, '');
}

export function calculateFBISE(
  input: FbiseInput,
  bands: GradeBand[] = DEFAULT_GPA_BANDS
): BoardResult & { compositeTotal: number; compositeMax: number; part1Total: number; part2Total: number } {
  const gradingScale = input.gradingScale ?? 'PERCENTAGE';
  const map = new Map<
    string,
    {
      subjectId: string;
      subjectCode: string;
      canonicalCode: string;
      o1: number;
      m1: number;
      o2: number;
      m2: number;
      pass: number;
      category: SubjectMark['category'];
      isFourth?: boolean;
    }
  >();

  for (const s of input.part1.subjects) {
    const baseKey = normalizeFbiseSubjectCode(s.subjectCode);
    map.set(baseKey, {
      subjectId: s.subjectId,
      subjectCode: s.subjectCode,
      canonicalCode: baseKey,
      o1: s.obtained,
      m1: s.max,
      o2: 0,
      m2: 0,
      pass: s.pass,
      category: s.category,
      isFourth: s.isFourth,
    });
  }

  for (const s of input.part2.subjects) {
    const baseKey = normalizeFbiseSubjectCode(s.subjectCode);
    const existing = map.get(baseKey);
    if (existing) {
      existing.o2 = s.obtained;
      existing.m2 = s.max;
      if (!existing.subjectId) existing.subjectId = s.subjectId;
    } else {
      map.set(baseKey, {
        subjectId: s.subjectId,
        subjectCode: s.subjectCode,
        canonicalCode: baseKey,
        o1: 0,
        m1: 0,
        o2: s.obtained,
        m2: s.max,
        pass: s.pass,
        category: s.category,
        isFourth: s.isFourth,
      });
    }
  }

  const subjectResults: SubjectResult[] = [];
  let total = 0,
    max = 0,
    part1Total = 0,
    part2Total = 0;
  let failed = 0;

  for (const v of map.values()) {
    const o = v.o1 + v.o2;
    const m = v.m1 + v.m2;
    part1Total += v.o1;
    part2Total += v.o2;
    total += o;
    max += m;
    const pct = toPercentage(o, m);
    const { grade, point } = gradingScale === 'GPA' ? toGrade(pct, bands) : { grade: pct >= 33 ? 'P' : 'F', point: pct / 20 };
    const status: SubjectResult['status'] = o < v.pass || pct < 33 ? 'FAIL' : 'PASS';
    if (status === 'FAIL') failed++;
    subjectResults.push({
      subjectId: v.subjectId,
      subjectCode: v.canonicalCode || v.subjectCode,
      obtained: o,
      max: m,
      percentage: pct,
      grade,
      gradePoint: point,
      status,
      isFourth: !!v.isFourth,
    });
  }

  const overallPercentage = toPercentage(total, max);
  const overallGpa =
    gradingScale === 'GPA'
      ? Math.round((subjectResults.reduce((a, s) => a + s.gradePoint, 0) / Math.max(subjectResults.length, 1)) * 100) / 100
      : undefined;

  return {
    subjectResults,
    overallPercentage,
    overallGpa,
    totalObtained: total,
    totalMax: max,
    compositeTotal: total,
    compositeMax: max,
    part1Total,
    part2Total,
    failedCount: failed,
    absentCount: 0,
    promotionEligible: failed === 0,
  };
}

/**
 * Helper for single-year view (Class 11 alone) — treat part2 empty
 */
export function calculateFBISEPart1Only(
  subjects: SubjectMark[],
  gradingScale: 'GPA' | 'PERCENTAGE' = 'PERCENTAGE'
) {
  return calculateFBISE({
    part1: { subjects, academicYearId: 'part1' },
    part2: { subjects: [], academicYearId: 'part2' },
    gradingScale,
  });
}
