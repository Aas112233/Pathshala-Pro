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
import { requireApiAccess } from "@/lib/api-auth";
import { MAX_PAGE_SIZE } from "@/lib/constants";

/**
 * GET /api/staff
 * Get all staff members with pagination
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

    const [totalCount, staff] = await Promise.all([
      prisma.staffProfile.count({ where }),
      prisma.staffProfile.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        staffId: true,
        firstName: true,
        lastName: true,
        firstNameBn: true,
        lastNameBn: true,
        department: true,
        designation: true,
        baseSalary: true,
        phone: true,
        email: true,
        isActive: true,
        hireDate: true,
        joiningDate: true,
        qualification: true,
        gender: true,
        dateOfBirth: true,
        address: true,
        profilePictureUrl: true,
        driveFileId: true,
        userId: true,
        createdAt: true,
        updatedAt: true,
      },
    })
    ]);

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
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;

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

    let staffId = data.staffId;

    if (!staffId) {
      // Auto-generate staff ID uniquely with 4-digit sequence number
      const latestStaff = await prisma.staffProfile.findFirst({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
      });

      const currentYear = new Date().getFullYear();
      let nextNumber = 1;

      if (latestStaff && latestStaff.staffId.startsWith(`STAFF-${currentYear}-`)) {
        const parts = latestStaff.staffId.split("-");
        const lastNum = parseInt(parts[2], 10);
        if (!isNaN(lastNum)) {
          nextNumber = lastNum + 1;
        }
      }

      // Keep incrementing if it randomly collides due to race conditions or manual entry
      let isUnique = false;
      while (!isUnique) {
        staffId = `STAFF-${currentYear}-${nextNumber.toString().padStart(4, "0")}`; // 4-digit padding
        const collision = await prisma.staffProfile.findFirst({ where: { tenantId, staffId } });
        if (!collision) isUnique = true;
        else nextNumber++;
      }
    } else {
      // Check if provided staff ID already exists
      const existingStaff = await prisma.staffProfile.findFirst({
        where: { tenantId, staffId },
      });

      if (existingStaff) {
        return badRequest("Staff member already exists", [
          { field: "staffId", code: "duplicate", message: "Staff ID already exists" },
        ]);
      }
    }

    const staff = await prisma.staffProfile.create({
      data: {
        tenantId,
        staffId,
        firstName: data.firstName,
        lastName: data.lastName,
        firstNameBn: data.firstNameBn,
        lastNameBn: data.lastNameBn,
        department: data.department,
        designation: data.designation,
        baseSalary: data.baseSalary,
        email: data.email,
        phone: data.phone,
        isActive: data.isActive ?? true,
        hireDate: new Date(data.hireDate),
        joiningDate: data.joiningDate ? new Date(data.joiningDate) : null,
        qualification: data.qualification,
        gender: data.gender,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
        address: data.address,
        profilePictureUrl: data.profilePictureUrl,
        driveFileId: data.driveFileId,
        userId: data.userId,
      },
      select: {
        id: true,
        staffId: true,
        firstName: true,
        lastName: true,
        firstNameBn: true,
        lastNameBn: true,
        department: true,
        designation: true,
        baseSalary: true,
        email: true,
        phone: true,
        isActive: true,
        hireDate: true,
        joiningDate: true,
        qualification: true,
        gender: true,
        dateOfBirth: true,
        address: true,
        profilePictureUrl: true,
        driveFileId: true,
        userId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return successResponse(staff, "Staff member created successfully", 201);
  } catch (error) {
    console.error("Create staff error:", error);
    return errorResponse("Internal server error", 500);
  }
}
