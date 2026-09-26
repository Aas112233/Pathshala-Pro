// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import {
  isTenantOwned,
  getSelfScopedStudentProfileIds,
  invalidateTenantModulesCache,
  requireApiAccess,
} from "@/lib/api-auth";
import { isProtectedTenantId, generateTenantImpersonationToken } from "@/lib/superadmin-service";
import { getAuthContext } from "@/lib/auth";
import { signJwtToken } from "@/lib/jwt";

const db = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
  },
  tenant: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
  },
  studentProfile: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  parentStudentLink: {
    findMany: vi.fn(),
  },
  superAdminActionLog: {
    create: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: db }));

describe("Multi-Tenant Isolation & Row-Level Security Safeguards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Cross-Tenant Data Snooping & isTenantOwned Safeguard", () => {
    it("returns true when entity belongs to the requesting tenant", async () => {
      const mockDelegate = {
        findFirst: vi.fn().mockResolvedValue({ id: "student-101" }),
      };

      const result = await isTenantOwned(mockDelegate, "student-101", "school-alpha");
      expect(result).toBe(true);
      expect(mockDelegate.findFirst).toHaveBeenCalledWith({
        where: { id: "student-101", tenantId: "school-alpha" },
        select: { id: true },
      });
    });

    it("returns false when entity belongs to another tenant (cross-tenant leak prevented)", async () => {
      const mockDelegate = {
        findFirst: vi.fn().mockResolvedValue(null),
      };

      const result = await isTenantOwned(mockDelegate, "student-999-beta", "school-alpha");
      expect(result).toBe(false);
      expect(mockDelegate.findFirst).toHaveBeenCalledWith({
        where: { id: "student-999-beta", tenantId: "school-alpha" },
        select: { id: true },
      });
    });

    it("passes cleanly when id is null or undefined (nothing to validate)", async () => {
      const mockDelegate = { findFirst: vi.fn() };
      expect(await isTenantOwned(mockDelegate, null, "school-alpha")).toBe(true);
      expect(await isTenantOwned(mockDelegate, undefined, "school-alpha")).toBe(true);
      expect(mockDelegate.findFirst).not.toHaveBeenCalled();
    });
  });

  describe("Student & Parent Self-Scoping Isolation", () => {
    it("strictly isolates a STUDENT to their own profile ID", async () => {
      const authContext = {
        tenantId: "school-alpha",
        user: {
          id: "user-student-1",
          role: "STUDENT",
          studentProfileId: "profile-student-1",
        } as any,
      };

      const scopedIds = await getSelfScopedStudentProfileIds(authContext);
      expect(scopedIds).toEqual(["profile-student-1"]);
    });

    it("fails closed (empty array) if a student user has no linked student profile ID", async () => {
      const authContext = {
        tenantId: "school-alpha",
        user: {
          id: "user-student-orphan",
          role: "STUDENT",
          studentProfileId: null,
        } as any,
      };

      const scopedIds = await getSelfScopedStudentProfileIds(authContext);
      expect(scopedIds).toEqual([]);
    });

    it("strictly isolates a PARENT to only their linked children within that tenant", async () => {
      db.parentStudentLink.findMany.mockResolvedValue([
        { studentProfileId: "child-1" },
        { studentProfileId: "child-2" },
      ]);

      const authContext = {
        tenantId: "school-alpha",
        user: {
          id: "user-parent-1",
          role: "PARENT",
        } as any,
      };

      const scopedIds = await getSelfScopedStudentProfileIds(authContext);
      expect(scopedIds).toEqual(["child-1", "child-2"]);
      expect(db.parentStudentLink.findMany).toHaveBeenCalledWith({
        where: { tenantId: "school-alpha", parentUserId: "user-parent-1" },
        select: { studentProfileId: true },
      });
    });

    it("returns null for staff roles permitting full tenant staff reads", async () => {
      const authContext = {
        tenantId: "school-alpha",
        user: {
          id: "user-teacher-1",
          role: "TEACHER",
        } as any,
      };

      const scopedIds = await getSelfScopedStudentProfileIds(authContext);
      expect(scopedIds).toBeNull();
    });
  });

  describe("JWT Tenant Spoofing Defense (getAuthContext)", () => {
    it("rejects token when user exists in Tenant A but token claims Tenant B", async () => {
      // User exists in Tenant A, but attacker creates or forges a token with tenantId: "tenant-b"
      const forgedToken = await signJwtToken({
        userId: "user-alice",
        tenantId: "tenant-b-victim",
        email: "alice@school-a.test",
        role: "ADMIN",
      });

      // The database query filters by BOTH id and tenantId
      db.user.findUnique.mockResolvedValue(null);

      const req = new NextRequest("http://localhost/api/students", {
        headers: {
          authorization: `Bearer ${forgedToken}`,
        },
      });

      const auth = await getAuthContext(req);
      expect(auth).toBeNull();
      expect(db.user.findUnique).toHaveBeenCalledWith({
        where: { id: "user-alice", tenantId: "tenant-b-victim" },
      });
    });
  });

  describe("Protected System Tenant Guard (isProtectedTenantId)", () => {
    it("recognizes protected system tenants and prevents deletion", () => {
      expect(isProtectedTenantId("SYSTEM")).toBe(true);
      expect(isProtectedTenantId("PLATFORM")).toBe(true);
      expect(isProtectedTenantId("SYSTEM-PLATFORM")).toBe(true);
      expect(isProtectedTenantId("system ")).toBe(true);

      expect(isProtectedTenantId("school-001")).toBe(false);
      expect(isProtectedTenantId("dps-delhi")).toBe(false);
    });
  });

  describe("System Admin Impersonation Transparency & Audit Trail", () => {
    it("records audit events in BOTH SuperAdminActionLog AND the target school's AuditLog", async () => {
      const mockTx: any = {
        user: {
          findUnique: vi.fn().mockResolvedValue({ id: "admin-1", role: "SUPER_ADMIN" }),
          findFirst: vi.fn().mockResolvedValue({
            id: "principal-1",
            email: "principal@greenwood.test",
            name: "Dr. Greenwood",
            role: "PRINCIPAL",
            isActive: true,
          }),
        },
        tenant: {
          findUnique: vi.fn().mockResolvedValue({
            tenantId: "greenwood-high",
            name: "Greenwood High",
          }),
        },
        superAdminActionLog: {
          create: vi.fn().mockResolvedValue({ id: "super-log-1" }),
        },
        auditLog: {
          create: vi.fn().mockResolvedValue({ id: "school-log-1" }),
        },
      };

      const result = await generateTenantImpersonationToken(mockTx, {
        targetTenantId: "greenwood-high",
        context: {
          adminUserId: "platform-staff-1",
          adminEmail: "support@pathshala.pro",
          ipAddress: "192.168.1.100",
        },
      });

      expect(result.token).toBeDefined();
      expect(result.targetTenantId).toBe("greenwood-high");
      expect(result.impersonatedUserEmail).toBe("principal@greenwood.test");

      // Verify platform-level audit log
      expect(mockTx.superAdminActionLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            targetTenantId: "greenwood-high",
            actionType: "IMPERSONATION_START",
          }),
        })
      );

      // Verify school leadership visible audit log
      expect(mockTx.auditLog.create).toHaveBeenCalledWith({
        data: {
          tenantId: "greenwood-high",
          userId: "platform-staff-1",
          userEmail: "support@pathshala.pro",
          action: "IMPERSONATION_SESSION_STARTED",
          entity: "Tenant",
          entityId: "greenwood-high",
          ipAddress: "192.168.1.100",
          details: {
            platformAdminEmail: "support@pathshala.pro",
            impersonatedEmail: "principal@greenwood.test",
            role: "PRINCIPAL",
            sessionDuration: "2h",
            note: "Platform staff initiated customer support impersonation session",
          },
        },
      });
    });
  });

  describe("Module Entitlement Cache Invalidation", () => {
    it("invalidates cached tenant module permissions immediately", () => {
      // Invalidate specific tenant or all
      expect(() => invalidateTenantModulesCache("greenwood-high")).not.toThrow();
      expect(() => invalidateTenantModulesCache()).not.toThrow();
    });
  });
});
