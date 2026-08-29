import { describe, it, expect } from "vitest";
import {
  createQuestionSchema,
  updateQuestionSchema,
  createQuestionPaperSchema,
  updateQuestionPaperSchema,
  generateBlueprintSchema,
} from "@/lib/schemas";

describe("Question Bank & Question Paper Engine", () => {
  describe("createQuestionSchema", () => {
    it("validates a standard MCQ question with options and correct answer", () => {
      const validMcq = {
        classId: "cls-10",
        subjectId: "sub-math",
        chapter: "Trigonometry",
        topic: "Sine and Cosine Rules",
        type: "MCQ",
        difficulty: "MEDIUM",
        bloomLevel: "UNDERSTANDING",
        marks: 1,
        questionText: "What is sin(90°)?",
        options: [
          { id: "A", text: "0", isCorrect: false },
          { id: "B", text: "1", isCorrect: true },
          { id: "C", text: "0.5", isCorrect: false },
          { id: "D", text: "Undefined", isCorrect: false },
        ],
        correctAnswer: "B",
        explanation: "sin(90°) = 1 by standard trigonometric table.",
      };

      const parsed = createQuestionSchema.safeParse(validMcq);
      expect(parsed.success).toBe(true);
    });

    it("validates an NCTB Creative (CQ) question with stimulus and structured sub-questions", () => {
      const validCq = {
        classId: "cls-10",
        subjectId: "sub-physics",
        chapter: "Force & Motion",
        type: "CREATIVE_NCTB",
        difficulty: "HARD",
        bloomLevel: "ANALYSIS",
        marks: 10,
        stimulus: "A car of mass 1000 kg accelerates uniformly from rest to 20 m/s in 10 seconds.",
        questionText: "Based on the above stimulus, answer the following questions:",
        subQuestions: [
          { label: "ক", text: "Define inertia.", marks: 1 },
          { label: "খ", text: "Why is seatbelt necessary during sudden braking?", marks: 2 },
          { label: "গ", text: "Calculate the acceleration and force exerted by the engine.", marks: 3 },
          { label: "ঘ", text: "Analyze the total distance covered during the acceleration phase.", marks: 4 },
        ],
      };

      const parsed = createQuestionSchema.safeParse(validCq);
      expect(parsed.success).toBe(true);
    });

    it("rejects questions without required classId or subjectId", () => {
      const invalid = {
        type: "MCQ",
        questionText: "Missing class and subject",
      };

      const parsed = createQuestionSchema.safeParse(invalid);
      expect(parsed.success).toBe(false);
    });
  });

  describe("createQuestionPaperSchema", () => {
    it("validates a multi-section question paper specification", () => {
      const validPaper = {
        title: "Annual Examination 2026",
        code: "SET-A",
        academicYearId: "ay-2026",
        classId: "cls-10",
        subjectId: "sub-math",
        totalMarks: 100,
        durationMinutes: 180,
        instructions: "1. Answer all questions.\n2. Figures in margin indicate full marks.",
        sections: [
          {
            id: "sec-1",
            title: "Section A: Multiple Choice Questions",
            instructions: "Answer all 20 MCQs.",
            totalMarks: 20,
            questionIds: ["q1", "q2", "q3"],
          },
          {
            id: "sec-2",
            title: "Section B: Creative Questions",
            instructions: "Answer any 8 out of 11 questions.",
            totalMarks: 80,
            questionIds: ["q4", "q5"],
          },
        ],
        status: "DRAFT",
      };

      const parsed = createQuestionPaperSchema.safeParse(validPaper);
      expect(parsed.success).toBe(true);
    });

    it("rejects question papers without any sections", () => {
      const invalid = {
        title: "No Section Paper",
        academicYearId: "ay-2026",
        classId: "cls-10",
        subjectId: "sub-math",
        sections: [],
      };

      const parsed = createQuestionPaperSchema.safeParse(invalid);
      expect(parsed.success).toBe(false);
    });
  });

  describe("generateBlueprintSchema", () => {
    it("validates smart blueprint generator criteria", () => {
      const validBlueprint = {
        title: "Mid-Term Exam 2026",
        academicYearId: "ay-2026",
        classId: "cls-10",
        subjectId: "sub-chem",
        totalMarks: 100,
        durationMinutes: 180,
        blueprint: {
          mcqCount: 20,
          mcqMarksEach: 1,
          shortCount: 5,
          shortMarksEach: 4,
          descriptiveCount: 4,
          descriptiveMarksEach: 10,
          creativeCount: 2,
          creativeMarksEach: 10,
          difficultyRatio: {
            easy: 30,
            medium: 50,
            hard: 20,
          },
        },
      };

      const parsed = generateBlueprintSchema.safeParse(validBlueprint);
      expect(parsed.success).toBe(true);
    });
  });
});
