import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAccess } from "@/lib/api-auth";
import {
  badRequest,
  forbidden,
  handleApiError,
  notFound,
  safeParseBody,
  successResponse,
} from "@/lib/api-response";
import { feeCollectorCapabilitySchema } from "@/lib/schemas";
import {
  FEE_DESK_TIER,
  PORTAL_ROLES,
  canGrantPermissions,
  getEffectivePermissions,
  hasPermission,
  type UserPermissions,
} from "@/lib/permissions";
import { logAuditEvent } from "@/lib/audit-logger";

/**
 * PATCH /api/fees/collectors/[id]
 *
 * Grant or revoke one user's access to each fee collection desk. This is the
 * only writer of the two desk tiers.
 *
 * The stored `permissions` JSON *replaces* the role defaults wholesale (see
 * `getEffectivePermissions`), so the write is the target's full effective
 * matrix with the two desks set — a partial object would silently revoke every
 * other module the user holds.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Admin surface. The requester must additionally hold each desk they hand
    // out (checked below) so a desk can never be escalated beyond its own
    // holder — the same rule the user-permission editor enforces.
    const access = await requireApiAccess(request, { module: "users", action: "write" });
    if ("response" in access) return access.response;
    const { tenantId, user: requester } = access.authContext;

    const { id } = await params;
    const bodyResult = await safeParseBody(request, feeCollectorCapabilitySchema);
    if (!bodyResult.success) return bodyResult.errorResponse;
    const { posCollect, bulkCollect } = bodyResult.data;

    const target = await prisma.user.findFirst({
      where: { id, tenantId },
      select: { id: true, name: true, role: true, accessLevel: true, permissions: true },
    });
    if (!target) return notFound("Collector not found");

    if ((PORTAL_ROLES as readonly string[]).includes(target.role)) {
      return badRequest(
        `The ${target.role} role is a portal login and cannot be granted a fee collection desk.`
      );
    }

    const current = getEffectivePermissions(
      target.role,
      target.permissions,
      target.accessLevel
    ) ?? {};

    // A desk is a cash-handling capability, not a browsable resource: granting
    // turns read+write on, revoking clears the tier outright so a revoked
    // collector stops seeing the desk in navigation as well.
    const grantedDesks: Record<string, UserPermissions[string]> = {};
    const revokedTiers: string[] = [];
    const next: UserPermissions = { ...current };

    for (const [tier, granted] of [
      [FEE_DESK_TIER.pos, posCollect],
      [FEE_DESK_TIER.bulk, bulkCollect],
    ] as const) {
      if (granted) {
        next[tier] = {
          read: true,
          write: true,
          manage: current[tier]?.manage ?? false,
        };
        if (!hasPermission(current, tier, "write")) grantedDesks[tier] = next[tier];
      } else {
        if (hasPermission(current, tier, "write")) revokedTiers.push(tier);
        next[tier] = { read: false, write: false, manage: false };
      }
    }

    if (Object.keys(grantedDesks).length > 0) {
      const requesterPerms = getEffectivePermissions(
        requester.role,
        requester.permissions,
        requester.accessLevel
      );
      const grant = canGrantPermissions(requesterPerms, grantedDesks);
      if (!grant.allowed) {
        return forbidden(`You cannot grant ${grant.action} permission for ${grant.module} module`);
      }
    }

    const updated = await prisma.user.update({
      where: { id: target.id },
      data: { permissions: next },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        accessLevel: true,
        isActive: true,
        lastLoginAt: true,
      },
    });

    await logAuditEvent({
      tenantId,
      userId: requester.id,
      userEmail: requester.email,
      action: "UPDATE",
      entity: "User",
      entityId: target.id,
      details: {
        scope: "fee-collector-desks",
        target: target.name,
        posCollect,
        bulkCollect,
        granted: Object.keys(grantedDesks),
        revoked: revokedTiers,
      },
    });

    return successResponse({
      ...updated,
      posCollect: hasPermission(next, FEE_DESK_TIER.pos, "write"),
      bulkCollect: hasPermission(next, FEE_DESK_TIER.bulk, "write"),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
