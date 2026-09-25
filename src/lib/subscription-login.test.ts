import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ users: vi.fn(), update: vi.fn(), password: vi.fn(), state: vi.fn(), token: vi.fn(), evict: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findMany: mocks.users, update: mocks.update } } }));
vi.mock("@/lib/auth", () => ({ verifyPassword: mocks.password, generateAuthToken: mocks.token, evictUserAuthCache: mocks.evict }));
vi.mock("@/lib/subscription-service", () => ({ getSubscriptionEnforcementState: mocks.state }));
vi.mock("@/lib/rate-limit", () => ({
  smartRateLimitAsync: vi.fn().mockResolvedValue({ success: true }),
  dedupeRequestAsync: vi.fn().mockResolvedValue(true),
  recordRateLimitFailureAsync: vi.fn(), recordRateLimitSuccessAsync: vi.fn(),
}));
import { POST } from "@/app/api/auth/login/route";
const user = { id: "u1", tenantId: "school-1", email: "admin@school.test", role: "ADMIN", isActive: true, hash: "hash", name: "Admin", tenant: { name: "School", subscriptionStatus: "SUSPENDED" } };
const request = () => new NextRequest("https://erp.test/api/auth/login", { method: "POST", body: JSON.stringify({ email: user.email, password: "password123" }) });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.users.mockResolvedValue([user]);
  mocks.update.mockResolvedValue({ updatedAt: new Date(0), sessionVersion: 0 });
  mocks.password.mockResolvedValue(true);
  mocks.token.mockResolvedValue("signed-test-token");
  mocks.state.mockResolvedValue({ blocked: true });
});

describe("subscription-restricted login", () => {
  it("authenticates valid credentials and returns the restricted destination", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect((await response.json()).data.redirectTo).toBe("/subscription/inactive");
    expect(response.cookies.get("auth_token")?.value).toBe("signed-test-token");
    expect(mocks.state).toHaveBeenCalledWith("school-1");
  });
  it("returns the dashboard destination after renewal", async () => {
    mocks.state.mockResolvedValue({ blocked: false });
    expect((await (await POST(request())).json()).data.redirectTo).toBe("/");
  });
  it("still rejects invalid credentials", async () => {
    mocks.password.mockResolvedValue(false);
    expect((await POST(request())).status).toBe(401);
    expect(mocks.token).not.toHaveBeenCalled();
  });
  it("does not reactivate disabled user accounts", async () => {
    mocks.users.mockResolvedValue([{ ...user, isActive: false }]);
    expect((await POST(request())).status).toBe(401);
    expect(mocks.token).not.toHaveBeenCalled();
  });
  it("keeps the session version on login when the tenant allows concurrent sessions", async () => {
    mocks.users.mockResolvedValue([{ ...user, tenant: { ...user.tenant, allowConcurrentSessions: true } }]);
    const response = await POST(request());
    expect(response.status).toBe(200);
    // No version rotation: other devices stay signed in.
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.not.objectContaining({ sessionVersion: expect.anything() }) })
    );
    expect(mocks.token).toHaveBeenCalledWith("u1", "school-1", "ADMIN", user.email, 0, true);
    expect(mocks.evict).toHaveBeenCalledWith("school-1", "u1");
  });
  it("rotates the session version on login when the tenant is single-session", async () => {
    mocks.users.mockResolvedValue([{ ...user, tenant: { ...user.tenant, allowConcurrentSessions: false } }]);
    mocks.update.mockResolvedValue({ updatedAt: new Date(0), sessionVersion: 1 });
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ sessionVersion: { increment: 1 } }) })
    );
    expect(mocks.token).toHaveBeenCalledWith("u1", "school-1", "ADMIN", user.email, 1, true);
  });
});
