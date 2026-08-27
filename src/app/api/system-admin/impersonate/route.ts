import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  unauthorized,
  badRequest,
  handleApiError,
} from "@/lib/api-response";
import { requireApiAccess } from "@/lib/api-auth";
import { jwtVerify, SignJWT } from "jose";
import { getJwtSecretKey } from "@/lib/jwt";

/**
 * POST /api/system-admin/impersonate
 * Switch into a school tenant as Super Admin for support and troubleshooting
 */
export async function POST(request: NextRequest) {
  try {
    const access = await requireApiAccess(request, {
      allowSystemAdmin: true,
    });
    if ("response" in access) return access.response;

    const { user } = access.authContext;

    // Only actual Admins/System Admins can initiate impersonation
    if (
      user.role !== "SYSTEM_ADMIN" &&
      user.role !== "SUPER_ADMIN" &&
      user.role !== "ADMIN" &&
      user.tenantId !== "system"
    ) {
      return unauthorized("Only system administrators can impersonate tenants.");
    }

    const body = await request.json();
    const { targetTenantId } = body;

    if (!targetTenantId) {
      return badRequest("targetTenantId is required");
    }

    const tenant = await prisma.tenant.findUnique({
      where: { tenantId: targetTenantId },
      include: {
        users: {
          where: { role: "SUPER_ADMIN", isActive: true },
          take: 1,
        },
      },
    });

    if (!tenant) {
      return badRequest("Target school tenant was not found.");
    }

    const targetUser = tenant.users[0] || {
      id: "impersonated-admin",
      email: `admin@${tenant.tenantId}.pathshala.pro`,
      name: `${tenant.name} Administrator`,
      role: "SUPER_ADMIN",
    };

    // Issue impersonation token
    const originalAdminEmail = (payload.impersonatedBy as string) || (payload.email as string);
    const impersonationToken = await new SignJWT({
      userId: targetUser.id,
      tenantId: tenant.tenantId,
      email: targetUser.email,
      role: "SUPER_ADMIN",
      impersonatedBy: originalAdminEmail,
      impersonatedTenantName: tenant.name,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("4h")
      .sign(getJwtSecretKey());

    const response = NextResponse.json({
      success: true,
      data: {
        user: {
          id: targetUser.id,
          tenantId: tenant.tenantId,
          email: targetUser.email,
          name: targetUser.name,
          role: "SUPER_ADMIN",
          tenantName: tenant.name,
          impersonatedBy: originalAdminEmail,
        },
        targetTenantName: tenant.name,
      },
      message: `Now viewing as ${tenant.name}`,
    });

    // Set cookie
    response.cookies.set("auth_token", impersonationToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 4 * 60 * 60, // 4 hours
    });

    return response;
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/system-admin/impersonate
 * Exit impersonation and return to System Admin panel
 */
export async function DELETE(request: NextRequest) {
  try {
    const token =
      request.cookies.get("auth_token")?.value ||
      request.headers.get("authorization")?.substring(7);

    if (!token) return unauthorized();

    const { payload } = await jwtVerify(token, getJwtSecretKey());

    const originalAdminEmail = payload.impersonatedBy as string;
    if (!originalAdminEmail) {
      return badRequest("No active impersonation session found.");
    }

    // Re-issue System Admin token
    const systemAdminToken = await new SignJWT({
      userId: "system-admin",
      tenantId: "system",
      email: originalAdminEmail,
      role: "SYSTEM_ADMIN",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("24h")
      .sign(getJwtSecretKey());

    const response = NextResponse.json({
      success: true,
      data: {
        redirectTo: "/system-admin/tenants",
      },
      message: "Exited impersonation. Returned to System Admin.",
    });

    response.cookies.set("auth_token", systemAdminToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 24 * 60 * 60,
    });

    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
