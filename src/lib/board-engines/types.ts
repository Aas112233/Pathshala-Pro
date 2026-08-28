/**
 * Board-agnostic types for assessment → promotion pipeline.
 * Pure data contracts — no DB, no side effects.
 */

export type Board = 'NCTB' | 'CBSE' | 'FBISE';

export type BoardGradingSystem = 'GPA' | 'PERCENTAGE';

export interface SubjectComponentInput {
  type: string; // THEORY | PRACTICAL | MCQ | CA | INTERNAL | VIVA
  obtained: number;
  max: number;
  weightage?: number; // default 1.0 — CBSE uses 0.8 / 0.2
  pass?: number;
}

export interface SubjectMark {
  subjectId: string;
  subjectCode: string;
  subjectName?: string;
  category: 'COMPULSORY' | 'ELECTIVE' | 'OPTIONAL' | 'FOURTH';
  isFourth?: boolean;
  obtained: number;
  max: number;
  pass: number;
  components?: SubjectComponentInput[];
}

export interface SubjectResult {
  subjectId: string;
  subjectCode: string;
  obtained: number;
  max: number;
  percentage: number;
  grade: string;
  gradePoint: number;
  status: 'PASS' | 'FAIL' | 'ABSENT';
  isFourth?: boolean;
}

export interface BoardResult {
  subjectResults: SubjectResult[];
  overallPercentage: number;
  overallGpa?: number; // GPA boards only
  totalObtained: number;
  totalMax: number;
  failedCount: number;
  absentCount: number;
  promotionEligible: boolean;
  // Board-specific extras
  bonusPoints?: number; // NCTB 4th subject bonus
  bestOfReplacedId?: string | null; // CBSE
}

export interface NctbOptions {
  paperPairs?: Record<string, string[]>; // e.g. {BENGALI:['BAN1','BAN2']}
  fourthSubjectId?: string | null;
  gradingScale?: BoardGradingSystem;
}

export interface CbseOptions {
  bestOf5?: boolean; // true → 6th (FOURTH) may replace lowest core
  internalWeight?: number; // default 0.2
  boardWeight?: number; // default 0.8
}

export interface FbisePart {
  subjects: SubjectMark[];
}

// Grace policy — tenant-configured
export interface GracePolicy {
  maxPerSubject: number;
  maxPerStudent: number;
  autoApply?: boolean;
}
