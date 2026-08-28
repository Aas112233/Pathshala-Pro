/**
 * India CBSE Engine
 * - Best-of-5 / 6th additional skill replacement
 * - Language 1 Protection: Language 1 (Core English/Hindi L1) is mandatory and CANNOT be replaced.
 * - Internal (20%) + Board/Term (80%) weighted per subject.
 * Pure, deterministic.
 */
import { toPercentage, toGrade, DEFAULT_GPA_BANDS } from './grading';
import type { SubjectMark, SubjectResult, BoardResult, CbseOptions } from './types';
import type { GradeBand } from './grading';

function weightedSubject(s: SubjectMark, internalWeight = 0.2, boardWeight = 0.8): SubjectMark {
  if (!s.components?.length) return s;
  const internal = s.components.filter((c) => c.type === 'INTERNAL' || c.type === 'CA');
  const board = s.components.filter((c) => c.type !== 'INTERNAL' && c.type !== 'CA');
  const internalObt = internal.reduce((a, c) => a + c.obtained, 0);
  const internalMax = internal.reduce((a, c) => a + c.max, 0) || s.max * internalWeight;
  const boardObt = board.reduce((a, c) => a + c.obtained, 0);
  const boardMax = board.reduce((a, c) => a + c.max, 0) || s.max * boardWeight;

  const internalPct = internalMax ? internalObt / internalMax : 0;
  const boardPct = boardMax ? boardObt / boardMax : 0;
  const weightedPct = internalPct * internalWeight + boardPct * boardWeight;
  const obtained = Math.round(weightedPct * s.max * 100) / 100;
  return { ...s, obtained, max: s.max };
}

function bestOf5(pool: SubjectMark[]): { selected: SubjectMark[]; replacedId: string | null } {
  if (pool.length <= 5) return { selected: pool, replacedId: null };

  const core = pool.filter((s) => !s.isFourth && s.category !== 'FOURTH');
  const additional = pool.filter((s) => s.isFourth || s.category === 'FOURTH' || s.category === 'OPTIONAL' || (s.category as string) === 'SKILL');

  if (core.length < 5 || additional.length === 0) return { selected: pool, replacedId: null };

  // Language 1 Protection: Language 1 cannot be replaced
  const replaceableCore = core.filter((s) => (s.category as string) !== 'LANGUAGE_1' && !(s as any).isLanguage1);

  if (replaceableCore.length === 0) return { selected: pool, replacedId: null };

  // Find lowest replaceable core by percentage
  const scoredReplaceable = replaceableCore
    .map((s) => ({ s, pct: toPercentage(s.obtained, s.max) }))
    .sort((a, b) => a.pct - b.pct);

  const lowestReplaceable = scoredReplaceable[0];
  const bestAdd = additional
    .map((s) => ({ s, pct: toPercentage(s.obtained, s.max) }))
    .sort((a, b) => b.pct - a.pct)[0];

  if (bestAdd && bestAdd.pct > lowestReplaceable.pct) {
    const selected = [...pool.filter((p) => p !== lowestReplaceable.s)];
    // Ensure total pool retains top 5 subjects
    return { selected, replacedId: lowestReplaceable.s.subjectId };
  }

  return { selected: pool, replacedId: null };
}

export function calculateCBSE(
  input: { subjects: SubjectMark[]; gradingScale?: 'GPA' | 'PERCENTAGE' },
  options: CbseOptions = {},
  bands: GradeBand[] = DEFAULT_GPA_BANDS
): BoardResult {
  const iw = options.internalWeight ?? 0.2;
  const bw = options.boardWeight ?? 0.8;
  const gradingScale = input.gradingScale ?? 'PERCENTAGE';

  const weighted = input.subjects.map((s) => weightedSubject(s, iw, bw));

  let selected = weighted;
  let replacedId: string | null = null;
  if (options.bestOf5) {
    const res = bestOf5(weighted);
    selected = res.selected;
    replacedId = res.replacedId;
  }

  const subjectResults: SubjectResult[] = selected.map((s) => {
    const pct = toPercentage(s.obtained, s.max);
    const { grade, point } = gradingScale === 'GPA' ? toGrade(pct, bands) : { grade: pct >= 33 ? 'P' : 'F', point: pct / 20 };
    const status: SubjectResult['status'] = s.obtained < s.pass || pct < 33 ? 'FAIL' : 'PASS';
    return {
      subjectId: s.subjectId,
      subjectCode: s.subjectCode,
      obtained: s.obtained,
      max: s.max,
      percentage: pct,
      grade,
      gradePoint: point,
      status,
      isFourth: !!s.isFourth,
    };
  });

  const totalObtained = subjectResults.reduce((a, s) => a + s.obtained, 0);
  const totalMax = subjectResults.reduce((a, s) => a + s.max, 0);
  const overallPercentage = toPercentage(totalObtained, totalMax);
  const failedCount = subjectResults.filter((s) => s.status === 'FAIL').length;
  const overallGpa =
    gradingScale === 'GPA'
      ? Math.round((subjectResults.reduce((a, s) => a + s.gradePoint, 0) / Math.max(subjectResults.length, 1)) * 100) / 100
      : undefined;

  return {
    subjectResults,
    overallPercentage,
    overallGpa,
    totalObtained,
    totalMax,
    failedCount,
    absentCount: 0,
    promotionEligible: failedCount === 0,
    bestOfReplacedId: replacedId,
  };
}

export const _private = { weightedSubject, bestOf5 };
