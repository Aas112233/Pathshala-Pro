import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-error";
import { logAuditEvent } from "@/lib/audit-logger";
import {
  planRollover,
  type RolloverCopyOptions,
  type RolloverFeeStructure,
  type RolloverPlan,
  type RolloverRule,
  type RolloverTarget,
} from "@/lib/rollover-plan";

/**
 * Evidence loading and application for the rollover wizard.
 *
 * Mirrors `rollover-preflight-roster.ts` and `promotion-roster.ts`: the pure
 * module decides, this module fetches and writes. The split matters here for a
 * specific reason — the wizard shows a **dry run**, and the dry run and the
 * commit must be the same decision. If the preview assembled its own evidence
 * and the commit assembled its own, the operator would be shown one plan and
 * given another, which is the defect the promotion module already shipped once.
 */

const RULE_SELECT = {
  classId: true,
  minimumAttendance: true,
  minimumOverallPercentage: true,
  minimumPerSubject: true,
  maxFailedSubjects: true,
  allowConditionalPromotion: true,
  autoPromote: true,
  nextClassId: true,
  isActive: true,
} as const;

const FEE_SELECT = {
  classId: true,
  tuitionFee: true,
  labFee: true,
  computerFee: true,
  examFee: true,
  sportsFee: true,
  libraryFee: true,
  otherFee: true,
  totalMonthlyFee: true,
  billingCycle: true,
  notes: true,
  isActive: true,
} as const;

// ---------------------------------------------------------------------------
// The request
// ---------------------------------------------------------------------------

export type RolloverRequestTarget =
  | {
      mode: "CREATE";
      yearId: string;
      label: string;
      startDate: string;
      endDate: string;
      /** Overrides the source year's working-day policy. Omit to carry it. */
      nonWorkingWeekdays?: unknown;
    }
  | { mode: "EXISTING"; academicYearId: string };

export interface RolloverRequestBody {
  sourceAcademicYearId: string;
  target: RolloverRequestTarget;
  copy: RolloverCopyOptions;
  dryRun: boolean;
}

function invalidRequest(message: string, field: string, code: string): ApiError {
  return ApiError.badRequest(message, [{ field, code, message }]);
}

function requiredString(value: unknown, field: string, code: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw invalidRequest(`'${field}' is required.`, field, code);
  }
  return value.trim();
}

/**
 * Parse the wizard's request.
 *
 * `copy` is **required** and both of its flags must be present. Defaulting it
 * would mean a caller that forgot to decide silently gets either a year with no
 * configuration — which then cannot promote anyone — or a copy nobody asked for.
 * Making the caller state it moves that decision to the edge, where the operator
 * is, rather than into a default nobody reads.
 */
