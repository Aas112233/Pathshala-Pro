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
import {
  getTemplateStats,
  ensureBuiltInOnboardingTemplates,
} from "@/lib/onboarding-template-store";
import { resolveAcademicStructure } from "@/lib/onboarding-structure";
import { createOnboardingTemplateSchema, CLASS_TEMPLATE_PRESETS } from "@/lib/schemas";

function requireSysAdmin(access: any, user: any) {
  if (user.role !== "SYSTEM_ADMIN" && !isPlatformOwnerEmail(user.email) && !access.authContext.isImpersonated) {
    return unauthorized("Only platform system administrators can manage onboarding templates.");
  }
  return null;
}

function toSummary(row: {
  id: string;
  code: string;
  label: string | null;
  description: string | null;
  isActive: boolean;
  isSystem: boolean;
  classes: unknown;
  version: number;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    code: row.code,
    label: row.label,
    description: row.description,
    isActive: row.isActive,
    isBuiltIn: row.isSystem,
    stats: getTemplateStats(Array.isArray(row.classes) ? (row.classes as any) : []),
    version: row.version,
    updatedAt: row.updatedAt,
  };
}

/**
 * GET /api/system-admin/onboarding-templates
 * List all templates (seeds built-ins on first call).
 */
export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess(request, { allowSystemAdmin: true });
    if ("response" in access) return access.response;
    const denied = requireSysAdmin(access, access.authContext.user);
    if (denied) return denied;

    await ensureBuiltInOnboardingTemplates();
    const rows = await prisma.onboardingTemplate.findMany({
      orderBy: [{ isSystem: "desc" }, { code: "asc" }],
    });
    return successResponse(rows.map(toSummary));
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/system-admin/onboarding-templates
 * Create a custom template, or duplicate an existing one via { duplicateOf, code }.
 */
export async function POST(request: NextRequest) {
  try {
    const access = await requireApiAccess(request, { allowSystemAdmin: true });
    if ("response" in access) return access.response;
    const denied = requireSysAdmin(access, access.authContext.user);
    if (denied) return denied;

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return badRequest("Request body is required.");

    // Duplicate flow: clone classes/meta from an existing row under a new code.
    if ((body as any).duplicateOf) {
      const source = await prisma.onboardingTemplate.findUnique({
        where: { id: String((body as any).duplicateOf) },
      });
      if (!source) return badRequest("Source template not found.");
      const code = String((body as any).code ?? "").toUpperCase().trim();
      if (!/^[A-Z0-9_]{2,32}$/.test(code)) {
        return badRequest("Code must contain only uppercase letters, numbers, and underscores.");
      }
      if ((CLASS_TEMPLATE_PRESETS as readonly string[]).includes(code)) {
        return badRequest("Code collides with a built-in preset.");
      }
      const clash = await prisma.onboardingTemplate.findUnique({ where: { code } });
      if (clash) return badRequest("Template code already exists.");
      const created = await prisma.onboardingTemplate.create({
        data: {
          code,
          label: `${source.label ?? source.code} (Copy)`,
          description: source.description,
          countryCode: source.countryCode,
          board: source.board,
          category: source.category,
          currency: source.currency,
          currencySymbol: source.currencySymbol,
          timezone: source.timezone,
          gradingSystem: source.gradingSystem,
          curriculum: source.curriculum,
          fiscalYearStartMonth: source.fiscalYearStartMonth,
          classes: source.classes as object,
          feeHeads: source.feeHeads ?? undefined,
          isSystem: false,
          isActive: true,
        },
      });
      return successResponse(toSummary(created as any), "Template duplicated.", 201);
    }

    const parsed = createOnboardingTemplateSchema.safeParse(body);
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
    if ((CLASS_TEMPLATE_PRESETS as readonly string[]).includes(data.code)) {
      return badRequest("Code collides with a built-in preset.");
    }
    const clash = await prisma.onboardingTemplate.findUnique({ where: { code: data.code } });
    if (clash) return badRequest("Template code already exists.");

    const classes = resolveAcademicStructure("K_12", data.classes as any);
    const created = await prisma.onboardingTemplate.create({
      data: {
        code: data.code,
        label: data.label,
        description: data.description || null,
        countryCode: data.countryCode,
        board: data.board || null,
        category: data.category,
        currency: data.currency,
        currencySymbol: data.currencySymbol,
        timezone: data.timezone,
        gradingSystem: data.gradingSystem,
        curriculum: data.curriculum,
        fiscalYearStartMonth: data.fiscalYearStartMonth,
        classes: classes as unknown as object,
        feeHeads: (data.feeHeads ?? []) as unknown as object,
        isSystem: false,
        isActive: data.isActive,
      },
    });
    return successResponse(toSummary(created as any), "Template created.", 201);
  } catch (error) {
    return handleApiError(error);
  }
}
