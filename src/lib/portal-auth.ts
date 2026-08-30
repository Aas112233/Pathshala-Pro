import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, type AuthContext } from "@/lib/auth";
import { requireApiAccess } from "@/lib/api-auth";
import { forbidden, unauthorized } from "@/lib/api-response";
import type { Permission } from "@/lib/permissions";

export type PortalRole = "STUDENT" | "PARENT";
export type PortalAccess =
  | { authContext: AuthContext; response?: never }
  | { authContext?: never; response: NextResponse };

export async function requirePortalAccess(
  request: NextRequest,
  expectedRole?: PortalRole
): Promise<PortalAccess> {
  const authenticated = await getAuthContext(request);
  if (!authenticated) return { response: unauthorized("Authentication required") };

  const role = authenticated.user.role.toUpperCase() as PortalRole;
  if (role !== "STUDENT" && role !== "PARENT") {
    return { response: forbidden("Portal access is limited to students and parents") };
  }
  if (expectedRole && role !== expectedRole) {
    return { response: forbidden("This portal area is not available for your account") };
  }

  const permission: Permission = role === "STUDENT" ? "portal:student:self" : "portal:parent:self";
  const access = await requireApiAccess(request, { module: null, permission });
  if ("response" in access) return access;
  return { authContext: access.authContext };
}
