import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  paginatedResponse,
  badRequest,
  handleApiError,
  safeParseBody,
} from "@/lib/api-response";
import { requireApiAccess } from "@/lib/api-auth";
import { postCashDeposit } from "@/lib/fee-service";
import { GL_CODES, MAX_PAGE_SIZE } from "@/lib/constants";
import { z } from "zod";

const depositSchema = z.object({
  toCode: z.string().regex(/^\d{1,6}$/, "toCode must be a numeric account code"),
  fromCode: z.string().regex(/^\d{1,6}$/).optional().default(GL_CODES.CASH),
  amount: z.number().positive("Deposit amount must be greater than 0"),
  note: z.string().max(500).optional(),
  bankReference: z.string().trim().max(100).optional(),
  receiptRefs: z.string().trim().max(1000).optional(),
});

/**
 * GET /api/accounting/deposits
 * Recent cash → bank deposits (CONTRA journals).
 */
export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;
    const { tenantId } = access.authContext;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), MAX_PAGE_SIZE);
    const where: any = { tenantId, voucherType: "CONTRA" };

    const [totalCount, deposits] = await Promise.all([
      prisma.journalEntry.count({ where }),
      prisma.journalEntry.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { postingDate: "desc" },
        include: { lineItems: { include: { account: { select: { code: true, name: true } } } } },
      }),
    ]);

    return paginatedResponse(deposits, {
      totalCount,
      currentPage: page,
      pageSize: limit,
      totalPages: Math.ceil(totalCount / limit),
      hasNextPage: page * limit < totalCount,
      hasPreviousPage: page > 1,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/accounting/deposits
 * Move collected cash into the bank: Dr bank / Cr cash (CONTRA) + syncs
 * linked BankAccount balances atomically.
 */
export async function POST(request: NextRequest) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;
    const { user, tenantId } = access.authContext;

    const bodyResult = await safeParseBody(request, depositSchema);
    if (!bodyResult.success) return bodyResult.errorResponse;
    const data = bodyResult.data;

    const result = await prisma.$transaction(async (tx) =>
      postCashDeposit(tx as any, {
        tenantId,
        fromCode: data.fromCode,
        toCode: data.toCode,
        amount: data.amount,
        executedById: user.id,
        note: data.note,
        bankReference: data.bankReference,
        receiptRefs: data.receiptRefs,
      })
    );

    return successResponse(result, "Cash deposit recorded successfully", 201);
  } catch (error) {
    if (error instanceof Error && /Deposit|closed|configured/i.test(error.message)) {
      return badRequest(error.message);
    }
    return handleApiError(error);
  }
}
