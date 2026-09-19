import { NextRequest, NextResponse } from "next/server";
import type { AuthContext } from "@/lib/auth";
import { getAuthContext } from "@/lib/auth";
import { errorResponse, forbidden, unauthorized } from "@/lib/api-response";
import { hasPermission, hasRolePermission, getEffectivePermissions, type PermissionAction, type Permission } from "@/lib/permissions";
import { isPlatformOwnerEmail } from "@/lib/platform-owner";
import { prisma } from "@/lib/prisma";
import {
  getSubscriptionEnforcementState,
} from "@/lib/subscription-service";
import {
  getModuleKeyForApiPath,
  resolveTenantModules,
} from "@/lib/tenant-modules";

type AccessResult =
  | { authContext: AuthContext; response?: never }
  | { authContext?: never; response: NextResponse };

const tenantModulesCache = new Map<string, { modules: Record<string, boolean>; expiresAt: number }>();

const API_PREFIX = "/api/";

function getApiPathSegments(pathname: string): string[] {
  if (!pathname.startsWith(API_PREFIX)) {
    return [];
  }

  return pathname.slice(API_PREFIX.length).split("/").filter(Boolean);
}

export function getPermissionActionForMethod(method: string): PermissionAction {
  switch (method.toUpperCase()) {
    case "GET":
    case "HEAD":
      return "read";
    case "DELETE":
      return "manage";
    default:
      return "write";
  }
}

export function getPermissionModuleForApiPath(pathname: string): string | null {
  const [resource, subresource] = getApiPathSegments(pathname);

  switch (resource) {
    case "users":
      return "users";
    case "students":
      return "students";
    case "staff":
      return "staff";
    case "attendance":
      return "attendance";
    case "fees":
    case "transactions":
      return "fees";
    case "accounting":
      return "accounting";
    case "salary":
      return "salary";
    case "notices":
      return "notices";
    case "timetable":
    case "timetables":
      return "timetable";
    case "enquiries":
      return "enquiries";
    case "library":
      return "library";
    case "transport":
      return "transport";
    case "homework":
    case "homeworks":
    case "homework-submissions":
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
    case "settings":
    case "audit-logs":
      return "settings";
    case "upload":
      return null;
    case "subjects":
      return "subjects";
    case "classes":
    case "groups":
    case "sections":
    case "academic-years":
    case "class-subjects":
      return "academic";
    case "calendar":
    case "holidays":
      return "calendar";
    case "exams":
    case "exam-results":
    case "promotion-rules":
    case "promotions":
    case "question-papers":
    case "questions":
      return "exams";
    case "reports":
      if (subresource === "students" || subresource === "admissions") return "students";
      if (subresource === "fees" || subresource === "financial") return "fees";
      if (subresource === "attendance") return "attendance";
      if (subresource === "exams") return "exams";
      if (subresource === "salary") return "salary";
      return "settings";
    case "admin":
      if (subresource === "historical-data") return "historical-data";
      return "settings";
    case "system-admin":
    case "tenants":
      return "settings";
    default:
      return null;
  }
}

