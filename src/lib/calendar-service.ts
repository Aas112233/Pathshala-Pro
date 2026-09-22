import { prisma } from "@/lib/prisma";
import {
  getRecurrenceOccurrenceStarts,
  type CalendarRecurrence,
} from "@/lib/calendar-recurrence";

/**
 * Calendar aggregation service.
 *
 * The calendar is a VIEW over existing modules (exams, homework, notices, fee
 * dues, library returns, holidays) plus the free-form CalendarEvent table.
 * Nothing is duplicated: items are projected from their source of truth at
 * query time, so editing an exam immediately updates the calendar.
 */

export type CalendarItemSource =
  | "EVENT"
  | "HOLIDAY"
  | "EXAM"
  | "HOMEWORK"
  | "NOTICE"
  | "FEE_DUE"
  | "LIBRARY_DUE";

export interface CalendarItem {
  /** Unique per rendered occurrence, e.g. `EVENT:abc123:3`. */
  id: string;
  source: CalendarItemSource;
  /** Raw record id (without occurrence suffix) for click-through navigation. */
  sourceId: string;
  /** English fallback label; the client composes localized labels by source. */
  title: string;
  category: string;
  color: string;
  start: string;
  /** Inclusive end instant for timed events; for multi-day all-day events it is the last day's end-of-day. */
  end: string | null;
  isAllDay: boolean;
  location?: string | null;
  description?: string | null;
  href?: string | null;
  classId?: string | null;
  sectionId?: string | null;
  meta?: Record<string, unknown>;
}

export interface GetCalendarItemsParams {
  tenantId: string;
  from: Date;
  to: Date;
  classId?: string;
  sectionId?: string;
  canReadFees: boolean;
  canReadLibrary: boolean;
  /** Portal roles (STUDENT/PARENT) only see published exams. */
  isPortalUser: boolean;
}

const AGGREGATE_HARD_CAP = 2000;

function eventHref(source: CalendarItemSource, sourceId: string): string | null {
  switch (source) {
    case "EXAM":
      return `/exams/${sourceId}`;
    case "HOMEWORK":
      return "/homework";
    case "NOTICE":
      return "/notices";
    case "FEE_DUE":
      return "/fees";
    case "LIBRARY_DUE":
      return "/library";
    default:
      return null;
  }
}

