import {
  ExamPaperStudioModel,
  ExamSection,
  LayoutSettings,
  NumeralSystem,
  QuestionItem,
  QuestionType,
} from "@/types/exam-studio";
import { formatNumeral } from "./bengali-numerals";

/**
 * Adapter: raw QuestionPaper API/DB payload → ExamPaperStudioModel.
 *
 * The QuestionPaper Prisma model persists DB-shaped JSON (`sections` with
 * `{ id, title, instructions, questionIds, questions }` holding Question Bank
 * rows typed "MCQ" | "CREATIVE_NCTB" | ... with `options: [{ id, text, isCorrect }]`).
 * The @react-pdf template however requires the Studio Model shape
 * (`header`, `layout`, `sections[].questions[]` with QuestionItem typing).
 * Feeding the raw payload to the template crashes on `paper.layout.isRTL`.
 *
 * This adapter is tolerant of both shapes and never throws, so a saved paper
 * can always be exported even if studio settings were never persisted.
 */

const DEFAULT_LAYOUT: LayoutSettings = {
  fontBengali: "hind",
  fontArabic: "amiri",
  numeralSystem: "bengali",
  pageFormat: "A4",
  columnLayout: "single",
  headerStyle: "classic-center",
  fontSize: "md",
  lineSpacing: "normal",
  showWatermark: false,
  watermarkText: "",
  watermarkOpacity: 0.08,
  watermarkType: "text",
  showBorder: true,
  borderStyle: "solid",
  showHeaderCutLine: false,
  showOMRGrid: false,
  studentInfoBox: true,
  marksPosition: "right-bracket",
  numberingStyle: "bengali",
  showDottedAnswerLines: false,
  isRTL: false,
  headerArabicBismillah: false,
  showTeacherNotes: false,
  pageNumberingFormat: "bengali",
  marginSize: "standard",
};

const NUMERAL_SYSTEMS: NumeralSystem[] = ["bengali", "english", "arabic"];

const DB_TYPE_TO_STUDIO: Record<string, QuestionType> = {
  MCQ: "mcq",
  TRUE_FALSE: "mcq",
  SHORT: "short",
  DESCRIPTIVE: "descriptive",
  CREATIVE_NCTB: "cq",
  FILL_BLANK: "fill-blanks",
};

const STUDIO_TYPES: ReadonlySet<string> = new Set<string>([
  "cq",
  "mcq",
  "mcq-polynomial",
  "passage",
  "short",
  "fill-blanks",
  "matching",
  "math-proof",
  "grammar-cloze",
  "arabic-hadith",
  "descriptive",
  "worksheet-trace",
]);

function normalizeType(raw: unknown): QuestionType {
  if (typeof raw === "string") {
    if (DB_TYPE_TO_STUDIO[raw]) return DB_TYPE_TO_STUDIO[raw];
    if (STUDIO_TYPES.has(raw)) return raw as QuestionType;
  }
  return "short";
}

function asString(value: unknown, fallback = ""): string {
  if (value === undefined || value === null) return fallback;
  return String(value);
}

function normalizeQuestion(raw: any, idx: number): QuestionItem {
  // Question Bank rows store options as [{ id: "A", text, isCorrect }].
  const options = Array.isArray(raw?.options) ? raw.options : null;
  const mcqOptions = options
    ? options.map((o: any) => asString(o?.text ?? o))
    : Array.isArray(raw?.mcqOptions)
      ? raw.mcqOptions.map((o: any) => asString(o))
      : undefined;
  const mcqCorrectIndex = options
    ? options.findIndex((o: any) => o?.isCorrect)
    : typeof raw?.mcqCorrectIndex === "number"
      ? raw.mcqCorrectIndex
      : undefined;

  return {
    id: asString(raw?.id, `q-${idx + 1}`),
    type: normalizeType(raw?.type),
    qNumber: asString(raw?.qNumber, String(idx + 1)),
    stimulus: raw?.stimulus || undefined,
    questionText: asString(raw?.questionText ?? raw?.text),
    marks: raw?.marks,
    cqParts: raw?.cqParts,
    mcqOptions: mcqOptions && mcqOptions.length > 0 ? mcqOptions : undefined,
    mcqCorrectIndex: mcqCorrectIndex !== undefined && mcqCorrectIndex >= 0 ? mcqCorrectIndex : undefined,
    polynomialStatements: raw?.polynomialStatements,
    polynomialQuestionText: raw?.polynomialQuestionText,
    matchingColumns: raw?.matchingColumns,
    fillBlanksOptions: raw?.fillBlanksOptions,
    subQuestions: raw?.subQuestions,
    orAlternative: raw?.orAlternative,
    isRTL: raw?.isRTL,
    dottedLinesCount: raw?.dottedLinesCount,
  };
}

