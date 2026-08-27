import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAccess } from "@/lib/api-auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { handleApiError } from "@/lib/api-error";
import { createNoticeSchema } from "@/lib/schemas";

export async function GET(req: NextRequest) {
  try {
    const access = await requireApiAccess(req, { module: "notices" });
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;
    const { searchParams } = new URL(req.url);

    const search = searchParams.get("search") || "";
    const category = searchParams.get("category") || "";
    const priority = searchParams.get("priority") || "";
    const audience = searchParams.get("audience") || "";
    const isPinned = searchParams.get("isPinned");
    const activeOnly = searchParams.get("activeOnly") === "true";

    const where: any = {
      OR: [
        { tenantId, scope: "TENANT" },
        {
          scope: "GLOBAL",
          isPublished: true,
          OR: [
            { audience: "ALL_SCHOOLS" },
            { targetTenants: { has: tenantId } },
          ],
        },
      ],
    };

    if (activeOnly) {
      where.isPublished = true;
      where.OR = [
        ...where.OR,
        {
          expiresAt: null,
        },
        {
          expiresAt: { gte: new Date() },
        },
      ];
    }

    if (category) {
      where.category = category;
    }

    if (priority) {
      where.priority = priority;
    }

    if (audience) {
      where.audience = audience;
    }

    if (isPinned !== null && isPinned !== undefined && isPinned !== "") {
      where.isPinned = isPinned === "true";
    }

    if (search) {
      where.AND = [
        {
          OR: [
            { title: { contains: search, mode: "insensitive" } },
            { content: { contains: search, mode: "insensitive" } },
            { authorName: { contains: search, mode: "insensitive" } },
          ],
        },
      ];
    }

    const notices = await prisma.notice.findMany({
      where,
      orderBy: [
        { isPinned: "desc" },
        { publishDate: "desc" },
        { createdAt: "desc" },
      ],
    });

    return successResponse(notices);
  } catch (error) {
    return handleApiError(error, "GET /api/notices");
  }
}

export async function POST(req: NextRequest) {
  try {
    const access = await requireApiAccess(req, { module: "notices" });
    if ("response" in access) return access.response;

    const { tenantId, user } = access.authContext;
    const body = await req.json();
    const parsed = createNoticeSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(parsed.error.errors[0].message, 400);
    }

    const data = parsed.data;

    const notice = await prisma.notice.create({
      data: {
        tenantId,
        scope: "TENANT",
        title: data.title,
        content: data.content,
        category: data.category,
        priority: data.priority,
        audience: data.audience,
        targetClassId: data.targetClassId || null,
        targetTenants: [],
        isPinned: data.isPinned || false,
        isPublished: data.isPublished !== undefined ? data.isPublished : true,
        publishDate: data.publishDate ? new Date(data.publishDate) : new Date(),
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        authorId: user.id,
        authorName: user.name || "Administrator",
        authorRole: user.role,
        attachmentUrl: data.attachmentUrl || null,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        tenantId,
        userId: user.id,
        userEmail: user.email,
        action: "CREATE",
        entity: "Notice",
        entityId: notice.id,
        details: { title: notice.title, category: notice.category, priority: notice.priority },
      },
    });

    return successResponse(notice, "Notice published successfully", 201);
  } catch (error) {
    return handleApiError(error, "POST /api/notices");
  }
}
