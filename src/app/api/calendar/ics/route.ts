import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAccess } from "@/lib/api-auth";
import { parseCalendarRange } from "@/lib/calendar-service";
import {
  getRecurrenceOccurrenceStarts,
  type CalendarRecurrence,
} from "@/lib/calendar-recurrence";

/** RFC 5545 text escaping. */
function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** RFC 5545 line folding at 75 octets. */
function foldIcsLine(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let remaining = line;
  parts.push(remaining.slice(0, 75));
  remaining = remaining.slice(75);
  while (remaining.length > 0) {
    parts.push(` ${remaining.slice(0, 74)}`);
    remaining = remaining.slice(74);
  }
  return parts.join("\r\n");
}

function icsDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

function icsDateTimeUtc(date: Date): string {
  return `${date.toISOString().slice(0, 19).replace(/[-:]/g, "")}Z`;
}

/**
 * GET /api/calendar/ics?start=...&end=...
 * Subscribable iCal feed of school events, holidays and exams for the window.
 * Module-generated items (homework, notices, fees, library) stay in the app
 * where their context lives; the feed carries date-anchored school happenings.
 */
export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;
    const { searchParams } = new URL(request.url);

    const range = parseCalendarRange(searchParams.get("start"), searchParams.get("end"));
    if (!range.ok) {
      return NextResponse.json({ error: range.error }, { status: 400 });
    }

    // Events with their recurrence expansion.
    const events = await prisma.calendarEvent.findMany({
      where: {
        tenantId,
        AND: [
          { startDate: { lte: range.to } },
          {
            OR: [
              { endDate: { gte: range.from } },
              { startDate: { gte: range.from } },
              { recurrence: { not: "NONE" } },
            ],
          },
        ],
      },
    });

    const holidays = await prisma.academicHoliday.findMany({
      where: {
        tenantId,
        startDate: { lte: range.to },
        endDate: { gte: range.from },
      },
    });

    const exams = await prisma.exam.findMany({
      where: { tenantId, startDate: { lte: range.to }, endDate: { gte: range.from } },
      select: { id: true, name: true, startDate: true, endDate: true },
    });

    type IcsEntry = {
      uid: string;
      title: string;
      start: Date;
      end: Date | null;
      allDay: boolean;
      location: string | null;
      description: string | null;
    };

    const entries: IcsEntry[] = [];

    for (const event of events) {
      const occurrenceStarts = getRecurrenceOccurrenceStarts({
        recurrence: event.recurrence as CalendarRecurrence,
        seriesStart: event.startDate,
        seriesEnd: event.endDate,
        recurrenceEndDate: event.recurrenceEndDate,
        windowStart: range.from,
        windowEnd: range.to,
      });
      occurrenceStarts.forEach((start, index) => {
        entries.push({
          uid: `${event.id}-${index}@calendar.pathshala-pro`,
          title: event.title,
          start,
          end: event.endDate
            ? new Date(start.getTime() + (event.endDate.getTime() - event.startDate.getTime()))
            : null,
          allDay: event.isAllDay,
          location: event.location,
          description: event.description,
        });
      });
    }

    for (const holiday of holidays) {
      entries.push({
        uid: `holiday-${holiday.id}@calendar.pathshala-pro`,
        title: holiday.title,
        start: holiday.startDate,
        end: holiday.endDate,
        allDay: true,
        location: null,
        description: holiday.description,
      });
    }

    for (const exam of exams) {
      entries.push({
        uid: `exam-${exam.id}@calendar.pathshala-pro`,
        title: exam.name,
        start: exam.startDate,
        end: exam.endDate,
        allDay: true,
        location: null,
        description: null,
      });
    }

    const lines: string[] = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Pathshala Pro//School Calendar//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
    ];

    for (const entry of entries) {
      lines.push("BEGIN:VEVENT");
      lines.push(foldIcsLine(`UID:${entry.uid}`));
      lines.push(foldIcsLine(`SUMMARY:${escapeIcsText(entry.title)}`));
      if (entry.allDay) {
        lines.push(`DTSTART;VALUE=DATE:${icsDateOnly(entry.start)}`);
        // DTEND is exclusive for DATE values.
        const exclusiveEnd = entry.end
          ? new Date(entry.end.getTime() + 86_400_000)
          : new Date(entry.start.getTime() + 86_400_000);
        lines.push(`DTEND;VALUE=DATE:${icsDateOnly(exclusiveEnd)}`);
      } else {
        lines.push(`DTSTART:${icsDateTimeUtc(entry.start)}`);
        lines.push(`DTEND:${icsDateTimeUtc(entry.end ?? entry.start)}`);
      }
      if (entry.location) {
        lines.push(foldIcsLine(`LOCATION:${escapeIcsText(entry.location)}`));
      }
      if (entry.description) {
        lines.push(foldIcsLine(`DESCRIPTION:${escapeIcsText(entry.description)}`));
      }
      lines.push("END:VEVENT");
    }

    lines.push("END:VCALENDAR");

    return new NextResponse(lines.join("\r\n") + "\r\n", {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'attachment; filename="calendar.ics"',
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to generate iCal feed" }, { status: 500 });
  }
}
