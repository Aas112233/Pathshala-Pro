import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import {
  resolveRequestAcademicYearId,
  ensureStudentAcademicSession,
  assertAcademicYearOpen,
  assertAcademicYearsOpen,
} from "@/lib/academic-year-guards";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-error";

describe("Academic Year Resolution and Guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("resolveRequestAcademicYearId", () => {
    it("prioritizes explicit academicYearId search param over headers and cookies", async () => {
      const req = new NextRequest("http://localhost:3000/api/students?academicYearId=ay-from-param", {
        headers: {
          "x-academic-year-id": "ay-from-header",
          cookie: "pathshala_academic_year=ay-from-cookie",
        },
      });

      const resolved = await resolveRequestAcademicYearId(req, "tenant-1");
      expect(resolved).toBe("ay-from-param");
    });

    it("uses x-academic-year-id header when search param is absent", async () => {
      const req = new NextRequest("http://localhost:3000/api/students", {
        headers: {
          "x-academic-year-id": "ay-from-header",
          cookie: "pathshala_academic_year=ay-from-cookie",
        },
      });

      const resolved = await resolveRequestAcademicYearId(req, "tenant-1");
      expect(resolved).toBe("ay-from-header");
    });

    it("uses pathshala_academic_year cookie when search param and header are absent", async () => {
      const req = new NextRequest("http://localhost:3000/api/students", {
        headers: {
          cookie: "pathshala_academic_year=ay-from-cookie",
        },
      });

      const resolved = await resolveRequestAcademicYearId(req, "tenant-1");
      expect(resolved).toBe("ay-from-cookie");
    });

    it("falls back to the active non-closed DB academic year covering today", async () => {
      const req = new NextRequest("http://localhost:3000/api/students");

      vi.spyOn(prisma.academicYear, "findFirst").mockResolvedValueOnce({
        id: "ay-current-active",
      } as any);

      const resolved = await resolveRequestAcademicYearId(req, "tenant-1");
      expect(resolved).toBe("ay-current-active");
    });

    it("falls back to the latest open academic year if no active date range matches", async () => {
      const req = new NextRequest("http://localhost:3000/api/students");

      vi.spyOn(prisma.academicYear, "findFirst")
        .mockResolvedValueOnce(null) // date range search
        .mockResolvedValueOnce({ id: "ay-latest-open" } as any);

      const resolved = await resolveRequestAcademicYearId(req, "tenant-1");
      expect(resolved).toBe("ay-latest-open");
    });
  });

  describe("ensureStudentAcademicSession", () => {
    it("creates a new session with ENROLLED status if no session exists", async () => {
      const mockTx = {
        studentAcademicSession: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({
            id: "sess-1",
            tenantId: "tenant-1",
            studentProfileId: "student-1",
            academicYearId: "ay-2026",
            classId: "class-1",
            sectionId: "sec-1",
            groupId: null,
            rollNumber: "001",
            classNumber: 1,
            promotionStatus: "ENROLLED",
          }),
        },
      } as any;

      const result = await ensureStudentAcademicSession(mockTx, {
        tenantId: "tenant-1",
        studentProfileId: "student-1",
        academicYearId: "ay-2026",
        classId: "class-1",
        sectionId: "sec-1",
        rollNumber: "001",
        classNumber: 1,
      });

      expect(mockTx.studentAcademicSession.findUnique).toHaveBeenCalledTimes(1);
      expect(mockTx.studentAcademicSession.create).toHaveBeenCalledTimes(1);
      expect(mockTx.studentAcademicSession.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: "tenant-1",
          studentProfileId: "student-1",
          academicYearId: "ay-2026",
          classId: "class-1",
          sectionId: "sec-1",
          rollNumber: "001",
          classNumber: 1,
          promotionStatus: "ENROLLED",
        }),
      });
      expect(result?.id).toBe("sess-1");
    });

    it("updates existing session fields if a session already exists for that year", async () => {
      const mockTx = {
        studentAcademicSession: {
          findUnique: vi.fn().mockResolvedValue({
            id: "existing-sess-1",
            tenantId: "tenant-1",
            studentProfileId: "student-1",
            academicYearId: "ay-2026",
            classId: "class-1",
            rollNumber: "001",
          }),
          update: vi.fn().mockResolvedValue({
            id: "existing-sess-1",
            classId: "class-2",
            rollNumber: "002",
          }),
        },
      } as any;

      const result = await ensureStudentAcademicSession(mockTx, {
        tenantId: "tenant-1",
        studentProfileId: "student-1",
        academicYearId: "ay-2026",
        classId: "class-2",
        sectionId: "sec-2",
        rollNumber: "002",
      });

      expect(mockTx.studentAcademicSession.findUnique).toHaveBeenCalledTimes(1);
      expect(mockTx.studentAcademicSession.update).toHaveBeenCalledTimes(1);
      expect(mockTx.studentAcademicSession.update).toHaveBeenCalledWith({
        where: { id: "existing-sess-1" },
        data: expect.objectContaining({
          classId: "class-2",
          sectionId: "sec-2",
          rollNumber: "002",
        }),
      });
      expect(result?.classId).toBe("class-2");
    });

    it("returns null if academicYearId or classId is missing", async () => {
      const mockTx = {
        studentAcademicSession: {
          findUnique: vi.fn(),
          create: vi.fn(),
        },
      } as any;

      const resultWithoutYear = await ensureStudentAcademicSession(mockTx, {
        tenantId: "tenant-1",
        studentProfileId: "student-1",
        academicYearId: "",
        classId: "class-1",
        rollNumber: "001",
      });
      expect(resultWithoutYear).toBeNull();
      expect(mockTx.studentAcademicSession.findUnique).not.toHaveBeenCalled();

      const resultWithoutClass = await ensureStudentAcademicSession(mockTx, {
        tenantId: "tenant-1",
        studentProfileId: "student-1",
        academicYearId: "ay-2026",
        classId: "",
        rollNumber: "001",
      });
      expect(resultWithoutClass).toBeNull();
    });
  });

  describe("assertAcademicYearOpen", () => {
    it("returns the academic year when found and open", async () => {
      vi.spyOn(prisma.academicYear, "findFirst").mockResolvedValue({
        id: "ay-open",
        tenantId: "t-1",
        yearId: "AY-2026",
        label: "2026-2027",
        isClosed: false,
      } as any);

      const year = await assertAcademicYearOpen("t-1", "ay-open");
      expect(year.id).toBe("ay-open");
      expect(year.isClosed).toBe(false);
    });

    it("throws 404 when academic year does not exist", async () => {
      vi.spyOn(prisma.academicYear, "findFirst").mockResolvedValue(null);

      await expect(assertAcademicYearOpen("t-1", "non-existent")).rejects.toThrow(ApiError);
    });

    it("throws 409 conflict when academic year is closed", async () => {
      vi.spyOn(prisma.academicYear, "findFirst").mockResolvedValue({
        id: "ay-closed",
        tenantId: "t-1",
        yearId: "AY-2025",
        label: "2025-2026",
        isClosed: true,
      } as any);

      await expect(assertAcademicYearOpen("t-1", "ay-closed")).rejects.toThrow(ApiError);
      try {
        await assertAcademicYearOpen("t-1", "ay-closed");
      } catch (err: any) {
        expect(err.statusCode).toBe(409);
        expect(err.details[0].code).toBe("ACADEMIC_YEAR_CLOSED");
      }
    });
  });

  describe("assertAcademicYearsOpen", () => {
    it("returns all years when all are open", async () => {
      vi.spyOn(prisma.academicYear, "findMany").mockResolvedValue([
        { id: "ay-1", label: "Year 1", isClosed: false },
        { id: "ay-2", label: "Year 2", isClosed: false },
      ] as any);

      const years = await assertAcademicYearsOpen("t-1", ["ay-1", "ay-2"]);
      expect(years).toHaveLength(2);
    });

    it("throws 409 if any year in the list is closed", async () => {
      vi.spyOn(prisma.academicYear, "findMany").mockResolvedValue([
        { id: "ay-1", label: "Year 1", isClosed: false },
        { id: "ay-2", label: "Year 2", isClosed: true },
      ] as any);

      await expect(assertAcademicYearsOpen("t-1", ["ay-1", "ay-2"])).rejects.toThrow(ApiError);
    });
  });
});
