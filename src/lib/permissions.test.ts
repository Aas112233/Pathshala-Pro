import { describe, it, expect } from "vitest";
import {
  hasPermission,
  getEffectivePermissions,
  getModuleForPath,
  ALL_PERMISSION_MODULES,
  ROLE_DEFAULT_PERMISSIONS,
  ROLE_PERMISSIONS,
  ACCESS_LEVEL_PERMISSIONS,
  deriveModulePermissions,
  hasRolePermission,
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

  describe("Fine-Grained Role Permissions & Scopes", () => {
    it("grants ACCOUNTANT access to fees and accounting but not exams marks", () => {
      expect(hasPermission("ACCOUNTANT", "fees:read")).toBe(true);
      expect(hasPermission("ACCOUNTANT", "fees:invoice:create")).toBe(true);
      expect(hasPermission("ACCOUNTANT", "accounting:journal:post")).toBe(true);
      expect(hasPermission("ACCOUNTANT", "payroll:disburse")).toBe(true);
      expect(hasPermission("ACCOUNTANT", "exams:marks:write")).toBe(false);
    });

    it("grants TEACHER access to attendance and exams marks but not accounting", () => {
      expect(hasPermission("TEACHER", "attendance:mark")).toBe(true);
      expect(hasPermission("TEACHER", "exams:marks:write")).toBe(true);
      expect(hasPermission("TEACHER", "accounting:period:close")).toBe(false);
      expect(hasPermission("TEACHER", "payroll:process")).toBe(false);
    });

    it("grants PLATFORM_OWNER and SUPER_ADMIN universal access", () => {
      expect(hasPermission("PLATFORM_OWNER", ["accounting:period:close", "exams:grade:override"])).toBe(true);
      expect(hasPermission("SUPER_ADMIN", "academic:promote:execute")).toBe(true);
    });

    it("restricts STUDENT and PARENT to self portals", () => {
      expect(hasPermission("STUDENT", "portal:student:self")).toBe(true);
      expect(hasPermission("STUDENT", "fees:payment:collect")).toBe(false);
      expect(hasPermission("PARENT", "portal:parent:self")).toBe(true);
      expect(hasPermission("PARENT", "students:manage")).toBe(false);
    });
  });
});

