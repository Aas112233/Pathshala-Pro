import { NextRequest, NextResponse } from "next/server";
import type { AuthContext } from "@/lib/auth";
import { getAuthContext } from "@/lib/auth";
import { forbidden, unauthorized } from "@/lib/api-response";
import { hasPermission, type PermissionAction } from "@/lib/permissions";

type AccessResult =
  | { authContext: AuthContext; response?: never }
  | { authContext?: never; response: NextResponse };

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
    case "salary":
      return "salary";
    case "settings":
      return "settings";
    case "subjects":
      return "subjects";
    case "classes":
    case "groups":
    case "sections":
    case "academic-years":
    case "class-subjects":
      return "academic";
    case "exams":
    case "exam-results":
    case "promotion-rules":
    case "promotions":
      return "exams";
    case "reports":
      if (subresource === "students") return "students";
      if (subresource === "fees") return "fees";
      if (subresource === "attendance") return "attendance";
      if (subresource === "exams") return "exams";
      return null;
    default:
      return null;
  }
}

export async function requireApiAccess(
  request: NextRequest,
  options?: {
    action?: PermissionAction;
    module?: string | null;
    allowSystemAdmin?: boolean;
  }
): Promise<AccessResult> {
  const authContext = await getAuthContext(request);

  if (!authContext) {
    return { response: unauthorized("Authentication required") };
  }

  const { user } = authContext;

  if (!options?.allowSystemAdmin && user.role === "SYSTEM_ADMIN") {
    return { response: forbidden("System administrators cannot access tenant APIs") };
  }

  if (user.role === "SUPER_ADMIN") {
    return { authContext };
  }

  const action = options?.action ?? getPermissionActionForMethod(request.method);
  const moduleName =
    options?.module === undefined
      ? getPermissionModuleForApiPath(request.nextUrl.pathname)
      : options.module;

  if (!moduleName) {
    return { authContext };
  }

  if (!hasPermission(user.permissions, moduleName, action)) {
    return {
      response: forbidden(
        `Insufficient ${action} permissions for ${moduleName} module`
      ),
    };
  }

  return { authContext };
}
