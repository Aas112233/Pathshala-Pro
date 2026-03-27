import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  paginatedResponse,
  errorResponse,
  badRequest,
  unauthorized,
  validationError,
} from "@/lib/api-response";
import { requireApiAccess } from "@/lib/api-auth";
import { MAX_PAGE_SIZE } from "@/lib/constants";
import { z } from "zod";

const createClassSchema = z.object({
  name: z.string().min(2, "Class name must be at least 2 characters"),
  classNumber: z.number().int().positive("Class number must be positive"),
  isActive: z.boolean().default(true),
});

const updateClassSchema = z.object({
  name: z.string().min(2, "Class name must be at least 2 characters").optional(),
  classNumber: z.number().int().positive("Class number must be positive").optional(),
  isActive: z.boolean().default(true).optional(),
});

/**
 * GET /api/classes
 * Get all classes with pagination
 */
export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), MAX_PAGE_SIZE);
    const search = searchParams.get("search") || "";
    const isActive = searchParams.get("isActive");

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = { tenantId };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { shortName: { contains: search, mode: "insensitive" } },
        { classId: { contains: search, mode: "insensitive" } },
      ];
    }

    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === "true";
    }

    // Get total count
    const [totalCount, classes] = await Promise.all([
      prisma.class.count({ where }),
      prisma.class.findMany({
      where,
      skip,
      take: limit,
      orderBy: { classNumber: "asc" },
      include: {
        _count: {
          select: {
            groups: true,
            sections: true,
            studentProfiles: true,
            classSubjects: true,
          },
        },
      },
    })
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return paginatedResponse(classes, {
      totalCount,
      currentPage: page,
      pageSize: limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    });
  } catch (error) {
    console.error("Get classes error:", error);
    return errorResponse("Internal server error", 500);
  }
}

/**
 * POST /api/classes
 * Create a new class
 */
export async function POST(request: NextRequest) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;

    const body = await request.json();
    const validation = createClassSchema.safeParse(body);

    if (!validation.success) {
      const errors = validation.error.errors.map((err) => ({
        field: err.path.join("."),
        code: err.code,
        message: err.message,
      }));
      return validationError(errors);
    }

    const data = validation.data;

    // Check if classNumber already exists for this tenant
    const existingClass = await prisma.class.findFirst({
      where: { tenantId, classNumber: data.classNumber },
    });

    if (existingClass) {
      return badRequest("Class number already exists", [
        { field: "classNumber", code: "duplicate", message: "A class with this number already exists" },
      ]);
    }

    // Auto-generate class ID
    const latestClass = await prisma.class.findFirst({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    });

    let nextNumber = 1;
    if (latestClass && latestClass.classId.startsWith("CLS-")) {
      const parts = latestClass.classId.split("-");
      const lastNum = parseInt(parts[1], 10);
      if (!isNaN(lastNum)) {
        nextNumber = lastNum + 1;
      }
    }

    const classId = `CLS-${nextNumber.toString().padStart(3, "0")}`;

    const newClass = await prisma.class.create({
      data: {
        tenantId,
        classId,
        ...data,
      },
      select: {
        id: true,
        classId: true,
        name: true,
        classNumber: true,
        isActive: true,
        createdAt: true,
      },
    });

    return successResponse(newClass, "Class created successfully", 201);
  } catch (error) {
    console.error("Create class error:", error);
    return errorResponse("Internal server error", 500);
  }
}
