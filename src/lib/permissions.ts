export type PermissionAction = "read" | "write" | "manage";

export interface UserPermissions {
  [module: string]: {
    read?: boolean;
    write?: boolean;
    manage?: boolean;
  };
}

export const ALL_PERMISSION_MODULES = [
  "students",
  "staff",
  "attendance",
  "exams",
  "exam-results",
  "fees",
  "transactions",
  "salary",
  "accounting",
  "users",
  "settings",
  "academic",
  "academic-years",
  "subjects",
  "admissions",
  "reports",
  "notices",
  "timetable",
  "enquiries",
  "library",
  "transport",
  "homework",
  "leaves",
  "inventory",
  "hostel",
  "certificates",
  "health",
] as const;

const FULL_ACCESS_PERMISSIONS: UserPermissions = Object.fromEntries(
  ALL_PERMISSION_MODULES.map((module) => [module, { read: true, write: true, manage: true }])
);

// Role-based default permissions applied when a user has no explicit
// per-user permissions stored (User.permissions is null/empty).
export const ROLE_DEFAULT_PERMISSIONS: Record<string, UserPermissions> = {
  ADMIN: FULL_ACCESS_PERMISSIONS,
  SUPER_ADMIN: FULL_ACCESS_PERMISSIONS,
  SYSTEM_ADMIN: FULL_ACCESS_PERMISSIONS,
};

export function getEffectivePermissions(
  role: string | null | undefined,
  permissions: unknown
): UserPermissions | null {
  if (role === "SUPER_ADMIN" || role === "SYSTEM_ADMIN") return FULL_ACCESS_PERMISSIONS;

  if (
    permissions &&
    typeof permissions === "object" &&
    !Array.isArray(permissions) &&
    Object.keys(permissions as Record<string, unknown>).length > 0
  ) {
    return permissions as UserPermissions;
  }

  return ROLE_DEFAULT_PERMISSIONS[role ?? ""] ?? null;
}

export function hasPermission(
  permissions: any,
  module: string,
  action: PermissionAction = "read"
): boolean {
  if (!permissions) return false;
  
  // If the permissions object has this module defined
  const modulePerms = permissions[module];
  if (!modulePerms) return false;

  // Manage permission implicitly grants read and write
  if (modulePerms.manage) return true;
  
  // Write permission implicitly grants read
  if (action === "read" && modulePerms.write) return true;

  // Otherwise check the specific action
  return !!modulePerms[action];
}

// Map frontend routes to permission modules
export function getModuleForPath(path: string): string | null {
  if (path === "/") return null; // Dashboard is public for logged in users
  
  const segments = path.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  const baseRoute = segments[0];

  switch (baseRoute) {
    case "users":
      return "users";
    case "students":
      return "students";
    case "staff":
      return "staff";
    case "attendance":
      return "attendance";
    case "promotions":
    case "exams":
      return "exams";
    case "fees":
    case "transactions":
      return "fees";
    case "settings":
      return "settings";
    case "academic":
    case "academic-year":
      return "academic";
    case "salary":
      return "salary";
    case "accounting":
      return "accounting";
    case "admissions":
      return "admissions";
    case "timetable":
      return "timetable";
    case "enquiries":
      return "enquiries";
    case "library":
      return "library";
    case "transport":
      return "transport";
    case "homework":
      return "homework";
    case "leaves":
      return "leaves";
    case "inventory":
      return "inventory";
    case "hostel":
    case "hostels":
    case "hostel-rooms":
    case "hostel-allocations":
      return "hostel";
    case "certificates":
      return "certificates";
    case "health":
    case "health-records":
      return "health";
    default:
      // Return the generic base route as its own permission module to default-deny unknown paths securely
      return baseRoute;
  }
}
