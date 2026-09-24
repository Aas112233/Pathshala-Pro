import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAccess } from "@/lib/api-auth";
import { handleApiError, paginatedResponse } from "@/lib/api-response";
import {
  FEE_DESK_TIER,
  PORTAL_ROLES,
  getEffectivePermissions,
  hasPermission,
  type UserPermissions,
} from "@/lib/permissions";
import { getTenantDayRange } from "@/lib/tenant-settings";
import { roundCurrency } from "@/lib/math-utils";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/**
 * GET /api/fees/collectors
 *
 * Who may work each fee collection desk, with today's counter activity per
 * collector. Read is gated on `users` because designating collectors is a
 * user-administration concern — the desks themselves stay gated per desk.
 *
 * `todayCollected` is reconciled against the cash drawer, so the day boundary
 * follows the tenant's timezone rather than the server's.
 */
export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess(request, { module: "users", action: "read" });
    if ("response" in access) return access.response;
    const { tenantId } = access.authContext;

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, Number(searchParams.get("pageSize")) || DEFAULT_PAGE_SIZE)
    );
    const search = (searchParams.get("search") || "").trim();

    const where = {
      tenantId,
      role: { notIn: [...PORTAL_ROLES] },
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { email: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [totalCount, users, tenant] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          accessLevel: true,
          isActive: true,
          lastLoginAt: true,
          permissions: true,
        },
      }),
      prisma.tenant.findUnique({ where: { tenantId }, select: { timezone: true } }),
    ]);

    const { start, end } = getTenantDayRange(new Date(), tenant?.timezone);
    const todayWindow = { gte: start, lte: end };

    // Desk grants are computed from effective permissions, so they must be read
    // per user: they are a function of role, access level and the stored
    // override, none of which is queryable in SQL.
    const rows = users.map((user) => {
      const perms = getEffectivePermissions(
        user.role,
        user.permissions,
        user.accessLevel
      ) as UserPermissions | null;
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        accessLevel: user.accessLevel,
        isActive: user.isActive,
        lastLoginAt: user.lastLoginAt,
        posCollect: hasPermission(perms, FEE_DESK_TIER.pos, "write"),
        bulkCollect: hasPermission(perms, FEE_DESK_TIER.bulk, "write"),
      };
    });

    const pageUserIds = rows.map((row) => row.id);
    // Scoped to the page's collectors, so the aggregate rides the existing
    // (tenantId, collectedById, timestamp) index instead of scanning the day.
    const todayByCollector = pageUserIds.length
      ? await prisma.transaction.groupBy({
          by: ["collectedById"],
          where: {
            tenantId,
            isVoided: false,
            collectedById: { in: pageUserIds },
            timestamp: todayWindow,
          },
          _sum: { amountPaid: true },
          _count: { _all: true },
          _max: { timestamp: true },
        })
      : [];

    const statsByCollector = new Map(
      todayByCollector.map((stat) => [stat.collectedById, stat])
    );

    const data = rows.map((row) => {
      const stat = statsByCollector.get(row.id);
      return {
        ...row,
        todayCollected: roundCurrency(Number(stat?._sum.amountPaid ?? 0)),
        todayReceipts: stat?._count._all ?? 0,
        lastCollectedAt: stat?._max.timestamp ?? null,
      };
    });

    const totalPages = Math.ceil(totalCount / pageSize);

    return paginatedResponse(data, {
      totalCount,
      currentPage: page,
      pageSize,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
