import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAccess } from "@/lib/api-auth";
import { successResponse, unauthorized, badRequest, handleApiError } from "@/lib/api-response";
import { MAX_PAGE_SIZE } from "@/lib/constants";
import { isPlatformOwnerEmail } from "@/lib/platform-owner";

/**
 * GET /api/system-admin/users
 * Global cross-tenant user directory — SUPER_ADMIN only
 * Query: page, limit, search (email/name), tenantId, role, isActive
 */
export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess(request, { allowSystemAdmin: true });
    if ("response" in access) return access.response;
    const { user } = access.authContext;
    if (user.role !== "SYSTEM_ADMIN" && !isPlatformOwnerEmail(user.email) && !(user as any).impersonatedBy) {
      return unauthorized("Only platform system administrators can access global user directory.");
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const search = (searchParams.get("search") || "").trim();
    const tenantId = searchParams.get("tenantId") || "";
    const role = searchParams.get("role") || "";
    const isActive = searchParams.get("isActive");

    const where: any = {};
    if (tenantId) where.tenantId = tenantId;
    if (role) where.role = role;
    if (isActive !== null && isActive !== "" && isActive !== undefined) where.isActive = isActive === "true";

    if (search) {
      where.OR = [
        { email: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
        { role: { contains: search, mode: "insensitive" } },
      ];
    }

    const skip = (page - 1) * limit;
    const [totalCount, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          accessLevel: true,
          tenantId: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          tenant: { select: { name: true } },
        },
      }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);
    return successResponse(
      { users, pagination: { totalCount, currentPage: page, pageSize: limit, totalPages, hasNextPage: page < totalPages, hasPreviousPage: page > 1 } },
      "Global users retrieved"
    );
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/system-admin/users?id=xxx
 * Update cross-tenant user — isActive, role, accessLevel (SUPER_ADMIN only)
 */
export async function PATCH(request: NextRequest) {
  try {
    const access = await requireApiAccess(request, { allowSystemAdmin: true });
    if ("response" in access) return access.response;
    const { user } = access.authContext;
    if (user.role !== "SYSTEM_ADMIN" && !isPlatformOwnerEmail(user.email) && !(user as any).impersonatedBy) {
      return unauthorized("Only platform system administrators can modify global users.");
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return badRequest("User id is required");

    const body = await request.json();
    const { isActive, role, accessLevel } = body;

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) return badRequest("User not found");

    // Prevent demoting last SUPER_ADMIN
    if (existing.role === "SUPER_ADMIN" && role && role !== "SUPER_ADMIN") {
      const superCount = await prisma.user.count({ where: { role: "SUPER_ADMIN", isActive: true } });
      if (superCount <= 1) return badRequest("Cannot demote the last active SUPER_ADMIN");
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        isActive: typeof isActive === "boolean" ? isActive : undefined,
        role: role || undefined,
        accessLevel: typeof accessLevel === "number" ? accessLevel : undefined,
      },
      select: { id: true, email: true, role: true, accessLevel: true, isActive: true, tenantId: true },
    });

    return successResponse(updated, "User updated");
  } catch (error) {
    return handleApiError(error);
  }
}
