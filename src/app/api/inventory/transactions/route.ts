import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, paginatedResponse, validationError, handleApiError, badRequest } from "@/lib/api-response";
import { createInventoryTransactionSchema } from "@/lib/schemas";
import { requireApiAccess } from "@/lib/api-auth";
import { MAX_PAGE_SIZE } from "@/lib/constants";

export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;
    const { tenantId } = access.authContext;
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const search = searchParams.get("search")?.trim() || "";
    const type = searchParams.get("type") || "";
    const itemId = searchParams.get("itemId") || "";
    const where: any = { tenantId };
    if (type) where.transactionType = type;
    if (itemId) where.itemId = itemId;
    if (search) {
      where.OR = [
        { reference: { contains: search, mode: "insensitive" } },
        { notes: { contains: search, mode: "insensitive" } },
        { item: { name: { contains: search, mode: "insensitive" } } },
      ];
    }
    const skip = (page - 1) * limit;
    const [totalCount, data] = await Promise.all([
      prisma.inventoryTransaction.count({ where }),
      prisma.inventoryTransaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: { item: { select: { id: true, name: true, code: true } } },
      }),
    ]);
    const totalPages = Math.ceil(totalCount / limit);
    return paginatedResponse(data, { totalCount, currentPage: page, pageSize: limit, totalPages, hasNextPage: page < totalPages, hasPreviousPage: page > 1 });
  } catch (e) { return handleApiError(e); }
}

export async function POST(request: NextRequest) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;
    const { tenantId, user } = access.authContext as any;
    const body = await request.json();
    const parsed = createInventoryTransactionSchema.safeParse(body);
    if (!parsed.success) {
      const errors = parsed.error.errors.map((er) => ({ field: er.path.join("."), code: er.code, message: er.message }));
      return validationError(errors);
    }
    const d = parsed.data;
    const item = await prisma.inventoryItem.findFirst({ where: { id: d.itemId, tenantId } });
    if (!item) return badRequest("Item not found");

    // Calculate stock delta
    let delta = 0;
    if (d.transactionType === "PURCHASE" || d.transactionType === "RETURN") delta = d.quantity;
    else if (d.transactionType === "ISSUE") delta = -d.quantity;
    else if (d.transactionType === "ADJUSTMENT") delta = d.quantity; // allow positive/negative via quantity sign? For now treat as +

    const tx = await prisma.$transaction(async (db) => {
      const updated = await db.inventoryItem.updateMany({
        where: { id: d.itemId, tenantId, ...(delta < 0 ? { quantity: { gte: Math.abs(delta) } } : {}) },
        data: { quantity: { increment: delta } },
      });
      if (updated.count !== 1) throw new Error(`Insufficient stock; only ${item.quantity} available`);
      return db.inventoryTransaction.create({
        data: {
          tenantId,
          itemId: d.itemId,
          transactionType: d.transactionType ?? "PURCHASE",
          quantity: d.quantity,
          unitCost: d.unitCost ?? null,
          reference: d.reference || null,
          notes: d.notes || null,
          performedById: user.id,
        },
      });
    });

    return successResponse(tx, "Transaction recorded", 201);
  } catch (e) { return handleApiError(e); }
}
