import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAccess } from "@/lib/api-auth";
import {
  successResponse,
  unauthorized,
  badRequest,
  validationError,
  handleApiError,
} from "@/lib/api-response";
import { isPlatformOwnerEmail } from "@/lib/platform-owner";
import { resolveAcademicStructure } from "@/lib/onboarding-structure";
import { updateOnboardingTemplateSchema } from "@/lib/schemas";

function denied(access: any) {
  const { user } = access.authContext;
  if (user.role !== "SYSTEM_ADMIN" && !isPlatformOwnerEmail(user.email) && !access.authContext.isImpersonated) {
    return unauthorized("Only platform system administrators can manage onboarding templates.");
  }
  return null;
}

/**
 * GET /api/system-admin/onboarding-templates/[id]
 * Full template definition for the editor.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireApiAccess(request, { allowSystemAdmin: true });
    if ("response" in access) return access.response;
    const no = denied(access);
    if (no) return no;

    const { id } = await params;
    const row = await prisma.onboardingTemplate.findUnique({ where: { id } });
    if (!row) return badRequest("Template not found.");
    return successResponse(row);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PUT /api/system-admin/onboarding-templates/[id]
 * Update label/meta/content/active. Built-ins keep their code.
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireApiAccess(request, { allowSystemAdmin: true });
    if ("response" in access) return access.response;
    const no = denied(access);
    if (no) return no;

    const { id } = await params;
    const row = await prisma.onboardingTemplate.findUnique({ where: { id } });
    if (!row) return badRequest("Template not found.");

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return badRequest("Request body is required.");
    const parsed = updateOnboardingTemplateSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(
        parsed.error.errors.map((err) => ({
          field: err.path.join("."),
          code: err.code,
          message: err.message,
        }))
      );
    }
    const data = parsed.data;

    const updateData: Record<string, unknown> = {
      ...(data.label !== undefined ? { label: data.label } : {}),
      ...(data.description !== undefined ? { description: data.description || null } : {}),
      ...(data.countryCode !== undefined ? { countryCode: data.countryCode } : {}),
      ...(data.board !== undefined ? { board: data.board || null } : {}),
      ...(data.category !== undefined ? { category: data.category } : {}),
      ...(data.currency !== undefined ? { currency: data.currency } : {}),
      ...(data.currencySymbol !== undefined ? { currencySymbol: data.currencySymbol } : {}),
      ...(data.timezone !== undefined ? { timezone: data.timezone } : {}),
      ...(data.gradingSystem !== undefined ? { gradingSystem: data.gradingSystem } : {}),
      ...(data.curriculum !== undefined ? { curriculum: data.curriculum } : {}),
      ...(data.fiscalYearStartMonth !== undefined ? { fiscalYearStartMonth: data.fiscalYearStartMonth } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      version: { increment: 1 },
    };
    if (data.classes !== undefined) {
      const classes = resolveAcademicStructure("K_12", data.classes as any);
      updateData.classes = classes as unknown as object;
    }
    if (data.feeHeads !== undefined) {
      updateData.feeHeads = (data.feeHeads ?? []) as unknown as object;
    }

    const updated = await prisma.onboardingTemplate.update({ where: { id }, data: updateData as any });
    return successResponse(updated, "Template updated.");
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/system-admin/onboarding-templates/[id]
 * Custom templates only — built-ins are reset, never deleted.
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireApiAccess(request, { allowSystemAdmin: true });
    if ("response" in access) return access.response;
    const no = denied(access);
    if (no) return no;

    const { id } = await params;
    const row = await prisma.onboardingTemplate.findUnique({ where: { id } });
    if (!row) return badRequest("Template not found.");
    if (row.isSystem) {
      return badRequest("Built-in templates cannot be deleted. Deactivate or reset them instead.");
    }
    await prisma.onboardingTemplate.delete({ where: { id } });
    return successResponse({ id }, "Template deleted.");
  } catch (error) {
    return handleApiError(error);
  }
}
