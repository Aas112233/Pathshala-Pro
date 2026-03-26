import { hasPermission } from "@/lib/permissions";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  paginatedResponse,
  errorResponse,
  badRequest,
  unauthorized,
  validationError,
  notFound,
} from "@/lib/api-response";
import { getAuthContext } from "@/lib/auth";
import { MAX_PAGE_SIZE } from "@/lib/constants";
import { z } from "zod";

export const runtime = 'edge';

const createGroupSchema = z.object({
  classId: z.string().min(1, "Class is required"),
  name: z.string().min(2, "Group name must be at least 2 characters"),
  shortName: z.string().min(1, "Short name is required"),
  subjects: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
});

const updateGroupSchema = createGroupSchema.partial();

/**
 * GET /api/groups
 * Get all groups with pagination
 */
export async function GET(request: NextRequest) {
  try {
    const authContext = await getAuthContext(request);
    if (!authContext) {
      return unauthorized("Authentication required");
    }

    const { tenantId } = authContext;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), MAX_PAGE_SIZE);
    const search = searchParams.get("search") || "";
    const classId = searchParams.get("classId") || undefined;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = { tenantId };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { shortName: { contains: search, mode: "insensitive" } },
      ];
    }

    if (classId) {
      where.classId = classId;
    }

    // Get total count
    const totalCount = await prisma.group.count({ where });

    // Get groups
    const groups = await prisma.group.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        class: {
          select: {
            name: true,
          },
        },
        _count: {
          select: {
            sections: true,
          },
        },
      },
    });

    const totalPages = Math.ceil(totalCount / limit);

    return paginatedResponse(groups, {
      totalCount,
      currentPage: page,
      pageSize: limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    });
  } catch (error) {
    console.error("Get groups error:", error);
    return errorResponse("Internal server error", 500);
  }
}

/**
 * POST /api/groups
 * Create a new group
 */
export async function POST(request: NextRequest) {
  try {
    const authContext = await getAuthContext(request);
    if (!authContext) {
      return unauthorized("Authentication required");
    }

    const { tenantId } = authContext;

    const body = await request.json();
    const validation = createGroupSchema.safeParse(body);

    if (!validation.success) {
      const errors = validation.error.errors.map((err) => ({
        field: err.path.join("."),
        code: err.code,
        message: err.message,
      }));
      return validationError(errors);
    }

    const data = validation.data;

    // Check if class exists
    const classExists = await prisma.class.findFirst({
      where: { id: data.classId, tenantId },
    });

    if (!classExists) {
      return notFound("Class not found");
    }

    // Auto-generate group ID
    const latestGroup = await prisma.group.findFirst({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    });

    let nextNumber = 1;
    if (latestGroup && latestGroup.groupId.startsWith("GRP-")) {
      const parts = latestGroup.groupId.split("-");
      const lastNum = parseInt(parts[1], 10);
      if (!isNaN(lastNum)) {
        nextNumber = lastNum + 1;
      }
    }

    const groupId = `GRP-${nextNumber.toString().padStart(3, "0")}`;

    const newGroup = await prisma.group.create({
      data: {
        tenantId,
        groupId,
        ...data,
      },
      select: {
        id: true,
        groupId: true,
        name: true,
        shortName: true,
        subjects: true,
        isActive: true,
        class: {
          select: {
            name: true,
          },
        },
        createdAt: true,
      },
    });

    return successResponse(newGroup, "Group created successfully", 201);
  } catch (error) {
    console.error("Create group error:", error);
    return errorResponse("Internal server error", 500);
  }
}
