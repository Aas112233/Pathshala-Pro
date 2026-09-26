import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  badRequest,
  handleApiError,
  safeParseBody,
} from "@/lib/api-response";
import { createBankAccountSchema } from "@/lib/schemas";
import { requireApiAccess } from "@/lib/api-auth";

/**
 * GET /api/accounting/accounts
 * List bank accounts and cash registers
 */
export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;

    const accounts = await prisma.bankAccount.findMany({
      where: { tenantId, isActive: true },
      orderBy: { createdAt: "asc" },
    });

    return successResponse(accounts, "Bank accounts retrieved successfully");
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/accounting/accounts
 * Create bank account or petty cash register
 */
export async function POST(request: NextRequest) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;

    const bodyResult = await safeParseBody(request, createBankAccountSchema);
    if (!bodyResult.success) return bodyResult.errorResponse;
    const data = bodyResult.data;

    // A linked code must resolve to an active ASSET account, otherwise the GL
    // mirror syncs into a void and reconciliation drifts with no error.
    if ((data as any).accountCode) {
      const linked = await prisma.chartOfAccount.findFirst({
        where: { tenantId, code: (data as any).accountCode, isActive: true },
        select: { code: true, name: true, accountType: true },
      });
      if (!linked) {
        return badRequest(`GL account ${(data as any).accountCode} is not configured. Create it under Accounting > Chart of Accounts first.`);
      }
      if (linked.accountType !== "ASSET") {
        return badRequest(`GL account ${linked.code} (${linked.name}) is a ${linked.accountType} account — bank/cash mirrors must link to an ASSET account.`);
      }
    }

    const account = await prisma.bankAccount.create({
      data: {
        tenantId,
        accountName: data.accountName,
        accountNumber: data.accountNumber,
        bankName: data.bankName,
        branchName: data.branchName,
        accountType: data.accountType,
        accountCode: (data as any).accountCode,
        openingBalance: data.openingBalance,
        currentBalance: data.openingBalance,
        currency: data.currency,
        isActive: true,
      },
    });

    return successResponse(account, "Bank account created successfully", 201);
  } catch (error) {
    return handleApiError(error);
  }
}
