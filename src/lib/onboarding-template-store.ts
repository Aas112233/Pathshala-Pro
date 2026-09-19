import { prisma } from "@/lib/prisma";
import {
  getClassTemplateDefinitions,
  type TemplateClassDef,
} from "@/lib/onboarding-templates";
import { CLASS_TEMPLATE_PRESETS } from "@/lib/schemas";

type TemplateReader = {
  findUnique: (args: any) => Promise<{ id: string } | null>;
  findFirst: (args: any) => Promise<{ classes: unknown } | null>;
  create: (args: any) => Promise<unknown>;
};

type StoreClient = { onboardingTemplate: TemplateReader };

export interface TemplateStats {
  classes: number;
  sections: number;
  groups: number;
  subjects: number;
}

/** Count what a template provisions (for admin cards and wizard badges). */
export function getTemplateStats(classes: TemplateClassDef[]): TemplateStats {
  let sections = 0;
  let groups = 0;
  const subjectCodes = new Set<string>();
  for (const cls of classes ?? []) {
    sections += cls.sections?.length ?? 0;
    groups += cls.groups?.length ?? 0;
    for (const s of cls.subjects ?? []) subjectCodes.add(s.code);
  }
  return { classes: (classes ?? []).length, sections, groups, subjects: subjectCodes.size };
}

function presetCountryAndCategory(code: string): { countryCode: string; category: string } {
  if (code.startsWith("PK_")) return { countryCode: "PK", category: "NATIONAL" };
  if (code.startsWith("IN_")) return { countryCode: "IN", category: "NATIONAL" };
  if (code.startsWith("BD_")) return { countryCode: "BD", category: "NATIONAL" };
  if (code === "MADRASA") return { countryCode: "INTL", category: "RELIGIOUS" };
  if (code === "O_A_LEVELS" || code === "IGCSE_CAMBRIDGE") {
    return { countryCode: "INTL", category: "INTERNATIONAL" };
  }
  return { countryCode: "INTL", category: "GENERIC" };
}

/**
 * Idempotently seed the 12 built-in presets into the DB (labels stay null so
 * the UI falls back to the translated built-in strings). Returns the count
 * of rows created (0 when everything already exists).
 */
export async function ensureBuiltInOnboardingTemplates(
  client: StoreClient = prisma as unknown as StoreClient
): Promise<number> {
  let created = 0;
  for (const preset of CLASS_TEMPLATE_PRESETS) {
    const classes = getClassTemplateDefinitions(preset);
    const { countryCode, category } = presetCountryAndCategory(preset);
    const existing = await client.onboardingTemplate.findUnique({
      where: { code: preset },
      select: { id: true },
    });
    if (existing) continue;
    await client.onboardingTemplate.create({
      data: {
        code: preset,
        label: null,
        description: null,
        countryCode,
        category,
        isSystem: true,
        isActive: true,
        version: 1,
        classes: classes as unknown as object,
      },
    });
    created++;
  }
  return created;
}

function isTemplateClassArray(value: unknown): value is TemplateClassDef[] {
  if (!Array.isArray(value) || value.length === 0) return false;
  return value.every(
    (c) =>
      c &&
      typeof c.code === "string" &&
      typeof c.sequence === "number" &&
      Array.isArray(c.sections) &&
      Array.isArray(c.subjects)
  );
}

/**
 * Resolve the class definitions for a provisioning run:
 * the active DB template wins, then the built-in code definitions.
 * Returns null when nothing resolves (caller turns it into a 400).
 * Explicit academic-structure overrides bypass this helper and go through
 * resolveAcademicStructure directly (see tenants route).
 */
export async function resolveOnboardingTemplateClasses(
  presetCode: string,
  client: StoreClient = prisma as unknown as StoreClient
): Promise<TemplateClassDef[] | null> {
  if (!presetCode) return null;
  try {
    const row = await client.onboardingTemplate.findFirst({
      where: { code: presetCode, isActive: true },
      select: { classes: true },
    });
    if (row && isTemplateClassArray(row.classes)) return row.classes;
  } catch {
    // DB unreachable/blocked — fall through to built-ins below.
  }
  // Unknown codes resolve to null (built-ins never throw, so guard first).
  if (!(CLASS_TEMPLATE_PRESETS as readonly string[]).includes(presetCode)) return null;
  return getClassTemplateDefinitions(presetCode as (typeof CLASS_TEMPLATE_PRESETS)[number]);
}
