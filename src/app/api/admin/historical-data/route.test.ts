import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, PATCH, POST } from "@/app/api/admin/historical-data/route";
import { prisma } from "@/lib/prisma";
import * as apiAuth from "@/lib/api-auth";

describe("Historical Data API - /api/admin/historical-data", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Role Access Control", () => {
    it("rejects unauthorized non-admin roles (TEACHER) with 403 Forbidden", async () => {
      vi.spyOn(apiAuth, "requireApiAccess").mockResolvedValue({
        authContext: {
          user: {
            id: "user-teacher",
            email: "teacher@test.com",
            role: "TEACHER",
            permissions: {},
          } as any,
          tenantId: "test-tenant",
        },
      });

      const req = new NextRequest("http://localhost:3000/api/admin/historical-data?domain=promotions", {
        method: "GET",
      });

      const res = await GET(req);
      expect(res).toBeDefined();
      expect(res!.status).toBe(403);
      const json = await res!.json();
      expect(json.error).toBe(true);
      expect(json.message).toContain("Only School Administrators have access");
    });

    it("permits SCHOOL_ADMIN and returns paginated historical records", async () => {
      vi.spyOn(apiAuth, "requireApiAccess").mockResolvedValue({
        authContext: {
          user: {
            id: "user-admin",
            email: "admin@test.com",
            role: "SCHOOL_ADMIN",
            permissions: {},
          } as any,
          tenantId: "test-tenant",
        },
      });

      vi.spyOn(prisma.classPromotion, "count").mockResolvedValue(1);
      vi.spyOn(prisma.classPromotion, "findMany").mockResolvedValue([
        {
          id: "prom-1",
          tenantId: "test-tenant",
          studentProfileId: "std-1",
          status: "PROMOTED",
          reason: "Completed Grade 8",
          studentProfile: {
            id: "std-1",
            firstName: "Zayn",
            lastName: "Malik",
            studentId: "STD-01",
            rollNumber: "12",
          },
          fromAcademicYear: { id: "ay-1", label: "2022-2023", isClosed: true },
          toAcademicYear: { id: "ay-2", label: "2023-2024", isClosed: false },
        } as any,
      ]);

      const req = new NextRequest("http://localhost:3000/api/admin/historical-data?domain=promotions", {
        method: "GET",
      });

      const res = await GET(req);
      expect(res).toBeDefined();
      expect(res!.status).toBe(200);
      const json = await res!.json();
      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(1);
      expect(json.data[0].studentProfile.firstName).toBe("Zayn");
    });
  });

  describe("PATCH Mutation & Immutable Audit Logging", () => {
    it("requires a mandatory justification reason of at least 5 characters", async () => {
      vi.spyOn(apiAuth, "requireApiAccess").mockResolvedValue({
        authContext: {
          user: {
            id: "user-admin",
            email: "admin@test.com",
            role: "SCHOOL_ADMIN",
            permissions: {},
          } as any,
          tenantId: "test-tenant",
        },
      });

      const req = new NextRequest("http://localhost:3000/api/admin/historical-data", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: "promotions",
          recordId: "prom-1",
          reason: "no", // Too short
          changes: { status: "RETAINED" },
        }),
      });

      const res = await PATCH(req);
      expect(res).toBeDefined();
      expect(res!.status).toBe(422);
      const json = await res!.json();
      expect(json.error).toBe(true);
    });

    it("applies historical correction and writes an AuditLog entry", async () => {
      vi.spyOn(apiAuth, "requireApiAccess").mockResolvedValue({
        authContext: {
          user: {
            id: "user-admin",
            email: "admin@test.com",
            role: "SCHOOL_ADMIN",
            permissions: {},
          } as any,
          tenantId: "test-tenant",
        },
      });

      const mockAuditCreate = vi.fn().mockResolvedValue({ id: "audit-1" });
      const mockPromotionUpdate = vi.fn().mockResolvedValue({
        id: "prom-1",
        status: "RETAINED",
        reason: "Administrative board correction #401",
      });

      vi.spyOn(prisma, "$transaction").mockImplementation(async (callback: any) => {
        return callback({
          classPromotion: {
            findFirst: vi.fn().mockResolvedValue({
              id: "prom-1",
              status: "PROMOTED",
              reason: "Original status",
            }),
            update: mockPromotionUpdate,
          },
          auditLog: {
            create: mockAuditCreate,
          },
        });
      });

      const req = new NextRequest("http://localhost:3000/api/admin/historical-data", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: "promotions",
          recordId: "prom-1",
          reason: "Administrative board correction #401",
          changes: { status: "RETAINED" },
        }),
      });

      const res = await PATCH(req);
      expect(res).toBeDefined();
      expect(res!.status).toBe(200);
      const json = await res!.json();
      expect(json.success).toBe(true);
      expect(mockAuditCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "HISTORICAL_OVERRIDE_PROMOTIONS",
            tenantId: "test-tenant",
          }),
        })
      );
    });
  });

  describe("POST Archival & Restoration", () => {
    it("archives a record and writes archive action to audit log", async () => {
      vi.spyOn(apiAuth, "requireApiAccess").mockResolvedValue({
        authContext: {
          user: {
            id: "user-admin",
            email: "admin@test.com",
            role: "SCHOOL_ADMIN",
            permissions: {},
          } as any,
          tenantId: "test-tenant",
        },
      });

      const mockAuditCreate = vi.fn().mockResolvedValue({ id: "audit-2" });
      const mockVoucherUpdate = vi.fn().mockResolvedValue({
        id: "vouch-1",
        status: "VOIDED",
      });

      vi.spyOn(prisma, "$transaction").mockImplementation(async (callback: any) => {
        return callback({
          feeVoucher: {
            findFirst: vi.fn().mockResolvedValue({
              id: "vouch-1",
              status: "PENDING",
            }),
            update: mockVoucherUpdate,
          },
          auditLog: {
            create: mockAuditCreate,
          },
        });
      });

      const req = new NextRequest("http://localhost:3000/api/admin/historical-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: "fee-vouchers",
          recordId: "vouch-1",
          action: "archive",
          reason: "Archiving obsolete ghost invoice from 2021",
        }),
      });

      const res = await POST(req);
      expect(res).toBeDefined();
      expect(res!.status).toBe(200);
      const json = await res!.json();
      expect(json.success).toBe(true);
      expect(json.message).toContain("Record archived successfully");
      expect(mockAuditCreate).toHaveBeenCalled();
    });
  });
});
