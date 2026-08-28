import { describe, it, expect } from "vitest";
import { onboardInstituteSchema } from "@/lib/schemas";
import {
  generateTenantSlug,
  getClassTemplateDefinitions,
} from "@/lib/onboarding-templates";

describe("Institute Onboarding & Tenant Provisioning", () => {
  describe("Slug Generator", () => {
    it("converts institute names into URL-safe lowercase slugs", () => {
      expect(generateTenantSlug("Beaconhouse International School")).toBe(
        "beaconhouse-internationa"
      );
      expect(generateTenantSlug("Army Public School & College")).toBe(
        "army-public-school-colle"
      );
      expect(generateTenantSlug("St. Mary's High School (Campus-1)")).toBe(
        "st-marys-high-school-cam"
      );
    });

    it("handles trailing and multiple hyphens cleanly", () => {
      expect(generateTenantSlug("  The   City   School   ")).toBe(
        "the-city-school"
      );
    });
  });

  describe("Class Template Definitions Seeder", () => {
    it("returns 13 classes for K-12 comprehensive preset with core subjects", () => {
      const classes = getClassTemplateDefinitions("K_12");
      expect(classes.length).toBe(13);
      expect(classes[0].name).toBe("Playgroup");
      expect(classes[3].name).toBe("Grade 1");
      expect(classes[3].sections).toContain("Section A");
      expect(classes[3].subjects.length).toBeGreaterThan(0);
    });

    it("returns 5 classes for primary school preset", () => {
      const classes = getClassTemplateDefinitions("PRIMARY_1_5");
      expect(classes.length).toBe(5);
      expect(classes[0].name).toBe("Class 1");
      expect(classes[4].name).toBe("Class 5");
    });

    it("returns Cambridge O/A levels streams", () => {
      const classes = getClassTemplateDefinitions("O_A_LEVELS");
      expect(classes.length).toBe(5);
      expect(classes.map((c) => c.name)).toEqual([
        "O-Level Year 1 (Grade 9)",
        "O-Level Year 2 (Grade 10)",
        "O-Level Year 3 (Grade 11)",
        "A-Level Year 1 (AS)",
        "A-Level Year 2 (A2)",
      ]);
    });

    it("returns Pakistan FBISE curriculum with Matric and Intermediate streams", () => {
      const classes = getClassTemplateDefinitions("PK_FBISE_MATRIC_INTER");
      expect(classes.length).toBe(4);
      expect(classes[0].name).toContain("Class 9 (SSC-I");
      expect(classes[0].subjects.some((s) => s.code === "ENG-9")).toBe(true);
      expect(classes[0].subjects.some((s) => s.code === "ISL-9" && s.totalMarks === 75)).toBe(true);
      expect(classes[2].subjects.some((s) => s.code === "ACC-11" && s.totalMarks === 200)).toBe(true);
    });

    it("returns India CBSE curriculum with Std/Basic Math and Commerce streams", () => {
      const classes = getClassTemplateDefinitions("IN_CBSE_SECONDARY_SR_SEC");
      expect(classes.length).toBe(4);
      expect(classes[0].name).toContain("Class 9 (CBSE Secondary)");
      expect(classes[0].subjects.some((s) => s.code === "CBSE-184")).toBe(true);
      expect(classes[0].subjects.some((s) => s.code === "CBSE-041")).toBe(true);
      expect(classes[2].subjects.some((s) => s.code === "CBSE-055")).toBe(true);
    });

    it("returns Bangladesh NCTB curriculum from Primary (1-5) to HSC (11-12)", () => {
      const classes = getClassTemplateDefinitions("BD_NCTB_PRIMARY_SSC_HSC");
      expect(classes.length).toBe(12);
      expect(classes[0].name).toContain("Class 1");
      expect(classes[0].subjects.some((s) => s.code === "BD-101-P")).toBe(true);
      expect(classes[5].subjects.some((s) => s.code === "BD-154-J")).toBe(true);
      expect(classes[8].subjects.some((s) => s.code === "BD-101-SSC")).toBe(true);
      expect(classes[10].subjects.some((s) => s.code === "BD-101-HSC")).toBe(true);
    });

    it("returns religious curriculum for Madrasa preset", () => {
      const classes = getClassTemplateDefinitions("MADRASA");
      expect(classes.length).toBe(4);
      expect(classes[0].name).toBe("Nazra Quran");
      expect(classes[1].name).toBe("Hifz-ul-Quran");
    });

    it("returns empty list for CUSTOM preset", () => {
      const classes = getClassTemplateDefinitions("CUSTOM");
      expect(classes).toEqual([]);
    });
  });

  describe("Onboard Institute Schema Validation", () => {
    const validPayload = {
      name: "Crescent Model Higher Secondary School",
      tenantId: "crescent-model",
      schoolCode: "CMS-2026",
      address: "Shadman Colony, Lahore, Pakistan",
      phone: "+92 42 111 222 333",
      email: "info@crescent.edu.pk",
      currency: "PKR",
      currencySymbol: "₨",
      taxRate: 0,
      dateFormat: "DD/MM/YYYY",
      timeFormat: "12h",
      timezone: "Asia/Karachi",
      firstDayOfWeek: "monday",
      gradingSystem: "GPA",
      academicYearLabel: "2026-2027",
      academicStartDate: "2026-08-01",
      academicEndDate: "2027-06-30",
      classTemplate: "K_12",
      adminName: "Mian Altaf",
      adminEmail: "principal@crescent.edu.pk",
      adminPassword: "SecurePassword123!",
      subscriptionStatus: "TRIAL",
    };

    it("accepts valid comprehensive onboarding input", () => {
      const parsed = onboardInstituteSchema.safeParse(validPayload);
      expect(parsed.success).toBe(true);
    });

    it("rejects invalid email formats", () => {
      const invalid = { ...validPayload, adminEmail: "not-an-email" };
      const parsed = onboardInstituteSchema.safeParse(invalid);
      expect(parsed.success).toBe(false);
    });

    it("rejects password with fewer than 6 characters", () => {
      const invalid = { ...validPayload, adminPassword: "123" };
      const parsed = onboardInstituteSchema.safeParse(invalid);
      expect(parsed.success).toBe(false);
    });

    it("rejects invalid slug characters (e.g. spaces or uppercase in slug)", () => {
      const invalid = { ...validPayload, tenantId: "Crescent Model School" };
      const parsed = onboardInstituteSchema.safeParse(invalid);
      expect(parsed.success).toBe(false);
    });

    it("strictly rejects reserved platform slugs such as 'system', 'admin', 'api', 'platform'", () => {
      const reservedSlugs = ["system", "admin", "api", "app", "platform", "root", "superadmin", "null"];
      for (const slug of reservedSlugs) {
        const invalid = { ...validPayload, tenantId: slug };
        const parsed = onboardInstituteSchema.safeParse(invalid);
        expect(parsed.success).toBe(false);
      }
    });
  });
});
