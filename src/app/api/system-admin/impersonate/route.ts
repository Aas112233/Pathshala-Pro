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

    // Only Platform System Admins can initiate impersonation
    if (
      user.role !== "SYSTEM_ADMIN" &&
      user.role !== "SUPER_ADMIN" &&
      user.tenantId?.toLowerCase() !== "system" &&
      !isPlatformOwnerEmail(user.email)
    ) {
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
