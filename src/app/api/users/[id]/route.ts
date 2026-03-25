import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  errorResponse,
  unauthorized,
  forbidden,
  notFound,
  badRequest,
} from "@/lib/api-response";
import { updateUserSchema } from "@/lib/schemas";
import { getAuthContext, hashPassword } from "@/lib/auth";

/**
 * GET /api/users/[id]
 * Get a single user by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = await getAuthContext(request);
    if (!authContext) {
      return unauthorized("Authentication required");
    }

    const { user: currentUser, tenantId } = authContext;

    // Check permission
    if (!["ADMIN", "SUPER_ADMIN"].includes(currentUser.role)) {
      return forbidden("Insufficient permissions");
    }

    const { id } = await params;

    const user = await prisma.user.findUnique({
      where: { id, tenantId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
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
    console.error("Get user error:", error);
    return errorResponse("Internal server error", 500);
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
    const authContext = await getAuthContext(request);
    if (!authContext) {
      return unauthorized("Authentication required");
    }

    const { user: currentUser, tenantId } = authContext;

    // Check permission
    if (!["ADMIN", "SUPER_ADMIN"].includes(currentUser.role)) {
      return forbidden("Insufficient permissions");
    }

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
        isActive: true,
        updatedAt: true,
      },
    });

    return successResponse(updatedUser, "User updated successfully");
  } catch (error) {
    console.error("Update user error:", error);
    return errorResponse("Internal server error", 500);
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
    const authContext = await getAuthContext(request);
    if (!authContext) {
      return unauthorized("Authentication required");
    }

    const { user: currentUser, tenantId } = authContext;

    // Check permission
    if (!["ADMIN", "SUPER_ADMIN"].includes(currentUser.role)) {
      return forbidden("Insufficient permissions");
    }

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

    await prisma.user.delete({
      where: { id },
    });

    return successResponse(null, "User deleted successfully");
  } catch (error) {
    console.error("Delete user error:", error);
    return errorResponse("Internal server error", 500);
  }
}
