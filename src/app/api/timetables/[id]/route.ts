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
import { requireApiAccess, isTenantOwned } from "@/lib/api-auth";
import { assertAcademicYearOpen } from "@/lib/academic-year-guards";

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

    // The entry's year governs the write, whether or not this request is the
    // one changing it: editing the room of a slot that belongs to a closed year
    // is still an edit to a closed year's timetable.
    if (nextYear) {
      await assertAcademicYearOpen(tenantId, nextYear);
    }

    if (nextSection) {
      const section = await prisma.section.findFirst({
        where: { id: nextSection, tenantId, classId: nextClass },
        select: { id: true },
      });
      if (!section) {
        return badRequest("Section does not belong to the selected class", [
          { field: "sectionId", code: "invalid", message: "Select a section from the selected class" },
        ]);
      }
    }

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

    // FK-confusion guard: the relation targets must belong to this tenant,
    // and the include below returns the staff/subject names back to the caller.
    if (d.classId && !(await isTenantOwned(prisma.class, d.classId, tenantId))) {
      return badRequest("Selected class does not exist in your institution.");
    }
    if (d.sectionId && !(await isTenantOwned(prisma.section, d.sectionId, tenantId))) {
      return badRequest("Selected section does not exist in your institution.");
    }
    if (d.subjectId && !(await isTenantOwned(prisma.subject, d.subjectId, tenantId))) {
      return badRequest("Selected subject does not exist in your institution.");
    }
    if (d.staffProfileId && !(await isTenantOwned(prisma.staffProfile, d.staffProfileId, tenantId))) {
      return badRequest("Selected staff member does not exist in your institution.");
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

    // Deleting is the most consequential mutation of a closed year's timetable:
    // the slot cannot be reconstructed from anything else.
    if (existing.academicYearId) {
      await assertAcademicYearOpen(tenantId, existing.academicYearId);
    }

    await prisma.timetable.delete({ where: { id } });

    return successResponse(null, "Timetable entry deleted");
  } catch (error) {
    return handleApiError(error);
  }
}
