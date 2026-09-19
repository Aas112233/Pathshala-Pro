import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  errorResponse,
  unauthorized,
  notFound,
  badRequest,
  validationError,
  handleApiError,
} from "@/lib/api-response";
import { createSubjectSchema } from "@/lib/schemas";
import { requireApiAccess } from "@/lib/api-auth";
import { fastCache } from "@/lib/fast-memory-cache";

/**
 * GET /api/subjects
 * Get all subjects
 */
export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;
    const { searchParams } = new URL(request.url);
    const isActive = searchParams.get("isActive");
    const classId = searchParams.get("classId");

    const cacheKey = `subjects:${tenantId}:${isActive}:${classId || ""}`;
    const cachedSubjects = fastCache.get<any[]>(cacheKey);
    if (cachedSubjects) {
      return successResponse(cachedSubjects, "Subjects retrieved successfully");
    }

    const where: any = { tenantId };

    if (isActive !== null) {
      where.isActive = isActive === "true";
    }

    if (classId) {
      where.classSubjects = {
        some: { classId, tenantId },
      };
    }

    const subjects = await prisma.subject.findMany({
      where,
      orderBy: { name: "asc" },
    });

    fastCache.set(cacheKey, subjects, 60);

    return successResponse(subjects, "Subjects retrieved successfully");
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/subjects
 * Create a new subject
 */
export async function POST(request: NextRequest) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;
    const body = await request.json();
    const validation = createSubjectSchema.safeParse(body);

    if (!validation.success) {
      const errors = validation.error.errors.map((err) => ({
        field: err.path.join("."),
        code: err.code,
        message: err.message,
      }));
      return validationError(errors);
    }

    const data = validation.data;

    // Check if subject ID already exists
    const existingSubject = await prisma.subject.findFirst({
      where: { tenantId, subjectId: data.subjectId },
    });

    if (existingSubject) {
      return badRequest("Subject already exists", [
        { field: "subjectId", code: "duplicate", message: "Subject ID already exists" },
      ]);
    }

    const subject = await prisma.subject.create({
      data: {
        tenantId,
        ...data,
      },
    });

    fastCache.invalidatePrefix(`subjects:${tenantId}`);

    return successResponse(subject, "Subject created successfully", 201);
  } catch (error) {
    return handleApiError(error);
  }
}
