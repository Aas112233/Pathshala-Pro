import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, badRequest, validationError, handleApiError } from "@/lib/api-response";
import { requireApiAccess } from "@/lib/api-auth";
import { createCalendarEventSchema } from "@/lib/schemas";
import { hasPermission, getEffectivePermissions } from "@/lib/permissions";
import { getCalendarItems, parseCalendarRange } from "@/lib/calendar-service";

/**
 * GET /api/calendar?start=...&end=...&classId=...&sectionId=...
 * Aggregated calendar items across modules (events, holidays, exams,
 * homework, notices, fee dues, library dues) for the requested window.
 */
export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { tenantId, user } = access.authContext;
    const { searchParams } = new URL(request.url);

    const range = parseCalendarRange(searchParams.get("start"), searchParams.get("end"));
    if (!range.ok) {
      return badRequest(range.error);
    }

    const perms = getEffectivePermissions(
      user.role,
      (user as any).permissions,
      (user as any).accessLevel
    );
    const isPortalUser = user.role === "STUDENT" || user.role === "PARENT";

    const items = await getCalendarItems({
      tenantId,
      from: range.from,
      to: range.to,
      classId: searchParams.get("classId") || undefined,
      sectionId: searchParams.get("sectionId") || undefined,
      canReadFees: hasPermission(perms, "fees", "read"),
      canReadLibrary: hasPermission(perms, "library", "read"),
      isPortalUser,
    });

    return successResponse(items);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/calendar
 * Create a free-form calendar event.
 */
export async function POST(request: NextRequest) {
  try {
    const access = await requireApiAccess(request, { action: "write" });
    if ("response" in access) return access.response;

    const { tenantId, user } = access.authContext;

    const body = await request.json();
    const validation = createCalendarEventSchema.safeParse(body);
    if (!validation.success) {
      const errors = validation.error.errors.map((err) => ({
        field: err.path.join("."),
        code: err.code,
        message: err.message,
      }));
      return validationError(errors);
    }

    const data = validation.data;

    const event = await prisma.calendarEvent.create({
      data: {
        tenantId,
        title: data.title,
        description: data.description || null,
        category: data.category,
        location: data.location || null,
        color: data.color,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : null,
        isAllDay: data.isAllDay,
        recurrence: data.recurrence,
        recurrenceEndDate: data.recurrenceEndDate ? new Date(data.recurrenceEndDate) : null,
        audience: data.audience,
        classId: data.classId || null,
        sectionId: data.sectionId || null,
        createdById: user.id,
      },
    });

    return successResponse(event, "Calendar event created successfully", 201);
  } catch (error) {
    return handleApiError(error);
  }
}
