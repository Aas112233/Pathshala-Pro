import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  badRequest,
  notFound,
  handleApiError,
} from "@/lib/api-response";
import { requireApiAccess } from "@/lib/api-auth";
import { loadPromotionCohort } from "@/lib/promotion-roster";
import {
  decidePromotion,
  summariseDecisions,
  suggestTargetAcademicYear,
  type PromotionDecision,
  type PromotionRuleInput,
} from "@/lib/promotion-engine";

/**
 * GET /api/promotions/calculate
 *
 * Preview of a promotion run for one class, moving out of one academic year and
 * into another.
 *
 * This route is a *courtesy*: it runs the exact same decision engine and the
 * exact same cohort loader as POST /api/promotions/execute. The write path
 * recomputes everything and trusts nothing from here, so a stale or tampered
 * preview cannot influence what actually gets written.
 *
 * Query parameters:
 *   classId           (required) source class
 *   academicYearId    (required) source academic year
 *   toAcademicYearId  (optional) target academic year. When omitted the next
 *                     year after the source is suggested. When no later year
 *                     exists the response reports `requiresTargetYearSelection`
 *                     instead of silently reusing the source year — reusing the
 *                     source year was the original defect that made promotions
 *                     advance a student's class without enrolling them in the
 *                     following year.
 */
