import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, notFound, validationError, handleApiError } from "@/lib/api-response";
import { requireApiAccess } from "@/lib/api-auth";
import { updateCalendarEventSchema } from "@/lib/schemas";

/**
 * PUT /api/calendar/[id]
 * Update a calendar event (series-level: recurrence edits apply to the whole series).
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireApiAccess(request, { action: "write" });
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;
    const { id } = await params;

    const existing = await prisma.calendarEvent.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      return notFound("Calendar event not found");
    }

    const body = await request.json();
    const validation = updateCalendarEventSchema.safeParse(body);
    if (!validation.success) {
      const errors = validation.error.errors.map((err) => ({
        field: err.path.join("."),
        code: err.code,
        message: err.message,
      }));
      return validationError(errors);
    }

    const data = validation.data;
    const event = await prisma.calendarEvent.update({
      where: { id: existing.id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description || null }),
        ...(data.category !== undefined && { category: data.category }),
        ...(data.location !== undefined && { location: data.location || null }),
        ...(data.color !== undefined && { color: data.color }),
        ...(data.startDate !== undefined && { startDate: new Date(data.startDate) }),
        ...(data.endDate !== undefined && { endDate: data.endDate ? new Date(data.endDate) : null }),
        ...(data.isAllDay !== undefined && { isAllDay: data.isAllDay }),
        ...(data.recurrence !== undefined && { recurrence: data.recurrence }),
        ...(data.recurrenceEndDate !== undefined && {
          recurrenceEndDate: data.recurrenceEndDate ? new Date(data.recurrenceEndDate) : null,
        }),
        ...(data.audience !== undefined && { audience: data.audience }),
        ...(data.classId !== undefined && { classId: data.classId || null }),
        ...(data.sectionId !== undefined && { sectionId: data.sectionId || null }),
      },
    });

    return successResponse(event, "Calendar event updated successfully");
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/calendar/[id]
 * Delete a calendar event (whole series for recurring events).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireApiAccess(request, { action: "write" });
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;
    const { id } = await params;

    const existing = await prisma.calendarEvent.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      return notFound("Calendar event not found");
    }

    await prisma.calendarEvent.delete({
      where: { id: existing.id },
    });

    return successResponse(null, "Calendar event deleted successfully");
  } catch (error) {
    return handleApiError(error);
  }
}
