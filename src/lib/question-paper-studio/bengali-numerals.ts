import { NumeralSystem } from '@/types/exam-studio';

const BENGALI_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

export function toBengaliNumber(num: number | string): string {
  if (num === undefined || num === null) return '';
  const str = String(num);
  return str.replace(/[0-9]/g, (digit) => BENGALI_DIGITS[Number.parseInt(digit, 10)]);
}

export function toArabicNumber(num: number | string): string {
  if (num === undefined || num === null) return '';
  const str = String(num);
  return str.replace(/[0-9]/g, (digit) => ARABIC_DIGITS[Number.parseInt(digit, 10)]);
}

export function formatNumeral(value: number | string, system: NumeralSystem): string {
  if (value === undefined || value === null) return '';
  if (system === 'bengali') {
    return toBengaliNumber(value);
  }
  if (system === 'arabic') {
    return toArabicNumber(value);
  }
  return String(value);
}

export const CQ_PART_LABELS_BENGALI = {
  ka: 'ক',
  kha: 'খ',
  ga: 'গ',
  gha: 'ঘ',
};

export const CQ_PART_LABELS_ENGLISH = {
  ka: 'a',
  kha: 'b',
  ga: 'c',
  gha: 'd',
};

export const CQ_PART_LABELS_ARABIC = {
  ka: 'أ',
  kha: 'ب',
  ga: 'ج',
  gha: 'د',
};

export function getCQPartLabels(system: NumeralSystem) {
  if (system === 'bengali') return CQ_PART_LABELS_BENGALI;
  if (system === 'arabic') return CQ_PART_LABELS_ARABIC;
  return CQ_PART_LABELS_ENGLISH;
}

export const MCQ_OPTION_LABELS_BENGALI = ['(ক)', '(খ)', '(গ)', '(ঘ)'];
export const MCQ_OPTION_LABELS_ENGLISH = ['(A)', '(B)', '(C)', '(D)'];
export const MCQ_OPTION_LABELS_ARABIC = ['(أ)', '(ب)', '(ج)', '(د)'];

export function getOptionLabel(index: number, system: NumeralSystem): string {
  if (system === 'bengali') {
    return MCQ_OPTION_LABELS_BENGALI[index] || `(${index + 1})`;
  }
  if (system === 'arabic') {
    return MCQ_OPTION_LABELS_ARABIC[index] || `(${index + 1})`;
  }
  return MCQ_OPTION_LABELS_ENGLISH[index] || `(${index + 1})`;
}
