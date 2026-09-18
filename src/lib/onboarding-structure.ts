import type { ClassTemplatePreset } from "@/lib/schemas";
import type { OnboardAcademicStructureItem } from "@/lib/schemas";
import {
  getClassTemplateDefinitions,
  type TemplateClassDef,
  type TemplateSubjectDef,
} from "@/lib/onboarding-templates";

export const STRUCTURE_ERROR = {
  DUPLICATE_CODE: "DUPLICATE_CLASS_CODE",
  DUPLICATE_SEQUENCE: "DUPLICATE_CLASS_SEQUENCE",
} as const;

/**
 * Normalizes a wizard override into TemplateClassDef[] and enforces the
 * @@unique([tenantId, classId]) / @@unique([tenantId, classNumber]) invariants
 * before anything touches the database.
 * Throws Error with STRUCTURE_ERROR codes so the route can return a 400.
 */
export function resolveAcademicStructure(
  template: ClassTemplatePreset,
  override?: OnboardAcademicStructureItem[] | null
): TemplateClassDef[] {
  if (!override || override.length === 0) {
    return getClassTemplateDefinitions(template);
  }

  const codes = new Set<string>();
  const sequences = new Set<number>();
  for (const item of override) {
    if (codes.has(item.code)) throw new Error(`${STRUCTURE_ERROR.DUPLICATE_CODE}:${item.code}`);
    if (sequences.has(item.sequence)) throw new Error(`${STRUCTURE_ERROR.DUPLICATE_SEQUENCE}:${item.sequence}`);
    codes.add(item.code);
    sequences.add(item.sequence);
  }

  return override.map((item) => ({
    name: item.name.trim(),
    code: item.code.trim(),
    sequence: item.sequence,
    sections: item.sections,
    subjects: item.subjects.map(
      (s): TemplateSubjectDef => ({
        name: s.name.trim(),
        code: s.code.trim(),
        type: s.type,
        totalMarks: s.totalMarks,
        passMarks: s.passMarks,
      })
    ),
  }));
}
