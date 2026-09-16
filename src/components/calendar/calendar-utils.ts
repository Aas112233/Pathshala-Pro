import {
  BookOpen,
  CalendarDays,
  Circle,
  ClipboardCheck,
  FileText,
  Library,
  Megaphone,
  Music,
  Receipt,
  Sun,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { CalendarItem } from "@/lib/calendar-service";

/**
 * All-day items are stored at UTC midnight (the date the school means), so the
 * intended calendar date is read from the UTC parts — not the viewer's local
 * offset, which would shift the day for tenants in negative UTC offsets.
 * Timed items carry real instants and use local components directly.
 */
export function itemStartDate(item: CalendarItem): Date {
  if (item.isAllDay) return utcDatePartsToLocal(item.start);
  return new Date(item.start);
}

export function itemEndDate(item: CalendarItem): Date {
  if (item.isAllDay) return utcDatePartsToLocal(item.end ?? item.start);
  return new Date(item.end ?? item.start);
}

function utcDatePartsToLocal(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function endOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

export function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

const WEEKDAY_INDEX: Record<string, number> = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };

export function firstDayOfWeekIndex(firstDayOfWeekSetting: string): number {
  return WEEKDAY_INDEX[firstDayOfWeekSetting] ?? 0;
}

export function startOfWeek(date: Date, weekStartsOn: number): Date {
  const day = startOfDay(date);
  const diff = (day.getDay() - weekStartsOn + 7) % 7;
  return addDays(day, -diff);
}

/** 42-cell month grid starting at the configured week start. */
export function monthGridCells(anchor: Date, weekStartsOn: number): Date[] {
  const firstOfMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const gridStart = startOfWeek(firstOfMonth, weekStartsOn);
  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
}

/** Local "YYYY-MM-DD" for all-day form payloads (server stores it at UTC midnight). */
export function toISODateLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function toLocalDateTimeIso(date: Date, time: string): string {
  const [h, min] = time.split(":").map(Number);
  const composed = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    h ?? 0,
    min ?? 0,
    0,
    0
  );
  return composed.toISOString();
}

/** Local "HH:mm" from an instant, for prefilling time inputs. */
export function extractTime(iso: string): string {
  const date = new Date(iso);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export const CALENDAR_COLOR_STYLES: Record<string, string> = {
  blue: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30",
  amber: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  emerald: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  rose: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30",
  violet: "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/30",
  slate: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30",
};

export function itemColorClass(item: CalendarItem): string {
  return CALENDAR_COLOR_STYLES[item.color] ?? CALENDAR_COLOR_STYLES.blue;
}

const SOURCE_ICONS: Record<string, LucideIcon> = {
  EVENT: CalendarDays,
  HOLIDAY: Sun,
  EXAM: FileText,
  HOMEWORK: BookOpen,
  NOTICE: Megaphone,
  FEE_DUE: Receipt,
  LIBRARY_DUE: Library,
};

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  MEETING: Users,
  PTM: Users,
  SPORTS: Trophy,
  CULTURAL: Music,
  ADMISSION_TEST: ClipboardCheck,
  OTHER: Circle,
};

export function itemIcon(item: CalendarItem): LucideIcon {
  return CATEGORY_ICONS[item.category] ?? SOURCE_ICONS[item.source] ?? CalendarDays;
}

/** Timetable day keys are "MONDAY".. "SATURDAY". */
export function dayOfWeekKey(date: Date): string {
  return [
    "SUNDAY",
    "MONDAY",
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
    "SATURDAY",
  ][date.getDay()];
}
