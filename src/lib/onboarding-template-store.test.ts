import { describe, it, expect } from "vitest";
import {
  getTemplateStats,
  ensureBuiltInOnboardingTemplates,
  resolveOnboardingTemplateClasses,
} from "@/lib/onboarding-template-store";
import { CLASS_TEMPLATE_PRESETS } from "@/lib/schemas";

describe("onboarding template store", () => {
  describe("getTemplateStats", () => {
    it("counts classes, sections, groups, and unique subjects", () => {
      const stats = getTemplateStats([
        {
          name: "IGCSE Year 1",
          code: "IGCSE-1",
          sequence: 1,
          sections: ["Section A", "Section B"],
          groups: [{ name: "Science", shortName: "SCI" }],
          subjects: [
            { name: "Math", code: "MATH", type: "THEORY" },
            { name: "Physics", code: "PHY", type: "BOTH" },
          ],
        },
        {
          name: "IGCSE Year 2",
          code: "IGCSE-2",
          sequence: 2,
          sections: ["Section A"],
          groups: [{ name: "Science", shortName: "SCI" }],
          subjects: [
            { name: "Math", code: "MATH", type: "THEORY" },
            { name: "Chemistry", code: "CHE", type: "BOTH" },
          ],
        },
      ] as any);
      expect(stats).toEqual({ classes: 2, sections: 3, groups: 2, subjects: 3 });
    });

    it("handles empty input", () => {
      expect(getTemplateStats([])).toEqual({ classes: 0, sections: 0, groups: 0, subjects: 0 });
    });
  });

  describe("ensureBuiltInOnboardingTemplates", () => {
    it("creates one row per preset and skips existing ones", async () => {
      const existing = new Set(["K_12"]);
      const created: any[] = [];
      const client: any = {
        onboardingTemplate: {
          findUnique: async ({ where }: any) =>
            existing.has(where.code) ? { id: `id-${where.code}` } : null,
          create: async ({ data }: any) => {
            created.push(data);
            existing.add(data.code);
            return data;
          },
        },
      };
      const count = await ensureBuiltInOnboardingTemplates(client);
      expect(count).toBe(CLASS_TEMPLATE_PRESETS.length - 1);
      expect(created).toHaveLength(CLASS_TEMPLATE_PRESETS.length - 1);
      expect(created[0].isSystem).toBe(true);
      expect(created[0].isActive).toBe(true);
      expect(created[0].label).toBeNull();

      // Second run creates nothing (idempotent)
      expect(await ensureBuiltInOnboardingTemplates(client)).toBe(0);
    });
  });

  describe("resolveOnboardingTemplateClasses", () => {
    const liveClasses = [
      {
        name: "Custom One",
        code: "C1",
        sequence: 1,
        sections: ["Section A"],
        subjects: [{ name: "Math", code: "MATH", type: "THEORY" }],
      },
    ];

    it("prefers the active DB template over built-ins", async () => {
      const client: any = {
        onboardingTemplate: {
          findFirst: async () => ({ classes: liveClasses }),
        },
      };
      const resolved = await resolveOnboardingTemplateClasses("K_12", client);
      expect(resolved).toEqual(liveClasses);
    });

    it("falls back to built-ins when no DB row exists", async () => {
      const client: any = {
        onboardingTemplate: { findFirst: async () => null },
      };
      const resolved = await resolveOnboardingTemplateClasses("K_12", client);
      expect(Array.isArray(resolved)).toBe(true);
      expect(resolved!.length).toBeGreaterThan(0);
    });

    it("returns null for unknown codes and empty input", async () => {
      const client: any = {
        onboardingTemplate: { findFirst: async () => null },
      };
      expect(await resolveOnboardingTemplateClasses("NOPE", client)).toBeNull();
      expect(await resolveOnboardingTemplateClasses("", client)).toBeNull();
    });

    it("ignores malformed DB rows and falls back to built-ins", async () => {
      const client: any = {
        onboardingTemplate: { findFirst: async () => ({ classes: { nope: true } }) },
      };
      const resolved = await resolveOnboardingTemplateClasses("K_12", client);
      expect(Array.isArray(resolved)).toBe(true);
      expect(resolved!.length).toBeGreaterThan(0);
    });
  });
});
