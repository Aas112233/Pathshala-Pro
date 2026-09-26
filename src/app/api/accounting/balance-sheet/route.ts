import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  handleApiError,
} from "@/lib/api-response";
import { requireApiAccess } from "@/lib/api-auth";
import { generateBalanceSheetReport } from "@/lib/financial-reports";

/**
 * GET /api/accounting/balance-sheet
 * Generates an institutional Balance Sheet report verifying Assets === Liabilities + Equity
 */
export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;
    const { tenantId } = access.authContext;

    const { searchParams } = new URL(request.url);
    const asOfDateParam = searchParams.get("asOfDate") || searchParams.get("date") || searchParams.get("endDate");
    const fiscalYearStartParam = searchParams.get("fiscalYearStartDate") || searchParams.get("startDate");

    const asOfDate = asOfDateParam ? new Date(asOfDateParam) : new Date();

    let fiscalYearStartDate: Date;
    if (fiscalYearStartParam) {
      fiscalYearStartDate = new Date(fiscalYearStartParam);
    } else {
      const fy = await prisma.fiscalYear.findFirst({
        where: {
          tenantId,
          startDate: { lte: asOfDate },
          endDate: { gte: asOfDate },
        },
        select: { startDate: true },
      });

      if (fy) {
        fiscalYearStartDate = fy.startDate;
      } else {
        fiscalYearStartDate = new Date(asOfDate.getFullYear(), 0, 1);
      }
    }

    const report = await generateBalanceSheetReport(prisma, {
      tenantId,
      asOfDate,
      fiscalYearStartDate,
    });

    return successResponse(report, "Balance sheet generated successfully");
  } catch (error) {
    return handleApiError(error);
  }
}
