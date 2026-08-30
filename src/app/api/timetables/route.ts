import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  badRequest,
  validationError,
  handleApiError,
} from "@/lib/api-response";
import {
  createTimetableSchema,
  bulkTimetableSchema,
} from "@/lib/schemas";
import { requireApiAccess } from "@/lib/api-auth";

/**
 * GET /api/timetables
 * Query: classId (required), sectionId?, academicYearId?, dayOfWeek?
 */
export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get("classId");
    const sectionId = searchParams.get("sectionId");
    const academicYearId = searchParams.get("academicYearId");
    const dayOfWeek = searchParams.get("dayOfWeek");

    if (!classId) {
      return badRequest("classId is required");
    }

    const where: any = { tenantId, classId };
    if (sectionId) where.sectionId = sectionId;
    else if (searchParams.has("sectionId") && !sectionId) {
      // explicitly request class-level (no section)
      where.sectionId = null;
    }
    if (academicYearId) where.academicYearId = academicYearId;
    if (dayOfWeek) where.dayOfWeek = dayOfWeek;

    const entries = await prisma.timetable.findMany({
      where,
      include: {
        subject: { select: { id: true, name: true, code: true } },
        staffProfile: { select: { id: true, firstName: true, lastName: true, staffId: true } },
        class: { select: { id: true, name: true, classId: true } },
        section: { select: { id: true, name: true, shortName: true } },
      },
      orderBy: [{ dayOfWeek: "asc" }, { periodNumber: "asc" }],
    });

    return successResponse(entries, "Timetable retrieved");
  } catch (error) {
    return handleApiError(error);
  }
}

async function checkTeacherClash(
  tenantId: string,
  staffProfileId: string,
  dayOfWeek: string,
  periodNumber: number,
  academicYearId?: string | null,
  excludeId?: string
) {
  if (!staffProfileId) return null;
  const clash = await prisma.timetable.findFirst({
    where: {
      tenantId,
      ...(academicYearId ? { academicYearId } : {}),
      staffProfileId,
      dayOfWeek,
      periodNumber,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    include: {
      class: { select: { name: true } },
      section: { select: { name: true } },
    },
  });
  return clash;
}

/**
 * POST /api/timetables
 * Body: single entry OR { entries: [...] } for bulk
 */
export async function POST(request: NextRequest) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;
    const body = await request.json();

    // Bulk path
    if (body.entries && Array.isArray(body.entries)) {
      const parsed = bulkTimetableSchema.safeParse(body);
      if (!parsed.success) {
        const errors = parsed.error.errors.map((e) => ({
          field: e.path.join("."),
          code: e.code,
          message: e.message,
        }));
        return validationError(errors);
      }

      // Validate clashes for each entry before writing
      for (const e of parsed.data.entries) {
        if (e.staffProfileId) {
          const clash = await checkTeacherClash(tenantId, e.staffProfileId, e.dayOfWeek, e.periodNumber, e.academicYearId);
          if (clash) {
            return badRequest(
              `Teacher clash: already assigned to ${clash.class.name}${clash.section ? ` - ${clash.section.name}` : ""} on ${e.dayOfWeek} period ${e.periodNumber}`,
              [{ field: "staffProfileId", code: "clash", message: "Teacher already booked" }]
            );
          }
        }
      }

      const created = await prisma.$transaction(
        parsed.data.entries.map((e) =>
          prisma.timetable.create({
            data: {
              tenantId,
              academicYearId: e.academicYearId || null,
              classId: e.classId,
              sectionId: e.sectionId || null,
              dayOfWeek: e.dayOfWeek,
              periodNumber: e.periodNumber,
              startTime: e.startTime,
              endTime: e.endTime,
              subjectId: e.subjectId || null,
              staffProfileId: e.staffProfileId || null,
              roomNumber: e.roomNumber || null,
              isBreak: e.isBreak ?? false,
              breakLabel: e.breakLabel || null,
            },
          })
        )
      );

      return successResponse(created, "Timetable bulk created", 201);
    }

    const parsed = createTimetableSchema.safeParse(body);
    if (!parsed.success) {
      const errors = parsed.error.errors.map((e) => ({
        field: e.path.join("."),
        code: e.code,
        message: e.message,
      }));
      return validationError(errors);
    }

    const d = parsed.data;

    if (d.staffProfileId) {
          const clash = await checkTeacherClash(tenantId, d.staffProfileId, d.dayOfWeek, d.periodNumber, d.academicYearId);
      if (clash) {
        return badRequest(
          `Teacher clash: already assigned to ${clash.class.name}${clash.section ? ` - ${clash.section.name}` : ""} on ${d.dayOfWeek} period ${d.periodNumber}`,
          [{ field: "staffProfileId", code: "clash", message: "Teacher already booked at this slot" }]
        );
      }
    }

    // Unique slot check (class+section+day+period)
    const slotTaken = await prisma.timetable.findFirst({
      where: {
        tenantId,
        academicYearId: d.academicYearId || null,
        classId: d.classId,
        sectionId: d.sectionId || null,
        dayOfWeek: d.dayOfWeek,
        periodNumber: d.periodNumber,
      },
    });
    if (slotTaken) {
      return badRequest("Slot already occupied for this class/section/day/period", [
        { field: "periodNumber", code: "duplicate", message: "Period already exists" },
      ]);
    }

    const entry = await prisma.timetable.create({
      data: {
        tenantId,
        academicYearId: d.academicYearId || null,
        classId: d.classId,
        sectionId: d.sectionId || null,
        dayOfWeek: d.dayOfWeek,
        periodNumber: d.periodNumber,
        startTime: d.startTime,
        endTime: d.endTime,
        subjectId: d.subjectId || null,
        staffProfileId: d.staffProfileId || null,
        roomNumber: d.roomNumber || null,
        isBreak: d.isBreak ?? false,
        breakLabel: d.breakLabel || null,
      },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        staffProfile: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return successResponse(entry, "Timetable entry created", 201);
  } catch (error: any) {
    if (error?.code === "P2002") {
      return badRequest("Duplicate timetable slot", [
        { field: "periodNumber", code: "duplicate", message: "Slot already exists" },
      ]);
    }
    return handleApiError(error);
  }
}
