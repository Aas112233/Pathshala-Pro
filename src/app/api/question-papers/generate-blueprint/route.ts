import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  badRequest,
  safeParseBody,
  handleApiError,
} from "@/lib/api-response";
import { generateBlueprintSchema } from "@/lib/schemas";
import { requireApiAccess } from "@/lib/api-auth";

// ponytail: Fisher-Yates shuffle — unbiased vs sort(() => 0.5 - Math.random())
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Chapter-balanced distribution: round-robin across chapters so no single chapter dominates
function balancedPick(pool: any[], count: number): any[] {
  if (!pool.length || count <= 0) return [];
  if (pool.length <= count) return shuffle(pool);
  // Group by chapter (fallback to "__none__")
  const groups = new Map<string, any[]>();
  for (const q of pool) {
    const key = (q.chapter || "__none__").trim() || "__none__";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(q);
  }
  // Shuffle each group
  for (const [k, v] of groups) groups.set(k, shuffle(v));
  const keys = shuffle([...groups.keys()]);
  const result: any[] = [];
  let idx = 0;
  while (result.length < count) {
    let added = false;
    for (const k of keys) {
      const g = groups.get(k)!;
      if (g.length > 0) {
        result.push(g.shift()!);
        added = true;
        if (result.length >= count) break;
      }
    }
    if (!added) break;
    if (++idx > count * 2) break; // safety
  }
  return result;
}

function sampleQuestionsEnhanced(
  pool: any[],
  count: number,
  opts: {
    difficultyRatio?: { easy?: number; medium?: number; hard?: number };
    bloomRatio?: { knowledge?: number; understanding?: number; application?: number; analysis?: number };
    chapterBalanced?: boolean;
  } = {}
): any[] {
  if (count <= 0) return [];
  if (pool.length <= count) return [...pool];

  const ratio = opts.difficultyRatio;
  const easyPool = pool.filter((q) => q.difficulty === "EASY");
  const mediumPool = pool.filter((q) => q.difficulty === "MEDIUM");
  const hardPool = pool.filter((q) => q.difficulty === "HARD");

  const easyTarget = Math.round((count * (ratio?.easy ?? 30)) / 100);
  const hardTarget = Math.round((count * (ratio?.hard ?? 20)) / 100);
  const mediumTarget = count - easyTarget - hardTarget;

  // Bloom secondary balancing helper
  const pickWithBloom = (subPool: any[], target: number): any[] => {
    if (!opts.bloomRatio || target <= 0 || subPool.length <= target) {
      return opts.chapterBalanced ? balancedPick(subPool, target) : shuffle(subPool).slice(0, target);
    }
    const b = opts.bloomRatio;
    const kTarget = Math.round((target * (b.knowledge ?? 25)) / 100);
    const uTarget = Math.round((target * (b.understanding ?? 25)) / 100);
    const apTarget = Math.round((target * (b.application ?? 25)) / 100);
    const anTarget = target - kTarget - uTarget - apTarget;
    const byBloom = {
      KNOWLEDGE: subPool.filter((q) => q.bloomLevel === "KNOWLEDGE"),
      UNDERSTANDING: subPool.filter((q) => q.bloomLevel === "UNDERSTANDING"),
      APPLICATION: subPool.filter((q) => q.bloomLevel === "APPLICATION"),
      ANALYSIS: subPool.filter((q) => q.bloomLevel === "ANALYSIS"),
      NONE: subPool.filter((q) => !q.bloomLevel),
    };
    const picks: any[] = [];
    const take = (arr: any[], n: number) => (opts.chapterBalanced ? balancedPick(arr, n) : shuffle(arr).slice(0, n));
    picks.push(...take(byBloom.KNOWLEDGE, kTarget));
    picks.push(...take(byBloom.UNDERSTANDING, uTarget));
    picks.push(...take(byBloom.APPLICATION, apTarget));
    picks.push(...take(byBloom.ANALYSIS, anTarget));
    if (picks.length < target) {
      const ids = new Set(picks.map((q) => q.id));
      const rem = subPool.filter((q) => !ids.has(q.id));
      picks.push(...(opts.chapterBalanced ? balancedPick(rem, target - picks.length) : shuffle(rem).slice(0, target - picks.length)));
    }
    return picks.slice(0, target);
  };

  const selectedEasy = pickWithBloom(easyPool, Math.max(0, easyTarget));
  const selectedMedium = pickWithBloom(mediumPool, Math.max(0, mediumTarget));
  const selectedHard = pickWithBloom(hardPool, Math.max(0, hardTarget));

  const selected = [...selectedEasy, ...selectedMedium, ...selectedHard];

  if (selected.length < count) {
    const ids = new Set(selected.map((q) => q.id));
    const remaining = pool.filter((q) => !ids.has(q.id));
    const filler = opts.chapterBalanced ? balancedPick(remaining, count - selected.length) : shuffle(remaining).slice(0, count - selected.length);
    selected.push(...filler);
  }

  return shuffle(selected).slice(0, count);
}

/**
 * POST /api/question-papers/generate-blueprint
 * Smart automatic question paper generation algorithm
 */
