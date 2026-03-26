import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  errorResponse,
  unauthorized,
  notFound,
  badRequest,
} from "@/lib/api-response";
import { getAuthContext } from "@/lib/auth";

export const runtime = 'edge';

/**
 * GET /api/class-subjects
 * Get subjects for a specific class
 */
export async function GET(request: NextRequest) {
  try {
    const authContext = await getAuthContext(request);
    if (!authContext) {
      return unauthorized("Authentication required");
    }

    const { tenantId } = authContext;
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get("classId");

    if (!classId) {
      return badRequest("classId parameter is required");
    }

    const classSubjects = await prisma.classSubject.findMany({
      where: { tenantId, classId },
      include: {
        subject: {
          select: {
            subjectId: true,
            name: true,
            code: true,
            category: true,
            maxMarks: true,
            passMarks: true,
          },
        },
      },
      orderBy: { sortOrder: "asc" },
    });

    return successResponse(classSubjects, "Class subjects retrieved successfully");
  } catch (error) {
    console.error("Get class subjects error:", error);
    return errorResponse("Internal server error", 500);
  }
}

/**
 * POST /api/class-subjects
 * Assign subjects to a class
 */
export async function POST(request: NextRequest) {
  try {
    const authContext = await getAuthContext(request);
    if (!authContext) {
      return unauthorized("Authentication required");
    }

    const { tenantId } = authContext;
    const body = await request.json();
    const { classId, subjects } = body;

    if (!classId || !Array.isArray(subjects)) {
      return badRequest("classId and subjects array are required");
    }

    // Verify class exists
    const classObj = await prisma.class.findUnique({
      where: { id: classId, tenantId },
    });

    if (!classObj) {
      return notFound("Class not found");
    }

    // Verify all subjects exist and get their IDs
    const subjectIds = subjects.map((s: any) => s.subjectId);
    const existingSubjects = await prisma.subject.findMany({
      where: {
        tenantId,
        subjectId: { in: subjectIds },
      },
      select: {
        id: true,
        subjectId: true,
      },
    }) as Array<{ id: string; subjectId: string }>;

    if (existingSubjects.length !== subjectIds.length) {
      return badRequest("One or more subjects not found");
    }

    // Create a map of subjectId to MongoDB id
    const subjectIdMap = new Map(existingSubjects.map((s: { id: string; subjectId: string }) => [s.subjectId, s.id]));

    // Remove existing subject assignments for this class
    await prisma.classSubject.deleteMany({
      where: { tenantId, classId },
    });

    // Create new subject assignments
    const classSubjects = await prisma.classSubject.createMany({
      data: subjects.map((s: any, index: number) => ({
        tenantId,
        classId,
        subjectId: subjectIdMap.get(s.subjectId)!, // Use MongoDB ObjectId
        isCompulsory: s.isCompulsory ?? true,
        sortOrder: s.sortOrder ?? index,
      })),
    });

    // Fetch the created assignments with subject details
    const result = await prisma.classSubject.findMany({
      where: { tenantId, classId },
      include: {
        subject: {
          select: {
            subjectId: true,
            name: true,
            code: true,
            category: true,
          },
        },
      },
      orderBy: { sortOrder: "asc" },
    });

    return successResponse(result, "Subjects assigned to class successfully", 201);
  } catch (error) {
    console.error("Assign class subjects error:", error);
    return errorResponse("Internal server error", 500);
  }
}
