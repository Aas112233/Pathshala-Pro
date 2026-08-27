import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, paginatedResponse, badRequest, validationError, handleApiError } from "@/lib/api-response";
import { createHostelAllocationSchema } from "@/lib/schemas";
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
    const roomId = searchParams.get("roomId") || "";
    const status = searchParams.get("status") || "";
    const where: any = { tenantId };
    if (hostelId) where.hostelId = hostelId;
    if (roomId) where.roomId = roomId;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { studentProfile: { firstName: { contains: search, mode: "insensitive" } } },
        { studentProfile: { lastName: { contains: search, mode: "insensitive" } } },
        { bedNumber: { contains: search, mode: "insensitive" } },
      ];
    }
    const skip = (page - 1) * limit;
    const [totalCount, data] = await Promise.all([
      prisma.hostelAllocation.count({ where }),
      prisma.hostelAllocation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          studentProfile: { select: { id: true, firstName: true, lastName: true, rollNumber: true } },
          hostel: { select: { name: true } },
          room: { select: { roomNumber: true, capacity: true } },
        },
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
    const { tenantId } = access.authContext;
    const body = await request.json();
    const parsed = createHostelAllocationSchema.safeParse(body);
    if (!parsed.success) {
      const errors = parsed.error.errors.map((er) => ({ field: er.path.join("."), code: er.code, message: er.message }));
      return validationError(errors);
    }
    const d = parsed.data;
    const student = await prisma.studentProfile.findFirst({ where: { id: d.studentProfileId, tenantId } });
    if (!student) return badRequest("Student not found");
    const dup = await prisma.hostelAllocation.findFirst({ where: { tenantId, studentProfileId: d.studentProfileId, status: "ACTIVE" } });
    if (dup) return badRequest("Student already allocated", [{ field: "studentProfileId", code: "already_allocated", message: "Student already has an active hostel allocation" }]);
    const room = await prisma.hostelRoom.findFirst({ where: { id: d.roomId, tenantId } });
    if (!room) return badRequest("Room not found");
    if (d.hostelId !== room.hostelId) return badRequest("Room does not belong to selected hostel");
    const occupancy = await prisma.hostelAllocation.count({ where: { roomId: d.roomId, tenantId, status: "ACTIVE" } });
    if (occupancy >= room.capacity) return badRequest("Room is full", [{ field: "roomId", code: "room_full", message: `Room capacity ${room.capacity} reached` }]);

    const allocation = await prisma.hostelAllocation.create({
      data: {
        tenantId,
        hostelId: d.hostelId,
        roomId: d.roomId,
        studentProfileId: d.studentProfileId,
        bedNumber: d.bedNumber || null,
        status: "ACTIVE",
      },
      include: { studentProfile: { select: { firstName: true, lastName: true } }, room: { select: { roomNumber: true } } },
    });
    return successResponse(allocation, "Student allocated", 201);
  } catch (e: any) { if (e?.code === "P2002") return badRequest("Already allocated"); return handleApiError(e); }
}