export function parseRolloverRequest(body: unknown): RolloverRequestBody {
  if (!body || typeof body !== "object") {
    throw invalidRequest(
      "A JSON body is required.",
      "body",
      "MISSING_BODY"
    );
  }

  const raw = body as Record<string, unknown>;
  const sourceAcademicYearId = requiredString(
    raw.sourceAcademicYearId,
    "sourceAcademicYearId",
    "MISSING_SOURCE_YEAR"
  );

  const mode = raw.mode;
  if (mode !== "CREATE" && mode !== "EXISTING") {
    throw invalidRequest(
      "Mode must be CREATE (open a new year) or EXISTING (roll into one that already exists).",
      "mode",
      "INVALID_MODE"
    );
  }

  let target: RolloverRequestTarget;

  if (mode === "CREATE") {
    const yearId = requiredString(raw.yearId, "yearId", "MISSING_TARGET_FIELDS");
    const label = requiredString(raw.label, "label", "MISSING_TARGET_FIELDS");

    for (const field of ["startDate", "endDate"] as const) {
      const value = raw[field];
      if (typeof value !== "string" || Number.isNaN(new Date(value).getTime())) {
        throw invalidRequest(
          `'${field}' must be a valid date.`,
          field,
          "INVALID_TARGET_DATE"
        );
      }
    }

    target = {
      mode: "CREATE",
      yearId,
      label,
      startDate: raw.startDate as string,
      endDate: raw.endDate as string,
      // Left undefined when absent, which is how the plan knows to carry the
      // source's policy rather than to treat "no override" as "no policy".
      ...(raw.nonWorkingWeekdays === undefined
        ? {}
        : { nonWorkingWeekdays: raw.nonWorkingWeekdays }),
    };
  } else {
    target = {
      mode: "EXISTING",
      academicYearId: requiredString(
        raw.academicYearId,
        "academicYearId",
        "MISSING_TARGET_YEAR"
      ),
    };
  }

  const copy = raw.copy;
  if (!copy || typeof copy !== "object") {
    throw invalidRequest(
      "A 'copy' object is required, stating whether to carry the promotion rules and the fee structures.",
      "copy",
      "MISSING_COPY_OPTIONS"
    );
  }

  const copyRaw = copy as Record<string, unknown>;
  for (const key of ["promotionRules", "feeStructures"] as const) {
    if (typeof copyRaw[key] !== "boolean") {
      throw invalidRequest(
        `'copy.${key}' must be true or false. It is required, so that a rollover never carries configuration nobody asked for.`,
        `copy.${key}`,
        "INVALID_COPY_OPTION"
      );
    }
  }

  return {
    sourceAcademicYearId,
    target,
    copy: {
      promotionRules: copyRaw.promotionRules as boolean,
      feeStructures: copyRaw.feeStructures as boolean,
    },
    dryRun: raw.dryRun === true,
  };
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

export interface LoadRolloverPlanParams {
  tenantId: string;
  sourceAcademicYearId: string;
  target: RolloverRequestTarget;
  copy: RolloverCopyOptions;
}

/**
 * Assemble the plan's input from the database.
 *
 * Loaders throw `ApiError` rather than returning a result union, matching
 * `assertAcademicYearOpen`: a caller that forgot to check `ok` would have
 * quietly skipped the decision, and every caller already funnels through
 * `handleApiError`.
 *
 * Rules and fee structures are read **including inactive rows**. An inactive row
 * is configuration the school put on file, and dropping it silently would lose
 * it; whether the target ends up able to promote is decided afterwards, by the
 * plan's own check, rather than by quietly filtering the evidence.
 */
export async function loadRolloverPlan(
  params: LoadRolloverPlanParams
): Promise<RolloverPlan> {
  const { tenantId, sourceAcademicYearId, target, copy } = params;

  const source = await prisma.academicYear.findFirst({
    where: { id: sourceAcademicYearId, tenantId },
    select: {
      id: true,
      label: true,
      startDate: true,
      endDate: true,
      isClosed: true,
      nonWorkingWeekdays: true,
      promotionRules: { select: RULE_SELECT },
      classFeeStructures: { select: FEE_SELECT },
    },
  });

  if (!source) throw ApiError.notFound("Source academic year not found");

  const [allYears, allClasses] = await Promise.all([
    prisma.academicYear.findMany({
      where: { tenantId },
      select: {
        id: true,
        yearId: true,
        label: true,
        startDate: true,
        endDate: true,
        isClosed: true,
        nonWorkingWeekdays: true,
      },
    }),
    prisma.class.findMany({
      where: { tenantId },
      select: { id: true, name: true, classNumber: true },
      orderBy: { classNumber: "asc" },
    }),
  ]);

  let planTarget: RolloverTarget;
  let targetRules: RolloverRule[] = [];
  let targetFees: RolloverFeeStructure[] = [];

  if (target.mode === "EXISTING") {
    const existing = allYears.find((year) => year.id === target.academicYearId);
    if (!existing) throw ApiError.notFound("Target academic year not found");

    const [enrolledStudents, rules, fees] = await Promise.all([
      prisma.studentAcademicSession.count({
        where: { tenantId, academicYearId: existing.id },
      }),
      prisma.promotionRule.findMany({
        where: { tenantId, academicYearId: existing.id },
        select: RULE_SELECT,
      }),
      prisma.classFeeStructure.findMany({
        where: { tenantId, academicYearId: existing.id },
        select: FEE_SELECT,
      }),
    ]);

    planTarget = {
      mode: "EXISTING",
      academicYearId: existing.id,
      label: existing.label,
      startDate: existing.startDate,
      endDate: existing.endDate,
      isClosed: existing.isClosed,
      nonWorkingWeekdays: existing.nonWorkingWeekdays,
      enrolledStudents,
    };
    targetRules = rules;
    targetFees = fees;
  } else {
    planTarget = {
      mode: "CREATE",
      yearId: target.yearId,
      label: target.label,
      startDate: target.startDate,
      endDate: target.endDate,
      ...(target.nonWorkingWeekdays === undefined
        ? {}
        : { nonWorkingWeekdays: target.nonWorkingWeekdays }),
    };
  }

  return planRollover({
    source: {
      id: source.id,
      label: source.label,
      startDate: source.startDate,
      endDate: source.endDate,
      isClosed: source.isClosed,
      nonWorkingWeekdays: source.nonWorkingWeekdays,
      promotionRules: source.promotionRules,
      feeStructures: source.classFeeStructures,
    },
    target: planTarget,
    targetPromotionRules: targetRules,
    targetFeeStructures: targetFees,
    allClasses,
    existingYearIds: allYears.map((year) => year.yearId),
    copy,
  });
}

// ---------------------------------------------------------------------------
// Applying
// ---------------------------------------------------------------------------

export interface ApplyRolloverPlanParams {
  tenantId: string;
  userId: string;
  userEmail?: string | null;
  plan: RolloverPlan;
}

export interface RolloverApplication {
  targetAcademicYearId: string;
  targetCreated: boolean;
  promotionRulesCreated: number;
  promotionRulesUpdated: number;
  feeStructuresCreated: number;
  feeStructuresUpdated: number;
  workingDayPolicyCarried: boolean;
}

/**
 * Apply a plan inside a caller-supplied transaction.
 *
 * The writes mirror the plan's diff exactly — `created` rows are inserted,
 * `updated` rows are updated, `skipped` rows are not touched — so the dry run
 * cannot describe one thing and the commit do another. There is no "recompute
 * and hope" step.
 *
 * A new year is deliberately **not** made the current year. Switching the
 * operating year changes what every other read resolves to, and it is a separate
 * act with its own capability check; a rollover that silently switched it would
 * move the whole institute's context as a side effect of copying some rules.
 */
export async function applyRolloverPlan(
  tx: Prisma.TransactionClient,
  params: ApplyRolloverPlanParams
): Promise<RolloverApplication> {
  const { tenantId, userId, userEmail, plan } = params;

  let targetAcademicYearId: string;
  let targetCreated = false;

  if (plan.target.create) {
    const created = await tx.academicYear.create({
      data: {
        tenantId,
        yearId: plan.target.create.yearId,
        label: plan.target.create.label,
        startDate: new Date(plan.target.create.startDate),
        endDate: new Date(plan.target.create.endDate),
        // `DbNull` rather than a bare `null`: the field is a nullable Json
        // column, and Prisma needs to be told whether the absence is a SQL NULL
        // or a JSON `null`. SQL NULL is what "undeclared" means.
        nonWorkingWeekdays:
          plan.target.nonWorkingWeekdays === null
            ? Prisma.DbNull
            : [...plan.target.nonWorkingWeekdays],
        clonedFromId: plan.target.clonedFromId,
      },
      select: { id: true },
    });

    targetAcademicYearId = created.id;
    targetCreated = true;
  } else if (plan.target.existingAcademicYearId) {
    targetAcademicYearId = plan.target.existingAcademicYearId;
  } else {
    // Unreachable through the route, and a throw rather than a fallback so it
    // cannot become a silent write into the wrong year if the plan's shape ever
    // changes.
    throw ApiError.internal("The rollover plan names no target year.");
  }

  if (plan.promotionRules.created.length > 0) {
    await tx.promotionRule.createMany({
      data: plan.promotionRules.created.map((row) => ({
        tenantId,
        academicYearId: targetAcademicYearId,
        classId: row.classId,
        ...row.values,
      })),
    });
  }

  for (const row of plan.promotionRules.updated) {
    await tx.promotionRule.update({
      where: {
        tenantId_academicYearId_classId: {
          tenantId,
          academicYearId: targetAcademicYearId,
          classId: row.classId,
        },
      },
      data: row.values,
    });
  }

  if (plan.feeStructures.created.length > 0) {
    await tx.classFeeStructure.createMany({
      data: plan.feeStructures.created.map((row) => ({
        tenantId,
        academicYearId: targetAcademicYearId,
        classId: row.classId,
        ...row.values,
      })),
    });
  }

  for (const row of plan.feeStructures.updated) {
    await tx.classFeeStructure.update({
      where: {
        tenantId_academicYearId_classId: {
          tenantId,
          academicYearId: targetAcademicYearId,
          classId: row.classId,
        },
      },
      data: row.values,
    });
  }

  const workingDayPolicyCarried =
    targetCreated &&
    plan.target.writesWorkingDayPolicy &&
    plan.target.nonWorkingWeekdays !== null;

  // The structured record of the run. The audit entry below is the timeline
  // entry; this is the row the wizard reads back to say what happened, and the
  // home the fee-balance policy choice will need when that decision is made.
  await tx.academicYearRollover.create({
    data: {
      tenantId,
      sourceAcademicYearId: plan.source.id,
      targetAcademicYearId,
      mode: plan.target.mode,
      copyPromotionRules: plan.promotionRules.requested,
      copyFeeStructures: plan.feeStructures.requested,
      promotionRulesCreated: plan.promotionRules.counts.created,
      promotionRulesUpdated: plan.promotionRules.counts.updated,
      feeStructuresCreated: plan.feeStructures.counts.created,
      feeStructuresUpdated: plan.feeStructures.counts.updated,
      workingDayPolicyCarried,
      performedByUserId: userId,
    },
  });

  // Written inside the transaction. Opening the next year changes what every
  // later record means, so the entry cannot be optional.
  await logAuditEvent(
    {
      tenantId,
      userId,
      userEmail: userEmail ?? undefined,
      action: "ROLLOVER",
      entity: "AcademicYear",
      entityId: targetAcademicYearId,
      details: {
        source: {
          id: plan.source.id,
          label: plan.source.label,
          startDate: plan.source.startDate,
          endDate: plan.source.endDate,
        },
        target: {
          id: targetAcademicYearId,
          label: plan.target.label,
          startDate: plan.target.startDate,
          endDate: plan.target.endDate,
          mode: plan.target.mode,
          created: targetCreated,
        },
        copy: {
          promotionRules: plan.promotionRules.requested,
          feeStructures: plan.feeStructures.requested,
        },
        workingDayPolicy: {
          carried: workingDayPolicyCarried,
          nonWorkingWeekdays: plan.target.nonWorkingWeekdays,
        },
        writes: plan.writes,
        // What the operator was told this would not do. Recorded because
        // "nobody said the timetables were not copied" is otherwise a
        // disagreement with no evidence either way.
        notCopied: plan.notCopied.map((entry) => entry.key),
        // And what it warned about, so the audit trail answers "was this run
        // clean" without re-deriving the plan.
        warnings: plan.warnings.map((warning) => warning.code),
      },
    },
    tx
  );

  return {
    targetAcademicYearId,
    targetCreated,
    promotionRulesCreated: plan.promotionRules.counts.created,
    promotionRulesUpdated: plan.promotionRules.counts.updated,
    feeStructuresCreated: plan.feeStructures.counts.created,
    feeStructuresUpdated: plan.feeStructures.counts.updated,
    workingDayPolicyCarried,
  };
}
