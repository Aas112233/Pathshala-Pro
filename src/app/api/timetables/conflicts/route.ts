import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, badRequest, handleApiError } from "@/lib/api-response";
import { requireApiAccess } from "@/lib/api-auth";

/**
 * GET /api/timetables/conflicts?staffProfileId=&dayOfWeek=&periodNumber=
 * Returns clash if teacher already booked at that slot.
 */
export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;
    const { searchParams } = new URL(request.url);
    const staffProfileId = searchParams.get("staffProfileId");
    const dayOfWeek = searchParams.get("dayOfWeek");
    const periodNumber = searchParams.get("periodNumber");

    if (!staffProfileId || !dayOfWeek || !periodNumber) {
      return badRequest("staffProfileId, dayOfWeek and periodNumber are required");
    }

    const clash = await prisma.timetable.findFirst({
      where: {
        tenantId,
        staffProfileId,
        dayOfWeek,
        periodNumber: parseInt(periodNumber, 10),
      },
      include: {
        class: { select: { name: true, classId: true } },
        section: { select: { name: true } },
        subject: { select: { name: true } },
      },
    });

    return successResponse({ clash: clash || null, hasClash: !!clash });
  } catch (error) {
    return handleApiError(error);
  }
}
