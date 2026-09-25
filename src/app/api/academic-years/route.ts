import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  paginatedResponse,
  errorResponse,
  badRequest,
  unauthorized,
  forbidden,
  validationError,
  handleApiError,
} from "@/lib/api-response";
import { createAcademicYearSchema, updateAcademicYearSchema } from "@/lib/schemas";
import { requireApiAccess } from "@/lib/api-auth";
import { clearAcademicYearCache } from "@/lib/academic-year-guards";
import { logAuditEvent } from "@/lib/audit-logger";
import { MAX_PAGE_SIZE } from "@/lib/constants";

/**
 * GET /api/academic-years
 * Get all academic years with pagination
 */
export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), MAX_PAGE_SIZE);
    const search = searchParams.get("search") || "";
    const isClosed = searchParams.get("isClosed");

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = { tenantId };

    if (search) {
      where.OR = [
        { yearId: { contains: search, mode: "insensitive" } },
        { label: { contains: search, mode: "insensitive" } },
      ];
    }

    if (isClosed !== null && isClosed !== undefined) {
      where.isClosed = isClosed === "true";
    }

    // Get total count
    const [totalCount, academicYears] = await Promise.all([
      prisma.academicYear.count({ where }),
      prisma.academicYear.findMany({
      where,
      skip,
      take: limit,
      orderBy: { startDate: "desc" },
      select: {
        id: true,
        yearId: true,
        label: true,
        startDate: true,
        endDate: true,
        isClosed: true,
        isCurrent: true,
        createdAt: true,
      },
    })
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return paginatedResponse(academicYears, {
      totalCount,
      currentPage: page,
      pageSize: limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/academic-years
 * Create a new academic year
 */
export async function POST(request: NextRequest) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { tenantId, user } = access.authContext;

    const body = await request.json();
    const validation = createAcademicYearSchema.safeParse(body);

    if (!validation.success) {
      const invalidDate = validation.error.errors.find((err) =>
        err.code === "custom" && (err.path[0] === "startDate" || err.path[0] === "endDate")
      );
      if (invalidDate) {
        const field = String(invalidDate.path[0]);
        return badRequest(field === "startDate" ? "Invalid start date" : "Invalid end date", [
          { field, code: "invalid", message: invalidDate.message },
        ]);
      }
      const errors = validation.error.errors.map((err) => ({
        field: err.path.join("."),
        code: err.code,
        message: err.message,
      }));
      return validationError(errors);
    }

    const data = validation.data;

    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);

    if (isNaN(startDate.getTime())) {
      return badRequest("Invalid start date", [
        { field: "startDate", code: "invalid", message: "Start date must be a valid date" },
      ]);
    }

    if (isNaN(endDate.getTime())) {
      return badRequest("Invalid end date", [
        { field: "endDate", code: "invalid", message: "End date must be a valid date" },
      ]);
    }

    if (startDate >= endDate) {
      return badRequest("Invalid dates", [
        { field: "startDate", code: "invalid", message: "Start date must be before end date" },
      ]);
    }

    // Check if year ID already exists
    const existingYear = await prisma.academicYear.findFirst({
      where: { tenantId, yearId: data.yearId },
    });

    if (existingYear) {
      return badRequest("Academic year already exists", [
        { field: "yearId", code: "duplicate", message: "Year ID already exists" },
      ]);
    }

    // The first year an institute creates becomes its current year. Without
    // that, a fresh tenant would have academic years but no answer to "which
    // year are we in", and every read would fall through to the date-range
    // inference — which is exactly the guesswork `isCurrent` exists to remove.
    const academicYear = await prisma.$transaction(async (tx) => {
      const created = await tx.academicYear.create({
        data: {
          tenantId,
          yearId: data.yearId,
          label: data.label,
          startDate,
          endDate,
        },
        select: {
          id: true,
          yearId: true,
          label: true,
          startDate: true,
          endDate: true,
          isClosed: true,
          isCurrent: true,
          createdAt: true,
        },
      });

      const existingCurrent = await tx.academicYear.findFirst({
        where: { tenantId, isCurrent: true, isClosed: false },
        select: { id: true },
      });

      if (!existingCurrent) {
        await tx.academicYear.update({ where: { id: created.id }, data: { isCurrent: true } });
        created.isCurrent = true;
      }

      // Written inside the transaction: an academic year that exists without a
      // record of who created it is not auditable.
      await logAuditEvent(
        {
          tenantId,
          userId: user.id,
          userEmail: user.email,
          action: "CREATE",
          entity: "AcademicYear",
          entityId: created.id,
          details: {
            yearId: created.yearId,
            label: created.label,
            startDate: created.startDate,
            endDate: created.endDate,
            isCurrent: created.isCurrent,
          },
        },
        tx
      );

      return created;
    });

    clearAcademicYearCache();

    return successResponse(academicYear, "Academic year created successfully", 201);
  } catch (error) {
    return handleApiError(error);
  }
}
