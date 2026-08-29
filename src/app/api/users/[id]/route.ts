import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  errorResponse,
  unauthorized,
  forbidden,
  notFound,
  badRequest,
  handleApiError,
} from "@/lib/api-response";
import { updateUserSchema } from "@/lib/schemas";
import { hashPassword } from "@/lib/auth";
import { requireApiAccess } from "@/lib/api-auth";
import { isPlatformOwnerEmail } from "@/lib/platform-owner";
import {
  canAssignRole,
  canAssignAccessLevel,
  canGrantPermissions,
  getEffectivePermissions,
} from "@/lib/permissions";
import {
  getUserUsageCounts,
  integrityViolation,
  lockedDeleteMessage,
} from "@/lib/data-integrity";

/**
 * GET /api/users/[id]
 * Get a single user by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;
    const { tenantId } = access.authContext;

    const { id } = await params;

    const user = await prisma.user.findUnique({
      where: { id, tenantId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        accessLevel: true,
        permissions: true,
        isActive: true,
        staffProfileId: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return notFound("User not found");
    }

    return successResponse(user);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PUT /api/users/[id]
 * Update a user
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;
    const { tenantId } = access.authContext;

    const { id } = await params;
    const body = await request.json();
    const validation = updateUserSchema.safeParse(body);

    if (!validation.success) {
      const errors = validation.error.errors.map((err) => ({
        field: err.path.join("."),
        code: err.code,
        message: err.message,
      }));
      return badRequest("Invalid input", errors);
    }

    const data = validation.data;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id, tenantId },
    });

    if (!existingUser) {
      return notFound("User not found");
    }

    // ── Privilege-escalation guards ──
    const requester: any = (access as any).authContext.user;
    const isRequesterPlatformOwner = isPlatformOwnerEmail(requester.email);
    const requesterEffectivePerms = getEffectivePermissions(requester.role, requester.permissions, requester.accessLevel);
    if ((data as any).role && !canAssignRole(requester.role, isRequesterPlatformOwner, (data as any).role)) {
      return forbidden("You are not allowed to assign this role");
    }
    if ((data as any).accessLevel !== undefined && !canAssignAccessLevel(requester.accessLevel, (data as any).accessLevel as number)) {
      return forbidden("You cannot assign a more privileged access level than your own");
    }
    if ((data as any).permissions) {
      const grant = canGrantPermissions(requesterEffectivePerms, (data as any).permissions);
      if (!grant.allowed) {
        return forbidden(`You cannot grant ${grant.action} permission for ${grant.module} module`);
      }
    }
    if ((data as any).email && isPlatformOwnerEmail((data as any).email) && !isRequesterPlatformOwner) {
      return forbidden("Cannot assign a platform owner email from tenant context");
    }

    // Check email uniqueness if changing email
    if (data.email && data.email !== existingUser.email) {
      const emailExists = await prisma.user.findFirst({
        where: { email: data.email, tenantId, id: { not: id } },
      });

      if (emailExists) {
        return badRequest("Email already in use", [
          { field: "email", code: "duplicate", message: "Email already registered" },
        ]);
      }
    }

    // Hash password if changing
    const updateData: any = { ...data };
    if (data.password) {
      updateData.hash = await hashPassword(data.password);
      delete updateData.password;
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        accessLevel: true,
        permissions: true,
        isActive: true,
        updatedAt: true,
      },
    });

    return successResponse(updatedUser, "User updated successfully");
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/users/[id]
 * Delete a user
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;
    const { user: currentUser, tenantId } = access.authContext;

    const { id } = await params;

    // Prevent deleting yourself
    if (id === currentUser.id) {
      return badRequest("Cannot delete your own account");
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id, tenantId },
    });

    if (!existingUser) {
      return notFound("User not found");
    }

    const usageCounts = await getUserUsageCounts(tenantId, id);
    if (Object.values(usageCounts).some((count) => count > 0)) {
      return integrityViolation(lockedDeleteMessage("User account", usageCounts), [
        {
          field: "id",
          code: "in_use",
          message:
            "Users referenced by collections, attendance, or promotion decisions cannot be deleted. Deactivate the account instead.",
        },
      ]);
    }

    await prisma.user.delete({
      where: { id },
    });

    return successResponse(null, "User deleted successfully");
  } catch (error) {
    return handleApiError(error);
  }
}
