import { NextRequest } from "next/server";
import { requireApiAccess } from "@/lib/api-auth";
import { badRequest, forbidden, handleApiError, notFound, successResponse } from "@/lib/api-response";
import { diagnosticsQuerySchema, runAdminDiagnostics } from "@/lib/admin-diagnostics";
import { isPlatformOwnerEmail } from "@/lib/platform-owner";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess(request, { allowSystemAdmin: true });
    if (access.response) return access.response;
    const { user, isImpersonated } = access.authContext;
    // Privileged diagnostics must not be available from an impersonated school session.
    if (isImpersonated || (user.role !== "SYSTEM_ADMIN" && !isPlatformOwnerEmail(user.email))) {
      return forbidden("[Field 'role', Code: forbidden] Direct platform administrator access is required.");
    }
    const parsed = diagnosticsQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
    if (!parsed.success) {
      return badRequest(parsed.error.issues.map((issue) =>
        `[Field '${issue.path.join(".")}', Code: ${issue.code}] ${issue.message}`).join("; "));
    }
    const tenant = await prisma.tenant.findFirst({ where: { tenantId: parsed.data.tenantId }, select: { tenantId: true } });
    if (!tenant) return notFound("[Field 'tenantId', Code: not_found] Tenant not found.");
    const response = successResponse(await runAdminDiagnostics(parsed.data));
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
