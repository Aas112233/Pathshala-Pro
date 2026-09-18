import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAccess } from "@/lib/api-auth";
import { successResponse, unauthorized, badRequest, handleApiError } from "@/lib/api-response";
import { isPlatformOwnerEmail } from "@/lib/platform-owner";

import { DEFAULT_TENANT_MODULE_ACCESS, resolveTenantModules, TENANT_MODULE_KEYS } from "@/lib/tenant-modules";

/**
 * GET /api/system-admin/feature-flags
 * List tenants with resolved moduleAccess
 */
export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess(request, { allowSystemAdmin: true });
    if ("response" in access) return access.response;
    const { user } = access.authContext;
    if (user.role !== "SYSTEM_ADMIN" && !isPlatformOwnerEmail(user.email) && !access.authContext.isImpersonated) {
      return unauthorized("Only platform system administrators can access feature flags.");
    }

    const tenants = await prisma.tenant.findMany({
      select: {
        id: true,
        tenantId: true,
        name: true,
        featureFlags: true,
        subscriptionStatus: true,
        featureOverride: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const withResolved = tenants.map((t) => ({
      id: t.id,
      tenantId: t.tenantId,
      name: t.name,
      subscriptionStatus: t.subscriptionStatus,
      featureFlags: resolveTenantModules(t.featureFlags, t.featureOverride),
    }));

    return successResponse({ tenants: withResolved, defaults: DEFAULT_TENANT_MODULE_ACCESS, moduleKeys: TENANT_MODULE_KEYS });
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
    if (user.role !== "SYSTEM_ADMIN" && !isPlatformOwnerEmail(user.email) && !access.authContext.isImpersonated) {
      return unauthorized("Only platform system administrators can modify feature flags.");
    }

    const body = await request.json();
    const { tenantId, featureFlags } = body;
    if (!tenantId || typeof featureFlags !== "object") return badRequest("tenantId and featureFlags are required");

    const tenant = await prisma.tenant.findUnique({ where: { tenantId } });
    if (!tenant) return badRequest("Tenant not found");

    const merged = { ...DEFAULT_TENANT_MODULE_ACCESS, ...(tenant.featureFlags as any || {}), ...featureFlags };

    const [updated] = await prisma.$transaction([
      prisma.tenant.update({
        where: { tenantId },
        data: { featureFlags: merged },
        select: { tenantId: true, name: true, featureFlags: true },
      }),
      prisma.tenantFeatureOverride.upsert({
        where: { tenantId },
        create: {
          tenantId,
          hasHostel: merged.hostel ?? true,
          hasTransport: merged.transport ?? true,
          hasPayroll: merged.payroll ?? true,
        },
        update: {
          hasHostel: merged.hostel ?? true,
          hasTransport: merged.transport ?? true,
          hasPayroll: merged.payroll ?? true,
        },
      }),
      prisma.superAdminActionLog.create({
        data: {
          adminUserId: user.id,
          adminEmail: user.email,
          targetTenantId: tenantId,
          actionType: "FEATURE_FLAG_CHANGE",
          details: {
            updatedModules: featureFlags,
            resolvedModules: merged,
          },
        },
      }),
    ]);

    return successResponse(updated, "Tenant module access updated successfully");
  } catch (error) {
    return handleApiError(error);
  }
}
