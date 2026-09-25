import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, badRequest, validationError, handleApiError } from "@/lib/api-response";
import { requireApiAccess } from "@/lib/api-auth";
import { assertAcademicYearOpen } from "@/lib/academic-year-guards";
import { createAcademicHolidaySchema } from "@/lib/schemas";

/**
 * GET /api/holidays?academicYearId=...
 * List academic holidays for a year (read: calendar module).
 */
export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;
    const { searchParams } = new URL(request.url);
    const academicYearId = searchParams.get("academicYearId");

    if (!academicYearId) {
      return badRequest("academicYearId query parameter is required");
    }

    const holidays = await prisma.academicHoliday.findMany({
      where: { tenantId, academicYearId },
      orderBy: { startDate: "asc" },
    });

    return successResponse(holidays);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/holidays
 * Create an academic holiday (write: calendar module).
 */
export async function POST(request: NextRequest) {
  try {
    const access = await requireApiAccess(request, { action: "write" });
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;

    const body = await request.json();
    const validation = createAcademicHolidaySchema.safeParse(body);
    if (!validation.success) {
      const errors = validation.error.errors.map((err) => ({
        field: err.path.join("."),
        code: err.code,
        message: err.message,
      }));
      return validationError(errors);
    }

    const data = validation.data;

    if (!data.endDate || new Date(data.endDate) < new Date(data.startDate)) {
      return badRequest("End date cannot be before start date");
    }

    // A holiday is a year-scoped calendar record, so a closed year must not gain
    // one. This also scopes the year to the tenant: the create below writes the
    // id straight through, so without the guard a caller could attach a holiday
    // to another tenant's year.
    await assertAcademicYearOpen(tenantId, data.academicYearId);

    const holiday = await prisma.academicHoliday.create({
      data: {
        tenantId,
        academicYearId: data.academicYearId,
        title: data.title,
        holidayType: data.holidayType,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        description: data.description || null,
      },
    });

    return successResponse(holiday, "Holiday created successfully", 201);
  } catch (error) {
    return handleApiError(error);
  }
}
