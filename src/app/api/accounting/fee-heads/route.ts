import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { badRequest, handleApiError, safeParseBody, successResponse } from "@/lib/api-response";
import { requireApiAccess } from "@/lib/api-auth";
import { updateFeeHeadMappingsSchema } from "@/lib/schemas";

/** GET /api/accounting/fee-heads */
export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;
    const [feeHeads, revenueAccounts] = await Promise.all([
      prisma.feeHead.findMany({
        where: { tenantId, isActive: true },
        orderBy: { code: "asc" },
      }),
      prisma.chartOfAccount.findMany({
        where: { tenantId, isActive: true, accountType: "REVENUE" },
        orderBy: { code: "asc" },
        select: { id: true, code: true, name: true, accountType: true, currency: true },
      }),
    ]);

    return successResponse({ feeHeads, revenueAccounts }, "Fee head mappings retrieved successfully");
  } catch (error) {
    return handleApiError(error);
  }
}

/** PUT /api/accounting/fee-heads */
export async function PUT(request: NextRequest) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;
    const bodyResult = await safeParseBody(request, updateFeeHeadMappingsSchema);
    if (!bodyResult.success) return bodyResult.errorResponse;
    const { mappings } = bodyResult.data;

    const codes = [...new Set(mappings.map((mapping) => mapping.code))];
    const accountCodes = [...new Set(mappings.map((mapping) => mapping.accountCode))];
    const [feeHeads, revenueAccounts] = await Promise.all([
      prisma.feeHead.findMany({
        where: { tenantId, code: { in: codes }, isActive: true },
        select: { code: true },
      }),
      prisma.chartOfAccount.findMany({
        where: { tenantId, code: { in: accountCodes }, accountType: "REVENUE", isActive: true },
        select: { code: true },
      }),
    ]);

    const validFeeHeads = new Set(feeHeads.map((head) => head.code));
    const validRevenueAccounts = new Set(revenueAccounts.map((account) => account.code));
    const invalidHead = mappings.find((mapping) => !validFeeHeads.has(mapping.code));
    if (invalidHead) return badRequest(`Fee head ${invalidHead.code} was not found.`);
    const invalidAccount = mappings.find((mapping) => !validRevenueAccounts.has(mapping.accountCode));
    if (invalidAccount) return badRequest(`Revenue account ${invalidAccount.accountCode} was not found.`);

    await prisma.$transaction(
      mappings.map((mapping) =>
        prisma.feeHead.update({
          where: { tenantId_code: { tenantId, code: mapping.code } },
          data: { accountCode: mapping.accountCode },
        })
      )
    );

    const updated = await prisma.feeHead.findMany({
      where: { tenantId, isActive: true },
      orderBy: { code: "asc" },
    });
    return successResponse(updated, "Fee head mappings saved successfully");
  } catch (error) {
    return handleApiError(error);
  }
}
