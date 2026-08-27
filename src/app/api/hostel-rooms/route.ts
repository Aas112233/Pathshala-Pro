import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, paginatedResponse, badRequest, validationError, handleApiError } from "@/lib/api-response";
import { createHostelRoomSchema } from "@/lib/schemas";
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
    const hostelId = searchParams.get("hostelId") || "";
    const where: any = { tenantId };
    if (hostelId) where.hostelId = hostelId;
    if (search) where.roomNumber = { contains: search, mode: "insensitive" };
    const skip = (page - 1) * limit;
    const [totalCount, data] = await Promise.all([
      prisma.hostelRoom.count({ where }),
      prisma.hostelRoom.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: { hostel: { select: { name: true } }, _count: { select: { allocations: true } } },
      }),
    ]);
    // Add occupancy info
    const withOccupancy = data.map((r: any) => ({ ...r, occupancy: r._count.allocations, available: r.capacity - r._count.allocations }));
    const totalPages = Math.ceil(totalCount / limit);
    return paginatedResponse(withOccupancy, { totalCount, currentPage: page, pageSize: limit, totalPages, hasNextPage: page < totalPages, hasPreviousPage: page > 1 });
  } catch (e) { return handleApiError(e); }
}

export async function POST(request: NextRequest) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;
    const { tenantId } = access.authContext;
    const body = await request.json();
    const parsed = createHostelRoomSchema.safeParse(body);
    if (!parsed.success) {
      const errors = parsed.error.errors.map((er) => ({ field: er.path.join("."), code: er.code, message: er.message }));
      return validationError(errors);
    }
    const d = parsed.data;
    const hostel = await prisma.hostel.findFirst({ where: { id: d.hostelId, tenantId } });
    if (!hostel) return badRequest("Hostel not found");
    const dup = await prisma.hostelRoom.findFirst({ where: { tenantId, hostelId: d.hostelId, roomNumber: d.roomNumber } });
    if (dup) return badRequest("Room number already exists in this hostel", [{ field: "roomNumber", code: "duplicate", message: "Room already exists" }]);
    const room = await prisma.hostelRoom.create({
      data: { tenantId, hostelId: d.hostelId, roomNumber: d.roomNumber, floor: d.floor ?? 1, capacity: d.capacity ?? 4, roomType: d.roomType ?? "GENERAL", isActive: d.isActive ?? true },
    });
    return successResponse(room, "Room created", 201);
  } catch (e: any) { if (e?.code === "P2002") return badRequest("Duplicate room"); return handleApiError(e); }
}
