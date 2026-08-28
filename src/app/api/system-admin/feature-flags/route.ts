import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAccess } from "@/lib/api-auth";
import { successResponse, unauthorized, badRequest, handleApiError } from "@/lib/api-response";
import { isPlatformOwnerEmail } from "@/lib/platform-owner";

const DEFAULT_FLAGS = {
  hostel: true,
  transport: true,
  payroll: true,
  inventory: true,
  health: true,
  biometrics: false,
  onlinePayment: true,
  customReports: true,
};

/**
 * GET /api/system-admin/feature-flags
 * List tenants with featureFlags
 */
export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess(request, { allowSystemAdmin: true });
    if ("response" in access) return access.response;
    const { user } = access.authContext;
    if (user.role !== "SYSTEM_ADMIN" && !isPlatformOwnerEmail(user.email) && !(user as any).impersonatedBy) {
      return unauthorized("Only platform system administrators can access feature flags.");
    }

    const tenants = await prisma.tenant.findMany({
      select: { id: true, tenantId: true, name: true, featureFlags: true, subscriptionStatus: true },
      orderBy: { createdAt: "desc" },
    });

    const withDefaults = tenants.map(t => ({
      ...t,
      featureFlags: { ...DEFAULT_FLAGS, ...((t.featureFlags as any) || {}) },
    }));

    return successResponse({ tenants: withDefaults, defaults: DEFAULT_FLAGS });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PUT /api/system-admin/feature-flags
 * Body: { tenantId, featureFlags: { hostel: true, ... } }
 */
export async function PUT(request: NextRequest) {
  try {
    const access = await requireApiAccess(request, { allowSystemAdmin: true });
    if ("response" in access) return access.response;
    const { user } = access.authContext;
    if (user.role !== "SYSTEM_ADMIN" && !isPlatformOwnerEmail(user.email) && !(user as any).impersonatedBy) {
      return unauthorized("Only platform system administrators can modify feature flags.");
    }

    const body = await request.json();
    const { tenantId, featureFlags } = body;
    if (!tenantId || typeof featureFlags !== "object") return badRequest("tenantId and featureFlags are required");

    const tenant = await prisma.tenant.findUnique({ where: { tenantId } });
    if (!tenant) return badRequest("Tenant not found");

    const merged = { ...DEFAULT_FLAGS, ...(tenant.featureFlags as any || {}), ...featureFlags };

    const updated = await prisma.tenant.update({
      where: { tenantId },
      data: { featureFlags: merged },
      select: { tenantId: true, name: true, featureFlags: true },
    });

    return successResponse(updated, "Feature flags updated");
  } catch (error) {
    return handleApiError(error);
  }
}
