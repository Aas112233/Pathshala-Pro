export type BengaliFontFamily = 'hind' | 'tiro' | 'noto' | 'anek' | 'system';
export type ArabicFontFamily = 'amiri' | 'system';
export type NumeralSystem = 'bengali' | 'english' | 'arabic';
export type PageFormat = 'A4' | 'Legal' | 'Letter';
export type ColumnLayout = 'single' | 'two-column' | 'three-column' | 'duplex-booklet';
export type HeaderStyle = 'classic-center' | 'modern-dual' | 'minimal-left' | 'madrasah-ornate' | 'cambridge-grid';
export type BorderStyle = 'none' | 'solid' | 'double' | 'dashed' | 'dotted' | 'ornamental';
export type MarksPosition = 'right-bracket' | 'inline-parentheses' | 'left-margin' | 'hidden';
export type NumberingStyle = 'bengali' | 'english' | 'roman' | 'parentheses-bengali' | 'parentheses-english' | 'q-prefix';

export type QuestionType =
  | 'cq' // Creative Question (সৃজনশীল)
  | 'mcq' // Multiple Choice (বহুনির্বাচনী)
  | 'mcq-polynomial' // Polynomial Multiple Choice (বহুপদী সমাপ্তিসূচক)
  | 'passage' // Reading Passage + questions
  | 'short' // Short Questions (সংক্ষিপ্ত প্রশ্ন)
  | 'fill-blanks' // Fill in blanks (শূন্যস্থান পূরণ)
  | 'matching' // Column Matching (বাম-ডান মিলকরণ)
  | 'math-proof' // Math / Theorem / Equation (উপপাদ্য / সমাধান)
  | 'grammar-cloze' // Grammar / Transformation (ব্যাকরণ)
  | 'arabic-hadith' // Arabic RTL / Quranic Ayah / Hadith
  | 'descriptive' // Essay / Paragraph / Composition
  | 'worksheet-trace'; // Primary Tracing / Fill lines

export interface CQParts {
  ka: { text: string; marks: number; label?: string };
  kha: { text: string; marks: number; label?: string };
  ga: { text: string; marks: number; label?: string };
  gha?: { text: string; marks: number; label?: string };
}

export interface QuestionImage {
  url: string;
  caption?: string;
  position: 'center' | 'left' | 'right';
  widthPercent: number;
}

export interface SubQuestion {
  id: string;
  label: string;
  text: string;
  marks: number;
}

export interface QuestionItem {
  id: string;
  type: QuestionType;
  qNumber: string;
  stimulus?: string; // উদ্দীপক / Passage / Context
  stimulusImage?: QuestionImage;
  questionText: string;
  marks?: number | string;
  cqParts?: CQParts;
  mcqOptions?: string[]; // 4 options
  mcqCorrectIndex?: number;
  polynomialStatements?: string[]; // [i, ii, iii]
  polynomialQuestionText?: string; // "নিচের কোনটি সঠিক?"
  matchingColumns?: {
    left: string[];
    right: string[];
  };
  fillBlanksOptions?: string[]; // Clue box
  subQuestions?: SubQuestion[];
  orAlternative?: {
    questionText: string;
    cqParts?: CQParts;
    subQuestions?: SubQuestion[];
  };
  isRTL?: boolean;
  notesForExaminer?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  cognitiveLevel?: 'জ্ঞান' | 'অনুধাবন' | 'প্রয়োগ' | 'উচ্চতর দক্ষতা' | 'সমন্বিত';
  dottedLinesCount?: number; // Blank answer lines
}

export interface ExamSection {
  sectionId: string;
  title: string; // e.g., "ক-বিভাগ : গদ্য (সৃজনশীল)" / "Part A : Reading Test"
  subTitle?: string; // e.g., "যেকোনো ৪টি প্রশ্নের উত্তর দাও"
  marksInstruction?: string; // e.g., "[৪ × ১০ = ৪০]"
  isRTL?: boolean;
  questions: QuestionItem[];
}

export interface ExamPaperHeader {
  instituteName: string;
  subInstituteText?: string;
  examName: string;
  sessionYear: string;
  subjectName: string;
  subjectCode: string;
  gradeClass: string;
  timeAllowed: string;
  totalMarks: string;
  specialInstructions?: string;
  logoUrl?: string;
  bismillahHeader?: boolean;
  bismillahArabicText?: string;
  examSet?: string;
  departmentName?: string;
  courseCode?: string;
}

export interface LayoutSettings {
  fontBengali: BengaliFontFamily;
  fontArabic: ArabicFontFamily;
  numeralSystem: NumeralSystem;
  pageFormat: PageFormat;
  columnLayout: ColumnLayout;
  headerStyle: HeaderStyle;
  fontSize: 'compact' | 'sm' | 'md' | 'lg' | 'xl';
  lineSpacing: 'tight' | 'normal' | 'relaxed' | 'spacious';
  showWatermark: boolean;
  watermarkText: string;
  watermarkOpacity: number;
  watermarkType: 'text' | 'logo';
  showBorder: boolean;
  borderStyle: BorderStyle;
  showHeaderCutLine: boolean;
  showOMRGrid: boolean;
  studentInfoBox: boolean; // Student Name, Roll, Section box
  marksPosition: MarksPosition;
  numberingStyle: NumberingStyle;
  showDottedAnswerLines: boolean;
  isRTL: boolean;
  headerArabicBismillah: boolean;
  showTeacherNotes: boolean;
  pageNumberingFormat: 'bengali' | 'english' | 'none';
  marginSize: 'compact' | 'standard' | 'wide';
}

export interface ExamPaperStudioModel {
  id: string;
  title: string;
  templateCategory:
    | 'nctb-general'
    | 'nctb-english'
    | 'nctb-math'
    | 'madrasah-board'
    | 'cambridge-edexcel'
    | 'cbse-icse'
    | 'primary-worksheet'
    | 'university-final'
    | 'class-test-slip';
  header: ExamPaperHeader;
  layout: LayoutSettings;
  sections: ExamSection[];
  lastModified: string;
  version: string;
}

export interface BatchSetOptions {
  sets: string[]; // ['Set-A', 'Set-B', 'Set-C']
  shuffleQuestions: boolean;
  shuffleMCQOptions: boolean;
  generateTeacherKey: boolean;
}
