import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, notFound, handleApiError, badRequest } from "@/lib/api-response";
import { requireApiAccess } from "@/lib/api-auth";

const FINE_PER_DAY = 5;

/**
 * POST /api/library/issues/[id]/return
 * Body: { fineAmount?: number }
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;
    const { tenantId } = access.authContext;
    const { id } = await params;

    const issue = await prisma.bookIssue.findFirst({ where: { id, tenantId } });
    if (!issue) return notFound("Issue not found");
    if (issue.status === "RETURNED") return badRequest("Already returned");

    const body = await request.json().catch(() => ({}));
    let fineAmount: number = 0;
    if (typeof body.fineAmount === "number") {
      fineAmount = body.fineAmount;
    } else {
      // Auto-calc
      const overdueMs = Date.now() - new Date(issue.dueDate).getTime();
      if (overdueMs > 0) {
        const days = Math.ceil(overdueMs / (1000 * 60 * 60 * 24));
        fineAmount = days * FINE_PER_DAY;
      }
    }

    const [updated] = await prisma.$transaction([
      prisma.bookIssue.update({
        where: { id },
        data: { status: "RETURNED", returnDate: new Date(), fineAmount },
      }),
      prisma.book.update({ where: { id: issue.bookId }, data: { availableCopies: { increment: 1 } } }),
    ]);

    return successResponse(updated, "Book returned");
  } catch (error) {
    return handleApiError(error);
  }
}
