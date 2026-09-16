import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST as createAcademicYearRoute } from "@/app/api/academic-years/route";
import { PUT as updateAcademicYearRoute } from "@/app/api/academic-years/[id]/route";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/api-auth", () => ({
  requireApiAccess: vi.fn().mockResolvedValue({
    authContext: {
      userId: "user-1",
      tenantId: "mhs",
      role: "ADMIN",
      permissions: ["academic-years:write", "academic-years:manage"],
    },
  }),
}));

vi.mock("@/lib/data-integrity", () => ({
  getAcademicYearUsageCounts: vi.fn().mockResolvedValue({}),
  integrityViolation: vi.fn(),
  lockedUpdateMessage: vi.fn(),
  lockedDeleteMessage: vi.fn(),
  buildLockedFieldsDetails: vi.fn(),
}));

describe("Academic Years API - Date Handling & Validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/academic-years", () => {
    it("parses string date inputs (YYYY-MM-DD) into native Date objects for prisma.academicYear.create", async () => {
      vi.spyOn(prisma.academicYear, "findFirst").mockResolvedValue(null);
      const mockCreate = vi.spyOn(prisma.academicYear, "create").mockResolvedValue({
        id: "ay-2027",
        yearId: "ACADEMIC YEAR 2027",
        label: "2027-2028",
        startDate: new Date("2027-01-01T00:00:00.000Z"),
        endDate: new Date("2027-12-31T00:00:00.000Z"),
        isClosed: false,
        createdAt: new Date(),
      } as any);

      const req = new NextRequest("http://localhost:3000/api/academic-years", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          yearId: "ACADEMIC YEAR 2027",
          label: "2027-2028",
          startDate: "2027-01-01",
          endDate: "2027-12-31",
        }),
      });

      const res = await createAcademicYearRoute(req);
      expect(res).toBeDefined();
      expect(res!.status).toBe(201);
      const json = await res!.json();
      expect(json.success).toBe(true);

      expect(mockCreate).toHaveBeenCalledTimes(1);
      const createArg = mockCreate.mock.calls[0][0];
      expect(createArg.data.startDate).toBeInstanceOf(Date);
      expect(createArg.data.endDate).toBeInstanceOf(Date);
      expect((createArg.data.startDate as Date).toISOString()).toContain("2027-01-01");
      expect((createArg.data.endDate as Date).toISOString()).toContain("2027-12-31");
    });

    it("rejects creation when startDate is after endDate", async () => {
      const req = new NextRequest("http://localhost:3000/api/academic-years", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          yearId: "ACADEMIC YEAR 2027",
          label: "2027-2028",
          startDate: "2027-12-31",
          endDate: "2027-01-01",
        }),
      });

      const res = await createAcademicYearRoute(req);
      expect(res).toBeDefined();
      expect(res!.status).toBe(400);
      const json = await res!.json();
      expect(json.error).toBe(true);
      expect(json.message).toBe("Invalid dates");
      expect(json.details[0].message).toContain("Start date must be before end date");
    });

    it("rejects creation when dates are invalid strings", async () => {
      const req = new NextRequest("http://localhost:3000/api/academic-years", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          yearId: "ACADEMIC YEAR 2027",
          label: "2027-2028",
          startDate: "not-a-valid-date",
          endDate: "2027-12-31",
        }),
      });

      const res = await createAcademicYearRoute(req);
      expect(res).toBeDefined();
      expect(res!.status).toBe(400);
      const json = await res!.json();
      expect(json.error).toBe(true);
      expect(json.message).toBe("Invalid start date");
      expect(json.details[0].message).toContain("Start date must be a valid date");
    });
  });

  describe("PUT /api/academic-years/[id]", () => {
    it("parses string date inputs into Date objects when updating", async () => {
      vi.spyOn(prisma.academicYear, "findUnique").mockResolvedValue({
        id: "ay-2027",
        tenantId: "mhs",
        yearId: "ACADEMIC YEAR 2027",
        label: "2027-2028",
        startDate: new Date("2027-01-01T00:00:00.000Z"),
        endDate: new Date("2027-12-31T00:00:00.000Z"),
        isClosed: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const mockUpdate = vi.spyOn(prisma.academicYear, "update").mockResolvedValue({
        id: "ay-2027",
        yearId: "ACADEMIC YEAR 2027",
        label: "2027-2028 Updated",
        startDate: new Date("2027-02-01T00:00:00.000Z"),
        endDate: new Date("2027-11-30T00:00:00.000Z"),
        isClosed: false,
        updatedAt: new Date(),
      } as any);

      const req = new NextRequest("http://localhost:3000/api/academic-years/ay-2027", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: "2027-2028 Updated",
          startDate: "2027-02-01",
          endDate: "2027-11-30",
        }),
      });

      const res = await updateAcademicYearRoute(req, {
        params: Promise.resolve({ id: "ay-2027" }),
      });
      expect(res).toBeDefined();
      expect(res!.status).toBe(200);

      expect(mockUpdate).toHaveBeenCalledTimes(1);
      const updateArg = mockUpdate.mock.calls[0][0];
      expect(updateArg.data.startDate).toBeInstanceOf(Date);
      expect(updateArg.data.endDate).toBeInstanceOf(Date);
    });
  });
});
