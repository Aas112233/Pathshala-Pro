import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, paginatedResponse, errorResponse, validationError, handleApiError } from "@/lib/api-response";
import { createHomeworkSchema } from "@/lib/schemas";
import { requireApiAccess } from "@/lib/api-auth";
import { smartRateLimit, dedupeRequest } from "@/lib/rate-limit";
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
    const classId = searchParams.get("classId") || "";
    const sectionId = searchParams.get("sectionId") || "";
    const subjectId = searchParams.get("subjectId") || "";
    const where: any = { tenantId };
    if (classId) where.classId = classId;
    if (sectionId) where.sectionId = sectionId;
    if (subjectId) where.subjectId = subjectId;
    if (search) where.title = { contains: search, mode: "insensitive" };
    const skip = (page - 1) * limit;
    const [totalCount, data] = await Promise.all([
      prisma.homework.count({ where }),
      prisma.homework.findMany({
        where,
        skip,
        take: limit,
        orderBy: { dueDate: "asc" },
        include: {
          class: { select: { id: true, name: true } },
          section: { select: { id: true, name: true } },
          subject: { select: { id: true, name: true, code: true } },
          _count: { select: { submissions: true } },
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
    const { tenantId, user } = access.authContext as any;
    const body = await request.json();
    const parsed = createHomeworkSchema.safeParse(body);
    if (!parsed.success) {
      const errors = parsed.error.errors.map((er) => ({ field: er.path.join("."), code: er.code, message: er.message }));
      return validationError(errors);
    }
    const d = parsed.data;

    // 1. Duplicate prevention
    const dedupeKey = `HW_CREATE_${tenantId}_${d.classId}_${d.title}`;
    if (!dedupeRequest(dedupeKey, 3000)) {
      return errorResponse("Duplicate homework assignment detected. Please wait a moment.", 409);
    }

    // 2. Adaptive rate limiting
    const rateCheck = smartRateLimit(`HW_MUT_${tenantId}_${user.id}`, { preset: "mutation" });
    if (!rateCheck.success) {
      return errorResponse("Too many homework creation requests. Please slow down.", 429);
    }

    const hw = await prisma.homework.create({
      data: {
        tenantId,
        classId: d.classId,
        sectionId: d.sectionId || null,
        subjectId: d.subjectId || null,
        title: d.title,
        description: d.description,
        attachmentUrl: d.attachmentUrl || null,
        dueDate: new Date(d.dueDate),
        createdById: user.id,
      },
    });
    return successResponse(hw, "Homework created", 201);
  } catch (e) { return handleApiError(e); }
}
