/**
 * Unified Tenant Module Access & Entitlements Engine.
 *
 * Defines modular capabilities across Pathshala-Pro that a tenant may or may
 * not license/enable. Serves as the single source of truth for:
 * 1. Superadmin Tenant Module Licensing Controls
 * 2. User session module access payload
 * 3. School Sidebar link visibility
 * 4. API request access gating (api-auth)
 */

export const TENANT_MODULE_KEYS = [
  "academics",
  "admissions",
  "attendance",
  "examinations",
  "fees",
  "accounting",
  "payroll",
  "timetable",
  "calendar",
  "homework",
  "notices",
  "leaves",
  "transport",
  "hostel",
  "library",
  "inventory",
  "certificates",
  "health",
] as const;

export type TenantModuleKey = (typeof TENANT_MODULE_KEYS)[number];

export interface TenantModuleDefinition {
  key: TenantModuleKey;
  labelKey: string;
  descriptionKey: string;
  category: "core" | "academic" | "finance" | "facilities";
  defaultEnabled: boolean;
}

export const TENANT_MODULE_DEFINITIONS: TenantModuleDefinition[] = [
  // Core & Operations
  {
    key: "academics",
    labelKey: "tenantModules.academics.title",
    descriptionKey: "tenantModules.academics.description",
    category: "core",
    defaultEnabled: true,
  },
  {
    key: "admissions",
    labelKey: "tenantModules.admissions.title",
    descriptionKey: "tenantModules.admissions.description",
    category: "core",
    defaultEnabled: true,
  },
  {
    key: "attendance",
    labelKey: "tenantModules.attendance.title",
    descriptionKey: "tenantModules.attendance.description",
    category: "core",
    defaultEnabled: true,
  },
  {
    key: "notices",
    labelKey: "tenantModules.notices.title",
    descriptionKey: "tenantModules.notices.description",
    category: "core",
    defaultEnabled: true,
  },
  {
    key: "calendar",
    labelKey: "tenantModules.calendar.title",
    descriptionKey: "tenantModules.calendar.description",
    category: "core",
    defaultEnabled: true,
  },

  // Academic Delivery & Assessment
  {
    key: "examinations",
    labelKey: "tenantModules.examinations.title",
    descriptionKey: "tenantModules.examinations.description",
    category: "academic",
    defaultEnabled: true,
  },
  {
    key: "timetable",
    labelKey: "tenantModules.timetable.title",
    descriptionKey: "tenantModules.timetable.description",
    category: "academic",
    defaultEnabled: true,
  },
  {
    key: "homework",
    labelKey: "tenantModules.homework.title",
    descriptionKey: "tenantModules.homework.description",
    category: "academic",
    defaultEnabled: true,
  },
  {
    key: "certificates",
    labelKey: "tenantModules.certificates.title",
    descriptionKey: "tenantModules.certificates.description",
    category: "academic",
    defaultEnabled: true,
  },

  // Finance, Accounts & HR
  {
    key: "fees",
    labelKey: "tenantModules.fees.title",
    descriptionKey: "tenantModules.fees.description",
    category: "finance",
    defaultEnabled: true,
  },
  {
    key: "accounting",
    labelKey: "tenantModules.accounting.title",
    descriptionKey: "tenantModules.accounting.description",
    category: "finance",
    defaultEnabled: true,
  },
  {
    key: "payroll",
    labelKey: "tenantModules.payroll.title",
    descriptionKey: "tenantModules.payroll.description",
    category: "finance",
    defaultEnabled: true,
  },

  // Campus Facilities & Logistics
  {
    key: "transport",
    labelKey: "tenantModules.transport.title",
    descriptionKey: "tenantModules.transport.description",
    category: "facilities",
    defaultEnabled: true,
  },
  {
    key: "hostel",
    labelKey: "tenantModules.hostel.title",
    descriptionKey: "tenantModules.hostel.description",
    category: "facilities",
    defaultEnabled: true,
  },
  {
    key: "library",
    labelKey: "tenantModules.library.title",
    descriptionKey: "tenantModules.library.description",
    category: "facilities",
    defaultEnabled: true,
  },
  {
    key: "inventory",
    labelKey: "tenantModules.inventory.title",
    descriptionKey: "tenantModules.inventory.description",
    category: "facilities",
    defaultEnabled: true,
  },
  {
    key: "health",
    labelKey: "tenantModules.health.title",
    descriptionKey: "tenantModules.health.description",
    category: "facilities",
    defaultEnabled: true,
  },
  {
    key: "leaves",
    labelKey: "tenantModules.leaves.title",
    descriptionKey: "tenantModules.leaves.description",
    category: "facilities",
    defaultEnabled: true,
  },
];

