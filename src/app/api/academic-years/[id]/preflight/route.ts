import { NextRequest } from "next/server";
import { successResponse, handleApiError } from "@/lib/api-response";
import { requireApiAccess } from "@/lib/api-auth";
import { loadYearClosePreflight } from "@/lib/rollover-preflight-roster";
import { runYearClosePreflight } from "@/lib/rollover-preflight";

/**
 * GET /api/academic-years/[id]/preflight
 *
 * Read-only readiness report for closing one academic year.
 *
 * Closing a year is the last moment at which "this cohort never crossed the
 * boundary" is still fixable — afterwards the year is read-only and the
 * students are stranded in it. So the close route refuses on a blocker, and
 * this route is how an operator finds out before they try.
 *
 * The report is whole-year by nature and cannot be paginated without lying
 * about the result. It is bounded instead, and `scan.truncated` says so when
 * the bound is reached.
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

    const { input, scan } = await loadYearClosePreflight({ tenantId, academicYearId: id });
    const report = runYearClosePreflight(input);

    return successResponse(
      {
        scope: "yearClose",
        year: {
          id: input.year.id,
          label: input.year.label,
          startDate: new Date(input.year.startDate).toISOString(),
          isClosed: input.year.isClosed,
        },
        scan,
        ...report,
      },
      report.canProceed
        ? "Pre-flight checks passed"
        : `Pre-flight blocked the close: ${report.counts.blockers} blocker(s), ${report.counts.warnings} warning(s).`
    );
  } catch (error) {
    return handleApiError(error);
  }
}