export async function requireApiAccess(
  request: NextRequest,
  options?: {
    action?: PermissionAction;
    module?: string | null;
    permission?: Permission | Permission[];
    allowSystemAdmin?: boolean;
    /** Explicit opt-in for intentionally generic authenticated endpoints. */
    allowUnmapped?: boolean;
  }
): Promise<AccessResult> {
  const authContext = await getAuthContext(request);

  if (!authContext) {
    return { response: unauthorized("Authentication required") };
  }

  const { user } = authContext;
  const isSystemAdmin = user.role === "SYSTEM_ADMIN" || isPlatformOwnerEmail(user.email);

  if (!options?.allowSystemAdmin && isSystemAdmin) {
    return { response: forbidden("System administrators cannot access tenant APIs") };
  }

  if (options?.allowSystemAdmin) {
    const isValidatedImpersonation =
      authContext.isImpersonated === true &&
      !!authContext.impersonatedBy &&
      isPlatformOwnerEmail(authContext.impersonatedBy);
    if (user.role !== "SYSTEM_ADMIN" && !isPlatformOwnerEmail(user.email) && !isValidatedImpersonation) {
      return { response: forbidden("Platform system administrator access is required") };
    }
    return { authContext };
  }

  // The restricted notice page needs this read-only, tenant-scoped endpoint.
  // This is an exact method/path exception, not a general subscription bypass.
  if (request.method === "GET" && request.nextUrl.pathname === "/api/tenants/subscription-status") {
    return { authContext };
  }

  // Subscription enforcement for regular tenant users.
  // System admins, platform owners and impersonated support sessions are exempt.
  if (!isSystemAdmin && !authContext.isImpersonated && authContext.tenantId) {
    // Enforcement evaluates dates directly; a background sweep is not an access gate.
    let enforcement;
    try {
      enforcement = await getSubscriptionEnforcementState(authContext.tenantId);
    } catch {
      return { response: errorResponse("Unable to verify subscription access. Please retry.", 503) };
    }
    if (enforcement?.blocked) {
      return {
        response: forbidden(
          enforcement.reason ||
            "Subscription is not active. Please contact your administrator to restore access."
        ),
      };
    }

    // Module licensing & entitlement check with 60s in-memory cache to save DB queries
    const moduleKey = getModuleKeyForApiPath(request.nextUrl.pathname);
    if (moduleKey) {
      let resolved = tenantModulesCache.get(authContext.tenantId);
      const now = Date.now();
      if (!resolved || resolved.expiresAt <= now) {
        const tenant = await prisma.tenant.findUnique({
          where: { tenantId: authContext.tenantId },
          select: {
            featureFlags: true,
            featureOverride: {
              select: {
                hasHostel: true,
                hasTransport: true,
                hasPayroll: true,
              },
            },
          },
        });
        const modules = resolveTenantModules(tenant?.featureFlags, tenant?.featureOverride);
        resolved = { modules, expiresAt: now + 60000 };
        tenantModulesCache.set(authContext.tenantId, resolved);
      }
      if (resolved.modules[moduleKey] === false) {
        return {
          response: forbidden(
            `The '${moduleKey}' module is not licensed or enabled for this educational institute.`
          ),
        };
      }
    }
  }

  if (options?.permission) {
    if (!hasRolePermission(user.role as string, options.permission)) {
      const permsStr = Array.isArray(options.permission) ? options.permission.join(", ") : options.permission;
      return { response: forbidden(`Missing required permission: ${permsStr}`) };
    }
  }

  const action = options?.action ?? getPermissionActionForMethod(request.method);
  const moduleName =
    options?.module === undefined
      ? getPermissionModuleForApiPath(request.nextUrl.pathname)
      : options.module;

  if (!moduleName) {
    // Fail-closed for security: unmapped API routes require explicit permission option
    if (!options?.permission && !options?.allowUnmapped) {
      return { response: forbidden("Unmapped API endpoint: access restricted.") };
    }
    return { authContext };
  }

  const effectivePermissions = getEffectivePermissions(user.role as string, user.permissions as any, (user as any).accessLevel ?? null);

  if (!hasPermission(effectivePermissions, moduleName, action)) {
    return {
      response: forbidden(
        `Insufficient ${action} permissions for ${moduleName} module`
      ),
    };
  }

  return { authContext };
}

export async function verifyAuthAndPermission(
  request: NextRequest,
  moduleName?: string,
  action?: PermissionAction
): Promise<
  | { authorized: true; authContext: AuthContext; error?: never; status?: never }
  | { authorized: false; authContext?: never; error: string; status: number }
> {
  const result = await requireApiAccess(request, {
    module: moduleName,
    action: action,
  });

  if ("response" in result && result.response) {
    return {
      authorized: false,
      error: "Authentication or permission check failed",
      status: result.response.status,
    };
  }

  return {
    authorized: true,
    authContext: result.authContext,
  };
}

/**
 * Self-scoping for STUDENT / PARENT JWTs on tenant-wide list endpoints.
 *
 * ROLE_DEFAULT_PERMISSIONS grants LEVEL_6/7 reads on fees, attendance,
 * health and transactions, and `hasPermission` has no notion of "own row" —
 * without this, any logged-in student calling `GET /api/transactions` reads
 * the whole tenant's financial ledger. Portal surfaces are supposed to use
 * the self-scoped `/api/portal/*` routes; the dashboard routes must not be a
 * wider door.
 *
 * Returns `null` for staff roles (no restriction) and the *only* student
 * profile IDs the caller may see otherwise. An empty array means "linked to
 * no student" and must yield zero rows — never fall back to unscoped.
 */
export async function getSelfScopedStudentProfileIds(
  authContext: AuthContext
): Promise<string[] | null> {
  const role = String(authContext.user.role ?? "").toUpperCase();
  if (role !== "STUDENT" && role !== "PARENT") return null;

  if (role === "STUDENT") {
    const own = (authContext.user as { studentProfileId?: string | null }).studentProfileId;
    return own ? [own] : [];
  }

  const links = await prisma.parentStudentLink.findMany({
    where: { tenantId: authContext.tenantId, parentUserId: authContext.user.id },
    select: { studentProfileId: true },
  });
  return links.map((link) => link.studentProfileId);
}

/**
 * True when `id` is empty/absent (nothing to validate) or names a row of the
 * given tenant-owned model. Guards relation writes: without it, tenant A can
 * set `studentProfileId`/`classId`/etc. to tenant B's row id and later read
 * B's data back through `include`. Pass a model delegate, e.g.
 * `isTenantOwned(prisma.studentProfile, body.studentProfileId, tenantId)`.
 */
export async function isTenantOwned(
  // Prisma delegates have per-model generic args types; `any` on the args
  // position is what makes one helper usable with every model.
  delegate: { findFirst: (args: any) => Promise<unknown> },
  id: string | null | undefined,
  tenantId: string,
): Promise<boolean> {
  if (!id) return true;
  return Boolean(await delegate.findFirst({ where: { id, tenantId }, select: { id: true } }));
}
