import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAccess } from "@/lib/api-auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { handleApiError } from "@/lib/api-error";
import { updateNoticeSchema } from "@/lib/schemas";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireApiAccess(req, { module: "notices" });
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;
    const { id } = await params;

    const notice = await prisma.notice.findFirst({
      where: {
        id,
        OR: [
          { tenantId },
          { scope: "GLOBAL" },
        ],
      },
    });

    if (!notice) {
      return errorResponse("Notice not found", 404);
    }

    // Increment view count asynchronously
    await prisma.notice.update({
      where: { id },
      data: { viewsCount: { increment: 1 } },
    });

    return successResponse(notice);
  } catch (error) {
    return handleApiError(error, "GET /api/notices/[id]");
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireApiAccess(req, { module: "notices" });
    if ("response" in access) return access.response;

    const { tenantId, user } = access.authContext;
    const { id } = await params;

    const existing = await prisma.notice.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return errorResponse("Notice not found or permission denied", 404);
    }

    const body = await req.json();
    const parsed = updateNoticeSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(parsed.error.errors[0].message, 400);
    }

    const data = parsed.data;

    const updated = await prisma.notice.update({
      where: { id },
      data: {
        ...(data.title && { title: data.title }),
        ...(data.content && { content: data.content }),
        ...(data.category && { category: data.category }),
        ...(data.priority && { priority: data.priority }),
        ...(data.audience && { audience: data.audience }),
        ...(data.targetClassId !== undefined && { targetClassId: data.targetClassId }),
        ...(data.isPinned !== undefined && { isPinned: data.isPinned }),
        ...(data.isPublished !== undefined && { isPublished: data.isPublished }),
        ...(data.publishDate && { publishDate: new Date(data.publishDate) }),
        ...(data.expiresAt !== undefined && {
          expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        }),
        ...(data.attachmentUrl !== undefined && { attachmentUrl: data.attachmentUrl }),
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        tenantId,
        userId: user.id,
        userEmail: user.email,
        action: "UPDATE",
        entity: "Notice",
        entityId: id,
        details: { title: updated.title },
      },
    });

    return successResponse(updated, "Notice updated successfully");
  } catch (error) {
    return handleApiError(error, "PUT /api/notices/[id]");
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireApiAccess(req, { module: "notices" });
    if ("response" in access) return access.response;

    const { tenantId, user } = access.authContext;
    const { id } = await params;

    const existing = await prisma.notice.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return errorResponse("Notice not found or permission denied", 404);
    }

    await prisma.notice.delete({
      where: { id },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        tenantId,
        userId: user.id,
        userEmail: user.email,
        action: "DELETE",
        entity: "Notice",
        entityId: id,
        details: { title: existing.title },
      },
    });

    return successResponse({ id }, "Notice deleted successfully");
  } catch (error) {
    return handleApiError(error, "DELETE /api/notices/[id]");
  }
}
