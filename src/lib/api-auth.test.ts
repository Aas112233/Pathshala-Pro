import {
  getPermissionActionForMethod,
  getPermissionModuleForApiPath,
} from "@/lib/api-auth";
import { hasPermission } from "@/lib/permissions";

describe("getPermissionActionForMethod", () => {
  it("maps read methods to read", () => {
    expect(getPermissionActionForMethod("GET")).toBe("read");
    expect(getPermissionActionForMethod("HEAD")).toBe("read");
  });

  it("maps write methods to write", () => {
    expect(getPermissionActionForMethod("POST")).toBe("write");
    expect(getPermissionActionForMethod("PUT")).toBe("write");
    expect(getPermissionActionForMethod("PATCH")).toBe("write");
  });

  it("maps delete to manage", () => {
    expect(getPermissionActionForMethod("DELETE")).toBe("manage");
  });
});

describe("getPermissionModuleForApiPath", () => {
  it("maps core resources to permission modules", () => {
    expect(getPermissionModuleForApiPath("/api/students")).toBe("students");
    expect(getPermissionModuleForApiPath("/api/fees/123")).toBe("fees");
    expect(getPermissionModuleForApiPath("/api/promotions/calculate")).toBe("exams");
    expect(getPermissionModuleForApiPath("/api/class-subjects")).toBe("academic");
    expect(getPermissionModuleForApiPath("/api/reports/attendance")).toBe("attendance");
  });

  it("returns null for auth-only routes", () => {
    expect(getPermissionModuleForApiPath("/api/upload")).toBeNull();
    expect(getPermissionModuleForApiPath("/api/unknown")).toBeNull();
  });
});

describe("hasPermission", () => {
  it("treats manage as a superset", () => {
    const permissions = { students: { manage: true } };

    expect(hasPermission(permissions, "students", "read")).toBe(true);
    expect(hasPermission(permissions, "students", "write")).toBe(true);
    expect(hasPermission(permissions, "students", "manage")).toBe(true);
  });

  it("treats write as including read", () => {
    const permissions = { students: { write: true } };

    expect(hasPermission(permissions, "students", "read")).toBe(true);
    expect(hasPermission(permissions, "students", "write")).toBe(true);
    expect(hasPermission(permissions, "students", "manage")).toBe(false);
  });
});

