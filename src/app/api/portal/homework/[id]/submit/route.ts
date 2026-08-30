import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { badRequest, forbidden, notFound, successResponse, validationError, handleApiError } from "@/lib/api-response";
import { requirePortalAccess } from "@/lib/portal-auth";
import { internalFileUrlSchema } from "@/lib/file-url";
import { verifyInternalFileUrl } from "@/lib/upload-security";

const submissionSchema = z.object({
  remarks: z.string().max(10000).optional().nullable(),
  attachmentUrl: internalFileUrlSchema.optional().nullable().or(z.literal("")),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await requirePortalAccess(request, "STUDENT");
    if ("response" in access) return access.response;
    const { tenantId, user } = access.authContext;
    const { id: homeworkId } = await params;
    const parsed = submissionSchema.safeParse(await request.json());
    if (!parsed.success) return validationError(parsed.error.errors.map((error) => ({ field: error.path.join("."), code: error.code, message: error.message })));
    if (parsed.data.attachmentUrl && !(await verifyInternalFileUrl(parsed.data.attachmentUrl, tenantId))) {
      return badRequest("Invalid attachment file");
    }

    const student = await prisma.studentProfile.findFirst({ where: { tenantId, linkedUser: { id: user.id } }, select: { id: true, classId: true, sectionId: true } });
    if (!student) return forbidden("Your student profile is not linked to this account");
    const homework = await prisma.homework.findFirst({ where: { id: homeworkId, tenantId, classId: student.classId ?? "", OR: [{ sectionId: student.sectionId }, { sectionId: null }] }, select: { id: true, dueDate: true } });
    if (!homework) return notFound("Homework not found");

    const existing = await prisma.homeworkSubmission.findFirst({ where: { tenantId, homeworkId, studentProfileId: student.id }, select: { id: true, status: true } });
    if (existing?.status === "GRADED") return badRequest("A graded submission cannot be replaced");
    const status = new Date() > homework.dueDate ? "LATE" : "SUBMITTED";
    const submission = await prisma.homeworkSubmission.upsert({
      where: { tenantId_homeworkId_studentProfileId: { tenantId, homeworkId, studentProfileId: student.id } },
      create: { tenantId, homeworkId, studentProfileId: student.id, remarks: parsed.data.remarks || null, attachmentUrl: parsed.data.attachmentUrl || null, status, submittedAt: new Date() },
      update: { remarks: parsed.data.remarks || null, attachmentUrl: parsed.data.attachmentUrl || null, status, submittedAt: new Date() },
    });
    return successResponse(submission, "Homework submitted", 201);
  } catch (error) {
    return handleApiError(error);
  }
}
