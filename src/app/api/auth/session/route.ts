import { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";
import { getJwtSecretKey } from "@/lib/jwt";
import { isPlatformOwnerEmail } from "@/lib/platform-owner";
import {
  successResponse,
  unauthorized,
  errorResponse,
  handleApiError,
} from "@/lib/api-response";
import { authCookieName, clearAuthCookie } from "@/lib/auth-cookies";
import { getEffectivePermissions } from "@/lib/permissions";

export async function GET(request: NextRequest) {
  try {
    const token =
      request.cookies.get(authCookieName)?.value ||
      request.headers.get("authorization")?.substring(7);

    if (!token) {
      return unauthorized("Authentication required");
    }

    const { payload } = await jwtVerify(token, getJwtSecretKey());
    const userId = payload.userId as string | undefined;
    const tenantId = payload.tenantId as string | undefined;

    if (!userId || !tenantId) {
      const response = unauthorized("Invalid session");
      clearAuthCookie(response);
      return response;
    }

    const user = await prisma.user.findUnique({
      where: {
        id: userId,
        tenantId,
      },
      include: {
        tenant: true,
      },
    });

    if (!user || !user.isActive) {
      const response = unauthorized("Session expired");
      clearAuthCookie(response);
      return response;
    }

    if (payload.sessionVersion !== undefined && Number(payload.sessionVersion) !== user.updatedAt.getTime()) {
      const response = unauthorized("Session expired");
      clearAuthCookie(response);
      return response;
    }
    if (payload.sessionVersion === undefined && (!payload.iat || Math.floor(user.updatedAt.getTime() / 1000) > Number(payload.iat))) {
      const response = unauthorized("Session expired");
      clearAuthCookie(response);
      return response;
    }
    if (payload.role && payload.role !== user.role) {
      const response = unauthorized("Session expired");
      clearAuthCookie(response);
      return response;
    }

    const sessionImpersonatedBy = typeof payload.impersonatedBy === "string" ? payload.impersonatedBy : undefined;
    const hasImpersonationClaims = payload.impersonatedBy !== undefined || payload.isImpersonated !== undefined;
    if (hasImpersonationClaims && (!sessionImpersonatedBy || payload.isImpersonated !== true)) {
      const response = unauthorized("Session expired");
      clearAuthCookie(response);
      return response;
    }
    if (sessionImpersonatedBy) {
      const originalAdmin = await prisma.user.findFirst({
        where: { email: sessionImpersonatedBy, isActive: true },
        select: { email: true, role: true },
      });
      if (!originalAdmin || (originalAdmin.role !== "SYSTEM_ADMIN" && !isPlatformOwnerEmail(originalAdmin.email))) {
        const response = unauthorized("Session expired");
        clearAuthCookie(response);
        return response;
      }
    }

    return successResponse({
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      tenantName: user.tenant.name,
      impersonatedBy: typeof payload.impersonatedBy === "string" ? payload.impersonatedBy : undefined,
      isImpersonated: payload.isImpersonated === true,
      permissions: getEffectivePermissions(user.role, user.permissions),
    });
  } catch (error) {
    const response = unauthorized("Session expired");
    clearAuthCookie(response);
    return response;
  }
}
