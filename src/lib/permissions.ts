export type PermissionAction = "read" | "write" | "manage";

export interface UserPermissions {
  [module: string]: {
    read?: boolean;
    write?: boolean;
    manage?: boolean;
  };
}

export type Permission =
  // Academics & Exams
  | "academic:read"
  | "academic:manage"
  | "exams:read"
  | "exams:manage"
  | "exams:marks:write"
  | "exams:grade:override"
  | "academic:promote:execute"
  // Fees & Finance
  | "fees:read"
  | "fees:invoice:create"
  | "fees:payment:collect"
  | "fees:waiver:approve"
  | "accounting:read"
  | "accounting:journal:post"
  | "accounting:period:close"
  // HR & Payroll
  | "payroll:read"
  | "payroll:process"
  | "payroll:disburse"
  // Student & Staff Management
  | "students:read"
  | "students:manage"
  | "staff:read"
  | "staff:manage"
  | "attendance:read"
  | "attendance:mark"
  | "attendance:manage"
  // Self / Portal Access
  | "portal:student:self"
  | "portal:parent:self"
  // System Management
  | "system:manage";

export type UserRole =
  | "PLATFORM_OWNER"
  | "SUPER_ADMIN"
  | "SYSTEM_ADMIN"
  | "INSTITUTE_ADMIN"
  | "ADMIN"
  | "SCHOOL_ADMIN"
  | "PRINCIPAL"
  | "ACCOUNTANT"
  | "TEACHER"
  | "CLERK"
  | "STUDENT"
  | "PARENT";

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  PLATFORM_OWNER: [
    "academic:read", "academic:manage", "exams:read", "exams:manage", "exams:marks:write",
    "exams:grade:override", "academic:promote:execute", "fees:read", "fees:invoice:create",
    "fees:payment:collect", "fees:waiver:approve", "accounting:read", "accounting:journal:post",
    "accounting:period:close", "payroll:read", "payroll:process", "payroll:disburse",
    "students:read", "students:manage", "staff:read", "staff:manage", "attendance:read", "attendance:mark", "attendance:manage",
    "portal:student:self", "portal:parent:self", "system:manage",
  ],
  SUPER_ADMIN: [
    "academic:read", "academic:manage", "exams:read", "exams:manage", "exams:marks:write",
    "exams:grade:override", "academic:promote:execute", "fees:read", "fees:invoice:create",
    "fees:payment:collect", "fees:waiver:approve", "accounting:read", "accounting:journal:post",
    "accounting:period:close", "payroll:read", "payroll:process", "payroll:disburse",
    "students:read", "students:manage", "staff:read", "staff:manage", "attendance:read", "attendance:mark", "attendance:manage",
    "portal:student:self", "portal:parent:self", "system:manage",
  ],
  SYSTEM_ADMIN: [
    "academic:read", "academic:manage", "exams:read", "exams:manage", "exams:marks:write",
    "exams:grade:override", "academic:promote:execute", "fees:read", "fees:invoice:create",
    "fees:payment:collect", "fees:waiver:approve", "accounting:read", "accounting:journal:post",
    "accounting:period:close", "payroll:read", "payroll:process", "payroll:disburse",
    "students:read", "students:manage", "staff:read", "staff:manage", "attendance:read", "attendance:mark", "attendance:manage",
    "system:manage",
  ],
  INSTITUTE_ADMIN: [
    "academic:read", "academic:manage", "exams:read", "exams:manage", "exams:marks:write",
    "exams:grade:override", "academic:promote:execute", "fees:read", "fees:invoice:create",
    "fees:payment:collect", "fees:waiver:approve", "accounting:read", "accounting:journal:post",
    "accounting:period:close", "payroll:read", "payroll:process", "payroll:disburse",
    "students:read", "students:manage", "staff:read", "staff:manage", "attendance:read", "attendance:mark", "attendance:manage",
  ],
  ADMIN: [
    "academic:read", "academic:manage", "exams:read", "exams:manage", "exams:marks:write",
    "exams:grade:override", "academic:promote:execute", "fees:read", "fees:invoice:create",
    "fees:payment:collect", "fees:waiver:approve", "accounting:read", "accounting:journal:post",
    "accounting:period:close", "payroll:read", "payroll:process", "payroll:disburse",
    "students:read", "students:manage", "staff:read", "staff:manage", "attendance:read", "attendance:mark", "attendance:manage",
  ],
  SCHOOL_ADMIN: [
    "academic:read", "academic:manage", "exams:read", "exams:manage", "exams:marks:write",
    "exams:grade:override", "academic:promote:execute", "fees:read", "fees:invoice:create",
    "fees:payment:collect", "fees:waiver:approve", "accounting:read", "accounting:journal:post",
    "accounting:period:close", "payroll:read", "payroll:process", "payroll:disburse",
    "students:read", "students:manage", "staff:read", "staff:manage", "attendance:read", "attendance:mark", "attendance:manage",
  ],
  PRINCIPAL: [
    "academic:read", "academic:manage", "exams:read", "exams:manage", "exams:marks:write",
    "exams:grade:override", "academic:promote:execute", "fees:read", "fees:waiver:approve",
    "accounting:read", "payroll:read", "students:read", "staff:read", "attendance:read", "attendance:mark",
  ],
  ACCOUNTANT: [
    "fees:read", "fees:invoice:create", "fees:payment:collect", "accounting:read",
    "accounting:journal:post", "payroll:read", "payroll:process", "payroll:disburse",
    "students:read", "staff:read",
  ],
  TEACHER: [
    "academic:read", "exams:read", "exams:marks:write", "students:read", "attendance:read", "attendance:mark",
  ],
  CLERK: [
    "students:read", "students:manage", "fees:read", "fees:payment:collect", "attendance:read", "attendance:mark",
  ],
  STUDENT: ["portal:student:self"],
  PARENT: ["portal:parent:self"],
};

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

