import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  badRequest,
  notFound,
  validationError,
  handleApiError,
} from "@/lib/api-response";
import { updateTimetableSchema } from "@/lib/schemas";
import { requireApiAccess } from "@/lib/api-auth";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;
    const { id } = await params;

    const existing = await prisma.timetable.findFirst({
      where: { id, tenantId },
    });
    if (!existing) return notFound("Timetable entry not found");

    const body = await request.json();
    const parsed = updateTimetableSchema.safeParse(body);
    if (!parsed.success) {
      const errors = parsed.error.errors.map((e) => ({
        field: e.path.join("."),
        code: e.code,
        message: e.message,
      }));
      return validationError(errors);
    }

    const d = parsed.data;

    // Teacher clash check if teacher/day/period changed
    const nextTeacher = d.staffProfileId !== undefined ? d.staffProfileId : existing.staffProfileId;
    const nextDay = (d.dayOfWeek as string) ?? existing.dayOfWeek;
    const nextPeriod = d.periodNumber ?? existing.periodNumber;

    if (nextTeacher) {
      const clash = await prisma.timetable.findFirst({
        where: {
          tenantId,
          staffProfileId: nextTeacher,
          dayOfWeek: nextDay,
          periodNumber: nextPeriod,
          id: { not: id },
        },
        include: { class: { select: { name: true } }, section: { select: { name: true } } },
      });
      if (clash) {
        return badRequest(
          `Teacher clash: already assigned to ${clash.class.name}${clash.section ? ` - ${clash.section.name}` : ""} on ${nextDay} period ${nextPeriod}`,
          [{ field: "staffProfileId", code: "clash", message: "Teacher already booked" }]
        );
      }
    }

    // Slot uniqueness check if class/section/day/period changed
    const nextClass = d.classId ?? existing.classId;
    const nextSection = d.sectionId !== undefined ? d.sectionId : existing.sectionId;
    const nextYear = d.academicYearId !== undefined ? d.academicYearId : existing.academicYearId;

    if (
      d.classId !== undefined ||
      d.sectionId !== undefined ||
      d.dayOfWeek !== undefined ||
      d.periodNumber !== undefined ||
      d.academicYearId !== undefined
    ) {
      const slotTaken = await prisma.timetable.findFirst({
        where: {
          tenantId,
          academicYearId: nextYear || null,
          classId: nextClass,
          sectionId: nextSection || null,
          dayOfWeek: nextDay,
          periodNumber: nextPeriod,
          id: { not: id },
        },
      });
      if (slotTaken) {
        return badRequest("Slot already occupied", [
          { field: "periodNumber", code: "duplicate", message: "Period already exists" },
        ]);
      }
    }

    const updated = await prisma.timetable.update({
      where: { id },
      data: {
        ...(d.academicYearId !== undefined && { academicYearId: d.academicYearId || null }),
        ...(d.classId !== undefined && { classId: d.classId }),
        ...(d.sectionId !== undefined && { sectionId: d.sectionId || null }),
        ...(d.dayOfWeek !== undefined && { dayOfWeek: d.dayOfWeek }),
        ...(d.periodNumber !== undefined && { periodNumber: d.periodNumber }),
        ...(d.startTime !== undefined && { startTime: d.startTime }),
        ...(d.endTime !== undefined && { endTime: d.endTime }),
        ...(d.subjectId !== undefined && { subjectId: d.subjectId || null }),
        ...(d.staffProfileId !== undefined && { staffProfileId: d.staffProfileId || null }),
        ...(d.roomNumber !== undefined && { roomNumber: d.roomNumber || null }),
        ...(d.isBreak !== undefined && { isBreak: d.isBreak }),
        ...(d.breakLabel !== undefined && { breakLabel: d.breakLabel || null }),
      },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        staffProfile: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return successResponse(updated, "Timetable updated");
  } catch (error: any) {
    if (error?.code === "P2002") {
      return badRequest("Duplicate slot", [
        { field: "periodNumber", code: "duplicate", message: "Slot already exists" },
      ]);
    }
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;
    const { id } = await params;

    const existing = await prisma.timetable.findFirst({ where: { id, tenantId } });
    if (!existing) return notFound("Timetable entry not found");

    await prisma.timetable.delete({ where: { id } });

    return successResponse(null, "Timetable entry deleted");
  } catch (error) {
    return handleApiError(error);
  }
}