export const DEFAULT_TENANT_MODULE_ACCESS: Record<TenantModuleKey, boolean> = {
  academics: true,
  admissions: true,
  attendance: true,
  examinations: true,
  fees: true,
  accounting: true,
  payroll: true,
  timetable: true,
  calendar: true,
  homework: true,
  notices: true,
  leaves: true,
  transport: true,
  hostel: true,
  library: true,
  inventory: true,
  certificates: true,
  health: true,
};

/**
 * Resolves full module entitlement access map for a tenant.
 *
 * Normalizes input from `Tenant.featureFlags` (JSON) and optional `TenantFeatureOverride`
 * relation, falling back to `DEFAULT_TENANT_MODULE_ACCESS`.
 */
export function resolveTenantModules(
  rawFlags?: any,
  override?: {
    hasHostel?: boolean;
    hasTransport?: boolean;
    hasPayroll?: boolean;
  } | null
): Record<TenantModuleKey, boolean> {
  const flags = typeof rawFlags === "object" && rawFlags !== null ? rawFlags : {};
  const result: Record<TenantModuleKey, boolean> = { ...DEFAULT_TENANT_MODULE_ACCESS };

  for (const key of TENANT_MODULE_KEYS) {
    if (typeof flags[key] === "boolean") {
      result[key] = flags[key];
    }
  }

  // Backwards compatibility with TenantFeatureOverride if set
  if (override) {
    if (typeof override.hasHostel === "boolean") result.hostel = override.hasHostel;
    if (typeof override.hasTransport === "boolean") result.transport = override.hasTransport;
    if (typeof override.hasPayroll === "boolean") result.payroll = override.hasPayroll;
  }

  return result;
}

/**
 * Maps a URL route or navigation href to its required TenantModuleKey (if any).
 * Returns `null` if the route belongs to core settings or is not modularly restricted.
 */
export function getModuleKeyForHref(href: string): TenantModuleKey | null {
  if (!href || href === "/") return null;
  const path = href.split("?")[0].replace(/^\//, "");
  const segment = path.split("/")[0].toLowerCase();

  switch (segment) {
    case "academic":
    case "classes":
    case "groups":
    case "subjects":
      return "academics";
    case "admissions":
    case "enquiries":
      return "admissions";
    case "attendance":
      return "attendance";
    case "exams":
    case "exam-results":
    case "promotions":
      return "examinations";
    case "fees":
    case "transactions":
      return "fees";
    case "accounting":
    case "accounts":
    case "expenses":
    case "bank-accounts":
    case "statements":
      return "accounting";
    case "salary":
    case "payroll":
      return "payroll";
    case "timetable":
      return "timetable";
    case "calendar":
      return "calendar";
    case "homework":
      return "homework";
    case "notices":
      return "notices";
    case "leaves":
      return "leaves";
    case "transport":
      return "transport";
    case "hostel":
      return "hostel";
    case "library":
      return "library";
    case "inventory":
      return "inventory";
    case "certificates":
      return "certificates";
    case "health":
      return "health";
    default:
      return null;
  }
}

/**
 * Maps an API request path to its required TenantModuleKey (if any).
 */
export function getModuleKeyForApiPath(pathname: string): TenantModuleKey | null {
  if (!pathname.startsWith("/api/")) return null;
  const segments = pathname.replace(/^\/api\//, "").split("/");
  const resource = segments[0]?.toLowerCase();

  switch (resource) {
    case "classes":
    case "groups":
    case "sections":
    case "class-subjects":
    case "subjects":
    case "students":
      return "academics";
    case "admissions":
    case "enquiries":
      return "admissions";
    case "attendance":
      return "attendance";
    case "exams":
    case "exam-results":
    case "promotions":
    case "question-papers":
    case "questions":
      return "examinations";
    case "fees":
    case "fee":
    case "student-fees":
    case "transactions":
      return "fees";
    case "accounting":
    case "accounts":
    case "expenses":
    case "bank-accounts":
    case "statements":
      return "accounting";
    case "salary":
    case "payroll":
      return "payroll";
    case "timetable":
    case "timetables":
      return "timetable";
    case "calendar":
    case "holidays":
      return "calendar";
    case "homework":
    case "homeworks":
    case "homework-submissions":
      return "homework";
    case "notices":
      return "notices";
    case "leaves":
      return "leaves";
    case "transport":
      return "transport";
    case "hostel":
    case "hostels":
    case "hostel-rooms":
    case "hostel-allocations":
      return "hostel";
    case "library":
      return "library";
    case "inventory":
      return "inventory";
    case "certificates":
      return "certificates";
    case "health":
    case "health-records":
      return "health";
    default:
      return null;
  }
}