// Principal hierarchy: Level 1 (highest) → 7 (lowest)
export const ACCESS_LEVEL_LABELS: Record<number, string> = {
  1: "School Admin (Principal)",
  2: "Manager / Vice-Principal",
  3: "Accountant",
  4: "Academic Coordinator",
  5: "Teacher",
  6: "Parent",
  7: "Student",
};

const LEVEL_3_ACCOUNTANT: UserPermissions = {
  fees: { read: true, write: true, manage: true },
  transactions: { read: true, write: true, manage: true },
  salary: { read: true, write: true, manage: true },
  accounting: { read: true, write: true, manage: true },
  expenses: { read: true, write: true },
  students: { read: true },
  reports: { read: true },
  notices: { read: true },
};

const LEVEL_4_ACADEMIC: UserPermissions = {
  students: { read: true, write: true },
  attendance: { read: true, write: true, manage: true },
  exams: { read: true, write: true, manage: true },
  "exam-results": { read: true, write: true, manage: true },
  timetable: { read: true, write: true, manage: true },
  homework: { read: true, write: true, manage: true },
  library: { read: true, write: true },
  hostel: { read: true, write: true },
  certificates: { read: true, write: true },
  health: { read: true, write: true },
  notices: { read: true, write: true },
  reports: { read: true },
};

const LEVEL_5_TEACHER: UserPermissions = {
  students: { read: true },
  attendance: { read: true, write: true },
  homework: { read: true, write: true },
  "exam-results": { read: true, write: true },
  timetable: { read: true },
  notices: { read: true },
  library: { read: true },
};

const LEVEL_6_PARENT: UserPermissions = {
  attendance: { read: true },
  fees: { read: true },
  "exam-results": { read: true },
  homework: { read: true },
  notices: { read: true },
  timetable: { read: true },
  certificates: { read: true },
  health: { read: true },
  transport: { read: true },
  hostel: { read: true },
  library: { read: true },
};

const LEVEL_7_STUDENT: UserPermissions = { ...LEVEL_6_PARENT };

