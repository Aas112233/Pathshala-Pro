import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { badRequest, handleApiError, successResponse } from "@/lib/api-response";
import { requireApiAccess } from "@/lib/api-auth";

const ACCOUNT_TYPES = ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"] as const;

/**
 * GET /api/accounting/chart?accountType=ASSET
 * Active chart of accounts for pickers (payment-method GL mapping, deposit
 * routing). Tenant-scoped, code-ordered. `accountType` is optional.
 */
export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;
    const { tenantId } = access.authContext;

    const { searchParams } = new URL(request.url);
    const accountType = searchParams.get("accountType");
    if (accountType && !(ACCOUNT_TYPES as readonly string[]).includes(accountType)) {
      return badRequest(`accountType must be one of: ${ACCOUNT_TYPES.join(", ")}`);
    }

    const accounts = await prisma.chartOfAccount.findMany({
      where: {
        tenantId,
        isActive: true,
        ...(accountType ? { accountType: accountType as (typeof ACCOUNT_TYPES)[number] } : {}),
      },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true, accountType: true, currency: true },
    });

    return successResponse({ accounts }, "Chart of accounts retrieved successfully");
  } catch (error) {
    return handleApiError(error);
  }
}
