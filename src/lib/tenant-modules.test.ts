import { describe, it, expect } from "vitest";
import {
  TENANT_MODULE_KEYS,
  TENANT_MODULE_DEFINITIONS,
  DEFAULT_TENANT_MODULE_ACCESS,
  resolveTenantModules,
  getModuleKeyForHref,
  getModuleKeyForApiPath,
} from "./tenant-modules";

describe("Tenant Module Access Management Engine", () => {
  it("defines all 17 unified modules", () => {
    expect(TENANT_MODULE_KEYS.length).toBe(18);
    expect(TENANT_MODULE_DEFINITIONS.length).toBe(18);
    for (const key of TENANT_MODULE_KEYS) {
      expect(DEFAULT_TENANT_MODULE_ACCESS[key]).toBe(true);
    }
  });

  it("resolves default module access when rawFlags is null or empty", () => {
    const resolved = resolveTenantModules(null, null);
    expect(resolved).toEqual(DEFAULT_TENANT_MODULE_ACCESS);
    expect(resolved.academics).toBe(true);
    expect(resolved.hostel).toBe(true);
  });

  it("merges custom flags with defaults", () => {
    const custom = {
      hostel: false,
      transport: false,
      library: false,
    };
    const resolved = resolveTenantModules(custom, null);
    expect(resolved.hostel).toBe(false);
    expect(resolved.transport).toBe(false);
    expect(resolved.library).toBe(false);
    expect(resolved.academics).toBe(true);
    expect(resolved.fees).toBe(true);
  });

  it("respects legacy TenantFeatureOverride relations if provided", () => {
    const legacyOverride = {
      hasHostel: false,
      hasTransport: true,
      hasPayroll: false,
    };
    const resolved = resolveTenantModules({ hostel: true, payroll: true }, legacyOverride);
    expect(resolved.hostel).toBe(false);
    expect(resolved.payroll).toBe(false);
    expect(resolved.transport).toBe(true);
  });

  it("maps navigation href to correct module key", () => {
    expect(getModuleKeyForHref("/academic")).toBe("academics");
    expect(getModuleKeyForHref("/classes")).toBe("academics");
    expect(getModuleKeyForHref("/admissions")).toBe("admissions");
    expect(getModuleKeyForHref("/fees")).toBe("fees");
    expect(getModuleKeyForHref("/accounts/ledger")).toBe("accounting");
    expect(getModuleKeyForHref("/payroll/salaries")).toBe("payroll");
    expect(getModuleKeyForHref("/hostel/rooms")).toBe("hostel");
    expect(getModuleKeyForHref("/transport/routes")).toBe("transport");
    expect(getModuleKeyForHref("/dashboard")).toBeNull();
    expect(getModuleKeyForHref("/settings")).toBeNull();
  });

  it("maps API routes to correct module key", () => {
    expect(getModuleKeyForApiPath("/api/students/bulk")).toBe("academics");
    expect(getModuleKeyForApiPath("/api/fees/collect")).toBe("fees");
    expect(getModuleKeyForApiPath("/api/accounting/vouchers")).toBe("accounting");
    expect(getModuleKeyForApiPath("/api/payroll/run")).toBe("payroll");
    expect(getModuleKeyForApiPath("/api/hostel/allocations")).toBe("hostel");
    expect(getModuleKeyForApiPath("/api/transport/routes")).toBe("transport");
    expect(getModuleKeyForApiPath("/api/auth/session")).toBeNull();
    expect(getModuleKeyForApiPath("/api/tenants/settings")).toBeNull();
  });
});
