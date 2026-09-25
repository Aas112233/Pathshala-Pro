import { NextRequest } from "next/server";
import { badRequest, successResponse, handleApiError } from "@/lib/api-response";
import { requireApiAccess } from "@/lib/api-auth";
import { loadPromotionPreflight } from "@/lib/rollover-preflight-roster";
import { runPromotionPreflight } from "@/lib/rollover-preflight";

/**
 * GET /api/promotions/preflight
 *
 * Read-only readiness report for one promotion run: is this cohort ready to
 * cross from one academic year into another?
 *
 * This route and POST /api/promotions/execute run the *same* pure checks over
 * the *same* loaded cohort. This one reports; that one refuses. Nothing here is
 * trusted by the write path — the gate exists twice on purpose, because a
 * pre-flight that only exists in the UI is a suggestion, not a gate.
 *
 * Query parameters:
 *   classId            (required) source class
 *   academicYearId     (required) source academic year
 *   toAcademicYearId   (required) target academic year — no suggestion here,
 *                      because a report about a year the caller never chose is
 *                      a report about nothing
 *   studentProfileIds  (optional) comma-separated. Absent means the whole class;
 *                      present-but-empty means nothing is selected, which is
 *                      reported as an empty cohort rather than silently widened
 *                      to the whole class.
 */
export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;
    const { searchParams } = new URL(request.url);

    const classId = searchParams.get("classId");
    const academicYearId = searchParams.get("academicYearId");
    const toAcademicYearId = searchParams.get("toAcademicYearId");

    if (!classId || !academicYearId || !toAcademicYearId) {
      return badRequest(
        "classId, academicYearId and toAcademicYearId are required to run a promotion pre-flight."
      );
    }

    const rawSelection = searchParams.get("studentProfileIds");
    const studentProfileIds =
      rawSelection === null
        ? undefined
        : rawSelection
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean);

    const input = await loadPromotionPreflight({
      tenantId,
      classId,
      fromAcademicYearId: academicYearId,
      toAcademicYearId,
      studentProfileIds,
    });

    const report = runPromotionPreflight(input);

    return successResponse(
      {
        scope: "promotion",
        fromAcademicYear: {
          id: input.fromYear.id,
          label: input.fromYear.label,
          isClosed: input.fromYear.isClosed,
        },
        toAcademicYear: {
          id: input.toYear.id,
          label: input.toYear.label,
          isClosed: input.toYear.isClosed,
        },
        class: {
          id: input.fromClass.id,
          name: input.fromClass.name,
          classNumber: input.fromClass.classNumber,
        },
        studentsConsidered: input.cohort.length,
        ...report,
      },
      report.canProceed
        ? "Pre-flight checks passed"
        : `Pre-flight blocked the run: ${report.counts.blockers} blocker(s), ${report.counts.warnings} warning(s).`
    );
  } catch (error) {
    return handleApiError(error);
  }
}