function normalizeSections(raw: unknown): ExamSection[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((sec: any, sIdx: number): ExamSection => {
    const rawQuestions = Array.isArray(sec?.questions) ? sec.questions : [];
    return {
      sectionId: asString(sec?.sectionId ?? sec?.id, `sec-${sIdx + 1}`),
      title: asString(sec?.title, `Section ${sIdx + 1}`),
      subTitle: sec?.subTitle || sec?.instructions || undefined,
      marksInstruction: sec?.marksInstruction || undefined,
      isRTL: sec?.isRTL,
      questions: rawQuestions.map(normalizeQuestion),
    };
  });
}

function normalizeNumeralSystem(raw: unknown): NumeralSystem {
  return NUMERAL_SYSTEMS.includes(raw as NumeralSystem) ? (raw as NumeralSystem) : "bengali";
}

/**
 * Convert a raw QuestionPaper payload (DB row hydrated by the API) — or an
 * existing Studio Model — into a complete `ExamPaperStudioModel` that the PDF
 * template can render without touching undefined properties.
 */
export function adaptPaperForPdf(raw: any): ExamPaperStudioModel {
  const safeRaw = raw && typeof raw === "object" ? raw : {};
  const layout = { ...DEFAULT_LAYOUT, ...(safeRaw.layout ?? {}) };
  layout.numeralSystem = normalizeNumeralSystem(layout.numeralSystem);
  layout.isRTL = Boolean(layout.isRTL);

  const duration = Number(safeRaw.durationMinutes) || 0;
  const hours = Math.floor(duration / 60);
  const minutes = duration % 60;
  const ns = layout.numeralSystem;
  const timeAllowed =
    duration > 0 ? `${formatNumeral(hours, ns)}h ${formatNumeral(minutes, ns)}m` : "";

  const header = {
    instituteName: asString(safeRaw.header?.instituteName ?? safeRaw.tenant?.name),
    subInstituteText: asString(safeRaw.header?.subInstituteText ?? safeRaw.tenant?.address) || undefined,
    examName: asString(safeRaw.header?.examName ?? safeRaw.exam?.name ?? safeRaw.title),
    sessionYear: asString(safeRaw.header?.sessionYear ?? safeRaw.academicYear?.label),
    subjectName: asString(safeRaw.header?.subjectName ?? safeRaw.subject?.name),
    subjectCode: asString(safeRaw.header?.subjectCode ?? safeRaw.subject?.code),
    gradeClass: asString(safeRaw.header?.gradeClass ?? safeRaw.class?.name),
    timeAllowed: asString(safeRaw.header?.timeAllowed, timeAllowed),
    totalMarks: asString(safeRaw.header?.totalMarks, String(safeRaw.totalMarks ?? "")),
    specialInstructions: safeRaw.header?.specialInstructions ?? safeRaw.instructions ?? undefined,
    examSet: safeRaw.header?.examSet ?? safeRaw.code ?? undefined,
  };

  return {
    id: asString(safeRaw.id),
    title: asString(safeRaw.title),
    templateCategory: safeRaw.templateCategory ?? "nctb-general",
    header,
    layout,
    sections: normalizeSections(safeRaw.hydratedSections ?? safeRaw.sections),
    lastModified: asString(safeRaw.updatedAt ?? safeRaw.lastModified, new Date().toISOString()),
    version: asString(safeRaw.version, "1.0.0"),
  };
}
