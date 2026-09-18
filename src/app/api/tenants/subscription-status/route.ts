import { NextRequest } from "next/server";
import { requireApiAccess } from "@/lib/api-auth";
import { successResponse, handleApiError } from "@/lib/api-response";
import { getTenantSubscriptionView } from "@/lib/subscription-service";

/**
 * GET /api/tenants/subscription-status
 *
 * Self-service subscription status for the currently authenticated tenant.
 * Used by the client-side subscription guard to redirect inactive/expired
 * tenants to the inactive notice page, and by the subscription banner to show
 * plan / grace / end-date context.
 */
export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess(request, { allowUnmapped: true });
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;
    const view = await getTenantSubscriptionView(tenantId);

    return successResponse(view);
  } catch (error) {
    return handleApiError(error, "Failed to load subscription status");
  }
}
