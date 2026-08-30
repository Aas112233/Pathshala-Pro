import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, handleApiError, forbidden } from "@/lib/api-response";
import { requirePortalAccess } from "@/lib/portal-auth";

export async function GET(request: NextRequest) {
  try {
    const access = await requirePortalAccess(request, "PARENT");
    if ("response" in access) return access.response;
    const { tenantId, user } = access.authContext;

    const links = await prisma.parentStudentLink.findMany({
      where: { tenantId, parentUserId: user.id },
      orderBy: { createdAt: "asc" },
      include: {
        studentProfile: {
          select: {
            id: true,
            studentId: true,
            firstName: true,
            lastName: true,
            profilePictureUrl: true,
            rollNumber: true,
            class: { select: { id: true, name: true } },
            section: { select: { id: true, name: true } },
          },
        },
      },
    });

    return successResponse(links.map(({ studentProfile, relation }) => ({ ...studentProfile, relation })));
  } catch (error) {
    return handleApiError(error);
  }
}
