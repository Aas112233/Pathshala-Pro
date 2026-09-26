import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  handleApiError,
} from "@/lib/api-response";
import { requireApiAccess } from "@/lib/api-auth";
import { generateTrialBalanceReport } from "@/lib/financial-reports";

/**
 * GET /api/accounting/trial-balance
 * Generates an institutional Trial Balance report verifying Debit === Credit equilibrium
 */
export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;
    const { tenantId } = access.authContext;

    const { searchParams } = new URL(request.url);
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate") || searchParams.get("asOfDate") || searchParams.get("date");

    const startDate = startDateParam ? new Date(startDateParam) : undefined;
    const endDate = endDateParam ? new Date(endDateParam) : new Date();

    const report = await generateTrialBalanceReport(prisma, {
      tenantId,
      startDate,
      endDate,
    });

    return successResponse(report, "Trial balance generated successfully");
  } catch (error) {
    return handleApiError(error);
  }
}
