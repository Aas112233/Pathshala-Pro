import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, notFound, badRequest, handleApiError } from "@/lib/api-response";
import { requireApiAccess } from "@/lib/api-auth";

/**
 * POST /api/enquiries/[id]/convert
 * Marks enquiry as ADMITTED. Optionally links to an existing StudentProfile via body { studentProfileId }.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;
    const { tenantId } = access.authContext;
    const { id } = await params;

    const enquiry = await prisma.enquiry.findFirst({ where: { id, tenantId } });
    if (!enquiry) return notFound("Enquiry not found");
    if (enquiry.status === "ADMITTED") {
      return badRequest("Already converted", [
        { field: "status", code: "already_admitted", message: "Enquiry already marked as admitted" },
      ]);
    }

    let convertedStudentId: string | null = null;
    try {
      const body = await request.json().catch(() => ({}));
      convertedStudentId = body?.studentProfileId || null;
      if (convertedStudentId) {
        const student = await prisma.studentProfile.findFirst({
          where: { id: convertedStudentId, tenantId },
        });
        if (!student) return badRequest("Student not found");
      }
    } catch {
      // no body is fine
    }

    const updated = await prisma.enquiry.update({
      where: { id },
      data: {
        status: "ADMITTED",
        convertedStudentId,
      },
    });

    return successResponse(updated, "Enquiry converted to admission");
  } catch (error) {
    return handleApiError(error);
  }
}
