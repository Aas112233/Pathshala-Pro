import type { ClassTemplatePreset } from "@/lib/schemas";

export interface TemplateClassDef {
  name: string;
  code: string;
  sequence: number;
  sections: string[];
  subjects: Array<{ name: string; code: string; type: "THEORY" | "PRACTICAL" | "BOTH" }>;
}

export function getClassTemplateDefinitions(template: ClassTemplatePreset): TemplateClassDef[] {
  const commonSubjects = [
    { name: "English Language", code: "ENG", type: "THEORY" as const },
    { name: "Mathematics", code: "MATH", type: "THEORY" as const },
    { name: "Science", code: "SCI", type: "BOTH" as const },
    { name: "Social Studies & History", code: "SST", type: "THEORY" as const },
    { name: "Computer Studies", code: "CS", type: "BOTH" as const },
    { name: "Islamic Studies / Ethics", code: "ISL", type: "THEORY" as const },
  ];

  const primarySubjects = [
    { name: "English", code: "ENG", type: "THEORY" as const },
    { name: "Mathematics", code: "MATH", type: "THEORY" as const },
    { name: "General Science", code: "GSCI", type: "THEORY" as const },
    { name: "Social Studies", code: "SST", type: "THEORY" as const },
    { name: "Urdu / National Language", code: "LANG", type: "THEORY" as const },
  ];

  const earlyYearsSubjects = [
    { name: "English Phonics & Literacy", code: "ENG", type: "THEORY" as const },
    { name: "Basic Numeracy", code: "MATH", type: "THEORY" as const },
    { name: "General Knowledge & Art", code: "GK", type: "PRACTICAL" as const },
  ];

  switch (template) {
    case "PRIMARY_1_5":
      return [1, 2, 3, 4, 5].map((grade, idx) => ({
        name: `Class ${grade}`,
        code: `CLS-${grade}`,
        sequence: idx + 1,
        sections: ["Section A", "Section B"],
        subjects: primarySubjects,
      }));

    case "MIDDLE_6_8":
      return [6, 7, 8].map((grade, idx) => ({
        name: `Class ${grade}`,
        code: `CLS-${grade}`,
        sequence: idx + 1,
        sections: ["Section A", "Section B"],
        subjects: commonSubjects,
      }));

    case "SECONDARY_9_10":
      return [
        {
          name: "Class 9 (Matric Part 1)",
          code: "CLS-9",
          sequence: 1,
          sections: ["Section A", "Section B"],
          subjects: [
            { name: "English Compulsory", code: "ENG-9", type: "THEORY" as const },
            { name: "Mathematics (Science)", code: "MATH-9", type: "THEORY" as const },
            { name: "Physics", code: "PHY-9", type: "BOTH" as const },
            { name: "Chemistry", code: "CHEM-9", type: "BOTH" as const },
            { name: "Biology / Computer Science", code: "BIO-CS-9", type: "BOTH" as const },
            { name: "Islamiat Compulsory", code: "ISL-9", type: "THEORY" as const },
          ],
        },
        {
          name: "Class 10 (Matric Part 2)",
          code: "CLS-10",
          sequence: 2,
          sections: ["Section A", "Section B"],
          subjects: [
            { name: "English Compulsory", code: "ENG-10", type: "THEORY" as const },
            { name: "Mathematics", code: "MATH-10", type: "THEORY" as const },
            { name: "Physics", code: "PHY-10", type: "BOTH" as const },
            { name: "Chemistry", code: "CHEM-10", type: "BOTH" as const },
            { name: "Biology / Computer Science", code: "BIO-CS-10", type: "BOTH" as const },
            { name: "Pakistan Studies", code: "PST-10", type: "THEORY" as const },
          ],
        },
      ];

    case "HIGHER_SEC_11_12":
      return [
        {
          name: "Grade 11 (HSSC-I / Intermediate)",
          code: "HSSC-1",
          sequence: 1,
          sections: ["FSc Pre-Medical", "FSc Pre-Engineering", "ICS Computer Science", "I.Com"],
          subjects: commonSubjects,
        },
        {
          name: "Grade 12 (HSSC-II / Intermediate)",
          code: "HSSC-2",
          sequence: 2,
          sections: ["FSc Pre-Medical", "FSc Pre-Engineering", "ICS Computer Science", "I.Com"],
          subjects: commonSubjects,
        },
      ];

    case "O_A_LEVELS":
      return [
        { name: "O-Level Year 1 (Grade 9)", code: "O1", sequence: 1, sections: ["Section A"], subjects: commonSubjects },
        { name: "O-Level Year 2 (Grade 10)", code: "O2", sequence: 2, sections: ["Section A"], subjects: commonSubjects },
        { name: "O-Level Year 3 (Grade 11)", code: "O3", sequence: 3, sections: ["Section A"], subjects: commonSubjects },
        { name: "A-Level Year 1 (AS)", code: "A1", sequence: 4, sections: ["Science", "Business"], subjects: commonSubjects },
        { name: "A-Level Year 2 (A2)", code: "A2", sequence: 5, sections: ["Science", "Business"], subjects: commonSubjects },
      ];

    case "MADRASA":
      return [
        { name: "Nazra Quran", code: "NZR", sequence: 1, sections: ["Morning", "Evening"], subjects: [{ name: "Quran Recitation & Tajweed", code: "TAJ", type: "THEORY" as const }] },
        { name: "Hifz-ul-Quran", code: "HFZ", sequence: 2, sections: ["Dormitory", "Day"], subjects: [{ name: "Hifz Revision & Sabaq", code: "HFZ-SAB", type: "THEORY" as const }] },
        { name: "Dars-e-Nizami (Awwal)", code: "DN-1", sequence: 3, sections: ["Darja Awwal"], subjects: [{ name: "Arabic Grammar & Fiqh", code: "AR-FQ", type: "THEORY" as const }] },
        { name: "Dars-e-Nizami (Saani)", code: "DN-2", sequence: 4, sections: ["Darja Saani"], subjects: [{ name: "Hadith & Fiqh Principles", code: "HD-USL", type: "THEORY" as const }] },
      ];

    case "CUSTOM":
      return [];

    case "K_12":
    default:
      return [
        { name: "Playgroup", code: "PG", sequence: 1, sections: ["Rose"], subjects: earlyYearsSubjects },
        { name: "Nursery", code: "NUR", sequence: 2, sections: ["Tulip"], subjects: earlyYearsSubjects },
        { name: "Kindergarten (KG)", code: "KG", sequence: 3, sections: ["Lotus"], subjects: earlyYearsSubjects },
        { name: "Grade 1", code: "GR-1", sequence: 4, sections: ["Section A", "Section B"], subjects: primarySubjects },
        { name: "Grade 2", code: "GR-2", sequence: 5, sections: ["Section A", "Section B"], subjects: primarySubjects },
        { name: "Grade 3", code: "GR-3", sequence: 6, sections: ["Section A", "Section B"], subjects: primarySubjects },
        { name: "Grade 4", code: "GR-4", sequence: 7, sections: ["Section A", "Section B"], subjects: primarySubjects },
        { name: "Grade 5", code: "GR-5", sequence: 8, sections: ["Section A", "Section B"], subjects: primarySubjects },
        { name: "Grade 6", code: "GR-6", sequence: 9, sections: ["Section A"], subjects: commonSubjects },
        { name: "Grade 7", code: "GR-7", sequence: 10, sections: ["Section A"], subjects: commonSubjects },
        { name: "Grade 8", code: "GR-8", sequence: 11, sections: ["Section A"], subjects: commonSubjects },
        { name: "Grade 9", code: "GR-9", sequence: 12, sections: ["Science", "Arts"], subjects: commonSubjects },
        { name: "Grade 10", code: "GR-10", sequence: 13, sections: ["Science", "Arts"], subjects: commonSubjects },
      ];
  }
}

/**
 * Generates a clean tenant identifier from a school name.
 * e.g. "Beaconhouse School System" -> "beaconhouse-school-system"
 */
export function generateTenantSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 24);
}
