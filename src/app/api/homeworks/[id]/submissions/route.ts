import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, paginatedResponse, validationError, handleApiError, notFound, badRequest } from "@/lib/api-response";
import { createSubmissionSchema } from "@/lib/schemas";
import { requireApiAccess } from "@/lib/api-auth";
import { MAX_PAGE_SIZE } from "@/lib/constants";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;
    const { tenantId } = access.authContext;
    const { id: homeworkId } = await params;
    const hw = await prisma.homework.findFirst({ where: { id: homeworkId, tenantId } });
    if (!hw) return notFound("Homework not found");
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const status = searchParams.get("status") || "";
    const where: any = { tenantId, homeworkId };
    if (status) where.status = status;
    const skip = (page - 1) * limit;
    const [totalCount, data] = await Promise.all([
      prisma.homeworkSubmission.count({ where }),
      prisma.homeworkSubmission.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: { studentProfile: { select: { id: true, firstName: true, lastName: true, rollNumber: true } } },
      }),
    ]);
    const totalPages = Math.ceil(totalCount / limit);
    return paginatedResponse(data, { totalCount, currentPage: page, pageSize: limit, totalPages, hasNextPage: page < totalPages, hasPreviousPage: page > 1 });
  } catch (e) { return handleApiError(e); }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;
    const { tenantId } = access.authContext;
    const { id: homeworkId } = await params;
    const hw = await prisma.homework.findFirst({ where: { id: homeworkId, tenantId } });
    if (!hw) return notFound("Homework not found");
    const body = await request.json();
    // Allow passing homeworkId in body as well, but override with param
    const parsed = createSubmissionSchema.safeParse({ ...body, homeworkId });
    if (!parsed.success) {
      const errors = parsed.error.errors.map((e) => ({ field: e.path.join("."), code: e.code, message: e.message }));
      return validationError(errors);
    }
    const d = parsed.data;
    const student = await prisma.studentProfile.findFirst({ where: { id: d.studentProfileId, tenantId } });
    if (!student) return badRequest("Student not found");
    const dup = await prisma.homeworkSubmission.findFirst({ where: { tenantId, homeworkId, studentProfileId: d.studentProfileId } });
    if (dup) return badRequest("Already submitted", [{ field: "studentProfileId", code: "duplicate", message: "Already submitted" }]);

    const isLate = new Date() > new Date(hw.dueDate);
    const submission = await prisma.homeworkSubmission.create({
      data: {
        tenantId,
        homeworkId,
        studentProfileId: d.studentProfileId,
        attachmentUrl: d.attachmentUrl || null,
        remarks: d.remarks || null,
        status: isLate ? "LATE" : "SUBMITTED",
        submittedAt: new Date(),
      },
    });
    return successResponse(submission, "Submitted", 201);
  } catch (e: any) {
    if (e?.code === "P2002") return badRequest("Duplicate submission");
    return handleApiError(e);
  }
}
