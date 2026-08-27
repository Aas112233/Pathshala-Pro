import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, notFound, handleApiError } from "@/lib/api-response";
import { requireApiAccess } from "@/lib/api-auth";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;
    const { tenantId } = access.authContext;
    const { id } = await params;
    const existing = await prisma.inventoryTransaction.findFirst({ where: { id, tenantId }, include: { item: true } });
    if (!existing) return notFound("Transaction not found");

    // Revert stock
    let revertDelta = 0;
    if (existing.transactionType === "PURCHASE" || existing.transactionType === "RETURN") revertDelta = -existing.quantity;
    else if (existing.transactionType === "ISSUE") revertDelta = existing.quantity;
    else if (existing.transactionType === "ADJUSTMENT") revertDelta = -existing.quantity;

    await prisma.$transaction([
      prisma.inventoryTransaction.delete({ where: { id } }),
      prisma.inventoryItem.update({ where: { id: existing.itemId }, data: { quantity: { increment: revertDelta } } }),
    ]);

    return successResponse(null, "Transaction deleted and stock reverted");
  } catch (e) { return handleApiError(e); }
}
