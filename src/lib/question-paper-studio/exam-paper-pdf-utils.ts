import type {
  MarksPosition,
  NumberingStyle,
  NumeralSystem,
  PageFormat,
} from "@/types/exam-studio";
import { formatNumeral } from "./bengali-numerals";

type FontSizeSetting = "compact" | "sm" | "md" | "lg" | "xl";
type LineSpacingSetting = "tight" | "normal" | "relaxed" | "spacious";
type MarginSizeSetting = "compact" | "standard" | "wide";

/**
 * Pure presentation helpers shared by the @react-pdf question-paper template.
 * Kept free of react-pdf imports so they stay unit-testable in Node.
 */

// ---------------------------------------------------------------------------
// Rich-text → plain text (the studio editor stores sanitized HTML; the PDF
// template must never print raw tags the way the HTML preview never shows them)
// ---------------------------------------------------------------------------
const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
};

export function stripHtml(html: unknown): string {
  if (typeof html !== "string" || html.length === 0) return "";
  const decode = (s: string) =>
    s.replace(/&(?:amp|lt|gt|quot|nbsp|#39);/g, (m) => HTML_ENTITIES[m] ?? m);
  if (!html.includes("<")) return decode(html).trim();
  return decode(html)
    .replace(/<\s*(br|p|div|li|tr|h[1-6])[^>]*>/gi, "\n")
    .replace(/<\/\s*(p|div|li|tr|h[1-6]|ul|ol)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

// ---------------------------------------------------------------------------
// Localized chrome labels (the PDF has no next-intl context, so the paper's
// own numeralSystem picks the label set — same convention the preview's
// Bengali-first UI follows)
// ---------------------------------------------------------------------------
export interface PdfLabels {
  subject: string;
  class: string;
  fullMarks: string;
  time: string;
  set: string;
  code: string;
  cutLine: string;
  studentName: string;
  rollNo: string;
  section: string;
  instructions: string;
  marks: string;
  or: string;
  endOfPaper: string;
  context: string;
  columnA: string;
  columnB: string;
}

const LABELS_EN: PdfLabels = {
  subject: "Subject",
  class: "Class",
  fullMarks: "Full Marks",
  time: "Time",
  set: "Set",
  code: "Code",
  cutLine: "Cut here",
  studentName: "Student Name",
  rollNo: "Roll No.",
  section: "Section",
  instructions: "General Instructions",
  marks: "Marks",
  or: "OR",
  endOfPaper: "End of Question Paper",
  context: "Context",
  columnA: "Column A",
  columnB: "Column B",
};

const LABELS_BN: PdfLabels = {
  subject: "বিষয়",
  class: "শ্রেণি",
  fullMarks: "পূর্ণমান",
  time: "সময়",
  set: "সেট",
  code: "কোড",
  cutLine: "এখানে কাটুন",
  studentName: "শিক্ষার্থীর নাম",
  rollNo: "রোল নং",
  section: "শাখা",
  instructions: "সাধারণ নির্দেশাবলি",
  marks: "নম্বর",
  or: "অথবা",
  endOfPaper: "প্রশ্নপত্র সমাপ্ত",
  context: "উদ্দীপক",
  columnA: "ক-কলাম",
  columnB: "খ-কলাম",
};

const LABELS_AR: PdfLabels = {
  subject: "الموضوع",
  class: "الصف",
  fullMarks: "الدرجة الكلية",
  time: "الوقت",
  set: "المجموعة",
  code: "الرمز",
  cutLine: "قص هنا",
  studentName: "اسم الطالب",
  rollNo: "رقم الجلوس",
  section: "القسم",
  instructions: "تعليمات عامة",
  marks: "درجة",
  or: "أو",
  endOfPaper: "نهاية ورقة الأسئلة",
  context: "السياق",
  columnA: "العمود أ",
  columnB: "العمود ب",
};

export function resolvePdfLabels(system: NumeralSystem): PdfLabels {
  if (system === "bengali") return LABELS_BN;
  if (system === "arabic") return LABELS_AR;
  return LABELS_EN;
}

// ---------------------------------------------------------------------------
// Numbering styles (mirrors the studio canvas options)
// ---------------------------------------------------------------------------
export function toRoman(num: number): string {
  if (!Number.isFinite(num) || num < 1) return String(num);
  const table: Array<[number, string]> = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
    [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
    [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let n = Math.floor(num);
  let out = "";
  for (const [value, glyph] of table) {
    while (n >= value) {
      out += glyph;
      n -= value;
    }
  }
  return out;
}

/** Format a question number the same way the HTML preview numbers it. */
export function formatQuestionNumber(
  raw: unknown,
  fallbackIndex: number,
  style: NumberingStyle,
  system: NumeralSystem
): string {
  const base = String(raw ?? "").trim() || String(fallbackIndex + 1);
  const localized = formatNumeral(base, system);
  switch (style) {
    case "roman":
      return toRoman(Number.parseInt(base, 10)) || localized;
    case "parentheses-bengali":
      return `(${formatNumeral(base, "bengali")})`;
    case "parentheses-english":
      return `(${formatNumeral(base, "english")})`;
    case "q-prefix":
      return `Q. ${localized}`;
    case "bengali":
      return formatNumeral(base, "bengali");
    case "english":
    default:
      return localized;
  }
}

// ---------------------------------------------------------------------------
// Marks position (preview renders `[x]` right-aligned by default)
// ---------------------------------------------------------------------------
export interface PlacedMarks {
  prefix: string;
  suffix: string;
}

export function placeMarks(
  marks: unknown,
  position: MarksPosition,
  system: NumeralSystem
): PlacedMarks {
  if (marks === undefined || marks === null || marks === "") return { prefix: "", suffix: "" };
  if (position === "hidden") return { prefix: "", suffix: "" };
  const val = typeof marks === "number" || typeof marks === "string" ? marks : String(marks);
  const n = formatNumeral(val, system);
  if (position === "inline-parentheses") return { prefix: "", suffix: ` (${n})` };
  if (position === "left-margin") return { prefix: `[${n}] `, suffix: "" };
  return { prefix: "", suffix: ` [${n}]` }; // right-bracket (default)
}

// ---------------------------------------------------------------------------
// Page geometry + typography maps (match the studio canvas scale)
// ---------------------------------------------------------------------------
export function pdfPageSize(format: PageFormat): "A4" | "LEGAL" | "LETTER" {
  if (format === "Legal") return "LEGAL";
  if (format === "Letter") return "LETTER";
  return "A4";
}

export function pdfPagePadding(margin: MarginSizeSetting): number {
  if (margin === "compact") return 28;
  if (margin === "wide") return 60;
  return 44; // standard
}

type FontSizeMap = Record<FontSizeSetting, number>;

const QUESTION_SIZES: FontSizeMap = {
  compact: 10.5,
  sm: 11,
  md: 12,
  lg: 13.5,
  xl: 15,
};

export function pdfTypeScale(size: FontSizeSetting): {
  question: number;
  small: number;
  meta: number;
  section: number;
  institute: number;
  exam: number;
} {
  const question = QUESTION_SIZES[size] ?? QUESTION_SIZES.md;
  const k = question / QUESTION_SIZES.md;
  return {
    question,
    small: Math.max(8, 10 * k),
    meta: Math.max(8.5, 11 * k),
    section: Math.max(11, 14 * k),
    institute: Math.max(16, 20 * k),
    exam: Math.max(14, 18 * k),
  };
}

export function pdfLineHeight(spacing: LineSpacingSetting): number {
  if (spacing === "tight") return 1.25;
  if (spacing === "relaxed") return 1.7;
  if (spacing === "spacious") return 2.0;
  return 1.5; // normal
}

/** Column widths for multi-column question flow (single → full width). */
export function pdfQuestionColumnWidth(columns: number): string {
  if (columns === 3) return "31%";
  if (columns === 2) return "48%";
  return "100%";
}