export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get("classId");
    const academicYearId = searchParams.get("academicYearId");
    const requestedTargetYearId = searchParams.get("toAcademicYearId");

    if (!classId || !academicYearId) {
      return badRequest("classId and academicYearId are required");
    }

    const [fromClass, sourceYear] = await Promise.all([
      prisma.class.findFirst({
        where: { id: classId, tenantId },
        select: { id: true, classId: true, name: true, classNumber: true },
      }),
      prisma.academicYear.findFirst({
        where: { id: academicYearId, tenantId },
        select: { id: true, yearId: true, label: true, startDate: true, endDate: true, isClosed: true },
      }),
    ]);

    if (!fromClass) return notFound("Class not found");
    if (!sourceYear) return notFound("Academic year not found");

    const ruleRow = await prisma.promotionRule.findFirst({
      where: { tenantId, classId: fromClass.id, academicYearId: sourceYear.id, isActive: true },
    });

    if (!ruleRow) {
      return notFound(
        `No active promotion rule is configured for '${fromClass.name}' in '${sourceYear.label}'. Create the rule before previewing promotions.`
      );
    }

    // PromotionRule.nextClassId is a plain column, not a relation, so the next
    // class is resolved explicitly.
    const nextClass = ruleRow.nextClassId
      ? await prisma.class.findFirst({
          where: { id: ruleRow.nextClassId, tenantId },
          select: { id: true, classId: true, name: true, classNumber: true },
        })
      : null;

    const rule: PromotionRuleInput = {
      id: ruleRow.id,
      classId: ruleRow.classId,
      academicYearId: ruleRow.academicYearId,
      minimumAttendance: ruleRow.minimumAttendance,
      minimumOverallPercentage: ruleRow.minimumOverallPercentage,
      minimumPerSubject: ruleRow.minimumPerSubject,
      maxFailedSubjects: ruleRow.maxFailedSubjects,
      allowConditionalPromotion: ruleRow.allowConditionalPromotion,
      autoPromote: ruleRow.autoPromote,
      nextClassId: ruleRow.nextClassId,
    };

    // ---------------------------------------------------------------------
    // Resolve the target academic year.
    // ---------------------------------------------------------------------
    const allYears = await prisma.academicYear.findMany({
      where: { tenantId },
      select: { id: true, yearId: true, label: true, startDate: true, endDate: true, isClosed: true },
      orderBy: { startDate: "asc" },
    });

    const sourceStart = new Date(sourceYear.startDate).getTime();

    const targetYearOptions = allYears.map((year) => ({
      id: year.id,
      yearId: year.yearId,
      label: year.label,
      startDate: year.startDate.toISOString(),
      endDate: year.endDate.toISOString(),
      isClosed: year.isClosed,
      isSource: year.id === sourceYear.id,
      /** Only a year that starts after the source year is a legal target. */
      isValidTarget: year.id !== sourceYear.id && new Date(year.startDate).getTime() > sourceStart,
    }));

    const suggestedTargetYear = suggestTargetAcademicYear(sourceYear.id, allYears);

    const targetYear = requestedTargetYearId
      ? allYears.find((year) => year.id === requestedTargetYearId) ?? null
      : suggestedTargetYear;

    if (requestedTargetYearId && !targetYear) {
      return notFound("Target academic year not found");
    }

    // An explicitly requested target year must still be a legal target.
    if (
      targetYear &&
      (targetYear.id === sourceYear.id ||
        new Date(targetYear.startDate).getTime() <= sourceStart)
    ) {
      return badRequest(
        "The target academic year must start after the source academic year.",
        [
          {
            field: "toAcademicYearId",
            code: "TARGET_YEAR_NOT_AFTER_SOURCE",
            message: `'${targetYear.label}' does not start after '${sourceYear.label}'.`,
          },
        ]
      );
    }

    // ---------------------------------------------------------------------
    // Cohort + evidence via the shared loader (no per-student query storm).
    // ---------------------------------------------------------------------
    const cohort = await loadPromotionCohort({
      tenantId,
      fromAcademicYearId: sourceYear.id,
      classId: fromClass.id,
      className: fromClass.name,
      classNumber: fromClass.classNumber,
    });

    const decisions: PromotionDecision[] = cohort.entries.map((entry) =>
      decidePromotion(entry.candidate, rule)
    );

    const summary = summariseDecisions(decisions);

    // Resolve every class the decisions point at, so a target is never guessed.
    const targetClassIds = [...new Set(decisions.map((decision) => decision.targetClassId))];
    const targetClasses = targetClassIds.length
      ? await prisma.class.findMany({
          where: { tenantId, id: { in: targetClassIds } },
          select: { id: true, name: true },
        })
      : [];
    const classNameById = new Map(targetClasses.map((cls) => [cls.id, cls.name]));

    const entryByStudent = new Map(
      cohort.entries.map((entry) => [entry.seed.studentProfileId, entry])
    );

    const students = decisions.map((decision) => {
      const entry = entryByStudent.get(decision.studentProfileId);
      const targetClassName = decision.exits
        ? null
        : classNameById.get(decision.targetClassId) ?? decision.fromClassName;

      return {
        id: decision.studentProfileId,
        studentProfileId: decision.studentProfileId,
        studentId: decision.studentId,
        studentName: decision.studentName,
        rollNumber: decision.rollNumber,
        currentClass: decision.fromClassName,
        currentClassId: decision.fromClassId,
        fromClassId: decision.fromClassId,
        fromClassName: decision.fromClassName,

        action: decision.action,
        eligible: decision.meetsCriteria,
        advances: decision.advances,
        repeats: decision.repeats,
        exits: decision.exits,
        requiresReExam: decision.requiresReExam,
        insufficientData: decision.insufficientData,
        isTerminalClass: decision.isTerminalClass,

        targetClassId: decision.targetClassId,
        targetClassName,
        /** Kept for existing consumers of the previous response shape. */
        suggestedNextClassId: decision.exits ? null : decision.targetClassId,
        suggestedNextClassName: decision.exits ? null : targetClassName,

        /**
         * Structured reason codes. The UI translates `code` + `params`; the
         * `message` is an English fallback for logs and API consumers.
         */
        reasons: decision.reasons,
        metrics: decision.metrics,
        subjectDetails: decision.subjectDetails,

        /** Placement provenance, so the operator can see why a student is here. */
        placementSource: entry?.seed.placementSource ?? "session",
      };
    });

    return successResponse(
      {
        class: {
          id: fromClass.id,
          classId: fromClass.classId,
          name: fromClass.name,
          classNumber: fromClass.classNumber,
        },
        academicYear: {
          id: sourceYear.id,
          yearId: sourceYear.yearId,
          label: sourceYear.label,
          startDate: sourceYear.startDate.toISOString(),
          isClosed: sourceYear.isClosed,
        },
        targetAcademicYear: targetYear
          ? {
              id: targetYear.id,
              yearId: targetYear.yearId,
              label: targetYear.label,
              startDate: targetYear.startDate.toISOString(),
              isClosed: targetYear.isClosed,
              isSuggested: !requestedTargetYearId,
            }
          : null,
        targetAcademicYearOptions: targetYearOptions,
        /**
         * True when no target year could be resolved (no later year exists).
         * The UI must block execution and ask the operator to create or select
         * the next academic year.
         */
        requiresTargetYearSelection: !targetYear,

        nextClass,
        isTerminalClass: !ruleRow.nextClassId,

        promotionRule: {
          id: ruleRow.id,
          minimumAttendance: ruleRow.minimumAttendance,
          minimumOverallPercentage: ruleRow.minimumOverallPercentage,
          minimumPerSubject: ruleRow.minimumPerSubject,
          maxFailedSubjects: ruleRow.maxFailedSubjects,
          allowConditionalPromotion: ruleRow.allowConditionalPromotion,
          autoPromote: ruleRow.autoPromote,
          nextClassId: ruleRow.nextClassId,
          nextClassName: nextClass?.name ?? null,
        },

        summary,

        // Counters kept for the existing UI; `summary` is the richer source.
        totalStudents: summary.total,
        eligibleCount: summary.promoted,
        retainedCount: summary.retained,
        conditionalCount: summary.conditionalPromoted,
        graduatedCount: summary.graduated,

        warnings: {
          legacyPlacement: cohort.legacyPlacementIds.map((id) => ({
            studentProfileId: id,
            studentName: cohort.nameByStudent.get(id) ?? id,
            message:
              "Placement taken from the student profile; no enrollment exists for this academic year.",
          })),
          insufficientData: decisions
            .filter((decision) => decision.insufficientData)
            .map((decision) => ({
              studentProfileId: decision.studentProfileId,
              studentName: decision.studentName,
              message: "No examination results were found, so the decision rests on absent data.",
            })),
        },

        students,
      },
      "Promotion eligibility calculated successfully"
    );
  } catch (error) {
    return handleApiError(error);
  }
}
