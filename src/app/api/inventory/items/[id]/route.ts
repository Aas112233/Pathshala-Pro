import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, notFound, validationError, handleApiError, badRequest } from "@/lib/api-response";
import { updateInventoryItemSchema } from "@/lib/schemas";
import { requireApiAccess } from "@/lib/api-auth";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;
    const { tenantId } = access.authContext;
    const { id } = await params;
    const existing = await prisma.inventoryItem.findFirst({ where: { id, tenantId } });
    if (!existing) return notFound("Item not found");
    const body = await request.json();
    const parsed = updateInventoryItemSchema.safeParse(body);
    if (!parsed.success) {
      const errors = parsed.error.errors.map((e) => ({ field: e.path.join("."), code: e.code, message: e.message }));
      return validationError(errors);
    }
    const d = parsed.data;
    if (d.code && d.code !== existing.code) {
      const dup = await prisma.inventoryItem.findFirst({ where: { tenantId, code: d.code, id: { not: id } } });
      if (dup) return badRequest("Code already exists");
    }
    const updated = await prisma.inventoryItem.update({
      where: { id },
      data: {
        ...(d.name !== undefined && { name: d.name }),
        ...(d.code !== undefined && { code: d.code }),
        ...(d.category !== undefined && { category: d.category }),
        ...(d.unit !== undefined && { unit: d.unit }),
        ...(d.quantity !== undefined && { quantity: d.quantity }),
        ...(d.minStockLevel !== undefined && { minStockLevel: d.minStockLevel }),
        ...(d.location !== undefined && { location: d.location || null }),
        ...(d.costPrice !== undefined && { costPrice: d.costPrice }),
        ...(d.isActive !== undefined && { isActive: d.isActive }),
      },
    });
    return successResponse(updated, "Item updated");
  } catch (e: any) { if (e?.code === "P2002") return badRequest("Duplicate"); return handleApiError(e); }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;
    const { tenantId } = access.authContext;
    const { id } = await params;
    const existing = await prisma.inventoryItem.findFirst({ where: { id, tenantId } });
    if (!existing) return notFound("Item not found");
    await prisma.inventoryTransaction.deleteMany({ where: { itemId: id, tenantId } });
    await prisma.inventoryItem.delete({ where: { id } });
    return successResponse(null, "Item deleted");
  } catch (e) { return handleApiError(e); }
}
