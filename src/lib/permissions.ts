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
  | "MANAGER"
  | "ACCOUNTANT"
  | "ACADEMIC_COORDINATOR"
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
    "system:manage",
  ],
  ADMIN: [
    "academic:read", "academic:manage", "exams:read", "exams:manage", "exams:marks:write",
    "exams:grade:override", "academic:promote:execute", "fees:read", "fees:invoice:create",
    "fees:payment:collect", "fees:waiver:approve", "accounting:read", "accounting:journal:post",
    "accounting:period:close", "payroll:read", "payroll:process", "payroll:disburse",
    "students:read", "students:manage", "staff:read", "staff:manage", "attendance:read", "attendance:mark", "attendance:manage",
    "system:manage",
  ],
  SCHOOL_ADMIN: [
    "academic:read", "academic:manage", "exams:read", "exams:manage", "exams:marks:write",
    "exams:grade:override", "academic:promote:execute", "fees:read", "fees:invoice:create",
    "fees:payment:collect", "fees:waiver:approve", "accounting:read", "accounting:journal:post",
    "accounting:period:close", "payroll:read", "payroll:process", "payroll:disburse",
    "students:read", "students:manage", "staff:read", "staff:manage", "attendance:read", "attendance:mark", "attendance:manage",
    "system:manage",
  ],
  PRINCIPAL: [
    "academic:read", "academic:manage", "exams:read", "exams:manage", "exams:marks:write",
    "exams:grade:override", "academic:promote:execute", "fees:read", "fees:waiver:approve",
    "accounting:read", "payroll:read", "students:read", "staff:read", "attendance:read", "attendance:mark",
  ],
  /** Vice-principal / operations manager: runs academics and campus, never the cash box. */
  MANAGER: [
    "academic:read", "academic:manage", "exams:read", "exams:manage", "exams:marks:write",
    "academic:promote:execute", "students:read", "students:manage", "staff:read",
    "attendance:read", "attendance:mark", "attendance:manage",
    "fees:read", "accounting:read", "payroll:read",
  ],
  ACCOUNTANT: [
    "fees:read", "fees:invoice:create", "fees:payment:collect", "accounting:read",
    "accounting:journal:post", "payroll:read", "payroll:process", "payroll:disburse",
    "students:read", "staff:read",
  ],
  /** Owns the timetable, syllabus and exam calendar; no finance, no HR. */
  ACADEMIC_COORDINATOR: [
    "academic:read", "academic:manage", "exams:read", "exams:manage", "exams:marks:write",
    "students:read", "attendance:read", "attendance:mark", "attendance:manage",
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
  "calendar",
] as const;

export const FULL_ACCESS_PERMISSIONS: UserPermissions = Object.fromEntries(
  ALL_PERMISSION_MODULES.map((module) => [module, { read: true, write: true, manage: true }])
);

/* ------------------------------------------------------------------ *
 * Single source of truth: module tiers are DERIVED from ROLE_PERMISSIONS
 * ------------------------------------------------------------------ */

/**
 * Module-tier grants implied by each fine-grained permission.
 *
 * The two matrices used to be maintained by hand and drifted: PRINCIPAL was
 * documented as unable to collect cash, post journals or manage users, yet
 * `ROLE_DEFAULT_PERMISSIONS.PRINCIPAL` was `FULL_ACCESS_PERMISSIONS` — and the
 * module tier is what `requireApiAccess` actually enforces, so the looser copy
 * won. CLERK drifted the other way: granted `fees:payment:collect` here, but
 * given teacher-level modules there, so a clerk could never collect a fee.
 *
 * Deriving one from the other makes that class of bug unrepresentable. Module
 * names must match `getPermissionModuleForApiPath` (what the API enforces) and
 * `getModuleForPath` (what the UI gates on) — hence the pairs, e.g. exam
 * routes map to `exams` while the results *page* gates on `exam-results`.
 */
