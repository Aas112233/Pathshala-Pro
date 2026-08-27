import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAccess } from "@/lib/api-auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { handleApiError } from "@/lib/api-error";
import { createNoticeSchema } from "@/lib/schemas";

export async function GET(req: NextRequest) {
  try {
    const access = await requireApiAccess(req, {
      module: "settings",
      allowSystemAdmin: true,
    });
    if ("response" in access) return access.response;

    const { user } = access.authContext;
    if (
      user.role !== "SUPER_ADMIN" &&
      user.role !== "SYSTEM_ADMIN" &&
      user.role !== "ADMIN" &&
      user.tenantId !== "system"
    ) {
      return errorResponse("SuperAdmin access required", 403);
    }

    const broadcasts = await prisma.notice.findMany({
      where: { scope: "GLOBAL" },
      orderBy: [
        { isPinned: "desc" },
        { publishDate: "desc" },
        { createdAt: "desc" },
      ],
    });

    const activeCount = broadcasts.filter(
      (b) => b.isPublished && (!b.expiresAt || new Date(b.expiresAt) > new Date())
    ).length;

    const urgentCount = broadcasts.filter((b) => b.priority === "URGENT").length;

    return successResponse({
      broadcasts,
      metrics: {
        totalBroadcasts: broadcasts.length,
        activeBroadcasts: activeCount,
        urgentAlerts: urgentCount,
      },
    });
  } catch (error) {
    return handleApiError(error, "GET /api/system-admin/notices");
  }
}

export async function POST(req: NextRequest) {
  try {
    const access = await requireApiAccess(req, {
      module: "settings",
      allowSystemAdmin: true,
    });
    if ("response" in access) return access.response;

    const { user } = access.authContext;
    if (
      user.role !== "SUPER_ADMIN" &&
      user.role !== "SYSTEM_ADMIN" &&
      user.role !== "ADMIN" &&
      user.tenantId !== "system"
    ) {
      return errorResponse("SuperAdmin access required", 403);
    }

    const body = await req.json();
    const parsed = createNoticeSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(parsed.error.errors[0].message, 400);
    }

    const data = parsed.data;

    // Check system tenant exists
    let systemTenant = await prisma.tenant.findUnique({
      where: { tenantId: "system" },
    });

    if (!systemTenant) {
      // Find first existing tenant or create system
      const firstTenant = await prisma.tenant.findFirst();
      if (!firstTenant) {
        return errorResponse("No tenants available in database", 400);
      }
      systemTenant = firstTenant;
    }

    const broadcast = await prisma.notice.create({
      data: {
        tenantId: systemTenant.tenantId,
        scope: "GLOBAL",
        title: data.title,
        content: data.content,
        category: data.category || "SYSTEM_UPDATE",
        priority: data.priority || "NORMAL",
        audience: data.audience || "ALL_SCHOOLS",
        targetClassId: null,
        targetTenants: data.targetTenants || [],
        isPinned: data.isPinned || false,
        isPublished: data.isPublished !== undefined ? data.isPublished : true,
        publishDate: data.publishDate ? new Date(data.publishDate) : new Date(),
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        authorId: user.id,
        authorName: user.name || "Super Administrator",
        authorRole: "SUPER_ADMIN",
        attachmentUrl: data.attachmentUrl || null,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        tenantId: systemTenant.tenantId,
        userId: user.id,
        userEmail: user.email,
        action: "CREATE",
        entity: "GlobalBroadcast",
        entityId: broadcast.id,
        details: { title: broadcast.title, audience: broadcast.audience, priority: broadcast.priority },
      },
    });

    return successResponse(broadcast, "Global broadcast announced successfully", 201);
  } catch (error) {
    return handleApiError(error, "POST /api/system-admin/notices");
  }
}
