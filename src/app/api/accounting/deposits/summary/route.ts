import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, handleApiError } from "@/lib/api-response";
import { requireApiAccess } from "@/lib/api-auth";
import { GL_CODES } from "@/lib/constants";

/**
 * GET /api/accounting/deposits/summary
 * Banking control: how much counter cash is still sitting in the drawer.
 *   cashCollected = sum RECEIPT debits to cashCode (POS/bulk cash taken)
 *   cashBanked    = sum CONTRA credits out of cashCode (deposited to bank)
 *   undeposited   = cashCollected - cashBanked
 * No migration: aggregates existing JournalLineItem rows, tenant-scoped.
 */
export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;
    const { tenantId } = access.authContext;

    const { searchParams } = new URL(request.url);
    const cashCode = (searchParams.get("cashCode") || GL_CODES.CASH).replace(/[^0-9]/g, "").slice(0, 6) || GL_CODES.CASH;

    const [collected, banked] = await Promise.all([
      prisma.journalLineItem.aggregate({
        where: {
          tenantId,
          account: { tenantId, code: cashCode },
          journalEntry: { tenantId, voucherType: "RECEIPT" },
        },
        _sum: { debitAmount: true },
      }),
      prisma.journalLineItem.aggregate({
        where: {
          tenantId,
          account: { tenantId, code: cashCode },
          journalEntry: { tenantId, voucherType: "CONTRA" },
        },
        _sum: { creditAmount: true },
      }),
    ]);

    const cashCollected = Number(collected._sum.debitAmount ?? 0);
    const cashBanked = Number(banked._sum.creditAmount ?? 0);

    return successResponse(
      {
        cashCode,
        cashCollected,
        cashBanked,
        undeposited: cashCollected - cashBanked,
      },
      "Deposit summary"
    );
  } catch (error) {
    return handleApiError(error);
  }
}
