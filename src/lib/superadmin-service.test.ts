import { describe, it, expect, vi } from "vitest";
import {
  updateTenantStatus,
  updateTenantQuota,
  updateTenantFeatureOverrides,
  generateTenantImpersonationToken,
  getGlobalPlatformTelemetry,
} from "@/lib/superadmin-service";

vi.mock("@/lib/jwt", () => ({
  signJwtToken: vi.fn().mockResolvedValue("mocked-impersonation-jwt-token"),
}));

describe("SuperAdmin Platform Control Plane & Governance Engine", () => {
  const adminContext = {
    adminUserId: "sys-admin-1",
    adminEmail: "superadmin@pathshala.pro",
    ipAddress: "127.0.0.1",
    userAgent: "Mozilla/5.0 Test",
  };

  describe("updateTenantStatus", () => {
    it("transitions tenant status and writes audit log", async () => {
      const mockTx = {
        tenant: {
          findUnique: vi.fn().mockResolvedValue({ tenantId: "school-1", name: "Greenwood High" }),
          update: vi.fn().mockResolvedValue({ tenantId: "school-1" }),
        },
        tenantSubscription: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        superAdminActionLog: {
          create: vi.fn().mockResolvedValue({ id: "log-1" }),
        },
      } as any;

      await updateTenantStatus(mockTx, {
        tenantId: "school-1",
        status: "SUSPENDED",
        reason: "Non-payment of subscription fee",
        context: adminContext,
      });

      expect(mockTx.tenantSubscription.updateMany).toHaveBeenCalledWith({
        where: { tenantId: "school-1" },
        data: { status: "PAST_DUE" },
      });
      expect(mockTx.superAdminActionLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actionType: "TENANT_STATUS_CHANGE",
            adminEmail: adminContext.adminEmail,
          }),
        })
      );
    });
  });

  describe("updateTenantQuota", () => {
    it("updates subscription quotas and logs action", async () => {
      const mockTx = {
        tenantSubscription: {
          upsert: vi.fn().mockResolvedValue({
            tenantId: "school-1",
            customMaxStudents: 1500,
            customMaxStaff: 100,
          }),
        },
        superAdminActionLog: {
          create: vi.fn().mockResolvedValue({ id: "log-2" }),
        },
      } as any;

      const sub = await updateTenantQuota(mockTx, {
        tenantId: "school-1",
        customMaxStudents: 1500,
        customMaxStaff: 100,
        context: adminContext,
      });

      expect(sub.customMaxStudents).toBe(1500);
      expect(mockTx.superAdminActionLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actionType: "QUOTA_UPDATE",
          }),
        })
      );
    });
  });

  describe("updateTenantFeatureOverrides", () => {
    it("upserts tenant feature flags and logs changes", async () => {
      const mockTx = {
        tenantFeatureOverride: {
          upsert: vi.fn().mockResolvedValue({
            tenantId: "school-1",
            hasHostel: false,
            hasBiometric: true,
          }),
        },
        superAdminActionLog: {
          create: vi.fn().mockResolvedValue({ id: "log-3" }),
        },
      } as any;

      const flags = await updateTenantFeatureOverrides(mockTx, {
        tenantId: "school-1",
        hasHostel: false,
        hasBiometric: true,
        context: adminContext,
      });

      expect(flags.hasHostel).toBe(false);
      expect(flags.hasBiometric).toBe(true);
      expect(mockTx.superAdminActionLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actionType: "FEATURE_FLAG_CHANGE",
          }),
        })
      );
    });
  });

  describe("generateTenantImpersonationToken", () => {
    it("generates signed impersonation JWT token for target school tenant", async () => {
      const mockTx = {
        user: {
          findUnique: vi.fn().mockResolvedValue({ id: "sys-admin-1", role: "SUPER_ADMIN" }),
          findFirst: vi.fn().mockResolvedValue({
            id: "principal-user-1",
            email: "principal@greenwood.com",
            name: "Dr. Principal",
            role: "SCHOOL_ADMIN",
          }),
        },
        tenant: {
          findUnique: vi.fn().mockResolvedValue({ tenantId: "greenwood", name: "Greenwood High" }),
        },
        superAdminActionLog: {
          create: vi.fn().mockResolvedValue({ id: "log-4" }),
        },
      } as any;

      const result = await generateTenantImpersonationToken(mockTx, {
        targetTenantId: "greenwood",
        context: adminContext,
      });

      expect(result.token).toBe("mocked-impersonation-jwt-token");
      expect(result.targetTenantId).toBe("greenwood");
      expect(result.targetTenantName).toBe("Greenwood High");
      expect(result.impersonatedUserEmail).toBe("principal@greenwood.com");
      expect(mockTx.superAdminActionLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actionType: "IMPERSONATION_START",
          }),
        })
      );
    });
  });

  describe("getGlobalPlatformTelemetry", () => {
    it("aggregates platform-wide capacity and transactions", async () => {
      const mockTx = {
        tenant: { count: vi.fn().mockResolvedValue(15) },
        studentProfile: { count: vi.fn().mockResolvedValue(4500) },
        staffProfile: { count: vi.fn().mockResolvedValue(320) },
        transaction: {
          count: vi.fn().mockResolvedValue(12500),
          aggregate: vi.fn().mockResolvedValue({ _sum: { amountPaid: 15000000 } }),
        },
      } as any;

      const telemetry = await getGlobalPlatformTelemetry(mockTx);
      expect(telemetry.tenants.total).toBe(15);
      expect(telemetry.capacity.totalStudents).toBe(4500);
      expect(telemetry.capacity.totalStaff).toBe(320);
      expect(telemetry.financials.totalPlatformTransactions).toBe(12500);
      expect(telemetry.financials.totalRevenueProcessed).toBe(15000000);
    });
  });
});
