import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isPlatformOwnerEmail } from "./platform-owner";

describe("isPlatformOwnerEmail", () => {
  const originalEnv = process.env.PLATFORM_OWNER_EMAILS;

  beforeEach(() => {
    process.env.PLATFORM_OWNER_EMAILS = "superadmin@pathshalapro.com, owner@saas.com , DEV@HOST.IO";
  });

  afterEach(() => {
    process.env.PLATFORM_OWNER_EMAILS = originalEnv;
  });

  it("returns true for exact matching emails in any casing or with whitespace", () => {
    expect(isPlatformOwnerEmail("superadmin@pathshalapro.com")).toBe(true);
    expect(isPlatformOwnerEmail("SUPERADMIN@PATHSHALAPRO.COM")).toBe(true);
    expect(isPlatformOwnerEmail("owner@saas.com")).toBe(true);
    expect(isPlatformOwnerEmail("dev@host.io")).toBe(true);
  });

  it("returns false for non-platform owner emails", () => {
    expect(isPlatformOwnerEmail("principal@school.edu")).toBe(false);
    expect(isPlatformOwnerEmail("admin@school.com")).toBe(false);
    expect(isPlatformOwnerEmail("teacher@school.org")).toBe(false);
  });

  it("returns false for empty or null inputs", () => {
    expect(isPlatformOwnerEmail("")).toBe(false);
    expect(isPlatformOwnerEmail(null)).toBe(false);
    expect(isPlatformOwnerEmail(undefined)).toBe(false);
  });
});
