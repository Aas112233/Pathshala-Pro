import { z } from "zod";

// Accept calendar dates and timezone-qualified ISO timestamps used by existing forms.
// Check the calendar components before Date parsing, which can normalize February 30.
export function isValidDateInput(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|[+-]\d{2}:\d{2}))?$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > daysInMonth[month - 1]) return false;

  if (match[4] !== undefined) {
    if (Number(match[4]) > 23 || Number(match[5]) > 59 || Number(match[6] || 0) > 59) return false;
    const offset = match[8];
    if (offset !== "Z" && (Number(offset.slice(1, 3)) > 23 || Number(offset.slice(4, 6)) > 59)) return false;
  }
  return Number.isFinite(new Date(value).getTime());
}

export function todayDateString(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function isValidBirthDate(value: string, today = todayDateString()): boolean {
  return isValidDateInput(value) && value.slice(0, 10) <= today;
}

export function isDateRangeValid(start: string, end: string, allowSameDay = true): boolean {
  if (!isValidDateInput(start) || !isValidDateInput(end)) return false;
  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();
  return allowSameDay ? startTime <= endTime : startTime < endTime;
}

export function dateInputSchema(label = "Date") {
  return z.string().min(1, `${label} is required`).refine(isValidDateInput, `${label} must be a valid date`);
}

export function validateDateRangeFields(
  data: { startDate?: string; endDate?: string | null; recurrenceEndDate?: string | null },
  ctx: z.RefinementCtx,
): void {
  if (data.startDate && data.endDate && !isDateRangeValid(data.startDate, data.endDate)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "End date cannot be before start date", path: ["endDate"] });
  }
  // Recurrence end is an inclusive calendar day, even for a timed event.
  if (data.startDate && data.recurrenceEndDate && data.recurrenceEndDate.slice(0, 10) < data.startDate.slice(0, 10)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Recurrence end cannot be before start date", path: ["recurrenceEndDate"] });
  }
}

export const optionalDateInputSchema = dateInputSchema().optional().or(z.literal(""));
export const birthDateSchema = dateInputSchema("Date of birth")
  .refine((value) => isValidBirthDate(value), "Date of birth cannot be in the future")
  .optional().or(z.literal(""));