describe("Matrix coherence: module tiers are derived from ROLE_PERMISSIONS", () => {
  it("projects every fine-grained permission of a role onto its module defaults", () => {
    // The regression this locks: the two matrices used to be hand-maintained
    // and disagreed, with the looser one (module tiers) actually enforced.
    for (const role of Object.keys(ROLE_PERMISSIONS) as Array<keyof typeof ROLE_PERMISSIONS>) {
      const derived = deriveModulePermissions(ROLE_PERMISSIONS[role]);
      const defaults = ROLE_DEFAULT_PERMISSIONS[role];
      for (const [module, actions] of Object.entries(derived)) {
        for (const action of ["read", "write", "manage"] as const) {
          if (actions?.[action]) {
            expect(hasPermission(defaults, module, action), `${role} ${module}.${action}`).toBe(true);
          }
        }
      }
    }
  });

  it("never grants a module tier the role matrix withholds for finance and system roles", () => {
    const forbidden: Array<[string, string, "write" | "manage"]> = [
      // PRINCIPAL keeps fees:{manage} — `fees:waiver:approve` genuinely mutates
      // fee records. What the principal must never do is take money, and that
      // is enforced by the `fees:payment:collect` gate on the collection
      // routes (asserted separately below), not by the module tier.
      ["PRINCIPAL", "transactions", "write"],
      ["PRINCIPAL", "accounting", "write"],
      ["PRINCIPAL", "salary", "write"],
      ["PRINCIPAL", "users", "write"],
      ["PRINCIPAL", "settings", "write"],
      ["MANAGER", "fees", "write"],
      ["MANAGER", "accounting", "write"],
      ["MANAGER", "salary", "write"],
      ["MANAGER", "users", "write"],
      ["MANAGER", "settings", "write"],
      ["ACADEMIC_COORDINATOR", "fees", "write"],
      ["ACADEMIC_COORDINATOR", "accounting", "write"],
      ["TEACHER", "fees", "write"],
      ["TEACHER", "salary", "write"],
      ["TEACHER", "users", "write"],
      ["ACCOUNTANT", "users", "write"],
      ["ACCOUNTANT", "settings", "write"],
      ["ACCOUNTANT", "exams", "write"],
      ["CLERK", "accounting", "write"],
      ["CLERK", "salary", "write"],
      ["CLERK", "users", "write"],
    ];
    for (const [role, module, action] of forbidden) {
      expect(hasPermission(ROLE_DEFAULT_PERMISSIONS[role], module, action), `${role} ${module}.${action}`).toBe(false);
    }
  });

  it("keeps PRINCIPAL and MANAGER read-only over finance while retaining oversight", () => {
    for (const role of ["PRINCIPAL", "MANAGER"]) {
      expect(hasPermission(ROLE_DEFAULT_PERMISSIONS[role], "fees", "read")).toBe(true);
      expect(hasPermission(ROLE_DEFAULT_PERMISSIONS[role], "accounting", "read")).toBe(true);
      expect(hasPermission(ROLE_DEFAULT_PERMISSIONS[role], "salary", "read")).toBe(true);
      expect(hasPermission(ROLE_DEFAULT_PERMISSIONS[role], "notices", "manage")).toBe(true);
    }
  });

  it("lets CLERK actually collect fees, matching fees:payment:collect", () => {
    expect(hasPermission("CLERK", "fees:payment:collect")).toBe(true);
    expect(hasPermission(ROLE_DEFAULT_PERMISSIONS.CLERK, "fees", "write")).toBe(true);
    expect(hasPermission(ROLE_DEFAULT_PERMISSIONS.CLERK, "transactions", "write")).toBe(true);
    expect(hasPermission(ROLE_DEFAULT_PERMISSIONS.CLERK, "students", "manage")).toBe(true);
  });

  it("keeps ACCOUNTANT in full control of the finance modules only", () => {
    const perms = ROLE_DEFAULT_PERMISSIONS.ACCOUNTANT;
    expect(hasPermission(perms, "fees", "write")).toBe(true);
    expect(hasPermission(perms, "accounting", "write")).toBe(true);
    expect(hasPermission(perms, "salary", "manage")).toBe(true);
    expect(hasPermission(perms, "students", "read")).toBe(true);
    expect(hasPermission(perms, "students", "write")).toBe(false);
  });

  it("admin-tier roles keep full tenant access", () => {
    for (const role of ["ADMIN", "SCHOOL_ADMIN", "INSTITUTE_ADMIN", "SUPER_ADMIN", "SYSTEM_ADMIN", "PLATFORM_OWNER"]) {
      for (const module of ALL_PERMISSION_MODULES) {
        expect(hasPermission(ROLE_DEFAULT_PERMISSIONS[role], module, "manage"), `${role} ${module}`).toBe(true);
      }
    }
  });

  it("STUDENT and PARENT never reach finance, staff, users or settings modules", () => {
    for (const role of ["STUDENT", "PARENT"]) {
      const perms = ROLE_DEFAULT_PERMISSIONS[role];
      expect(hasPermission(perms, "fees", "read")).toBe(true);
      expect(hasPermission(perms, "fees", "write")).toBe(false);
      expect(hasPermission(perms, "accounting", "read")).toBe(false);
      expect(hasPermission(perms, "salary", "read")).toBe(false);
      expect(hasPermission(perms, "staff", "read")).toBe(false);
      expect(hasPermission(perms, "users", "read")).toBe(false);
      expect(hasPermission(perms, "settings", "read")).toBe(false);
      expect(hasPermission(perms, "exams", "read")).toBe(false);
    }
  });

  it("access levels resolve through the role they represent, so level 2 is not full access", () => {
    expect(ACCESS_LEVEL_PERMISSIONS[1]).toEqual(ROLE_DEFAULT_PERMISSIONS.SCHOOL_ADMIN);
    expect(ACCESS_LEVEL_PERMISSIONS[2]).toEqual(ROLE_DEFAULT_PERMISSIONS.MANAGER);
    expect(hasPermission(ACCESS_LEVEL_PERMISSIONS[2], "settings", "manage")).toBe(false);
    expect(ACCESS_LEVEL_PERMISSIONS[3]).toEqual(ROLE_DEFAULT_PERMISSIONS.ACCOUNTANT);
    expect(ACCESS_LEVEL_PERMISSIONS[7]).toEqual(ROLE_DEFAULT_PERMISSIONS.STUDENT);
  });

  it("has a module-tier projection for every declared fine-grained permission", () => {
    const declared = new Set(Object.values(ROLE_PERMISSIONS).flat());
    for (const permission of declared) {
      expect(deriveModulePermissions([permission]), `${permission} maps to no module`).not.toEqual({});
    }
  });

  it("fails closed on an empty required-permission list", () => {
    expect(hasRolePermission("PRINCIPAL", [])).toBe(false);
    expect(hasRolePermission("STUDENT", [])).toBe(false);
  });

  it("implies lower tiers whenever a higher tier is granted", () => {
    for (const perms of Object.values(ROLE_DEFAULT_PERMISSIONS)) {
      for (const [module, actions] of Object.entries(perms)) {
        if (actions?.manage) expect(actions.write && actions.read, `${module}`).toBe(true);
        if (actions?.write) expect(actions.read, `${module}`).toBe(true);
      }
    }
  });
});

