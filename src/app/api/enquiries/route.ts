import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  paginatedResponse,
  badRequest,
  validationError,
  handleApiError,
} from "@/lib/api-response";
import { createEnquirySchema } from "@/lib/schemas";
import { requireApiAccess } from "@/lib/api-auth";
import { MAX_PAGE_SIZE } from "@/lib/constants";

/**
 * GET /api/enquiries
 * Query: page, limit, search, status, source, classAppliedId, followUpFrom, followUpTo
 */
export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const search = searchParams.get("search")?.trim() || "";
    const status = searchParams.get("status") || "";
    const source = searchParams.get("source") || "";
    const classAppliedId = searchParams.get("classAppliedId") || "";
    const followUpFrom = searchParams.get("followUpFrom");
    const followUpTo = searchParams.get("followUpTo");

    const where: any = { tenantId };
    if (status) where.status = status;
    if (source) where.source = source;
    if (classAppliedId) where.classAppliedId = classAppliedId;
    if (followUpFrom || followUpTo) {
      where.followUpDate = {};
      if (followUpFrom) where.followUpDate.gte = new Date(followUpFrom);
      if (followUpTo) where.followUpDate.lte = new Date(followUpTo);
    }
    if (search) {
      where.OR = [
        { studentName: { contains: search, mode: "insensitive" } },
        { guardianName: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    const skip = (page - 1) * limit;
    const [totalCount, data] = await Promise.all([
      prisma.enquiry.count({ where }),
      prisma.enquiry.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ followUpDate: "asc" }, { createdAt: "desc" }],
        include: {
          classApplied: { select: { id: true, name: true, classId: true } },
        },
      }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);
    return paginatedResponse(data, {
      totalCount,
      currentPage: page,
      pageSize: limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/enquiries
 */
export async function POST(request: NextRequest) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;
    const body = await request.json();
    const parsed = createEnquirySchema.safeParse(body);
    if (!parsed.success) {
      const errors = parsed.error.errors.map((e) => ({
        field: e.path.join("."),
        code: e.code,
        message: e.message,
      }));
      return validationError(errors);
    }

    const d = parsed.data;

    if (d.classAppliedId) {
      const cls = await prisma.class.findFirst({ where: { id: d.classAppliedId, tenantId } });
      if (!cls) return badRequest("Class not found", [{ field: "classAppliedId", code: "not_found", message: "Class not found" }]);
    }

    const enquiry = await prisma.enquiry.create({
      data: {
        tenantId,
        studentName: d.studentName,
        guardianName: d.guardianName,
        phone: d.phone,
        email: d.email || null,
        classAppliedId: d.classAppliedId || null,
        source: d.source ?? "WALK_IN",
        status: d.status ?? "NEW",
        followUpDate: d.followUpDate ? new Date(d.followUpDate) : null,
        notes: d.notes || null,
        assignedToId: d.assignedToId || null,
      },
      include: { classApplied: { select: { id: true, name: true } } },
    });

    return successResponse(enquiry, "Enquiry created", 201);
  } catch (error) {
    return handleApiError(error);
  }
}