export async function POST(request: NextRequest) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;
    const bodyParsed = await safeParseBody(request, generateBlueprintSchema);
    if (!bodyParsed.success) return bodyParsed.errorResponse;

    const {
      title,
      academicYearId,
      classId,
      subjectId,
      examId,
      totalMarks,
      durationMinutes,
      instructions,
      blueprint,
    } = bodyParsed.data;

    // Fetch question bank questions for this class and subject
    const allQuestions = await (prisma as any).question.findMany({
      where: {
        tenantId,
        classId,
        subjectId,
        isActive: true,
      },
    });

    if (allQuestions.length === 0) {
      return badRequest(
        "No questions found in the Question Bank for this class and subject. Please add questions first."
      );
    }

    // Group available questions by type
    const mcqPool = allQuestions.filter((q: any) => q.type === "MCQ");
    const shortPool = allQuestions.filter((q: any) => q.type === "SHORT" || q.type === "FILL_BLANK" || q.type === "TRUE_FALSE");
    const descriptivePool = allQuestions.filter((q: any) => q.type === "DESCRIPTIVE");
    const creativePool = allQuestions.filter((q: any) => q.type === "CREATIVE_NCTB");

    const mcqCount = blueprint.mcqCount ?? 20;
    const mcqMarksEach = blueprint.mcqMarksEach ?? 1;
    const shortCount = blueprint.shortCount ?? 5;
    const shortMarksEach = blueprint.shortMarksEach ?? 4;
    const descriptiveCount = blueprint.descriptiveCount ?? 4;
    const descriptiveMarksEach = blueprint.descriptiveMarksEach ?? 10;
    const creativeCount = blueprint.creativeCount ?? 0;
    const creativeMarksEach = blueprint.creativeMarksEach ?? 10;
    const chapterBalanced = (blueprint.chapterDistribution ?? "balanced") === "balanced";

    const sampleOpts = {
      difficultyRatio: blueprint.difficultyRatio,
      bloomRatio: (blueprint as any).bloomRatio,
      chapterBalanced,
    };

    const sections: any[] = [];
    const hydratedSections: any[] = [];
    const diagnostics: any[] = [];
    let sectionIndex = 1;

    const buildSection = (pool: any[], count: number, marksEach: number, title: string, instr: string) => {
      if (count <= 0) return;
      const sampled = sampleQuestionsEnhanced(pool, count, sampleOpts);
      const secMarks = sampled.length * marksEach;
      const secId = `sec-${sectionIndex++}`;
      if (sampled.length < count) {
        diagnostics.push({ type: title, requested: count, available: pool.length, sampled: sampled.length, shortage: count - sampled.length });
      }
      sections.push({ id: secId, title, instructions: instr.replace("{n}", String(sampled.length)).replace("{marks}", String(secMarks)), totalMarks: secMarks, questionIds: sampled.map((q) => q.id) });
      hydratedSections.push({ id: secId, title, instructions: instr.replace("{n}", String(sampled.length)).replace("{marks}", String(secMarks)), totalMarks: secMarks, questionIds: sampled.map((q) => q.id), questions: sampled });
    };

    buildSection(mcqPool, mcqCount, mcqMarksEach, "Section A: Multiple Choice Questions", `Choose the correct answer for each question. (1 × {n} = {marks} Marks)`);
    buildSection(shortPool, shortCount, shortMarksEach, "Section B: Short Answer Questions", `Answer all questions briefly in 2–3 sentences. (${shortMarksEach} × {n} = {marks} Marks)`);
    buildSection(descriptivePool, descriptiveCount, descriptiveMarksEach, "Section C: Descriptive / Essay Questions", `Answer the following broad questions in detail. (${descriptiveMarksEach} × {n} = {marks} Marks)`);
    buildSection(creativePool, creativeCount, creativeMarksEach, "Section D: Creative Questions (সৃজনশীল প্রশ্ন)", `Read the stimulus and answer all parts (a, b, c, d). (${creativeMarksEach} × {n} = {marks} Marks)`);

    const calculatedTotalMarks = sections.reduce((sum, sec) => sum + (sec.totalMarks || 0), 0);

    // Chapter coverage for diagnostics
    const allSampled = hydratedSections.flatMap((s: any) => s.questions || []);
    const chapterCoverage: Record<string, number> = {};
    for (const q of allSampled) {
      const ch = (q.chapter || "Unspecified").trim() || "Unspecified";
      chapterCoverage[ch] = (chapterCoverage[ch] || 0) + 1;
    }
    // Bank Intelligence: bump usageCount/lastUsedAt (best-effort, ignore if column not yet migrated)
    if (allSampled.length) {
      const ids = allSampled.map((q: any) => q.id);
      try {
        await (prisma as any).question.updateMany({
          where: { id: { in: ids }, tenantId },
          data: { usageCount: { increment: 1 }, lastUsedAt: new Date() },
        });
      } catch {}
    }

    return successResponse(
      {
        title,
        academicYearId,
        classId,
        subjectId,
        examId,
        totalMarks: calculatedTotalMarks || totalMarks,
        durationMinutes,
        instructions: instructions || "1. Read all questions carefully before answering.\n2. Write your Roll Number and Class clearly.\n3. Figures in the right margin indicate full marks.",
        sections,
        hydratedSections,
        diagnostics: {
          requestedTotalMarks: totalMarks,
          calculatedTotalMarks,
          marksMatch: totalMarks !== undefined ? Math.abs(calculatedTotalMarks - totalMarks) < 0.01 : true,
          shortages: diagnostics,
          chapterCoverage,
          totalSampled: allSampled.length,
          totalRequested: mcqCount + shortCount + descriptiveCount + creativeCount,
        },
      },
      diagnostics.length ? `Blueprint generated with ${diagnostics.length} shortage warning(s)` : "Question paper blueprint generated successfully"
    );
  } catch (error) {
    return handleApiError(error);
  }
}
