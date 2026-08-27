import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAccess } from "@/lib/api-auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { handleApiError } from "@/lib/api-error";
import { updateNoticeSchema } from "@/lib/schemas";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const existing = await prisma.notice.findUnique({
      where: { id },
    });

    if (!existing || existing.scope !== "GLOBAL") {
      return errorResponse("Broadcast not found", 404);
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
        ...(data.targetTenants && { targetTenants: data.targetTenants }),
        ...(data.isPinned !== undefined && { isPinned: data.isPinned }),
        ...(data.isPublished !== undefined && { isPublished: data.isPublished }),
        ...(data.publishDate && { publishDate: new Date(data.publishDate) }),
        ...(data.expiresAt !== undefined && {
          expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        }),
      },
    });

    return successResponse(updated, "Broadcast updated successfully");
  } catch (error) {
    return handleApiError(error, "PUT /api/system-admin/notices/[id]");
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    await prisma.notice.delete({
      where: { id },
    });

    return successResponse({ id }, "Broadcast deleted successfully");
  } catch (error) {
    return handleApiError(error, "DELETE /api/system-admin/notices/[id]");
  }
}
