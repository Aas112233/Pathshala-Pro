import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  errorResponse,
  badRequest,
  notFound,
} from "@/lib/api-response";
import { requireApiAccess } from "@/lib/api-auth";
import { hashPassword } from "@/lib/auth";

/**
 * POST /api/staff/[id]/link-user
 * Link a staff member to a user account or create a new user account
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;
    const { id } = await params;

    const body = await request.json();
    const { email, password, name, role = "TEACHER" } = body;

    // Verify staff exists
    const staff = await prisma.staffProfile.findUnique({
      where: { id, tenantId },
    });

    if (!staff) {
      return notFound("Staff member not found");
    }

    // Check if staff already has a linked user
    if (staff.userId) {
      return badRequest("Staff member already has a linked user account");
    }

    // Check if user already exists with this email
    const existingUser = await prisma.user.findFirst({
      where: { email, tenantId },
    });

    if (existingUser) {
      return badRequest("A user with this email already exists");
    }

    // Hash password
    const hash = await hashPassword(password);

    // Create user and link to staff
    const result = await prisma.$transaction(async (tx: any) => {
      // Create user
      const user = await tx.user.create({
        data: {
          tenantId,
          email,
          name,
          role: role as any,
          hash,
          isActive: true,
          staffProfileId: id,
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
        },
      });

      // Link staff to user
      await tx.staffProfile.update({
        where: { id },
        data: { userId: user.id },
      });

      return user;
    });

    return successResponse(result, "User account created and linked to staff member", 201);
  } catch (error) {
    console.error("Link staff user error:", error);
    return errorResponse("Internal server error", 500);
  }
}

/**
 * DELETE /api/staff/[id]/link-user
 * Unlink a staff member from their user account
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;
    const { id } = await params;

    // Verify staff exists
    const staff = await prisma.staffProfile.findUnique({
      where: { id, tenantId },
    });

    if (!staff) {
      return notFound("Staff member not found");
    }

    // Check if staff has a linked user
    if (!staff.userId) {
      return badRequest("Staff member does not have a linked user account");
    }

    const userId = staff.userId;

    // Unlink staff from user
    await prisma.$transaction(async (tx: any) => {
      // Remove staff profile link from user
      await tx.user.update({
        where: { id: userId },
        data: { staffProfileId: null },
      });

      // Remove user link from staff
      await tx.staffProfile.update({
        where: { id },
        data: { userId: null },
      });
    });

    return successResponse(null, "User account unlinked from staff member");
  } catch (error) {
    console.error("Unlink staff user error:", error);
    return errorResponse("Internal server error", 500);
  }
}

/**
 * GET /api/staff/[id]/link-user
 * Get the linked user account for a staff member
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

    // Verify staff exists and get linked user
    const staff = await prisma.staffProfile.findUnique({
      where: { id, tenantId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            isActive: true,
            lastLoginAt: true,
          },
        },
      },
    });

    if (!staff) {
      return notFound("Staff member not found");
    }

    return successResponse({
      hasLinkedUser: !!staff.userId,
      user: staff.user,
    });
  } catch (error) {
    console.error("Get staff linked user error:", error);
    return errorResponse("Internal server error", 500);
  }
}