export const ROLE_DEFAULT_PERMISSIONS: Record<string, UserPermissions> = {
  ADMIN: FULL_ACCESS_PERMISSIONS,
  SUPER_ADMIN: FULL_ACCESS_PERMISSIONS,
  SYSTEM_ADMIN: FULL_ACCESS_PERMISSIONS,
  PLATFORM_OWNER: FULL_ACCESS_PERMISSIONS,
  INSTITUTE_ADMIN: FULL_ACCESS_PERMISSIONS,
  SCHOOL_ADMIN: FULL_ACCESS_PERMISSIONS,
  PRINCIPAL: FULL_ACCESS_PERMISSIONS,
  MANAGER: FULL_ACCESS_PERMISSIONS,
  ACCOUNTANT: LEVEL_3_ACCOUNTANT,
  ACADEMIC_COORDINATOR: LEVEL_4_ACADEMIC,
  TEACHER: LEVEL_5_TEACHER,
  PARENT: LEVEL_6_PARENT,
  STUDENT: LEVEL_7_STUDENT,
  CLERK: LEVEL_5_TEACHER,
};

export const ACCESS_LEVEL_PERMISSIONS: Record<number, UserPermissions> = {
  1: FULL_ACCESS_PERMISSIONS,
  2: FULL_ACCESS_PERMISSIONS,
  3: LEVEL_3_ACCOUNTANT,
  4: LEVEL_4_ACADEMIC,
  5: LEVEL_5_TEACHER,
  6: LEVEL_6_PARENT,
  7: LEVEL_7_STUDENT,
};

export function getEffectivePermissions(
  role: string | null | undefined,
  permissions: unknown,
  accessLevel?: number | null
): UserPermissions | null {
  const normRole = (role || "").toUpperCase();
  if (normRole === "SUPER_ADMIN" || normRole === "SYSTEM_ADMIN" || normRole === "PLATFORM_OWNER") {
    return FULL_ACCESS_PERMISSIONS;
  }

  if (
    permissions &&
    typeof permissions === "object" &&
    !Array.isArray(permissions) &&
    Object.keys(permissions as Record<string, unknown>).length > 0
  ) {
    return permissions as UserPermissions;
  }

  const byRole = ROLE_DEFAULT_PERMISSIONS[normRole];
  if (byRole) return byRole;

  if (typeof accessLevel === "number" && ACCESS_LEVEL_PERMISSIONS[accessLevel]) {
    return ACCESS_LEVEL_PERMISSIONS[accessLevel];
  }

  if (role && /^LEVEL_[1-7]$/i.test(role)) {
    const lvl = parseInt(role.split("_")[1], 10);
    return ACCESS_LEVEL_PERMISSIONS[lvl] ?? null;
  }

  return null;
}

export function hasAccessLevel(userLevel: number | null | undefined, requiredLevel: number): boolean {
  if (userLevel == null) return false;
  return userLevel <= requiredLevel;
}

export function hasRolePermission(role: UserRole | string, required: Permission | Permission[]): boolean {
  const normRole = (role || "").toUpperCase() as UserRole;
  if (normRole === "PLATFORM_OWNER" || normRole === "SUPER_ADMIN" || normRole === "SYSTEM_ADMIN") return true;

  const permissions = ROLE_PERMISSIONS[normRole] || [];
  const reqList = Array.isArray(required) ? required : [required];
  return reqList.every((req) => permissions.includes(req));
}

// Dual-signature hasPermission
export function hasPermission(roleOrPerms: UserRole | string, required: Permission | Permission[]): boolean;
export function hasPermission(permissions: any, module: string, action?: PermissionAction): boolean;
export function hasPermission(
  first: any,
  second: any,
  third?: PermissionAction
): boolean {
  if (typeof first === "string" && (typeof second === "string" || Array.isArray(second)) && third === undefined) {
    return hasRolePermission(first, second as Permission | Permission[]);
  }

  if (!first) return false;
  const modulePerms = first[second];
  if (!modulePerms) return false;
  if (modulePerms.manage) return true;
  const act = third || "read";
  if (act === "read" && modulePerms.write) return true;
  return !!modulePerms[act];
}

export function getModuleForPath(path: string): string | null {
  if (path === "/") return null;
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
      return baseRoute;
  }
}
