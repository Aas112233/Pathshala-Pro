import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  errorResponse,
  unauthorized,
  notFound,
  badRequest,
  validationError,
} from "@/lib/api-response";
import { createSubjectSchema } from "@/lib/schemas";
import { requireApiAccess } from "@/lib/api-auth";

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

    const where: any = { tenantId };

    if (isActive !== null) {
      where.isActive = isActive === "true";
    }

    const subjects = await prisma.subject.findMany({
      where,
      orderBy: { name: "asc" },
    });

    return successResponse(subjects, "Subjects retrieved successfully");
  } catch (error) {
    console.error("Get subjects error:", error);
    return errorResponse("Internal server error", 500);
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

    return successResponse(subject, "Subject created successfully", 201);
  } catch (error) {
    console.error("Create subject error:", error);
    return errorResponse("Internal server error", 500);
  }
}
