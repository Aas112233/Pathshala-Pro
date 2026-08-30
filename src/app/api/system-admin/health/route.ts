import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAccess } from "@/lib/api-auth";
import { successResponse, unauthorized, handleApiError } from "@/lib/api-response";
import { isPlatformOwnerEmail } from "@/lib/platform-owner";

export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess(request, { allowSystemAdmin: true });
    if ("response" in access) return access.response;
    const { user } = access.authContext;
    if (user.role !== "SYSTEM_ADMIN" && !isPlatformOwnerEmail(user.email) && !access.authContext.isImpersonated) {
      return unauthorized("Only platform system administrators can access health metrics.");
    }

    const [tenantCount, userCount, studentCount, examResultCount, auditCount, tenants] = await Promise.all([
      prisma.tenant.count(),
      prisma.user.count(),
      prisma.studentProfile.count(),
      prisma.examResult.count(),
      prisma.auditLog.count(),
      prisma.tenant.findMany({ select: { subscriptionStatus: true, createdAt: true } }),
    ]);

    const active = tenants.filter(t => t.subscriptionStatus === "ACTIVE").length;
    const trial = tenants.filter(t => t.subscriptionStatus === "TRIAL").length;
    const suspended = tenants.filter(t => t.subscriptionStatus === "SUSPENDED").length;

    return successResponse({
      tenants: { total: tenantCount, active, trial, suspended },
      users: { total: userCount },
      students: { total: studentCount },
      examResults: { total: examResultCount },
      auditLogs: { total: auditCount },
      uptime: "Operational",
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
