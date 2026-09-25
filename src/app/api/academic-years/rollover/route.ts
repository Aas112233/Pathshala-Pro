import { NextRequest } from "next/server";
import {
  successResponse,
  errorResponse,
  forbidden,
  handleApiError,
} from "@/lib/api-response";
import { requireApiAccess } from "@/lib/api-auth";
import { hasRolePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { clearAcademicYearCache } from "@/lib/academic-year-guards";
import {
  applyRolloverPlan,
  loadRolloverPlan,
  parseRolloverRequest,
} from "@/lib/rollover-roster";
import type { RolloverFindingCode } from "@/lib/rollover-plan";

/**
 * POST /api/academic-years/rollover
 *
 * The rollover wizard's single decision point (roadmap item 16).
 *
 * ## One endpoint, two verbs' worth of work
 *
 * `dryRun: true` returns the plan and writes nothing; the default applies it.
 * Both go through `loadRolloverPlan`, so the preview and the commit cannot
 * describe different things — the same reason the promotion preview and execute
 * share `loadPromotionCohort`. A wizard whose preview is assembled separately
 * from its commit is a wizard that can lie.
 *
 * ## A dry run reports a blocked plan with 200
 *
 * A dry run is a read: it writes nothing, so `canProceed: false` is a *result*,
 * not a failure, and the caller needs the findings. Returning 409 would make a
 * readiness check look like an error and hide the reasons. Only the committing
 * path refuses with 409 — the same split the pre-flight routes use.
 *
 * ## What this does not do
 *
 * It does not close the source year, promote anyone, or switch the operating
 * year. Each of those is a separate act with its own capability check. A wizard
 * that quietly did them as side effects of copying some rules would be doing
 * three irreversible things behind one button.
 */

/**
 * Which field a blocker concerns, for a client that highlights one input.
 * Everything that is not about the year's own identity is about the year.
 */
const FIELD_BY_CODE: Partial<Record<RolloverFindingCode, string>> = {
  DUPLICATE_YEAR_ID: "yearId",
};

function successMessage(params: {
  mode: string;
  sourceLabel: string;
  targetLabel: string;
  created: number;
  updated: number;
}): string {
  const verb = params.mode === "CREATE" ? "Opened" : "Rolled into";
  const parts: string[] = [];
  if (params.created > 0) parts.push(`${params.created} row(s) created`);
  if (params.updated > 0) parts.push(`${params.updated} row(s) updated`);
  const detail = parts.length > 0 ? ` ${parts.join(", ")}.` : " No configuration was carried.";
  return `${verb} '${params.targetLabel}' from '${params.sourceLabel}'.${detail}`;
}

export async function POST(request: NextRequest) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { tenantId, user } = access.authContext;

    // Opening the next academic year is a lifecycle act, like closing one. The
    // route's module tier (`academic` / `write`) is not enough on its own:
    // day-to-day academic administration and opening a year are different
    // responsibilities, so the dedicated grant is re-checked here.
    if (!hasRolePermission(user.role, "academic:rollover:execute")) {
      return forbidden(
        "Opening the next academic year requires the academic rollover capability."
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = parseRolloverRequest(body);

    const plan = await loadRolloverPlan({
      tenantId,
      sourceAcademicYearId: parsed.sourceAcademicYearId,
      target: parsed.target,
      copy: parsed.copy,
    });

    if (parsed.dryRun) {
      return successResponse(
        { dryRun: true, plan },
        plan.canProceed
          ? `Preview: '${plan.target.label}' would be opened from '${plan.source.label}'.`
          : `Preview: the rollover is blocked by ${plan.counts.blockers} check(s).`
      );
    }

    if (!plan.canProceed) {
      return errorResponse(
        `The rollover of '${plan.source.label}' into '${plan.target.label}' is blocked by ${plan.counts.blockers} check(s). Nothing was written.`,
        409,
        plan.blockers.map((blocker) => ({
          field: FIELD_BY_CODE[blocker.code] ?? "academicYearId",
          code: blocker.code,
          message: blocker.message,
        }))
      );
    }

    // One transaction: the target year, its configuration, the rollover record
    // and the audit entry are one event. A half-applied rollover — a year with
    // some of last year's rules — is worse than none, because it looks
    // configured.
    const application = await prisma.$transaction(
      (tx) =>
        applyRolloverPlan(tx, {
          tenantId,
          userId: user.id,
          userEmail: user.email,
          plan,
        }),
      // The class ladder bounds this: one insert per class plus a record and an
      // audit row. The generous budget is for a school with a large ladder on a
      // slow link, not for a large cohort.
      { timeout: 120_000, maxWait: 15_000 }
    );

    clearAcademicYearCache();

    return successResponse(
      { plan, application },
      successMessage({
        mode: plan.target.mode,
        sourceLabel: plan.source.label,
        targetLabel: plan.target.label,
        created: plan.writes.created,
        updated: plan.writes.updated,
      }),
      201
    );
  } catch (error) {
    return handleApiError(error);
  }
}
