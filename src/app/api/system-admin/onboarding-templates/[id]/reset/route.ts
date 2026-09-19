import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAccess } from "@/lib/api-auth";
import {
  successResponse,
  unauthorized,
  badRequest,
  handleApiError,
} from "@/lib/api-response";
import { isPlatformOwnerEmail } from "@/lib/platform-owner";
import { getTemplateStats } from "@/lib/onboarding-template-store";
import { getClassTemplateDefinitions } from "@/lib/onboarding-templates";

/**
 * POST /api/system-admin/onboarding-templates/[id]/reset
 * Restore a built-in template to its code version (also re-activates it).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireApiAccess(request, { allowSystemAdmin: true });
    if ("response" in access) return access.response;
    const { user } = access.authContext;
    if (user.role !== "SYSTEM_ADMIN" && !isPlatformOwnerEmail(user.email) && !access.authContext.isImpersonated) {
      return unauthorized("Only platform system administrators can manage onboarding templates.");
    }

    const { id } = await params;
    const row = await prisma.onboardingTemplate.findUnique({ where: { id } });
    if (!row) return badRequest("Template not found.");
    if (!row.isSystem) return badRequest("Only built-in templates can be reset.");
    const classes = getClassTemplateDefinitions(row.code as any);
    const updated = await prisma.onboardingTemplate.update({
      where: { id },
      data: {
        label: null,
        description: null,
        classes: classes as unknown as object,
        isActive: true,
        version: { increment: 1 },
      },
    });
    return successResponse(
      {
        id: updated.id,
        stats: getTemplateStats(classes as any),
      },
      "Template reset to built-in version."
    );
  } catch (error) {
    return handleApiError(error);
  }
}