const PERMISSION_MODULE_GRANTS: Record<Permission, ReadonlyArray<[string, PermissionAction]>> = {
  "academic:read": [["academic", "read"], ["academic-years", "read"], ["subjects", "read"]],
  "academic:manage": [["academic", "manage"], ["academic-years", "manage"], ["subjects", "manage"]],
  "exams:read": [["exams", "read"], ["exam-results", "read"]],
  "exams:manage": [["exams", "manage"], ["exam-results", "manage"]],
  "exams:marks:write": [["exams", "write"], ["exam-results", "write"]],
  "exams:grade:override": [["exam-results", "manage"]],
  "academic:promote:execute": [["exams", "manage"], ["academic", "manage"]],
  "fees:read": [["fees", "read"], ["transactions", "read"]],
  "fees:invoice:create": [["fees", "write"]],
  "fees:payment:collect": [["fees", "write"], ["transactions", "write"]],
  "fees:waiver:approve": [["fees", "manage"]],
  "accounting:read": [["accounting", "read"]],
  "accounting:journal:post": [["accounting", "write"]],
  "accounting:period:close": [["accounting", "manage"]],
  "payroll:read": [["salary", "read"]],
  "payroll:process": [["salary", "write"]],
  "payroll:disburse": [["salary", "manage"]],
  "students:read": [["students", "read"], ["admissions", "read"]],
  "students:manage": [["students", "manage"], ["admissions", "manage"]],
  "staff:read": [["staff", "read"]],
  "staff:manage": [["staff", "manage"]],
  "attendance:read": [["attendance", "read"]],
  "attendance:mark": [["attendance", "write"]],
  "attendance:manage": [["attendance", "manage"]],
  // Portal roles read their OWN rows only; the tenant-wide list endpoints
  // self-scope STUDENT/PARENT tokens (see getSelfScopedStudentProfileIds).
  "portal:student:self": [["attendance", "read"], ["fees", "read"], ["transactions", "read"], ["homework", "read"]],
  "portal:parent:self": [["attendance", "read"], ["fees", "read"], ["transactions", "read"], ["homework", "read"]],
  "system:manage": [["users", "manage"], ["settings", "manage"]],
};

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

/**
 * Module-tier grants the fine-grained matrix does not model.
 *
 * Two reasons an entry belongs here, and only these two:
 *  1. Campus-operations modules (notices, hostel, library …) have no
 *     fine-grained permission at all.
 *  2. The fine-grained matrix is coarser than the module tier for a module —
 *     `students` has only read/manage there, so a role that should get
 *     `students.write` (edit, but not delete) states it here explicitly.
 *
 * Merged as a MAXIMUM over the derived grants; a supplement can widen a role
 * but the fine-grained matrix always establishes the floor.
 */
const ROLE_MODULE_SUPPLEMENT: Record<UserRole, UserPermissions> = {
  PLATFORM_OWNER: FULL_ACCESS_PERMISSIONS,
  SUPER_ADMIN: FULL_ACCESS_PERMISSIONS,
  SYSTEM_ADMIN: FULL_ACCESS_PERMISSIONS,
  INSTITUTE_ADMIN: FULL_ACCESS_PERMISSIONS,
  ADMIN: FULL_ACCESS_PERMISSIONS,
  SCHOOL_ADMIN: FULL_ACCESS_PERMISSIONS,
  // Academic head: sees everything for oversight, drives academic comms and
  // documents, and cannot mutate money, payroll, users or settings.
  PRINCIPAL: {
    ...Object.fromEntries(ALL_PERMISSION_MODULES.map((m) => [m, { read: true }])),
    notices: { read: true, write: true, manage: true },
    timetable: { read: true, write: true, manage: true },
    homework: { read: true, write: true, manage: true },
    certificates: { read: true, write: true, manage: true },
    leaves: { read: true, write: true, manage: true },
    calendar: { read: true, write: true, manage: true },
  },
  // Operations manager: owns the campus estate, not the ledger.
  MANAGER: {
    ...Object.fromEntries(ALL_PERMISSION_MODULES.map((m) => [m, { read: true }])),
    notices: { read: true, write: true, manage: true },
    timetable: { read: true, write: true, manage: true },
    homework: { read: true, write: true, manage: true },
    certificates: { read: true, write: true, manage: true },
    leaves: { read: true, write: true, manage: true },
    hostel: { read: true, write: true, manage: true },
    transport: { read: true, write: true, manage: true },
    inventory: { read: true, write: true, manage: true },
    library: { read: true, write: true, manage: true },
    health: { read: true, write: true, manage: true },
    enquiries: { read: true, write: true, manage: true },
    calendar: { read: true, write: true, manage: true },
  },
  ACCOUNTANT: {
    expenses: { read: true, write: true },
    reports: { read: true },
    notices: { read: true },
  },
  ACADEMIC_COORDINATOR: {
    students: { read: true, write: true },
    timetable: { read: true, write: true, manage: true },
    homework: { read: true, write: true, manage: true },
    library: { read: true, write: true },
    hostel: { read: true, write: true },
    certificates: { read: true, write: true },
    health: { read: true, write: true },
    notices: { read: true, write: true },
    reports: { read: true },
    calendar: { read: true, write: true, manage: true },
  },
  TEACHER: {
    homework: { read: true, write: true },
    timetable: { read: true },
    notices: { read: true },
    library: { read: true },
    calendar: { read: true },
  },
  CLERK: {
    certificates: { read: true, write: true },
    notices: { read: true },
    library: { read: true },
    reports: { read: true },
    calendar: { read: true },
  },
  PARENT: {
    notices: { read: true },
    timetable: { read: true },
    certificates: { read: true },
    health: { read: true },
    transport: { read: true },
    hostel: { read: true },
    library: { read: true },
    "exam-results": { read: true },
    calendar: { read: true },
  },
  STUDENT: {
    notices: { read: true },
    timetable: { read: true },
    certificates: { read: true },
    health: { read: true },
    transport: { read: true },
    hostel: { read: true },
    library: { read: true },
    "exam-results": { read: true },
    calendar: { read: true },
  },
};

