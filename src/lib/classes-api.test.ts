import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { PUT } from "@/app/api/classes/[id]/route";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/api-auth", () => ({
  requireApiAccess: vi.fn().mockResolvedValue({
    authContext: { userId: "user-1", tenantId: "mhs", role: "ADMIN" },
  }),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    class: { findUnique: vi.fn(), update: vi.fn() },
    studentProfile: { count: vi.fn() },
    group: { count: vi.fn() },
    section: { count: vi.fn() },
    classSubject: { count: vi.fn() },
    promotionRule: { count: vi.fn() },
    classPromotion: { count: vi.fn() },
  },
}));

const existingClass = {
  id: "class-1",
  tenantId: "mhs",
  classId: "CLASS 5",
  name: "Class Five",
  classNumber: 5,
  isActive: true,
  appAccessEnabled: false,
  studentAppEnabled: true,
  parentAppEnabled: true,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

async function updateClass(body: Record<string, unknown>) {
  const response = await PUT(
    new NextRequest("http://localhost:3000/api/classes/class-1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: existingClass.id }) }
  );
  if (!response) throw new Error("Expected an API response");
  return response;
}

describe("PUT /api/classes/[id] integrity locks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.class.findUnique).mockResolvedValue(existingClass);
    vi.mocked(prisma.class.update).mockResolvedValue(existingClass);
    for (const model of [
      prisma.studentProfile, prisma.group, prisma.section,
      prisma.classSubject, prisma.promotionRule, prisma.classPromotion,
    ]) {
      vi.mocked(model.count).mockResolvedValue(0);
    }
  });

  it.each([
    { name: existingClass.name, classNumber: existingClass.classNumber, isActive: false },
    { isActive: false },
  ])("accepts unchanged or omitted fields with all linked records: %j", async (data) => {
    for (const model of [
      prisma.studentProfile, prisma.group, prisma.section,
      prisma.classSubject, prisma.promotionRule, prisma.classPromotion,
    ]) {
      vi.mocked(model.count).mockResolvedValue(1);
    }

    const response = await updateClass(data);
    expect(response.status).toBe(200);
    expect((await response.json()).success).toBe(true);
    expect(prisma.class.findUnique).toHaveBeenCalledWith({
      where: { id: existingClass.id, tenantId: existingClass.tenantId },
    });
    expect(prisma.class.update).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      where: { id: existingClass.id, tenantId: existingClass.tenantId },
      data,
    }));
  });

  it.each(["studentProfile", "classSubject", "promotionRule", "fromClassId", "toClassId"] as const)(
    "rejects an actual number change with linked %s records",
    async (relationship) => {
      if (relationship === "fromClassId" || relationship === "toClassId") {
        vi.mocked(prisma.classPromotion.count)
          .mockResolvedValueOnce(relationship === "fromClassId" ? 1 : 0)
          .mockResolvedValueOnce(relationship === "toClassId" ? 1 : 0);
      } else {
        vi.mocked(prisma[relationship].count).mockResolvedValue(1);
      }

      const response = await updateClass({ name: existingClass.name, classNumber: 6 });
      expect(response.status).toBe(400);
      expect((await response.json()).details).toEqual([
        expect.objectContaining({ field: "classNumber", code: "locked" }),
      ]);
      expect(prisma.class.update).not.toHaveBeenCalled();
    }
  );

  it.each(["fromClassId", "toClassId"] as const)(
    "rejects an actual name change with linked %s promotions",
    async (relationship) => {
      vi.mocked(prisma.classPromotion.count)
        .mockResolvedValueOnce(relationship === "fromClassId" ? 1 : 0)
        .mockResolvedValueOnce(relationship === "toClassId" ? 1 : 0);

      const response = await updateClass({ name: "Grade Five", classNumber: 5 });
      expect(response.status).toBe(400);
      expect((await response.json()).details).toEqual([
        expect.objectContaining({ field: "name", code: "locked" }),
      ]);
      expect(prisma.class.update).not.toHaveBeenCalled();
    }
  );

  it("allows actual changes without locking dependencies", async () => {
    vi.mocked(prisma.group.count).mockResolvedValue(1);
    vi.mocked(prisma.section.count).mockResolvedValue(1);

    const response = await updateClass({ name: "Grade Six", classNumber: 6 });
    expect(response.status).toBe(200);
    expect(prisma.class.update).toHaveBeenCalledOnce();
  });
});
