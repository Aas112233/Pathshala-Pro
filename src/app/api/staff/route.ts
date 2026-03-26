import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  paginatedResponse,
  errorResponse,
  badRequest,
  unauthorized,
  validationError,
  notFound,
} from "@/lib/api-response";
import { createStaffSchema, updateStaffSchema } from "@/lib/schemas";
import { getAuthContext } from "@/lib/auth";
import { MAX_PAGE_SIZE } from "@/lib/constants";
import { hasPermission } from "@/lib/permissions";

export const runtime = 'edge';

/**
 * GET /api/staff
 * Get all staff members with pagination
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
    const department = searchParams.get("department") || "";
    const isActive = searchParams.get("isActive");

    const skip = (page - 1) * limit;

    const where: any = { tenantId };

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { staffId: { contains: search, mode: "insensitive" } },
        { designation: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    if (department) {
      where.department = department;
    }

    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === "true";
    }

    const totalCount = await prisma.staffProfile.count({ where });

    const staff = await prisma.staffProfile.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        staffId: true,
        firstName: true,
        lastName: true,
        department: true,
        designation: true,
        baseSalary: true,
        phone: true,
        email: true,
        isActive: true,
        hireDate: true,
        createdAt: true,
      },
    });

    const totalPages = Math.ceil(totalCount / limit);

    return paginatedResponse(staff, {
      totalCount,
      currentPage: page,
      pageSize: limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    });
  } catch (error) {
    console.error("Get staff error:", error);
    return errorResponse("Internal server error", 500);
  }
}

/**
 * POST /api/staff
 * Create a new staff member
 */
export async function POST(request: NextRequest) {
  try {
    const authContext = await getAuthContext(request);
    if (!authContext) {
      return unauthorized("Authentication required");
    }

    const { tenantId } = authContext;

    const body = await request.json();
    const validation = createStaffSchema.safeParse(body);

    if (!validation.success) {
      const errors = validation.error.errors.map((err) => ({
        field: err.path.join("."),
        code: err.code,
        message: err.message,
      }));
      return validationError(errors);
    }

    const data = validation.data;

    // Check if staff ID already exists
    const existingStaff = await prisma.staffProfile.findFirst({
      where: { tenantId, staffId: data.staffId },
    });

    if (existingStaff) {
      return badRequest("Staff member already exists", [
        { field: "staffId", code: "duplicate", message: "Staff ID already exists" },
      ]);
    }

    const staff = await prisma.staffProfile.create({
      data: {
        tenantId,
        ...data,
      },
      select: {
        id: true,
        staffId: true,
        firstName: true,
        lastName: true,
        department: true,
        designation: true,
        baseSalary: true,
        email: true,
        phone: true,
        isActive: true,
        hireDate: true,
        createdAt: true,
      },
    });

    return successResponse(staff, "Staff member created successfully", 201);
  } catch (error) {
    console.error("Create staff error:", error);
    return errorResponse("Internal server error", 500);
  }
}