const ACTION_RANK: Record<PermissionAction, number> = { read: 1, write: 2, manage: 3 };

/**
 * Grant `action` on `module`, filling in the tiers it implies.
 *
 * `hasPermission` already treats manage ⊃ write ⊃ read at read time, but the
 * flags are also rendered by the permission editor and diffed against role
 * defaults — leaving `{manage:true}` without `read`/`write` shows an operator a
 * checkbox grid that contradicts the access the user actually has.
 */
function grantModuleAction(target: UserPermissions, module: string, action: PermissionAction): void {
  const current = target[module] ?? (target[module] = {});
  if (ACTION_RANK[action] >= ACTION_RANK.read) current.read = true;
  if (ACTION_RANK[action] >= ACTION_RANK.write) current.write = true;
  if (ACTION_RANK[action] >= ACTION_RANK.manage) current.manage = true;
}

/** Project a fine-grained permission list onto the enforced module tiers. */
export function deriveModulePermissions(permissions: ReadonlyArray<Permission>): UserPermissions {
  const derived: UserPermissions = {};
  for (const permission of permissions) {
    for (const [module, action] of PERMISSION_MODULE_GRANTS[permission] ?? []) {
      grantModuleAction(derived, module, action);
    }
  }
  return derived;
}

function mergeMaxPermissions(base: UserPermissions, extra: UserPermissions): UserPermissions {
  const merged: UserPermissions = {};
  for (const source of [base, extra]) {
    for (const [module, actions] of Object.entries(source)) {
      if (actions?.manage) grantModuleAction(merged, module, "manage");
      else if (actions?.write) grantModuleAction(merged, module, "write");
      else if (actions?.read) grantModuleAction(merged, module, "read");
    }
  }
  return merged;
}

function buildRoleDefaults(): Record<string, UserPermissions> {
  const defaults: Record<string, UserPermissions> = {};
  for (const role of Object.keys(ROLE_PERMISSIONS) as UserRole[]) {
    defaults[role] = mergeMaxPermissions(
      deriveModulePermissions(ROLE_PERMISSIONS[role]),
      ROLE_MODULE_SUPPLEMENT[role] ?? {},
    );
  }
  return defaults;
}

/**
 * Module-tier defaults per role — DERIVED, never hand-maintained.
 * Edit {@link ROLE_PERMISSIONS} or {@link ROLE_MODULE_SUPPLEMENT} instead.
 */
export const ROLE_DEFAULT_PERMISSIONS: Record<string, UserPermissions> = buildRoleDefaults();

/**
 * Access level → permissions, expressed as the role that level represents so
 * the two tables cannot disagree. Level 1 is the school's own top admin (full
 * tenant access); level 2 is the vice-principal/manager, who — per the role
 * matrix — does not get the cash box, payroll or user administration.
 */
export const ACCESS_LEVEL_ROLE: Record<number, UserRole> = {
  1: "SCHOOL_ADMIN",
  2: "MANAGER",
  3: "ACCOUNTANT",
  4: "ACADEMIC_COORDINATOR",
  5: "TEACHER",
  6: "PARENT",
  7: "STUDENT",
};

export const ACCESS_LEVEL_PERMISSIONS: Record<number, UserPermissions> = Object.fromEntries(
  Object.entries(ACCESS_LEVEL_ROLE).map(([level, role]) => [Number(level), ROLE_DEFAULT_PERMISSIONS[role]]),
);

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
  // Empty required-list must fail closed: a dynamically built permission
  // list that ends up empty means the caller forgot to require anything,
  // and `every()` on [] returning true was a silent default-allow.
  if (reqList.length === 0) return false;
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
    case "calendar":
      return "calendar";
    default:
      return baseRoute;
  }
}

// ─── UI Module Category Grouping ───
export interface ModuleCategory {
  id: string;
  label: string;
  icon: string;
  modules: Array<{ id: string; label: string }>;
}

