import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  paginatedResponse,
  errorResponse,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  validationError,
  handleApiError,
} from "@/lib/api-response";
import { createUserSchema, updateUserSchema } from "@/lib/schemas";
import { hashPassword } from "@/lib/auth";
import { requireApiAccess } from "@/lib/api-auth";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "@/lib/constants";

/**
 * GET /api/users
 * Get all users with pagination
 */
export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;
    const { tenantId } = access.authContext;

    // Parse query params
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), MAX_PAGE_SIZE);
    const search = searchParams.get("search") || "";
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") || "desc";

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = { tenantId };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { role: { contains: search, mode: "insensitive" } },
      ];
    }

    // Get total count
    const [totalCount, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        permissions: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    })
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return paginatedResponse(users, {
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
 * POST /api/users
 * Create a new user
 */
export async function POST(request: NextRequest) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;
    const { tenantId } = access.authContext;

    const body = await request.json();
    const validation = createUserSchema.safeParse(body);

    if (!validation.success) {
      const errors = validation.error.errors.map((err) => ({
        field: err.path.join("."),
        code: err.code,
        message: err.message,
      }));
      return validationError(errors);
    }

    const { email, name, role, password, staffProfileId, studentProfileId, accessLevel, isActive, parentStudentIds } = validation.data as any;

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: { email, tenantId },
    });

    if (existingUser) {
      return badRequest("User already exists", [
        { field: "email", code: "duplicate", message: "Email already registered" },
      ]);
    }

    // Validate STUDENT linkage
    if (role === "STUDENT" && studentProfileId) {
      const sp = await prisma.studentProfile.findFirst({ where: { id: studentProfileId, tenantId } });
      if (!sp) return badRequest("Student profile not found for this tenant");
      const already = await prisma.user.findFirst({ where: { studentProfileId, tenantId } });
      if (already) return badRequest("Student already has a login account");
      // Class gate: respect principal's class appAccess
      const cls = sp.classId ? await prisma.class.findFirst({ where: { id: sp.classId, tenantId } }) : null;
      if (cls && (!cls.appAccessEnabled || !cls.studentAppEnabled)) {
        return badRequest("App access is disabled for this student's class by the principal");
      }
    }

    // Validate PARENT linkage ids belong to tenant
    if (role === "PARENT" && parentStudentIds?.length) {
      const count = await prisma.studentProfile.count({ where: { id: { in: parentStudentIds }, tenantId } });
      if (count !== parentStudentIds.length) return badRequest("One or more linked students not found");
    }

    // Hash password
    const hash = await hashPassword(password);

    // Create user
    const newUser = await prisma.user.create({
      data: {
        tenantId,
        email,
        name,
        role,
        accessLevel: accessLevel ?? (role === "STUDENT" ? 7 : role === "PARENT" ? 6 : undefined),
        hash,
        staffProfileId: staffProfileId || null,
        studentProfileId: studentProfileId || null,
        isActive,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        accessLevel: true,
        permissions: true,
        isActive: true,
        studentProfileId: true,
        createdAt: true,
      },
    });

    // Create parent links if PARENT
    if (role === "PARENT" && parentStudentIds?.length) {
      await prisma.parentStudentLink.createMany({
        data: parentStudentIds.map((sid: string) => ({
          tenantId,
          parentUserId: newUser.id,
          studentProfileId: sid,
        })),
        skipDuplicates: true,
      });
    }

    return successResponse(newUser, "User created successfully", 201);
  } catch (error) {
    return handleApiError(error);
  }
}
