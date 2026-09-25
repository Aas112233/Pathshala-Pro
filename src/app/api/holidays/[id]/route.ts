import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, notFound, validationError, handleApiError } from "@/lib/api-response";
import { requireApiAccess } from "@/lib/api-auth";
import { assertAcademicYearOpen } from "@/lib/academic-year-guards";
import { updateAcademicHolidaySchema } from "@/lib/schemas";

/**
 * PUT /api/holidays/[id]
 * Update an academic holiday.
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

    const existing = await prisma.academicHoliday.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      return notFound("Holiday not found");
    }

    // The holiday's own year governs, not any year in the request: the update
    // schema cannot move a holiday between years, so editing the dates of a
    // holiday in a closed year is still an edit to a closed year.
    await assertAcademicYearOpen(tenantId, existing.academicYearId);

    const body = await request.json();
    const validation = updateAcademicHolidaySchema.safeParse(body);
    if (!validation.success) {
      const errors = validation.error.errors.map((err) => ({
        field: err.path.join("."),
        code: err.code,
        message: err.message,
      }));
      return validationError(errors);
    }

    const data = validation.data;
    if (data.startDate !== undefined || data.endDate !== undefined) {
      const rangeValidation = updateAcademicHolidaySchema.safeParse({
        startDate: data.startDate ?? existing.startDate.toISOString(),
        endDate: data.endDate ?? existing.endDate.toISOString(),
      });
      if (!rangeValidation.success) {
        return validationError(rangeValidation.error.errors.map((err) => ({
          field: err.path.join("."), code: err.code, message: err.message,
        })));
      }
    }
    const holiday = await prisma.academicHoliday.update({
      where: { id: existing.id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.holidayType !== undefined && { holidayType: data.holidayType }),
        ...(data.startDate !== undefined && { startDate: new Date(data.startDate) }),
        ...(data.endDate !== undefined && { endDate: new Date(data.endDate) }),
        ...(data.description !== undefined && { description: data.description || null }),
      },
    });

    return successResponse(holiday, "Holiday updated successfully");
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/holidays/[id]
 * Delete an academic holiday.
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

    const existing = await prisma.academicHoliday.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      return notFound("Holiday not found");
    }

    await assertAcademicYearOpen(tenantId, existing.academicYearId);

    await prisma.academicHoliday.delete({
      where: { id: existing.id },
    });

    return successResponse(null, "Holiday deleted successfully");
  } catch (error) {
    return handleApiError(error);
  }
}
