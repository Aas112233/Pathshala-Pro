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

    // Liveness probe: a trivial round-trip whose latency is the honesty signal.
    // If the database is unreachable this throws and the request fails
    // instead of reporting a hardcoded "Operational".
    const probeStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const dbLatencyMs = Date.now() - probeStart;

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

    // Serverless (Neon) cold starts can take seconds on first contact; only
    // sustained slowness counts as degraded.
    const DEGRADED_LATENCY_MS = 3000;
    const status = dbLatencyMs > DEGRADED_LATENCY_MS ? "Degraded" : "Operational";

    return successResponse({
      tenants: { total: tenantCount, active, trial, suspended },
      users: { total: userCount },
      students: { total: studentCount },
      examResults: { total: examResultCount },
      auditLogs: { total: auditCount },
      status,
      uptime: status, // legacy alias; prefer `status` + `checks.database`
      checks: {
        database: { reachable: true, latencyMs: dbLatencyMs },
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