export const MODULE_CATEGORIES: ModuleCategory[] = [
  {
    id: "student-academic",
    label: "Student & Academic",
    icon: "GraduationCap",
    modules: [
      { id: "students", label: "Students Directory" },
      { id: "academic", label: "Academic Setup" },
      { id: "academic-years", label: "Academic Years" },
      { id: "subjects", label: "Subjects" },
      { id: "admissions", label: "Admissions" },
      { id: "attendance", label: "Attendance Records" },
    ],
  },
  {
    id: "exams-results",
    label: "Exams & Results",
    icon: "FileCheck",
    modules: [
      { id: "exams", label: "Exams Management" },
      { id: "exam-results", label: "Exam Results & Marks" },
    ],
  },
  {
    id: "finance",
    label: "Finance & Fees",
    icon: "Wallet",
    modules: [
      { id: "fees", label: "Fee Vouchers" },
      { id: "transactions", label: "Transactions" },
      { id: "salary", label: "Salary & Payroll" },
      { id: "accounting", label: "Accounting & Ledger" },
    ],
  },
  {
    id: "academic-ops",
    label: "Academic Operations",
    icon: "BookOpen",
    modules: [
      { id: "timetable", label: "Timetable" },
      { id: "calendar", label: "School Calendar" },
      { id: "homework", label: "Homework" },
      { id: "notices", label: "Notices & Circulars" },
      { id: "library", label: "Library" },
    ],
  },
  {
    id: "campus",
    label: "Campus & Facilities",
    icon: "Building2",
    modules: [
      { id: "transport", label: "Transport" },
      { id: "hostel", label: "Hostel" },
      { id: "inventory", label: "Inventory" },
      { id: "health", label: "Health Records" },
      { id: "certificates", label: "Certificates" },
      { id: "leaves", label: "Leave Management" },
      { id: "enquiries", label: "Enquiries" },
    ],
  },
  {
    id: "system",
    label: "System Administration",
    icon: "Settings",
    modules: [
      { id: "users", label: "System Users" },
      { id: "settings", label: "System Settings" },
      { id: "reports", label: "Reports & Analytics" },
    ],
  },
];

export const READ_ONLY_PERMISSIONS: UserPermissions = Object.fromEntries(
  ALL_PERMISSION_MODULES.map((module) => [module, { read: true, write: false, manage: false }])
);

export const NO_ACCESS_PERMISSIONS: UserPermissions = Object.fromEntries(
  ALL_PERMISSION_MODULES.map((module) => [module, { read: false, write: false, manage: false }])
);

export function getPermissionsDiff(
  current: UserPermissions,
  defaults: UserPermissions
): Set<string> {
  const changed = new Set<string>();
  const allKeys = new Set([...Object.keys(current), ...Object.keys(defaults)]);
  for (const mod of allKeys) {
    const c = current[mod] ?? {};
    const d = defaults[mod] ?? {};
    if (
      !!c.read !== !!d.read ||
      !!c.write !== !!d.write ||
      !!c.manage !== !!d.manage
    ) {
      changed.add(mod);
    }
  }
  return changed;
}

// ─── Privilege-escalation guards ───
export const PLATFORM_PRIVILEGED_ROLES = new Set<string>([
  "PLATFORM_OWNER",
  "SUPER_ADMIN",
  "SYSTEM_ADMIN",
]);

export function canAssignRole(
  requesterRole: string | null | undefined,
  requesterIsPlatformOwner: boolean,
  targetRole: string | null | undefined
): boolean {
  if (!targetRole) return true;
  const normTarget = targetRole.toUpperCase();
  if (PLATFORM_PRIVILEGED_ROLES.has(normTarget)) {
    const normRequester = (requesterRole || "").toUpperCase();
    return requesterIsPlatformOwner || PLATFORM_PRIVILEGED_ROLES.has(normRequester);
  }
  return true;
}

export function canAssignAccessLevel(
  requesterLevel: number | null | undefined,
  targetLevel: number | null | undefined
): boolean {
  if (targetLevel == null) return true;
  if (requesterLevel == null) return targetLevel >= 3;
  if (targetLevel < requesterLevel) return false;
  if (targetLevel <= 2 && requesterLevel > 2) return false;
  return true;
}

export function canGrantPermissions(
  requesterPerms: UserPermissions | null,
  targetPerms: UserPermissions | null | undefined
): { allowed: boolean; module?: string; action?: PermissionAction } {
  if (!targetPerms || Object.keys(targetPerms).length === 0) return { allowed: true };
  if (!requesterPerms) return { allowed: false, module: Object.keys(targetPerms)[0] };
  for (const [mod, perms] of Object.entries(targetPerms)) {
    for (const act of ["read", "write", "manage"] as PermissionAction[]) {
      if ((perms as any)[act] && !hasPermission(requesterPerms, mod, act)) {
        return { allowed: false, module: mod, action: act };
      }
    }
  }
  return { allowed: true };
}
