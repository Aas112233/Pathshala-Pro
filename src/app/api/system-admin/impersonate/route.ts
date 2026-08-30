import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  unauthorized,
  badRequest,
  handleApiError,
} from "@/lib/api-response";
import { requireApiAccess } from "@/lib/api-auth";
import { jwtVerify, SignJWT } from "jose";
import { getJwtSecretKey } from "@/lib/jwt";
import { generateTenantImpersonationToken } from "@/lib/superadmin-service";
import { isPlatformOwnerEmail } from "@/lib/platform-owner";

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

    // Only platform System Admins can initiate impersonation
    if (user.role !== "SYSTEM_ADMIN" && !isPlatformOwnerEmail(user.email)) {
      return unauthorized("Only platform system administrators can impersonate tenants.");
    }

    const body = await request.json();
    const { targetTenantId } = body;

    if (!targetTenantId) {
      return badRequest("targetTenantId is required");
    }

    const ipAddress = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || undefined;
    const userAgent = request.headers.get("user-agent") || undefined;

    const result = await generateTenantImpersonationToken(prisma, {
      targetTenantId,
      context: {
        adminUserId: user.id,
        adminEmail: user.email,
        ipAddress,
        userAgent,
      },
    });

    const response = NextResponse.json({
      success: true,
      data: {
        targetTenantName: result.targetTenantName,
        impersonatedUserEmail: result.impersonatedUserEmail,
      },
      message: `Now viewing as ${result.targetTenantName}`,
    });

    // Set cookie
    response.cookies.set("auth_token", result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 2 * 60 * 60, // 2 hours
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
    if (!originalAdminEmail || payload.isImpersonated !== true) {
      return badRequest("No active impersonation session found.");
    }

    const originalAdmin = await prisma.user.findFirst({
      where: {
        email: originalAdminEmail,
        isActive: true,
      },
      select: { id: true, tenantId: true, role: true, email: true, updatedAt: true },
    });
    if (!originalAdmin || (originalAdmin.role !== "SYSTEM_ADMIN" && !isPlatformOwnerEmail(originalAdmin.email))) {
      return unauthorized("Original administrator account is no longer active.");
    }

    // Re-issue a token for the real System Admin account so getAuthContext
    // can validate it against the database.
    const systemAdminToken = await new SignJWT({
      userId: originalAdmin.id,
      tenantId: originalAdmin.tenantId,
      email: originalAdmin.email,
      role: originalAdmin.role,
      sessionVersion: originalAdmin.updatedAt.getTime(),
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
