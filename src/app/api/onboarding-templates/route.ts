import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, handleApiError } from "@/lib/api-response";
import {
  getTemplateStats,
} from "@/lib/onboarding-template-store";
import {
  getClassTemplateDefinitions,
  type TemplateClassDef,
} from "@/lib/onboarding-templates";
import { CLASS_TEMPLATE_PRESETS } from "@/lib/schemas";

/**
 * GET /api/onboarding-templates (public — no auth, metadata only)
 * Lists ACTIVE templates for the signup wizard: code, label, description,
 * counts. Full class definitions stay server-side; provisioning resolves them.
 * Falls back to built-in code definitions when the DB table is empty.
 */
export async function GET(_request: NextRequest) {
  try {
    let rows: Array<{
      code: string;
      label: string | null;
      description: string | null;
      isSystem: boolean;
      classes: unknown;
      updatedAt: Date;
    }> = [];
    try {
      rows = await prisma.onboardingTemplate.findMany({
        where: { isActive: true },
        select: {
          code: true,
          label: true,
          description: true,
          isSystem: true,
          classes: true,
          updatedAt: true,
        },
        orderBy: [{ isSystem: "desc" }, { code: "asc" }],
      });
    } catch {
      rows = [];
    }

    if (rows.length > 0) {
      return successResponse(
        rows.map((row) => ({
          code: row.code,
          label: row.label,
          description: row.description,
          isBuiltIn: row.isSystem,
          stats: getTemplateStats(
            Array.isArray(row.classes) ? (row.classes as TemplateClassDef[]) : []
          ),
          updatedAt: row.updatedAt,
        }))
      );
    }

    // Fresh platform / table not seeded yet: describe built-ins from code.
    return successResponse(
      (CLASS_TEMPLATE_PRESETS as readonly string[]).map((code) => {
        const classes = getClassTemplateDefinitions(code as any);
        return {
          code,
          label: null,
          description: null,
          isBuiltIn: true,
          stats: getTemplateStats(classes),
          updatedAt: null,
        };
      })
    );
  } catch (error) {
    return handleApiError(error);
  }
}
