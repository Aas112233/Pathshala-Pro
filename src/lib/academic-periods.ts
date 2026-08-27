/**
 * Academic & Educational Period Management
 * Central source of truth for Academic Years, Semesters, Terms, Quarters, and Sessions.
 * Zero hardcoded educational periods.
 */

export interface AcademicYearData {
  id?: string;
  yearId?: string;
  label?: string;
  startDate: Date | string;
  endDate: Date | string;
  isClosed?: boolean;
}

export type AcademicPeriodType =
  | "YEAR"
  | "SEMESTER"
  | "TERM"
  | "QUARTER"
  | "SESSION";

export interface AcademicTermDefinition {
  id: string;
  nameKey: string;
  defaultName: string;
  code: string;
  type: AcademicPeriodType;
  sequence: number;
}

export const STANDARD_ACADEMIC_TERMS: AcademicTermDefinition[] = [
  { id: "term_1", nameKey: "academicPeriods.term1", defaultName: "1st Term", code: "T1", type: "TERM", sequence: 1 },
  { id: "term_2", nameKey: "academicPeriods.term2", defaultName: "2nd Term", code: "T2", type: "TERM", sequence: 2 },
  { id: "term_mid", nameKey: "academicPeriods.midterm", defaultName: "Mid-Term", code: "MID", type: "TERM", sequence: 3 },
  { id: "term_final", nameKey: "academicPeriods.finalTerm", defaultName: "Final Term", code: "FINAL", type: "TERM", sequence: 4 },
  { id: "term_annual", nameKey: "academicPeriods.annualTerm", defaultName: "Annual Term", code: "ANNUAL", type: "TERM", sequence: 5 },
];

export const STANDARD_SEMESTERS: AcademicTermDefinition[] = [
  { id: "sem_spring", nameKey: "academicPeriods.springSemester", defaultName: "Spring Semester", code: "SPRING", type: "SEMESTER", sequence: 1 },
  { id: "sem_summer", nameKey: "academicPeriods.summerSemester", defaultName: "Summer Session", code: "SUMMER", type: "SEMESTER", sequence: 2 },
  { id: "sem_fall", nameKey: "academicPeriods.fallSemester", defaultName: "Fall Semester", code: "FALL", type: "SEMESTER", sequence: 3 },
  { id: "sem_winter", nameKey: "academicPeriods.winterSemester", defaultName: "Winter Session", code: "WINTER", type: "SEMESTER", sequence: 4 },
];

export const STANDARD_SESSIONS: AcademicTermDefinition[] = [
  { id: "sess_morning", nameKey: "academicPeriods.morningSession", defaultName: "Morning Shift", code: "MORN", type: "SESSION", sequence: 1 },
  { id: "sess_day", nameKey: "academicPeriods.daySession", defaultName: "Day Shift", code: "DAY", type: "SESSION", sequence: 2 },
  { id: "sess_evening", nameKey: "academicPeriods.eveningSession", defaultName: "Evening Shift", code: "EVE", type: "SESSION", sequence: 3 },
];

export const STANDARD_QUARTERS: AcademicTermDefinition[] = [
  { id: "q1", nameKey: "academicPeriods.quarter1", defaultName: "Quarter 1", code: "Q1", type: "QUARTER", sequence: 1 },
  { id: "q2", nameKey: "academicPeriods.quarter2", defaultName: "Quarter 2", code: "Q2", type: "QUARTER", sequence: 2 },
  { id: "q3", nameKey: "academicPeriods.quarter3", defaultName: "Quarter 3", code: "Q3", type: "QUARTER", sequence: 3 },
  { id: "q4", nameKey: "academicPeriods.quarter4", defaultName: "Quarter 4", code: "Q4", type: "QUARTER", sequence: 4 },
];

/**
 * Derives a human-readable academic year label from start and end dates.
 * e.g. "2026-2027", "2026-27", or "2026"
 */
export function generateAcademicYearLabel(
  startDate: Date | string,
  endDate: Date | string,
  style: "full" | "short" | "auto" = "auto"
): string {
  const start = typeof startDate === "string" ? new Date(startDate) : startDate;
  const end = typeof endDate === "string" ? new Date(endDate) : endDate;

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    const currentYear = new Date().getFullYear();
    return `${currentYear}-${currentYear + 1}`;
  }

  const startYear = start.getFullYear();
  const endYear = end.getFullYear();

  if (startYear === endYear) {
    return `${startYear}`;
  }

  if (style === "short") {
    const shortEnd = String(endYear).slice(-2);
    return `${startYear}-${shortEnd}`;
  }

  return `${startYear}-${endYear}`;
}

/**
 * Formats an AcademicYear object into a standardized string with optional prefix.
 */
export function formatAcademicYear(
  year: AcademicYearData | string | null | undefined,
  prefix = "Academic Session"
): string {
  if (!year) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const label = `${currentYear}-${currentYear + 1}`;
    return prefix ? `${prefix}: ${label}` : label;
  }

  if (typeof year === "string") {
    return prefix ? `${prefix}: ${year}` : year;
  }

  const label =
    year.label ||
    generateAcademicYearLabel(year.startDate, year.endDate, "full");

  return prefix ? `${prefix}: ${label}` : label;
}

/**
 * Checks if a given academic year spans the current date.
 */
export function isCurrentAcademicYear(
  startDate: Date | string,
  endDate: Date | string
): boolean {
  const now = new Date();
  const start = typeof startDate === "string" ? new Date(startDate) : startDate;
  const end = typeof endDate === "string" ? new Date(endDate) : endDate;

  return now >= start && now <= end;
}
