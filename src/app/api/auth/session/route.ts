import { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";
import { getJwtSecretKey } from "@/lib/jwt";
import { successResponse, unauthorized, errorResponse } from "@/lib/api-response";
import { authCookieName, clearAuthCookie } from "@/lib/auth-cookies";

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

    return successResponse({
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      tenantName: user.tenant.name,
      permissions: user.permissions,
    });
  } catch (error) {
    const response = unauthorized("Session expired");
    clearAuthCookie(response);
    return response;
  }
}
