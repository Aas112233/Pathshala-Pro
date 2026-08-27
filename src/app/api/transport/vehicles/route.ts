import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, paginatedResponse, badRequest, validationError, handleApiError } from "@/lib/api-response";
import { createVehicleSchema } from "@/lib/schemas";
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
    const where: any = { tenantId };
    if (search) {
      where.OR = [
        { vehicleNo: { contains: search, mode: "insensitive" } },
        { driverName: { contains: search, mode: "insensitive" } },
      ];
    }
    const skip = (page - 1) * limit;
    const [totalCount, data] = await Promise.all([
      prisma.transportVehicle.count({ where }),
      prisma.transportVehicle.findMany({ where, skip, take: limit, orderBy: { createdAt: "desc" }, include: { _count: { select: { allocations: true } } } }),
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
    const parsed = createVehicleSchema.safeParse(body);
    if (!parsed.success) {
      const errors = parsed.error.errors.map((er) => ({ field: er.path.join("."), code: er.code, message: er.message }));
      return validationError(errors);
    }
    const d = parsed.data;
    const dup = await prisma.transportVehicle.findFirst({ where: { tenantId, vehicleNo: d.vehicleNo } });
    if (dup) return badRequest("Vehicle number already exists", [{ field: "vehicleNo", code: "duplicate", message: "Vehicle number already exists" }]);
    const v = await prisma.transportVehicle.create({ data: { tenantId, vehicleNo: d.vehicleNo, type: d.type ?? "BUS", capacity: d.capacity, driverName: d.driverName || null, driverPhone: d.driverPhone || null, isActive: d.isActive ?? true } });
    return successResponse(v, "Vehicle created", 201);
  } catch (e: any) { if (e?.code === "P2002") return badRequest("Duplicate vehicle"); return handleApiError(e); }
}
