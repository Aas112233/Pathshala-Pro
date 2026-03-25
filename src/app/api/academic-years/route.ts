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
} from "@/lib/api-response";
import { createAcademicYearSchema, updateAcademicYearSchema } from "@/lib/schemas";
import { getAuthContext } from "@/lib/auth";
import { MAX_PAGE_SIZE } from "@/lib/constants";

/**
 * GET /api/academic-years
 * Get all academic years with pagination
 */
export async function GET(request: NextRequest) {
  try {
    const authContext = await getAuthContext(request);
    if (!authContext) {
      return unauthorized("Authentication required");
    }

    const { tenantId } = authContext;

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
    const totalCount = await prisma.academicYear.count({ where });

    // Get academic years
    const academicYears = await prisma.academicYear.findMany({
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
        createdAt: true,
      },
    });

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
    console.error("Get academic years error:", error);
    return errorResponse("Internal server error", 500);
  }
}

/**
 * POST /api/academic-years
 * Create a new academic year
 */
export async function POST(request: NextRequest) {
  try {
    const authContext = await getAuthContext(request);
    if (!authContext) {
      return unauthorized("Authentication required");
    }

    const { tenantId } = authContext;

    const body = await request.json();
    const validation = createAcademicYearSchema.safeParse(body);

    if (!validation.success) {
      const errors = validation.error.errors.map((err) => ({
        field: err.path.join("."),
        code: err.code,
        message: err.message,
      }));
      return validationError(errors);
    }

    const data = validation.data;

    // Check if year ID already exists
    const existingYear = await prisma.academicYear.findFirst({
      where: { tenantId, yearId: data.yearId },
    });

    if (existingYear) {
      return badRequest("Academic year already exists", [
        { field: "yearId", code: "duplicate", message: "Year ID already exists" },
      ]);
    }

    const academicYear = await prisma.academicYear.create({
      data: {
        tenantId,
        ...data,
      },
      select: {
        id: true,
        yearId: true,
        label: true,
        startDate: true,
        endDate: true,
        isClosed: true,
        createdAt: true,
      },
    });

    return successResponse(academicYear, "Academic year created successfully", 201);
  } catch (error) {
    console.error("Create academic year error:", error);
    return errorResponse("Internal server error", 500);
  }
}
