export type PermissionAction = "read" | "write" | "manage";

export interface UserPermissions {
  [module: string]: {
    read?: boolean;
    write?: boolean;
    manage?: boolean;
  };
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
    case "admissions":
      return "admissions";
    default:
      // Return the generic base route as its own permission module to default-deny unknown paths securely
      return baseRoute;
  }
}
