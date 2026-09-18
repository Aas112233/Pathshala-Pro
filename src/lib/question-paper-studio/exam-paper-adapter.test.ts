import { describe, it, expect } from "vitest";
import { adaptPaperForPdf } from "./exam-paper-adapter";
import { ExamPaperStudioModel } from "@/types/exam-studio";

/**
 * Regression suite for: "Cannot read properties of undefined (reading 'isRTL')"
 * The preview page passed the raw GET /api/question-papers/[id] payload
 * (DB-shaped: hydratedSections/tenant/class/subject) into the PDF template
 * which requires the Studio Model (header/layout/sections).
 */
describe("Exam Paper PDF Adapter", () => {
  // Mirrors the payload returned by GET /api/question-papers/[id]
  const rawApiPayload = {
    id: "qp-1",
    paperId: "QP-MATH-10-01",
    title: "Annual Mathematics Examination",
    code: "SET-A",
    totalMarks: 100,
    durationMinutes: 150,
    instructions: "Answer all questions.",
    sections: [],
    hydratedSections: [
      {
        id: "sec-1",
        sectionId: "sec-1",
        title: "Part A: Multiple Choice",
        instructions: "Answer all questions",
        questions: [
          {
            id: "q-1",
            type: "MCQ",
            questionText: "What is 2 + 2?",
            marks: 1,
            options: [
              { id: "A", text: "3", isCorrect: false },
              { id: "B", text: "4", isCorrect: true },
            ],
          },
          {
            id: "q-2",
            type: "CREATIVE_NCTB",
            qNumber: "২",
            stimulus: "উদ্দীপক",
            questionText: "উদ্দীপকটি পড়ে প্রশ্নের উত্তর দাও",
            marks: 10,
          },
        ],
      },
    ],
    class: { id: "cls-1", name: "Class Ten" },
    subject: { id: "sub-1", name: "Mathematics", code: "101" },
    academicYear: { id: "ay-1", label: "2026" },
    exam: { id: "exam-1", name: "Annual Examination" },
    tenant: { name: "Pathshala High School", address: "12 School Road" },
  };

  it("maps a raw API payload into a complete Studio Model without throwing", () => {
    const model = adaptPaperForPdf(rawApiPayload);

    expect(model.layout).toBeDefined();
    expect(typeof model.layout.isRTL).toBe("boolean");
    expect(model.layout.isRTL).toBe(false);
    expect(model.layout.numeralSystem).toBe("bengali");

    expect(model.header.instituteName).toBe("Pathshala High School");
    expect(model.header.subInstituteText).toBe("12 School Road");
    expect(model.header.examName).toBe("Annual Examination");
    expect(model.header.subjectName).toBe("Mathematics");
    expect(model.header.subjectCode).toBe("101");
    expect(model.header.gradeClass).toBe("Class Ten");
    expect(model.header.totalMarks).toBe("100");
    expect(model.header.specialInstructions).toBe("Answer all questions.");
    expect(model.header.examSet).toBe("SET-A");
  });

  it("normalizes hydrated sections and Question Bank option rows", () => {
    const model = adaptPaperForPdf(rawApiPayload);

    expect(model.sections).toHaveLength(1);
    const section = model.sections[0];
    expect(section.sectionId).toBe("sec-1");
    expect(section.title).toBe("Part A: Multiple Choice");
    expect(section.subTitle).toBe("Answer all questions");
    expect(section.questions).toHaveLength(2);

    const mcq = section.questions[0];
    expect(mcq.type).toBe("mcq");
    expect(mcq.mcqOptions).toEqual(["3", "4"]);
    expect(mcq.mcqCorrectIndex).toBe(1);

    const cq = section.questions[1];
    expect(cq.type).toBe("cq");
    expect(cq.qNumber).toBe("২");
  });

  it("maps DB question types to studio question types", () => {
    const model = adaptPaperForPdf({
      ...rawApiPayload,
      hydratedSections: [
        {
          questions: [
            { id: "a", type: "SHORT", questionText: "Q" },
            { id: "b", type: "DESCRIPTIVE", questionText: "Q" },
            { id: "c", type: "FILL_BLANK", questionText: "Q" },
            { id: "d", type: "TRUE_FALSE", questionText: "Q" },
            { id: "e", type: "SOMETHING_NEW", questionText: "Q" },
          ],
        },
      ],
    });

    const types = model.sections[0].questions.map((q) => q.type);
    expect(types).toEqual(["short", "descriptive", "fill-blanks", "mcq", "short"]);
  });

  it("formats timeAllowed from durationMinutes in the layout numeral system", () => {
    const model = adaptPaperForPdf(rawApiPayload);
    expect(model.header.timeAllowed).toBe("২h ৩০m");

    const english = adaptPaperForPdf({
      ...rawApiPayload,
      layout: { numeralSystem: "english" },
    });
    expect(english.header.timeAllowed).toBe("2h 30m");
  });

  it("passes an existing Studio Model through without data loss", () => {
    const studioPaper: ExamPaperStudioModel = {
      id: "studio-1",
      title: "Studio Paper",
      templateCategory: "cambridge-edexcel",
      header: {
        instituteName: "Custom Institute",
        examName: "Mock Exam",
        sessionYear: "2026",
        subjectName: "Physics",
        subjectCode: "0625",
        gradeClass: "Year 11",
        timeAllowed: "1 Hour",
        totalMarks: "80",
      },
      layout: {
        fontBengali: "noto",
        fontArabic: "amiri",
        numeralSystem: "english",
        pageFormat: "A4",
        columnLayout: "single",
        headerStyle: "cambridge-grid",
        fontSize: "md",
        lineSpacing: "normal",
        showWatermark: true,
        watermarkText: "DRAFT",
        watermarkOpacity: 0.05,
        watermarkType: "text",
        showBorder: false,
        borderStyle: "none",
        showHeaderCutLine: true,
        showOMRGrid: true,
        studentInfoBox: true,
        marksPosition: "right-bracket",
        numberingStyle: "english",
        showDottedAnswerLines: true,
        isRTL: false,
        headerArabicBismillah: false,
        showTeacherNotes: false,
        pageNumberingFormat: "english",
        marginSize: "wide",
      },
      sections: [
        {
          sectionId: "s1",
          title: "Section I",
          marksInstruction: "[10 x 1]",
          questions: [
            {
              id: "sq-1",
              type: "mcq",
              qNumber: "1",
              questionText: "Pick one",
              mcqOptions: ["x", "y", "z", "w"],
              mcqCorrectIndex: 2,
              marks: 1,
            },
          ],
        },
      ],
      lastModified: "2026-01-01T00:00:00.000Z",
      version: "2.0.0",
    };

    const model = adaptPaperForPdf(studioPaper);
    expect(model).toEqual(studioPaper);
  });

  it("falls back to safe defaults for null/undefined/partial inputs", () => {
    for (const input of [null, undefined, {}, { sections: null }]) {
      const model = adaptPaperForPdf(input);
      expect(model.layout.isRTL).toBe(false);
      expect(model.layout.numeralSystem).toBe("bengali");
      expect(model.header.instituteName).toBe("");
      expect(model.sections).toEqual([]);
    }
  });
});