describe("Capability gates the module tier cannot express", () => {
  it("keeps the cash box away from academic and teaching roles", () => {
    for (const role of ["PRINCIPAL", "MANAGER", "ACADEMIC_COORDINATOR", "TEACHER", "STUDENT", "PARENT"]) {
      expect(hasRolePermission(role, "fees:payment:collect"), role).toBe(false);
    }
    for (const role of ["ACCOUNTANT", "CLERK", "ADMIN", "SCHOOL_ADMIN", "INSTITUTE_ADMIN"]) {
      expect(hasRolePermission(role, "fees:payment:collect"), role).toBe(true);
    }
  });

  it("restricts journal posting, period close and payroll to finance roles", () => {
    expect(hasRolePermission("PRINCIPAL", "accounting:journal:post")).toBe(false);
    expect(hasRolePermission("MANAGER", "accounting:journal:post")).toBe(false);
    expect(hasRolePermission("CLERK", "accounting:journal:post")).toBe(false);
    expect(hasRolePermission("ACCOUNTANT", "accounting:journal:post")).toBe(true);
    expect(hasRolePermission("ACCOUNTANT", "accounting:period:close")).toBe(false);
    expect(hasRolePermission("SCHOOL_ADMIN", "accounting:period:close")).toBe(true);
    expect(hasRolePermission("PRINCIPAL", "payroll:process")).toBe(false);
    expect(hasRolePermission("PRINCIPAL", "payroll:disburse")).toBe(false);
    expect(hasRolePermission("ACCOUNTANT", "payroll:disburse")).toBe(true);
  });

  it("restricts marks entry and promotion execution to academic roles", () => {
    expect(hasRolePermission("TEACHER", "exams:marks:write")).toBe(true);
    expect(hasRolePermission("ACCOUNTANT", "exams:marks:write")).toBe(false);
    expect(hasRolePermission("CLERK", "exams:marks:write")).toBe(false);
    expect(hasRolePermission("ACADEMIC_COORDINATOR", "academic:promote:execute")).toBe(false);
    expect(hasRolePermission("PRINCIPAL", "academic:promote:execute")).toBe(true);
    expect(hasRolePermission("TEACHER", "exams:grade:override")).toBe(false);
    expect(hasRolePermission("PRINCIPAL", "exams:grade:override")).toBe(true);
  });

  it("grants tenant administration to tenant admins and withholds it from staff", () => {
    for (const role of ["ADMIN", "SCHOOL_ADMIN", "INSTITUTE_ADMIN", "SUPER_ADMIN", "SYSTEM_ADMIN", "PLATFORM_OWNER"]) {
      expect(hasRolePermission(role, "system:manage"), role).toBe(true);
    }
    for (const role of ["PRINCIPAL", "MANAGER", "ACCOUNTANT", "ACADEMIC_COORDINATOR", "TEACHER", "CLERK"]) {
      expect(hasRolePermission(role, "system:manage"), role).toBe(false);
    }
  });
});
