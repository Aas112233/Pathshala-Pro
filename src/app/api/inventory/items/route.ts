import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, paginatedResponse, badRequest, validationError, handleApiError } from "@/lib/api-response";
import { createInventoryItemSchema } from "@/lib/schemas";
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
    const category = searchParams.get("category") || "";
    const where: any = { tenantId };
    if (category) where.category = category;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { code: { contains: search, mode: "insensitive" } },
      ];
    }
    const skip = (page - 1) * limit;
    const [totalCount, data] = await Promise.all([
      prisma.inventoryItem.count({ where }),
      prisma.inventoryItem.findMany({ where, skip, take: limit, orderBy: { createdAt: "desc" } }),
    ]);
    const totalPages = Math.ceil(totalCount / limit);
    return paginatedResponse(data, { totalCount, currentPage: page, pageSize: limit, totalPages, hasNextPage: page < totalPages, hasPreviousPage: page > 1 });
  } catch (e) { return handleApiError(e); }
}

export async function POST(request: NextRequest) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;
    const { tenantId } = access.authContext;
    const body = await request.json();
    const parsed = createInventoryItemSchema.safeParse(body);
    if (!parsed.success) {
      const errors = parsed.error.errors.map((er) => ({ field: er.path.join("."), code: er.code, message: er.message }));
      return validationError(errors);
    }
    const d = parsed.data;
    const dup = await prisma.inventoryItem.findFirst({ where: { tenantId, code: d.code } });
    if (dup) return badRequest("Code already exists", [{ field: "code", code: "duplicate", message: "Code already exists" }]);
    const item = await prisma.inventoryItem.create({
      data: {
        tenantId,
        name: d.name,
        code: d.code,
        category: d.category ?? "GENERAL",
        unit: d.unit ?? "PCS",
        quantity: d.quantity ?? 0,
        minStockLevel: d.minStockLevel ?? 10,
        location: d.location || null,
        costPrice: d.costPrice ?? 0,
        isActive: d.isActive ?? true,
      },
    });
    return successResponse(item, "Item created", 201);
  } catch (e: any) { if (e?.code === "P2002") return badRequest("Duplicate code"); return handleApiError(e); }
}
