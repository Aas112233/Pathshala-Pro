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

const createSectionSchema = z.object({
  classId: z.string().min(1, "Class is required"),
  groupId: z.string().optional(),
  name: z.string().min(2, "Section name must be at least 2 characters"),
  shortName: z.string().min(1, "Short name is required"),
  capacity: z.number().int().positive().optional(),
  roomNumber: z.string().optional(),
  isActive: z.boolean().default(true),
});

const updateSectionSchema = createSectionSchema.partial();

/**
 * GET /api/sections
 * Get all sections with pagination
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
    const groupId = searchParams.get("groupId") || undefined;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = { tenantId };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { shortName: { contains: search, mode: "insensitive" } },
        { roomNumber: { contains: search, mode: "insensitive" } },
      ];
    }

    if (classId) {
      where.classId = classId;
    }

    if (groupId) {
      where.groupId = groupId;
    }

    // Get total count
    const totalCount = await prisma.section.count({ where });

    // Get sections
    const sections = await prisma.section.findMany({
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
        group: {
          select: {
            name: true,
            shortName: true,
          },
        },
      },
    });

    const totalPages = Math.ceil(totalCount / limit);

    return paginatedResponse(sections, {
      totalCount,
      currentPage: page,
      pageSize: limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    });
  } catch (error) {
    console.error("Get sections error:", error);
    return errorResponse("Internal server error", 500);
  }
}

/**
 * POST /api/sections
 * Create a new section
 */
export async function POST(request: NextRequest) {
  try {
    const authContext = await getAuthContext(request);
    if (!authContext) {
      return unauthorized("Authentication required");
    }

    const { tenantId } = authContext;

    const body = await request.json();
    const validation = createSectionSchema.safeParse(body);

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

    // If group is provided, check if it exists
    if (data.groupId) {
      const groupExists = await prisma.group.findFirst({
        where: { id: data.groupId, tenantId },
      });
      if (!groupExists) {
        return notFound("Group not found");
      }
    }

    // Auto-generate section ID
    const latestSection = await prisma.section.findFirst({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    });

    let nextNumber = 1;
    if (latestSection && latestSection.sectionId.startsWith("SEC-")) {
      const parts = latestSection.sectionId.split("-");
      const lastNum = parseInt(parts[1], 10);
      if (!isNaN(lastNum)) {
        nextNumber = lastNum + 1;
      }
    }

    const sectionId = `SEC-${nextNumber.toString().padStart(3, "0")}`;

    const newSection = await prisma.section.create({
      data: {
        tenantId,
        sectionId,
        ...data,
      },
      select: {
        id: true,
        sectionId: true,
        name: true,
        shortName: true,
        capacity: true,
        roomNumber: true,
        isActive: true,
        class: {
          select: {
            name: true,
          },
        },
        group: {
          select: {
            name: true,
            shortName: true,
          },
        },
        createdAt: true,
      },
    });

    return successResponse(newSection, "Section created successfully", 201);
  } catch (error) {
    console.error("Create section error:", error);
    return errorResponse("Internal server error", 500);
  }
}
