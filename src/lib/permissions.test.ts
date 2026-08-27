import { describe, it, expect } from "vitest";
import {
  hasPermission,
  getEffectivePermissions,
  getModuleForPath,
  ALL_PERMISSION_MODULES,
  ROLE_DEFAULT_PERMISSIONS,
} from "@/lib/permissions";

describe("Permissions Engine & RBAC Matrix", () => {
  it("exports all core ERP permission modules", () => {
    expect(ALL_PERMISSION_MODULES).toContain("students");
    expect(ALL_PERMISSION_MODULES).toContain("staff");
    expect(ALL_PERMISSION_MODULES).toContain("fees");
    expect(ALL_PERMISSION_MODULES).toContain("exams");
    expect(ALL_PERMISSION_MODULES).toContain("salary");
    expect(ALL_PERMISSION_MODULES).toContain("attendance");
    expect(ALL_PERMISSION_MODULES).toContain("accounting");
    expect(ALL_PERMISSION_MODULES).toContain("users");
  });

  describe("getEffectivePermissions", () => {
    it("grants full access to SUPER_ADMIN regardless of permissions object", () => {
      const perms = getEffectivePermissions("SUPER_ADMIN", null);
      expect(perms).toBeDefined();
      expect(perms?.students?.manage).toBe(true);
      expect(perms?.fees?.write).toBe(true);
    });

    it("grants full access to SYSTEM_ADMIN regardless of permissions object", () => {
      const perms = getEffectivePermissions("SYSTEM_ADMIN", {});
      expect(perms).toBeDefined();
      expect(perms?.accounting?.manage).toBe(true);
    });

    it("returns explicit user custom permissions when configured", () => {
      const custom = {
        students: { read: true, write: false },
        fees: { read: true, write: true, manage: false },
      };
      const perms = getEffectivePermissions("TEACHER", custom);
      expect(perms).toEqual(custom);
    });

    it("falls back to role default permissions when user permissions is empty or null", () => {
      const adminPerms = getEffectivePermissions("ADMIN", null);
      expect(adminPerms).toEqual(ROLE_DEFAULT_PERMISSIONS.ADMIN);

      const unknownRolePerms = getEffectivePermissions("UNKNOWN_ROLE", null);
      expect(unknownRolePerms).toBeNull();
    });
  });

  describe("hasPermission checks and cascading hierarchy", () => {
    it("returns false if permissions object is null or undefined", () => {
      expect(hasPermission(null, "students", "read")).toBe(false);
      expect(hasPermission(undefined, "students", "write")).toBe(false);
    });

    it("evaluates specific action flags directly", () => {
      const perms = {
        students: { read: true, write: false },
      };
      expect(hasPermission(perms, "students", "read")).toBe(true);
      expect(hasPermission(perms, "students", "write")).toBe(false);
      expect(hasPermission(perms, "students", "manage")).toBe(false);
    });

    it("cascades 'manage' permission to implicitly grant read and write", () => {
      const perms = {
        fees: { manage: true },
      };
      expect(hasPermission(perms, "fees", "read")).toBe(true);
      expect(hasPermission(perms, "fees", "write")).toBe(true);
      expect(hasPermission(perms, "fees", "manage")).toBe(true);
    });

    it("cascades 'write' permission to implicitly grant read", () => {
      const perms = {
        attendance: { write: true },
      };
      expect(hasPermission(perms, "attendance", "read")).toBe(true);
      expect(hasPermission(perms, "attendance", "write")).toBe(true);
      expect(hasPermission(perms, "attendance", "manage")).toBe(false);
    });

    it("returns false for undefined modules", () => {
      const perms = {
        students: { read: true },
      };
      expect(hasPermission(perms, "salary", "read")).toBe(false);
    });
  });

  describe("getModuleForPath route mapper", () => {
    it("identifies standard ERP dashboard routes", () => {
      expect(getModuleForPath("/")).toBeNull();
      expect(getModuleForPath("/students")).toBe("students");
      expect(getModuleForPath("/students/123/edit")).toBe("students");
      expect(getModuleForPath("/fees")).toBe("fees");
      expect(getModuleForPath("/transactions")).toBe("fees");
      expect(getModuleForPath("/attendance")).toBe("attendance");
      expect(getModuleForPath("/exams")).toBe("exams");
      expect(getModuleForPath("/promotions")).toBe("exams");
      expect(getModuleForPath("/salary")).toBe("salary");
      expect(getModuleForPath("/accounting")).toBe("accounting");
      expect(getModuleForPath("/settings")).toBe("settings");
      expect(getModuleForPath("/academic")).toBe("academic");
      expect(getModuleForPath("/academic-year")).toBe("academic");
    });

    it("securely default-denies unknown subpaths by returning base segment", () => {
      expect(getModuleForPath("/custom-module/detail")).toBe("custom-module");
    });
  });
});
