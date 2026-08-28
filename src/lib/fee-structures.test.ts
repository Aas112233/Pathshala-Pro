import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";

describe("Class Fee Structures DB Operations", () => {
  it("can query or upsert class fee structures without schema or relation errors", async () => {
    try {
      const structures = await prisma.classFeeStructure.findMany({
        take: 5,
        include: {
          class: true,
          academicYear: true,
        },
      });
      expect(Array.isArray(structures)).toBe(true);
    } catch (err: any) {
      console.error("DB Query Error:", err);
      throw err;
    }
  });
});
