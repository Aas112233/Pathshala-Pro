import { describe, it, expect } from "vitest";
import {
  seedTenantChartOfAccounts,
  seedTenantFeeHeads,
  seedTenantFiscalCalendar,
  seedTenantVoucherSequences,
  seedTenantPromotionRules,
  seedTenantGroups,
  seedTenantClassFeeStructures,
  seedTenantExpenseCategories,
  deriveDefaultFeeStructures,
  DEFAULT_CHART_OF_ACCOUNTS,
  DEFAULT_FEE_HEADS,
  DEFAULT_EXPENSE_CATEGORIES,
} from "@/lib/tenant-provisioning";

describe("Multi-Tenant Provisioning & Bootstrapping", () => {
  describe("seedTenantChartOfAccounts", () => {
    it("seeds standard 5-tier Chart of Accounts with correct currencies and normal balances", async () => {
      let createdData: any[] = [];
      const mockTx: any = {
        chartOfAccount: {
          createMany: async (payload: any) => {
            createdData = payload.data;
            return { count: payload.data.length };
          },
        },
      };

      const res = await seedTenantChartOfAccounts(mockTx, "school-dhaka-01", "BDT");
      expect(res.count).toBe(DEFAULT_CHART_OF_ACCOUNTS.length);
      expect(createdData[0].tenantId).toBe("school-dhaka-01");
      expect(createdData[0].currency).toBe("BDT");

      // Verify specific essential accounts exist
      const bank = createdData.find((a) => a.code === "1010");
      expect(bank?.normalBalance).toBe("DEBIT");
      expect(bank?.accountType).toBe("ASSET");

      const tuition = createdData.find((a) => a.code === "4010");
      expect(tuition?.normalBalance).toBe("CREDIT");
      expect(tuition?.accountType).toBe("REVENUE");
    });
  });

  describe("seedTenantFeeHeads", () => {
    it("seeds default billing fee heads with correct GL revenue accounts", async () => {
      let createdData: any[] = [];
      const mockTx: any = {
        feeHead: {
          createMany: async (payload: any) => {
            createdData = payload.data;
            return { count: payload.data.length };
          },
        },
      };

      const res = await seedTenantFeeHeads(mockTx, "school-lahore-01");
      expect(res.count).toBe(DEFAULT_FEE_HEADS.length);

      const tuitionHead = createdData.find((h) => h.code === "TUITION");
      expect(tuitionHead?.accountCode).toBe("4010");

      const transportHead = createdData.find((h) => h.code === "TRANSPORT");
      expect(transportHead?.accountCode).toBe("4040");
    });
  });

  describe("seedTenantFiscalCalendar", () => {
    it("creates master FiscalYear and 12 child FinancialPeriods starting in July", async () => {
      let createdFy: any = null;
      let createdPeriods: any[] = [];

      const mockTx: any = {
        fiscalYear: {
          create: async (payload: any) => {
            createdFy = { id: "fy-1", ...payload.data };
            return createdFy;
          },
        },
        financialPeriod: {
          createMany: async (payload: any) => {
            createdPeriods = payload.data;
            return { count: payload.data.length };
          },
        },
      };

      const fy = await seedTenantFiscalCalendar(mockTx, "school-karachi-01", 7, 2026);
      expect(fy.name).toBe("FY 2026-2027");
      expect(createdPeriods.length).toBe(12);

      // Period 1 should be July 2026
      expect(createdPeriods[0].periodNumber).toBe(1);
      expect(createdPeriods[0].name).toBe("July 2026");

      // Period 12 should be June 2027
      expect(createdPeriods[11].periodNumber).toBe(12);
      expect(createdPeriods[11].name).toBe("June 2027");
    });

    it("creates Indian fiscal year starting in April", async () => {
      let createdFy: any = null;
      let createdPeriods: any[] = [];

      const mockTx: any = {
        fiscalYear: {
          create: async (payload: any) => {
            createdFy = { id: "fy-in", ...payload.data };
            return createdFy;
          },
        },
        financialPeriod: {
          createMany: async (payload: any) => {
            createdPeriods = payload.data;
            return { count: payload.data.length };
          },
        },
      };

      const fy = await seedTenantFiscalCalendar(mockTx, "school-delhi-01", 4, 2026);
      expect(fy.name).toBe("FY 2026-2027");
      expect(createdPeriods[0].name).toBe("April 2026");
      expect(createdPeriods[11].name).toBe("March 2027");
    });
  });

  describe("seedTenantVoucherSequences", () => {
    it("initializes all standard voucher type counters at 0", async () => {
      let createdData: any[] = [];
      const mockTx: any = {
        tenantVoucherSequence: {
          createMany: async (payload: any) => {
            createdData = payload.data;
            return { count: payload.data.length };
          },
        },
      };

      const res = await seedTenantVoucherSequences(mockTx, "school-dhaka-01", 2026);
      expect(res.count).toBeGreaterThanOrEqual(7);

      const rec = createdData.find((s) => s.voucherType === "RECEIPT");
      expect(rec?.prefix).toBe("REC");
      expect(rec?.current_number).toBe(0);
    });
  });

  describe("seedTenantPromotionRules", () => {
    it("creates promotion rules chaining each class to next and marks terminal class with nextClassId: null", async () => {
      let createdData: any[] = [];
      const mockTx: any = {
        promotionRule: {
          createMany: async (payload: any) => {
            createdData = payload.data;
            return { count: payload.data.length };
          },
        },
      };

      const classList = [
        { id: "c-9", classNumber: 9, name: "Class 9" },
        { id: "c-10", classNumber: 10, name: "Class 10" },
        { id: "c-11", classNumber: 11, name: "Class 11" },
        { id: "c-12", classNumber: 12, name: "Class 12" },
      ];

      const res = await seedTenantPromotionRules(mockTx, "school-lahore-01", "ay-2026", classList);
      expect(res.count).toBe(4);

      // Class 9 -> Next is Class 10
      expect(createdData[0].classId).toBe("c-9");
      expect(createdData[0].nextClassId).toBe("c-10");
      expect(createdData[0].allowConditionalPromotion).toBe(true);

      // Class 12 (Terminal) -> Next is null, conditional promotion false
      expect(createdData[3].classId).toBe("c-12");
      expect(createdData[3].nextClassId).toBeNull();
      expect(createdData[3].allowConditionalPromotion).toBe(false);
    });
  });

  describe("seedTenantGroups", () => {
    it("creates stream groups per class and links matching sections", async () => {
      const createdGroups: any[] = [];
      const updatedSections: any[] = [];
      const mockTx: any = {
        group: {
          create: async (payload: any) => {
            const row = { id: `g-${createdGroups.length}`, ...payload.data };
            createdGroups.push(row);
            return row;
          },
        },
        section: {
          update: async (payload: any) => {
            updatedSections.push(payload);
            return payload;
          },
        },
      };

      const classesById = new Map([["IGCSE-1", { id: "c-ig1", code: "IGCSE-1" }]]);
      const groupsByClassCode = new Map([
        [
          "IGCSE-1",
          [
            { name: "Science", shortName: "SCI", subjectCodes: ["PHY", "CHE"] },
            { name: "Business", shortName: "BIZ", subjectCodes: ["ACC", "ECO"] },
          ],
        ],
      ]);
      const sectionIdsByClassCode = new Map([
        [
          "IGCSE-1",
          [
            { id: "s-sci", name: "Science" },
            { id: "s-biz", name: "Business" },
          ],
        ],
      ]);

      const count = await seedTenantGroups(
        mockTx,
        "school-dhaka-01",
        classesById,
        groupsByClassCode,
        sectionIdsByClassCode
      );
      expect(count).toBe(2);
      expect(createdGroups[0].classId).toBe("c-ig1");
      expect(createdGroups[0].subjects).toEqual(["PHY", "CHE"]);
      // Sections with matching names get linked
      expect(updatedSections).toHaveLength(2);
      expect(updatedSections[0].data.groupId).toBe("g-0");
    });

    it("skips classes with no group definitions", async () => {
      const mockTx: any = {
        group: { create: async () => { throw new Error("should not create"); } },
        section: { update: async () => ({}) },
      };
      const count = await seedTenantGroups(
        mockTx,
        "school-dhaka-01",
        new Map([["GR-1", { id: "c-g1", code: "GR-1" }]]),
        new Map(),
        new Map()
      );
      expect(count).toBe(0);
    });
  });

  describe("deriveDefaultFeeStructures", () => {
    it("returns [] for a zero base (no zero-bill traps)", () => {
      expect(
        deriveDefaultFeeStructures([{ code: "GR-1", sequence: 1 }], 0)
      ).toEqual([]);
    });

    it("scales tuition mildly by class level", () => {
      const rows = deriveDefaultFeeStructures(
        [
          { code: "GR-1", sequence: 1 },
          { code: "GR-10", sequence: 10 },
        ],
        3000
      );
      expect(rows).toHaveLength(2);
      expect(rows[0]).toMatchObject({ classCode: "GR-1", tuitionFee: 3000 });
      expect(rows[1].tuitionFee).toBeGreaterThan(rows[0].tuitionFee);
    });
  });

  describe("seedTenantClassFeeStructures", () => {
    it("seeds one structure per class with summed totals and skips unknown codes", async () => {
      let createdData: any[] = [];
      const mockTx: any = {
        classFeeStructure: {
          createMany: async (payload: any) => {
            createdData = payload.data;
            return { count: payload.data.length };
          },
        },
      };

      const classIdsByCode = new Map([
        ["GR-9", "c-9"],
        ["GR-10", "c-10"],
      ]);
      const count = await seedTenantClassFeeStructures(mockTx, "school-lahore-01", "ay-2026", classIdsByCode, [
        { classCode: "GR-9", tuitionFee: 3000, examFee: 500 },
        { classCode: "NOPE", tuitionFee: 9999 },
      ]);
      expect(count).toBe(1);
      expect(createdData[0]).toMatchObject({
        tenantId: "school-lahore-01",
        academicYearId: "ay-2026",
        classId: "c-9",
        tuitionFee: 3000,
        examFee: 500,
        totalMonthlyFee: 3500,
      });
    });
  });

  describe("seedTenantExpenseCategories", () => {
    it("seeds the default operational categories", async () => {
      let createdData: any[] = [];
      const mockTx: any = {
        expenseCategory: {
          createMany: async (payload: any) => {
            createdData = payload.data;
            return { count: payload.data.length };
          },
        },
      };

      const res = await seedTenantExpenseCategories(mockTx, "school-dhaka-01");
      expect(res.count).toBe(DEFAULT_EXPENSE_CATEGORIES.length);
      expect(createdData[0].tenantId).toBe("school-dhaka-01");
      const salaries = createdData.find((c) => c.code === "EXP-SAL");
      expect(salaries?.isActive).toBe(true);
    });
  });
});
