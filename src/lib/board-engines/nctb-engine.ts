/**
 * Bangladesh NCTB Engine
 * - Two-paper aggregation (Bangla 1st+2nd, English 1st+2nd) → combined pass threshold (e.g. >= 66/200).
 * - 4th subject bonus: Bonus = max(0, GPA4th - 2.0); Final GPA = min(5.0, (Σ GPA_core + Bonus)/N_core)
 * - Strict Fail Invariant: If ANY core subject has grade F (0.0), overall GPA = 0.0 and promotionEligible = false.
 * Pure, deterministic — no DB.
 */
import { toPercentage, toGrade, DEFAULT_GPA_BANDS } from './grading';
import type { SubjectMark, SubjectResult, BoardResult, NctbOptions } from './types';
import type { GradeBand } from './grading';

const DEFAULT_PAPER_PAIRS: Record<string, string[]> = {
  BENGALI: ['BAN1', 'BAN2', 'BAN-1', 'BAN-2', 'BNG1', 'BNG2', '101', '102'],
  ENGLISH: ['ENG1', 'ENG2', 'ENG-1', 'ENG-2', '107', '108'],
};

function normalizeCode(code: string): string {
  return code.replace(/[\s_-]/g, '').toUpperCase();
}

function aggregatePaperPairs(subjects: SubjectMark[], paperPairs: Record<string, string[]>): SubjectMark[] {
  const codeToPairKey = new Map<string, string>();
  for (const [pairKey, codes] of Object.entries(paperPairs)) {
    for (const c of codes) codeToPairKey.set(normalizeCode(c), pairKey);
  }
  const aggregated: SubjectMark[] = [];
  const pairedBuckets = new Map<string, SubjectMark[]>();

  for (const s of subjects) {
    const key = codeToPairKey.get(normalizeCode(s.subjectCode));
    if (key) {
      const arr = pairedBuckets.get(key) ?? [];
      arr.push(s);
      pairedBuckets.set(key, arr);
    } else {
      aggregated.push(s);
    }
  }

  for (const [pairKey, bucket] of pairedBuckets) {
    if (bucket.length === 0) continue;
    if (bucket.length === 1) {
      aggregated.push(bucket[0]);
      continue;
    }
    const first = bucket[0];
    const obtained = bucket.reduce((a, s) => a + s.obtained, 0);
    const max = bucket.reduce((a, s) => a + s.max, 0);
    const pass = bucket.reduce((a, s) => a + s.pass, 0);

    // Combined Passing: pass/fail is determined on aggregate marks >= combined pass mark (e.g. >= 66 / 200)
    aggregated.push({
      subjectId: first.subjectId,
      subjectCode: pairKey,
      subjectName: first.subjectName ?? pairKey,
      category: first.category,
      isFourth: first.isFourth,
      obtained,
      max,
      pass,
      components: bucket.flatMap((b) => b.components ?? []),
    });
  }
  return aggregated;
}

export function calculateNCTB(
  input: { subjects: SubjectMark[]; gradingScale?: 'GPA' | 'PERCENTAGE' },
  options: NctbOptions = {},
  bands: GradeBand[] = DEFAULT_GPA_BANDS
): BoardResult {
  const paperPairs = options.paperPairs ?? DEFAULT_PAPER_PAIRS;
  const gradingScale = options.gradingScale ?? input.gradingScale ?? 'GPA';
  const fourthId =
    options.fourthSubjectId ??
    input.subjects.find((s) => s.isFourth || s.category === 'FOURTH' || s.category === 'OPTIONAL')?.subjectId ??
    null;

  const aggregated = aggregatePaperPairs(input.subjects, paperPairs);

  const subjectResults: SubjectResult[] = aggregated.map((s) => {
    const effectiveObtained = s.components?.length ? s.components.reduce((a, c) => a + c.obtained, 0) : s.obtained;
    const effectiveMax = s.components?.length ? s.components.reduce((a, c) => a + c.max, 0) : s.max;
    const pct = toPercentage(effectiveObtained, effectiveMax);
    const { grade, point } = gradingScale === 'GPA' ? toGrade(pct, bands) : { grade: pct >= 33 ? 'P' : 'F', point: pct / 20 };
    const isPassMarksMet = effectiveObtained >= s.pass;
    const status: SubjectResult['status'] = isPassMarksMet && pct >= 33 ? 'PASS' : 'FAIL';

    return {
      subjectId: s.subjectId,
      subjectCode: s.subjectCode,
      obtained: effectiveObtained,
      max: effectiveMax,
      percentage: pct,
      grade,
      gradePoint: point,
      status,
      isFourth: fourthId ? s.subjectId === fourthId : !!s.isFourth,
    };
  });

  const core = subjectResults.filter((s) => !s.isFourth);
  const fourth = subjectResults.find((s) => s.isFourth) ?? null;
  const failedCount = core.filter((s) => s.status === 'FAIL' || s.grade === 'F' || s.gradePoint === 0).length;
  const hasCoreFailure = failedCount > 0;

  const bonus = fourth ? Math.max(0, fourth.gradePoint - 2.0) : 0;
  let overallGpa = 0;

  if (hasCoreFailure) {
    // Strict Fail Invariant: If any core subject has F (0.0), final GPA must be 0.0
    overallGpa = 0.0;
  } else if (core.length > 0) {
    const sumCoreGp = core.reduce((a, s) => a + s.gradePoint, 0);
    const rawGpa = (sumCoreGp + bonus) / core.length;
    // Capped strictly at 5.00
    overallGpa = Math.min(5.0, Math.round(rawGpa * 100) / 100);
  }

  const totalObtained = subjectResults.reduce((a, s) => a + s.obtained, 0);
  const totalMax = subjectResults.reduce((a, s) => a + s.max, 0);
  const overallPercentage = toPercentage(totalObtained, totalMax);

  return {
    subjectResults,
    overallGpa,
    overallPercentage,
    totalObtained,
    totalMax,
    failedCount,
    absentCount: 0,
    promotionEligible: !hasCoreFailure,
    bonusPoints: bonus,
  } as BoardResult & { bonusPoints: number };
}

// Exported for testability
export const _private = { aggregatePaperPairs, normalizeCode };
