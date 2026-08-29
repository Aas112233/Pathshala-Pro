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

function sampleQuestionsByDifficulty(
  pool: any[],
  count: number,
  ratio?: { easy?: number; medium?: number; hard?: number }
) {
  if (pool.length <= count) return [...pool];

  const easyPool = pool.filter((q) => q.difficulty === "EASY");
  const mediumPool = pool.filter((q) => q.difficulty === "MEDIUM");
  const hardPool = pool.filter((q) => q.difficulty === "HARD");

  const easyTarget = Math.round((count * (ratio?.easy ?? 30)) / 100);
  const hardTarget = Math.round((count * (ratio?.hard ?? 20)) / 100);
  const mediumTarget = count - easyTarget - hardTarget;

  const shuffle = (arr: any[]) => [...arr].sort(() => 0.5 - Math.random());

  const selectedEasy = shuffle(easyPool).slice(0, easyTarget);
  const selectedMedium = shuffle(mediumPool).slice(0, mediumTarget);
  const selectedHard = shuffle(hardPool).slice(0, hardTarget);

  const selected = [...selectedEasy, ...selectedMedium, ...selectedHard];

  // If not enough from difficulty buckets, fill with remaining pool
  if (selected.length < count) {
    const selectedIds = new Set(selected.map((q) => q.id));
    const remaining = pool.filter((q) => !selectedIds.has(q.id));
    selected.push(...shuffle(remaining).slice(0, count - selected.length));
  }

  return selected.slice(0, count);
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

    const sections: any[] = [];
    const hydratedSections: any[] = [];
    let sectionIndex = 1;

    // 1. Section A: Multiple Choice Questions
    if (mcqCount > 0) {
      const sampledMcqs = sampleQuestionsByDifficulty(
        mcqPool,
        mcqCount,
        blueprint.difficultyRatio
      );

      const secMarks = sampledMcqs.length * mcqMarksEach;
      const secId = `sec-${sectionIndex++}`;

      sections.push({
        id: secId,
        title: "Section A: Multiple Choice Questions",
        instructions: `Choose the correct answer for each question. (1 × ${sampledMcqs.length} = ${secMarks} Marks)`,
        totalMarks: secMarks,
        questionIds: sampledMcqs.map((q) => q.id),
      });

      hydratedSections.push({
        id: secId,
        title: "Section A: Multiple Choice Questions",
        instructions: `Choose the correct answer for each question. (1 × ${sampledMcqs.length} = ${secMarks} Marks)`,
        totalMarks: secMarks,
        questionIds: sampledMcqs.map((q) => q.id),
        questions: sampledMcqs,
      });
    }

    // 2. Section B: Short Answer Questions
    if (shortCount > 0) {
      const sampledShort = sampleQuestionsByDifficulty(
        shortPool,
        shortCount,
        blueprint.difficultyRatio
      );

      const secMarks = sampledShort.length * shortMarksEach;
      const secId = `sec-${sectionIndex++}`;

      sections.push({
        id: secId,
        title: "Section B: Short Answer Questions",
        instructions: `Answer all questions briefly in 2–3 sentences. (${shortMarksEach} × ${sampledShort.length} = ${secMarks} Marks)`,
        totalMarks: secMarks,
        questionIds: sampledShort.map((q) => q.id),
      });

      hydratedSections.push({
        id: secId,
        title: "Section B: Short Answer Questions",
        instructions: `Answer all questions briefly in 2–3 sentences. (${shortMarksEach} × ${sampledShort.length} = ${secMarks} Marks)`,
        totalMarks: secMarks,
        questionIds: sampledShort.map((q) => q.id),
        questions: sampledShort,
      });
    }

    // 3. Section C: Descriptive / Essay Questions
    if (descriptiveCount > 0) {
      const sampledDescriptive = sampleQuestionsByDifficulty(
        descriptivePool,
        descriptiveCount,
        blueprint.difficultyRatio
      );

      const secMarks = sampledDescriptive.length * descriptiveMarksEach;
      const secId = `sec-${sectionIndex++}`;

      sections.push({
        id: secId,
        title: "Section C: Descriptive / Essay Questions",
        instructions: `Answer the following broad questions in detail. (${descriptiveMarksEach} × ${sampledDescriptive.length} = ${secMarks} Marks)`,
        totalMarks: secMarks,
        questionIds: sampledDescriptive.map((q) => q.id),
      });

      hydratedSections.push({
        id: secId,
        title: "Section C: Descriptive / Essay Questions",
        instructions: `Answer the following broad questions in detail. (${descriptiveMarksEach} × ${sampledDescriptive.length} = ${secMarks} Marks)`,
        totalMarks: secMarks,
        questionIds: sampledDescriptive.map((q) => q.id),
        questions: sampledDescriptive,
      });
    }

    // 4. Section D: Creative (NCTB / সৃজনশীল) Questions
    if (creativeCount > 0) {
      const sampledCreative = sampleQuestionsByDifficulty(
        creativePool,
        creativeCount,
        blueprint.difficultyRatio
      );

      const secMarks = sampledCreative.length * creativeMarksEach;
      const secId = `sec-${sectionIndex++}`;

      sections.push({
        id: secId,
        title: "Section D: Creative Questions (সৃজনশীল প্রশ্ন)",
        instructions: `Read the stimulus and answer all parts (a, b, c, d). (${creativeMarksEach} × ${sampledCreative.length} = ${secMarks} Marks)`,
        totalMarks: secMarks,
        questionIds: sampledCreative.map((q) => q.id),
      });

      hydratedSections.push({
        id: secId,
        title: "Section D: Creative Questions (সৃজনশীল প্রশ্ন)",
        instructions: `Read the stimulus and answer all parts (a, b, c, d). (${creativeMarksEach} × ${sampledCreative.length} = ${secMarks} Marks)`,
        totalMarks: secMarks,
        questionIds: sampledCreative.map((q) => q.id),
        questions: sampledCreative,
      });
    }

    const calculatedTotalMarks = sections.reduce(
      (sum, sec) => sum + (sec.totalMarks || 0),
      0
    );

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
      },
      "Question paper blueprint generated successfully"
    );
  } catch (error) {
    return handleApiError(error);
  }
}
