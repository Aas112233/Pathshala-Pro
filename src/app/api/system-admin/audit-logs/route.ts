import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAccess } from "@/lib/api-auth";
import { successResponse, unauthorized, handleApiError } from "@/lib/api-response";
import { MAX_PAGE_SIZE } from "@/lib/constants";
import { isPlatformOwnerEmail } from "@/lib/platform-owner";

export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess(request, { allowSystemAdmin: true });
    if ("response" in access) return access.response;
    const { user } = access.authContext;
    if (user.role !== "SYSTEM_ADMIN" && !isPlatformOwnerEmail(user.email) && !access.authContext.isImpersonated) {
      return unauthorized("Only platform system administrators can access global audit logs.");
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(searchParams.get("limit") || "100", 10)));
    const search = (searchParams.get("search") || "").trim();

    const where: any = {};
    if (search) {
      where.OR = [
        { userEmail: { contains: search, mode: "insensitive" } },
        { entity: { contains: search, mode: "insensitive" } },
        { tenantId: { contains: search, mode: "insensitive" } },
        { action: { contains: search, mode: "insensitive" } },
      ];
    }

    const logs = await prisma.auditLog.findMany({
      where,
      take: limit,
      orderBy: { timestamp: "desc" },
    });

    return successResponse(logs);
  } catch (error) {
    return handleApiError(error);
  }
}
