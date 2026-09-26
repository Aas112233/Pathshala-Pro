import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  notFound,
  handleApiError,
} from "@/lib/api-response";
import { requireApiAccess } from "@/lib/api-auth";

/**
 * GET /api/accounting/journals/[id]
 * Retrieve a specific journal entry by ID with its line items and account details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;
    const { tenantId } = access.authContext;
    const { id } = await params;

    const journal = await prisma.journalEntry.findFirst({
      where: { id, tenantId },
      include: {
        lineItems: {
          include: {
            account: {
              select: {
                id: true,
                code: true,
                name: true,
                accountType: true,
                normalBalance: true,
              },
            },
          },
        },
        fiscalYear: {
          select: { id: true, name: true, isClosed: true },
        },
        financialPeriod: {
          select: { id: true, name: true, isClosed: true },
        },
      },
    });

    if (!journal) {
      return notFound("Journal entry not found");
    }

    return successResponse(journal, "Journal entry retrieved successfully");
  } catch (error) {
    return handleApiError(error);
  }
}
