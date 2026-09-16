import { NextRequest, NextResponse } from "next/server";
import { requireApiAccess } from "@/lib/api-auth";
import { badRequest, handleApiError, successResponse } from "@/lib/api-response";
import { smartRateLimitAsync } from "@/lib/rate-limit";
import { exportFeeDaybookToExcel, fetchFeeDaybookRows } from "@/lib/excel/export-service";

/** Inclusive end-of-day, so `?to=2026-08-31` includes that day's collections. */
function parseRange(value: string | null, endOfDay = false): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(endOfDay ? `${value}T23:59:59.999Z` : value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

/**
 * GET /api/accounting/daybook
 *
 * Streams the Fee Collections Daybook as a real .xlsx workbook. Built on the
 * server rather than from the paginated `/api/transactions` feed so the export
 * covers the whole date range — a client-side build would silently stop at the
 * page cap, which is exactly the truncation this endpoint exists to avoid.
 */
export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess(request, { permission: "fees:read" });
    if ("response" in access) return access.response;

    const { tenantId, user } = access.authContext;

    // Full-range spreadsheet generation is expensive; keep it off the hot path.
    const rate = await smartRateLimitAsync(`DAYBOOK_XLSX_${tenantId}_${user.id}`, {
      preset: "read",
      limit: 12,
    });
    if (!rate.success) {
      return badRequest("Too many daybook exports. Please try again in a minute.");
    }

    const { searchParams } = new URL(request.url);
    const startDate = parseRange(searchParams.get("startDate"));
    const endDate = parseRange(searchParams.get("endDate"), true);

    if (startDate && endDate && startDate > endDate) {
      return badRequest("Start date must be on or before the end date.");
    }

    // JSON mode feeds the in-browser PDF exporter. Same full-range query as the
    // workbook below, so a daybook PDF never truncates at the table page cap.
    if (searchParams.get("format") === "json") {
      const rows = await fetchFeeDaybookRows(tenantId, startDate, endDate);
      return successResponse(rows);
    }

    const buffer = await exportFeeDaybookToExcel(tenantId, startDate, endDate);

    // ASCII-only filename: a non-ASCII Content-Disposition value is mangled by
    // some browsers into an unopenable download.
    const stamp = [startDate, endDate]
      .map((date) => date?.toISOString().slice(0, 10))
      .filter(Boolean)
      .join("_to_");
    const fileName = `fee-daybook${stamp ? `_${stamp}` : ""}.xlsx`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleApiError(error, "Failed to export the fee collections daybook");
  }
}
