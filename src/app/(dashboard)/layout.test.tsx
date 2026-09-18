import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), state: vi.fn(), redirect: vi.fn((url: string) => { throw new Error(`redirect:${url}`); }) }));
vi.mock("next/headers", () => ({ cookies: async () => ({ toString: () => "auth_token=test" }) }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/auth", () => ({ getAuthContext: mocks.auth }));
vi.mock("@/lib/subscription-service", () => ({ getSubscriptionEnforcementState: mocks.state }));
vi.mock("@/components/layout/app-shell", () => ({ AppShell: () => null }));
import Layout from "./layout";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ tenantId: "school-1", user: { role: "ADMIN", email: "admin@school.test" } });
});
describe("server dashboard subscription gate", () => {
  it("redirects suspended sessions before returning the ERP shell", async () => {
    mocks.state.mockResolvedValue({ blocked: true });
    await expect(Layout({ children: null })).rejects.toThrow("redirect:/subscription/inactive");
  });
  it("exempts platform system admins from the subscription gate", async () => {
    mocks.state.mockResolvedValue({ blocked: true });
    mocks.auth.mockResolvedValue({ tenantId: "school-1", user: { role: "SYSTEM_ADMIN", email: "owner@pathshala.pro" } });
    await expect(Layout({ children: null })).resolves.toBeDefined();
    expect(mocks.state).not.toHaveBeenCalled();
  });
  it("allows renewed sessions", async () => {
    mocks.state.mockResolvedValue({ blocked: false });
    await expect(Layout({ children: null })).resolves.toBeDefined();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
  it("does not render ERP content if the subscription cannot be checked", async () => {
    mocks.state.mockRejectedValue(new Error("Database unavailable"));
    await expect(Layout({ children: null })).rejects.toThrow("Database unavailable");
  });
  it("redirects invalid sessions to login", async () => {
    mocks.auth.mockResolvedValue(null);
    await expect(Layout({ children: null })).rejects.toThrow("redirect:/login");
  });
});