export async function getCalendarItems(params: GetCalendarItemsParams): Promise<CalendarItem[]> {
  const { tenantId, from, to, classId, sectionId, canReadFees, canReadLibrary, isPortalUser } =
    params;

  const classScope =
    classId && sectionId
      ? { classId, sectionId }
      : classId
        ? { classId }
        : null;

  const items: CalendarItem[] = [];

  // 1. Free-form calendar events (with recurrence expansion).
  const events = await prisma.calendarEvent.findMany({
    where: {
      tenantId,
      AND: [
        { startDate: { lte: to } },
        {
          OR: [
            { endDate: { gte: from } },
            { startDate: { gte: from } },
            { recurrence: { not: "NONE" } },
          ],
        },
        ...(classScope ? [{ OR: [classScope, { classId: null }] }] : []),
      ],
    },
    orderBy: { startDate: "asc" },
  });

  for (const event of events) {
    const occurrenceStarts = getRecurrenceOccurrenceStarts({
      recurrence: event.recurrence as CalendarRecurrence,
      seriesStart: event.startDate,
      seriesEnd: event.endDate,
      recurrenceEndDate: event.recurrenceEndDate,
      windowStart: from,
      windowEnd: to,
    });

    occurrenceStarts.forEach((start, index) => {
      const end = event.endDate
        ? new Date(start.getTime() + (event.endDate.getTime() - event.startDate.getTime()))
        : null;
      items.push({
        id: `EVENT:${event.id}:${index}`,
        source: "EVENT",
        sourceId: event.id,
        title: event.title,
        category: event.category,
        color: event.color,
        start: start.toISOString(),
        end: end ? end.toISOString() : null,
        isAllDay: event.isAllDay,
        location: event.location,
        description: event.description,
        href: null,
        classId: event.classId,
        sectionId: event.sectionId,
        meta: {
          audience: event.audience,
          recurrence: event.recurrence,
          isRecurring: event.recurrence !== "NONE",
        },
      });
    });
  }

  // 2. Academic holidays (source of truth lives in the academic-year setup).
  const holidays = await prisma.academicHoliday.findMany({
    where: { tenantId, startDate: { lte: to }, endDate: { gte: from } },
    orderBy: { startDate: "asc" },
  });

  for (const holiday of holidays) {
    items.push({
      id: `HOLIDAY:${holiday.id}`,
      source: "HOLIDAY",
      sourceId: holiday.id,
      title: holiday.title,
      category: "HOLIDAY",
      color: "rose",
      start: holiday.startDate.toISOString(),
      end: holiday.endDate.toISOString(),
      isAllDay: true,
      description: holiday.description,
      href: null,
      meta: { holidayType: holiday.holidayType },
    });
  }

  // 3. Exams.
  const exams = await prisma.exam.findMany({
    where: {
      tenantId,
      startDate: { lte: to },
      endDate: { gte: from },
      ...(isPortalUser ? { isPublished: true } : {}),
    },
    orderBy: { startDate: "asc" },
    select: { id: true, name: true, type: true, isPublished: true, startDate: true, endDate: true },
  });

  for (const exam of exams) {
    items.push({
      id: `EXAM:${exam.id}`,
      source: "EXAM",
      sourceId: exam.id,
      title: exam.name,
      category: "EXAM",
      color: "violet",
      start: exam.startDate.toISOString(),
      end: exam.endDate.toISOString(),
      isAllDay: true,
      href: eventHref("EXAM", exam.id),
      meta: { examType: exam.type, isPublished: exam.isPublished },
    });
  }

  // 4. Homework due dates.
  const homeworks = await prisma.homework.findMany({
    where: {
      tenantId,
      dueDate: { gte: from, lte: to },
      ...(classScope ?? {}),
    },
    orderBy: { dueDate: "asc" },
    select: {
      id: true,
      title: true,
      dueDate: true,
      classId: true,
      sectionId: true,
      subject: { select: { name: true } },
    },
    take: AGGREGATE_HARD_CAP,
  });

  for (const homework of homeworks) {
    items.push({
      id: `HOMEWORK:${homework.id}`,
      source: "HOMEWORK",
      sourceId: homework.id,
      title: homework.title,
      category: "HOMEWORK",
      color: "amber",
      start: homework.dueDate.toISOString(),
      end: null,
      isAllDay: true,
      href: eventHref("HOMEWORK", homework.id),
      classId: homework.classId,
      sectionId: homework.sectionId,
      meta: { subjectName: homework.subject?.name ?? null },
    });
  }

  // 5. Published notices pinned on their publish date.
  const notices = await prisma.notice.findMany({
    where: {
      tenantId,
      isPublished: true,
      publishDate: { gte: from, lte: to },
    },
    orderBy: { publishDate: "asc" },
    select: { id: true, title: true, publishDate: true, category: true },
    take: AGGREGATE_HARD_CAP,
  });

  for (const notice of notices) {
    items.push({
      id: `NOTICE:${notice.id}`,
      source: "NOTICE",
      sourceId: notice.id,
      title: notice.title,
      category: "NOTICE",
      color: "slate",
      start: notice.publishDate.toISOString(),
      end: null,
      isAllDay: true,
      href: eventHref("NOTICE", notice.id),
      meta: { noticeCategory: notice.category },
    });
  }

  // 6. Fee due dates (staff with fees read only; grouped per day, never per student).
  if (canReadFees) {
    const vouchers = await prisma.feeVoucher.findMany({
      where: {
        tenantId,
        dueDate: { gte: from, lte: to },
        balance: { gt: 0 },
        voidedAt: null,
      },
      select: { dueDate: true, balance: true, feeType: true },
      take: AGGREGATE_HARD_CAP,
    });

    const byDay = new Map<string, { count: number; totalBalance: number }>();
    for (const voucher of vouchers) {
      const dayKey = voucher.dueDate.toISOString().slice(0, 10);
      const bucket = byDay.get(dayKey) ?? { count: 0, totalBalance: 0 };
      bucket.count += 1;
      bucket.totalBalance += Number(voucher.balance);
      byDay.set(dayKey, bucket);
    }

    for (const [dayKey, bucket] of byDay) {
      items.push({
        id: `FEE_DUE:${dayKey}`,
        source: "FEE_DUE",
        sourceId: dayKey,
        title: "",
        category: "FEE",
        color: "emerald",
        start: `${dayKey}T00:00:00.000Z`,
        end: null,
        isAllDay: true,
        href: eventHref("FEE_DUE", dayKey),
        meta: { voucherCount: bucket.count, totalBalance: bucket.totalBalance },
      });
    }
  }

  // 7. Library return deadlines (unreturned issues due in range).
  if (canReadLibrary) {
    const bookIssues = await prisma.bookIssue.findMany({
      where: {
        tenantId,
        returnDate: null,
        dueDate: { gte: from, lte: to },
      },
      orderBy: { dueDate: "asc" },
      select: {
        id: true,
        dueDate: true,
        borrowerName: true,
        book: { select: { title: true } },
      },
      take: AGGREGATE_HARD_CAP,
    });

    for (const issue of bookIssues) {
      items.push({
        id: `LIBRARY_DUE:${issue.id}`,
        source: "LIBRARY_DUE",
        sourceId: issue.id,
        title: issue.book.title,
        category: "LIBRARY",
        color: "blue",
        start: issue.dueDate.toISOString(),
        end: null,
        isAllDay: true,
        href: eventHref("LIBRARY_DUE", issue.id),
        meta: { borrowerName: issue.borrowerName },
      });
    }
  }

  items.sort((a, b) => a.start.localeCompare(b.start));
  return items;
}

/**
 * Validates and normalizes a query window. The calendar never serves more than
 * a leap year at once — agenda-style "all history" queries would balloon the
 * per-module scans above.
 */
export function parseCalendarRange(startParam: string | null, endParam: string | null):
  | { ok: true; from: Date; to: Date }
  | { ok: false; error: string } {
  if (!startParam || !endParam) {
    return { ok: false, error: "start and end query parameters are required" };
  }
  const from = new Date(startParam);
  const to = new Date(endParam);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return { ok: false, error: "start and end must be valid ISO dates" };
  }
  if (to.getTime() < from.getTime()) {
    return { ok: false, error: "end cannot be before start" };
  }
  if (to.getTime() - from.getTime() > 366 * 86_400_000) {
    return { ok: false, error: "range cannot exceed 366 days" };
  }
  return { ok: true, from, to };
}
