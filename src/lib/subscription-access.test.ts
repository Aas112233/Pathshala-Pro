import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ tenant: vi.fn(), auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { tenant: { findUnique: mocks.tenant } } }));
vi.mock("@/lib/auth", () => ({ getAuthContext: mocks.auth }));
import { getSubscriptionEnforcementState } from "./subscription-service";
import { requireApiAccess } from "./api-auth";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ tenantId: "school-1", user: { role: "TEACHER", email: "teacher@school.test" } });
});

describe("restricted subscription access", () => {
  it.each(["PAST_DUE", "CANCELLED", "UNPAID", "INACTIVE", "EXPIRED"])(
    "blocks %s even with a future grace date", async (status) => {
      mocks.tenant.mockResolvedValue({ subscriptionStatus: "ACTIVE", subscription: {
        status, graceEndsAt: new Date(Date.now() + 86400000), currentPeriodEnd: new Date(Date.now() + 86400000),
      } });
      expect((await getSubscriptionEnforcementState("school-1")).blocked).toBe(true);
    }
  );
  it("respects explicit tenant suspension even when the relational row is active", async () => {
    mocks.tenant.mockResolvedValue({ subscriptionStatus: "SUSPENDED", subscription: { status: "ACTIVE" } });
    expect((await getSubscriptionEnforcementState("school-1")).blocked).toBe(true);
  });
  it("blocks a lapsed grace period without needing the expiry sweep", async () => {
    mocks.tenant.mockResolvedValue({ subscriptionStatus: "ACTIVE", subscription: {
      status: "GRACE", graceEndsAt: new Date(0), currentPeriodEnd: new Date(0),
    } });
    expect((await getSubscriptionEnforcementState("school-1")).blocked).toBe(true);
  });
  it("allows a current grace period", async () => {
    mocks.tenant.mockResolvedValue({ subscriptionStatus: "ACTIVE", subscription: {
      status: "GRACE", graceEndsAt: new Date(Date.now() + 86400000), currentPeriodEnd: new Date(0),
    } });
    expect((await getSubscriptionEnforcementState("school-1")).blocked).toBe(false);
  });
  it("allows authenticated teachers to read only their subscription status", async () => {
    mocks.tenant.mockResolvedValue({ subscriptionStatus: "SUSPENDED", subscription: null });
    const result = await requireApiAccess(new NextRequest("https://erp.test/api/tenants/subscription-status"));
    expect(result.authContext?.tenantId).toBe("school-1");
  });
  it.each(["/api/students", "/api/fees", "/api/settings", "/api/tenants/subscription-status/other"])(
    "blocks ERP access to %s", async (path) => {
      mocks.tenant.mockResolvedValue({ subscriptionStatus: "SUSPENDED", subscription: null });
      const result = await requireApiAccess(new NextRequest(`https://erp.test${path}`));
      expect(result.response?.status).toBe(403);
    }
  );
  it("does not exempt writes to the subscription status endpoint", async () => {
    mocks.tenant.mockResolvedValue({ subscriptionStatus: "SUSPENDED", subscription: null });
    const result = await requireApiAccess(new NextRequest("https://erp.test/api/tenants/subscription-status", { method: "POST" }));
    expect(result.response?.status).toBe(403);
  });
  it("requires authentication for subscription status", async () => {
    mocks.auth.mockResolvedValue(null);
    const result = await requireApiAccess(new NextRequest("https://erp.test/api/tenants/subscription-status"));
    expect(result.response?.status).toBe(401);
  });
  it("fails closed when subscription lookup fails", async () => {
    mocks.tenant.mockRejectedValue(new Error("Database unavailable"));
    const result = await requireApiAccess(new NextRequest("https://erp.test/api/students"));
    expect(result.response?.status).toBe(503);
  });
});
