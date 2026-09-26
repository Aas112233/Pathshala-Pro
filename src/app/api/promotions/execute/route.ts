import { NextRequest } from "next/server";
import { Prisma, type StudentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  badRequest,
  notFound,
  errorResponse,
  handleApiError,
  safeParseBody,
} from "@/lib/api-response";
import { executePromotionsSchema } from "@/lib/schemas";
import { requireApiAccess } from "@/lib/api-auth";
import { assertAcademicYearsOpen } from "@/lib/academic-year-guards";
import { logAuditEvent } from "@/lib/audit-logger";
import { loadPromotionCohort } from "@/lib/promotion-roster";
import {
  runPromotionPreflight,
  type PromotionPreflightStudent,
} from "@/lib/rollover-preflight";
import {
  decidePromotion,
  applyOverride,
  summariseDecisions,
  assignTargetRollNumbers,
  promotionStatusFor,
  studentStatusFor,
  locksSourceYearResults,
  type PromotionDecision,
  type PromotionRuleInput,
  type RollNumberPolicy,
  type RollAssignmentInput,
} from "@/lib/promotion-engine";

/**
 * POST /api/promotions/execute
 *
 * Cohort-scoped, server-authoritative promotion execution.
 *
 * The caller states which class is moving from which academic year into which
 * academic year. The server recomputes every student's action from the
 * promotion rule and their results — a client-supplied action is honoured only
 * as an explicit, audited per-student override. (The previous implementation
 * trusted the request body's `status` verbatim, which let any caller holding
 * the promote permission promote an ineligible student.)
 *
 * The whole batch is written inside one transaction, so a failure leaves no
 * partial promotions behind.
 */
export async function POST(request: NextRequest) {
  try {
    const access = await requireApiAccess(request, { permission: "academic:promote:execute" });
    if ("response" in access) return access.response;

    const { tenantId, user } = access.authContext;

    const parsed = await safeParseBody(request, executePromotionsSchema);
    if (!parsed.success) return parsed.errorResponse;
    const input = parsed.data;

    // ---------------------------------------------------------------------
    // Guard 1: the target year must genuinely differ from the source year.
    // This is the defect that made every prior promotion a no-op on the year.
    // ---------------------------------------------------------------------
    if (input.fromAcademicYearId === input.toAcademicYearId) {
      return badRequest(
        "Source and target academic year must be different. Promoting within a single year would advance a student's class without giving them an enrollment in the next year.",
        [
          {
            field: "toAcademicYearId",
            code: "SAME_ACADEMIC_YEAR",
            message: "Target academic year must differ from the source academic year.",
          },
        ]
      );
    }

    // ---------------------------------------------------------------------
    // Guard 2: both years must exist for this tenant and both must be open.
    // Checked once for the batch, not once per student.
    // ---------------------------------------------------------------------
    const [fromYear, toYear] = await Promise.all([
      prisma.academicYear.findFirst({
        where: { id: input.fromAcademicYearId, tenantId },
        select: { id: true, label: true, startDate: true, isClosed: true },
      }),
      prisma.academicYear.findFirst({
        where: { id: input.toAcademicYearId, tenantId },
        select: { id: true, label: true, startDate: true, isClosed: true },
      }),
    ]);

    if (!fromYear) return notFound("Source academic year not found");
    if (!toYear) return notFound("Target academic year not found");

    await assertAcademicYearsOpen(tenantId, [fromYear.id, toYear.id]);

    // ---------------------------------------------------------------------
    // Guard 3: the target year must come after the source year.
    // ---------------------------------------------------------------------
    if (new Date(toYear.startDate) <= new Date(fromYear.startDate)) {
      return badRequest("The target academic year must start after the source academic year.", [
        {
          field: "toAcademicYearId",
          code: "TARGET_YEAR_NOT_AFTER_SOURCE",
          message: `'${toYear.label}' starts on or before '${fromYear.label}'.`,
        },
      ]);
    }

    // ---------------------------------------------------------------------
    // Guard 4: the class and its promotion rule.
    // ---------------------------------------------------------------------
    const fromClass = await prisma.class.findFirst({
      where: { id: input.classId, tenantId },
      select: { id: true, name: true, classNumber: true },
    });
    if (!fromClass) return notFound("Class not found");

    const ruleRow = await prisma.promotionRule.findFirst({
      where: {
        tenantId,
        classId: fromClass.id,
        academicYearId: fromYear.id,
        isActive: true,
      },
    });

    if (!ruleRow) {
      return badRequest(
        `No active promotion rule is configured for '${fromClass.name}' in '${fromYear.label}'. Create the rule before promoting.`,
        [
          {
            field: "classId",
            code: "NO_PROMOTION_RULE",
            message: "A promotion rule is required to evaluate eligibility.",
          },
        ]
      );
    }

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
    // Cohort + evidence, loaded through the same path the preview uses.
    // ---------------------------------------------------------------------
    const cohort = await loadPromotionCohort({
      tenantId,
      fromAcademicYearId: fromYear.id,
      classId: fromClass.id,
      className: fromClass.name,
      classNumber: fromClass.classNumber,
    });
    const { nameByStudent } = cohort;

    let entries = cohort.entries;
    if (input.studentProfileIds !== undefined) {
      // An explicitly empty selection is a caller mistake, not a request to act
      // on the whole class. Treating [] as "all" would turn a failed selection
      // into a silent bulk promotion.
      if (input.studentProfileIds.length === 0) {
        return badRequest(
          "No students were selected for this batch. Omit 'studentProfileIds' entirely to act on the whole cohort.",
          [
            {
              field: "studentProfileIds",
              code: "EMPTY_SELECTION",
              message: "The selection is empty.",
            },
          ]
        );
      }

      const requested = new Set(input.studentProfileIds);
      const missing = [...requested].filter((id) => !nameByStudent.has(id));
      if (missing.length > 0) {
        return badRequest(
          "Some selected students are not enrolled in this class for the source academic year.",
          missing.map((id) => ({
            field: "studentProfileIds",
            code: "NOT_IN_COHORT",
            message: `Student ${id} is not part of this cohort.`,
          }))
        );
      }
      entries = entries.filter((entry) => requested.has(entry.seed.studentProfileId));
    }

    if (entries.length === 0) {
      return badRequest(
        `No active students found in '${fromClass.name}' for '${fromYear.label}'.`,
        [{ field: "classId", code: "EMPTY_COHORT", message: "The cohort is empty." }]
      );
    }

    const entryByStudent = new Map(entries.map((entry) => [entry.seed.studentProfileId, entry]));
    const studentIds = entries.map((entry) => entry.seed.studentProfileId);

    // ---------------------------------------------------------------------
    // Duplicate guard: a student may hold only one promotion per source year.
    // ---------------------------------------------------------------------
    const existingPromotions = await prisma.classPromotion.findMany({
      where: {
        tenantId,
        studentProfileId: { in: studentIds },
        fromAcademicYearId: fromYear.id,
      },
      select: { studentProfileId: true },
    });

    if (existingPromotions.length > 0) {
      return errorResponse(
        "Some students already have a promotion recorded for the source academic year. Reverse those records before running this batch again.",
        409,
        existingPromotions.map((p) => ({
          field: "studentProfileIds",
          code: "ALREADY_PROMOTED",
          message: `${nameByStudent.get(p.studentProfileId) ?? p.studentProfileId} already has a promotion for '${fromYear.label}'.`,
        }))
      );
    }

    // ---------------------------------------------------------------------
    // Pre-flight gate.
    //
    // The exact same pure checks that GET /api/promotions/preflight reports to
    // an operator are enforced here, because a gate that only exists in the UI
    // is a suggestion. The checks this adds over the guards above are the ones
    // that would otherwise fail silently:
    //
    //   - CLASS_WITHOUT_NEXT_CLASS: a null `nextClassId` is how the rule spells
    //     "final class", so leaving it blank on Class 5 while Class 6 exists
    //     marks the whole class GRADUATED and takes them off the roster.
    //   - DUPLICATE_ENROLLMENT: a student already placed in the target year
    //     would have that placement silently overwritten by the upsert below.
    // ---------------------------------------------------------------------
    const [targetYearPlacements, allClasses] = await Promise.all([
      prisma.studentAcademicSession.findMany({
        where: { tenantId, academicYearId: toYear.id, studentProfileId: { in: studentIds } },
        select: { studentProfileId: true },
      }),
      prisma.class.findMany({
        where: { tenantId },
        select: { id: true, name: true, classNumber: true },
        orderBy: { classNumber: "asc" },
      }),
    ]);

    const alreadyInTargetYear = new Set(
      targetYearPlacements.map((row) => row.studentProfileId)
    );

    const preflightCohort: PromotionPreflightStudent[] = entries.map((entry) => ({
      studentProfileId: entry.seed.studentProfileId,
      studentId: entry.seed.studentId,
      studentName: entry.seed.studentName,
      rollNumber: entry.seed.rollNumber,
      hasExamResults: entry.candidate.examResults.length > 0,
      demographics: entry.seed.demographics,
      enrolledAcademicYearIds: [
        // A session-derived placement is authoritative for the source year; a
        // profile-derived one is not, and that is what makes it a finding.
        ...(entry.seed.placementSource === "session" ? [fromYear.id] : []),
        ...(alreadyInTargetYear.has(entry.seed.studentProfileId) ? [toYear.id] : []),
      ],
    }));

    const preflight = runPromotionPreflight({
      fromYear,
      toYear,
      fromClass,
      allClasses,
      rule: ruleRow,
      cohort: preflightCohort,
    });

    if (!preflight.canProceed) {
      return errorResponse(
        `Pre-flight checks blocked this promotion run: ${preflight.counts.blockers} blocker(s) must be resolved before the cohort can be moved.`,
        409,
        [
          ...preflight.blockers.map((item) => ({
            field: item.subject.kind,
            code: item.code,
            message: item.message,
          })),
          ...(preflight.truncatedCodes.length > 0
            ? [
                {
                  code: "PREFLIGHT_TRUNCATED",
                  message: `Some findings were omitted from this response. Totals: ${preflight.counts.blockers} blocker(s), ${preflight.counts.warnings} warning(s).`,
                },
              ]
            : []),
        ]
      );
    }

    // ---------------------------------------------------------------------
    // Overrides: validated before applying so failures are clean 400s.
    // ---------------------------------------------------------------------
    const overrideByStudent = new Map(
      (input.overrides ?? []).map((o) => [o.studentProfileId, o])
    );

    const unknownOverrides = [...overrideByStudent.keys()].filter((id) => !entryByStudent.has(id));
    if (unknownOverrides.length > 0) {
      return badRequest(
        "Overrides reference students who are not part of this batch.",
        unknownOverrides.map((id) => ({
          field: "overrides",
          code: "NOT_IN_COHORT",
          message: `Override for unknown student ${id}.`,
        }))
      );
    }

    for (const [studentProfileId, override] of overrideByStudent) {
      if (override.action === "DEMOTED" && !override.toClassId) {
        return badRequest("A demotion requires an explicit target class.", [
          {
            field: "overrides",
            code: "DEMOTION_TARGET_REQUIRED",
            message: `${nameByStudent.get(studentProfileId) ?? studentProfileId} was set to DEMOTED without a target class.`,
          },
        ]);
      }

      if (override.action === "TRANSFERRED" && override.toClassId) {
        return badRequest(
          "A transfer-out has no target class inside this school. Remove 'toClassId', or use a different action.",
          [
            {
              field: "overrides",
              code: "TRANSFER_TARGET_NOT_ALLOWED",
              message: `${nameByStudent.get(studentProfileId) ?? studentProfileId} was set to TRANSFERRED with a target class.`,
            },
          ]
        );
      }
    }

    // ---------------------------------------------------------------------
    // Decide every student through the shared engine.
    // ---------------------------------------------------------------------
    const decisions: PromotionDecision[] = [];
    for (const entry of entries) {
      let decision = decidePromotion(entry.candidate, rule);

      const override = overrideByStudent.get(entry.seed.studentProfileId);
      if (override) {
        decision = applyOverride(decision, {
          action: override.action,
          toClassId: override.toClassId ?? null,
          reason: override.reason,
        });
      }

      decisions.push(decision);
    }

    // ---------------------------------------------------------------------
    // Resolve every class the decisions point at.
    // ---------------------------------------------------------------------
    // Every class the tenant owns is already in hand from the pre-flight, so
    // resolving a decision's target is a map lookup rather than a second query.
    const classById = new Map(allClasses.map((cls) => [cls.id, cls]));

    for (const decision of decisions) {
      const target = classById.get(decision.targetClassId);
      if (!target) {
        return badRequest(
          `The target class for ${decision.studentName} could not be resolved. Check the promotion rule's next class.`,
          [
            {
              field: "classId",
              code: "TARGET_CLASS_NOT_FOUND",
              message: `Class ${decision.targetClassId} does not exist for this tenant.`,
            },
          ]
        );
      }
      if (decision.action === "DEMOTED" && target.classNumber >= fromClass.classNumber) {
        return badRequest("A demotion must target a lower class than the current one.", [
          {
            field: "overrides",
            code: "INVALID_DEMOTION_TARGET",
            message: `'${target.name}' is not lower than '${fromClass.name}'.`,
          },
        ]);
      }
    }

    // ---------------------------------------------------------------------
    // Roll numbers for the target year.
    // ---------------------------------------------------------------------
    const targetClassIds = [
      ...new Set(decisions.filter((d) => !d.exits).map((d) => d.targetClassId)),
    ];

    const existingTargetSessions = targetClassIds.length
      ? await prisma.studentAcademicSession.findMany({
          where: { tenantId, academicYearId: toYear.id, classId: { in: targetClassIds } },
          select: { classId: true, rollNumber: true },
        })
      : [];

    const existingRollsByClass: Record<string, string[]> = {};
    for (const session of existingTargetSessions) {
      (existingRollsByClass[session.classId] ??= []).push(session.rollNumber);
    }

    const rollInputs: RollAssignmentInput[] = decisions.map((decision) => ({
      studentProfileId: decision.studentProfileId,
      targetClassId: decision.targetClassId,
      sourceRollNumber: decision.rollNumber,
      exits: decision.exits,
    }));

    const { assignments: rollAssignments, conflicts: rollConflicts } = assignTargetRollNumbers(
      rollInputs,
      existingRollsByClass,
      input.rollNumberPolicy as RollNumberPolicy
    );

    if (rollConflicts.length > 0) {
      return badRequest(
        "Roll numbers would collide in the target year. Re-run with the sequential roll number policy, or promote one section at a time.",
        rollConflicts.map((conflict) => ({
          field: "rollNumberPolicy",
          code: "ROLL_NUMBER_CONFLICT",
          message: `${nameByStudent.get(conflict.studentProfileId) ?? conflict.studentProfileId}: roll number '${conflict.rollNumber}' already exists in the target class.`,
        }))
      );
    }

    // ---------------------------------------------------------------------
    // Persist the batch atomically.
    // ---------------------------------------------------------------------
    const batchDecidedAt = new Date();
    const batchReason = input.reason?.trim() || null;
    // Exits are dated explicitly: the operator states the effective date, and
    // it falls back to the commit time rather than to some inferred value.
    const exitDate = input.exitDate ? new Date(input.exitDate) : batchDecidedAt;

    const outcome = await prisma.$transaction(
      async (tx) => {
        const promotionRows: Prisma.ClassPromotionCreateManyInput[] = [];
        /** studentProfileId[] keyed by the lifecycle status each exit writes. */
        const exitsByStatus = new Map<StudentStatus, string[]>();
        let targetSessionsWritten = 0;

        for (const decision of decisions) {
          const seed = entryByStudent.get(decision.studentProfileId)!.seed;
          const targetClass = classById.get(decision.targetClassId)!;
          const rollNumber = rollAssignments.get(decision.studentProfileId) ?? null;
          const reasonText = batchReason ?? decision.reasons.map((r) => r.message).join(" ");

          promotionRows.push({
            tenantId,
            studentProfileId: decision.studentProfileId,
            fromAcademicYearId: fromYear.id,
            toAcademicYearId: toYear.id,
            fromClassId: fromClass.id,
            toClassId: decision.targetClassId,
            status: decision.action,
            reason: reasonText,
            reExamRequired: decision.requiresReExam,
            decidedBy: user.id,
            decidedAt: batchDecidedAt,
          });

          // Source-year snapshot. Written for every student, including those
          // who graduate, so the year they left is always reconstructable.
          const sourceSnapshot = {
            source: "promotion-execute",
            academicYearId: fromYear.id,
            action: decision.action,
            decidedAt: batchDecidedAt.toISOString(),
          };

          await tx.studentAcademicSession.upsert({
            where: {
              tenantId_studentProfileId_academicYearId: {
                tenantId,
                studentProfileId: decision.studentProfileId,
                academicYearId: fromYear.id,
              },
            },
            update: {
              classId: fromClass.id,
              sectionId: seed.sectionId,
              groupId: seed.groupId,
              rollNumber: decision.rollNumber,
              classNumber: fromClass.classNumber,
              promotionStatus: promotionStatusFor(decision.action),
              snapshot: sourceSnapshot,
            },
            create: {
              tenantId,
              studentProfileId: decision.studentProfileId,
              academicYearId: fromYear.id,
              classId: fromClass.id,
              sectionId: seed.sectionId,
              groupId: seed.groupId,
              rollNumber: decision.rollNumber,
              classNumber: fromClass.classNumber,
              totalMarks: 0,
              obtainedMarks: 0,
              promotionStatus: promotionStatusFor(decision.action),
              snapshot: sourceSnapshot,
            },
          });

          // Target-year enrollment. Graduates exit the roster and therefore
          // receive no enrollment row for a year they never attend.
          if (!decision.exits && rollNumber) {
            const stayingInSameClass = decision.targetClassId === fromClass.id;
            const targetSnapshot = {
              source: "promotion-execute",
              fromAcademicYearId: fromYear.id,
              action: decision.action,
              decidedAt: batchDecidedAt.toISOString(),
            };

            await tx.studentAcademicSession.upsert({
              where: {
                tenantId_studentProfileId_academicYearId: {
                  tenantId,
                  studentProfileId: decision.studentProfileId,
                  academicYearId: toYear.id,
                },
              },
              update: {
                classId: decision.targetClassId,
                sectionId: stayingInSameClass ? seed.sectionId : null,
                groupId: stayingInSameClass ? seed.groupId : null,
                rollNumber,
                classNumber: targetClass.classNumber,
                promotionStatus: "ENROLLED",
                snapshot: targetSnapshot,
              },
              create: {
                tenantId,
                studentProfileId: decision.studentProfileId,
                academicYearId: toYear.id,
                classId: decision.targetClassId,
                sectionId: stayingInSameClass ? seed.sectionId : null,
                groupId: stayingInSameClass ? seed.groupId : null,
                rollNumber,
                classNumber: targetClass.classNumber,
                totalMarks: 0,
                obtainedMarks: 0,
                promotionStatus: "ENROLLED",
                snapshot: targetSnapshot,
              },
            });
            targetSessionsWritten++;
          }

          if (decision.exits) {
            // Graduation and transfer-out both leave the roster, but they are
            // not the same event: one owes a transcript, the other a transfer
            // certificate, and reporting treats them differently.
            const exitStatus = studentStatusFor(decision.action);
            const bucket = exitsByStatus.get(exitStatus) ?? [];
            bucket.push(decision.studentProfileId);
            exitsByStatus.set(exitStatus, bucket);
          } else {
            // The profile carries the student's operative placement, so it must
            // follow the promotion. A retained student keeps their class,
            // section and group but still takes the target year's roll number;
            // an advancing student moves class and therefore starts with no
            // section/group until the office assigns one.
            const staysInClass = decision.targetClassId === fromClass.id;
            await tx.studentProfile.update({
              where: { id: decision.studentProfileId },
              data: {
                classId: decision.targetClassId,
                sectionId: staysInClass ? seed.sectionId : null,
                groupId: staysInClass ? seed.groupId : null,
                rollNumber: rollNumber ?? decision.rollNumber,
              },
            });
          }

          if (locksSourceYearResults(decision.action)) {
            await tx.examResult.updateMany({
              where: {
                tenantId,
                studentProfileId: decision.studentProfileId,
                academicYearId: fromYear.id,
              },
              data: { isLocked: true },
            });
          }
        }

        await tx.classPromotion.createMany({ data: promotionRows });

        // The batch outcome is audited inside the transaction that produced it.
        // A promotion run rewrites every student's placement for two academic
        // years; an entry that could be lost is not an audit trail.
        await logAuditEvent(
          {
            tenantId,
            userId: user.id,
            userEmail: user.email,
            action: "PROMOTE",
            entity: "Promotion",
            entityId: fromClass.id,
            details: {
              fromAcademicYear: { id: fromYear.id, label: fromYear.label },
              toAcademicYear: { id: toYear.id, label: toYear.label },
              class: { id: fromClass.id, name: fromClass.name },
              rollNumberPolicy: input.rollNumberPolicy,
              exitDate: exitDate.toISOString(),
              studentsProcessed: decisions.length,
              manualOverrides: overrideByStudent.size,
              summary: summariseDecisions(decisions),
            },
          },
          tx
        );

        // Exits leave the active roster. Grouped by status so a mixed batch of
        // graduates and transfers is written in at most two statements, and the
        // exit date is recorded rather than left to be guessed from updatedAt.
        for (const [status, ids] of exitsByStatus) {
          await tx.studentProfile.updateMany({
            where: { id: { in: ids }, tenantId },
            data: {
              status,
              classId: null,
              sectionId: null,
              groupId: null,
              exitDate,
            },
          });
        }

        const createdPromotions = await tx.classPromotion.findMany({
          where: {
            tenantId,
            fromAcademicYearId: fromYear.id,
            studentProfileId: { in: studentIds },
          },
          include: {
            studentProfile: {
              select: { studentId: true, firstName: true, lastName: true, rollNumber: true },
            },
            fromClass: { select: { classId: true, name: true } },
            toClass: { select: { classId: true, name: true } },
          },
          orderBy: { studentProfile: { studentId: "asc" } },
        });

        return { createdPromotions, targetSessionsWritten };
      },
      { timeout: 120_000, maxWait: 15_000 }
    );

    const summary = summariseDecisions(decisions);

    return successResponse(
      {
        fromAcademicYear: { id: fromYear.id, label: fromYear.label },
        toAcademicYear: { id: toYear.id, label: toYear.label },
        fromClass: {
          id: fromClass.id,
          name: fromClass.name,
          classNumber: fromClass.classNumber,
        },
        rollNumberPolicy: input.rollNumberPolicy,
        decidedAt: batchDecidedAt.toISOString(),
        exitDate: exitDate.toISOString(),
        summary,
        warnings: {
          /**
           * Non-blocking pre-flight findings. The run proceeded, but these are
           * the things an operator should look at while the year is still open:
           * an unmarked student, a legacy placement, a blank demographic field.
           */
          preflight: preflight.warnings,
          legacyPlacement: entries
            .filter((entry) => entry.seed.placementSource === "profile")
            .map((entry) => ({
              studentProfileId: entry.seed.studentProfileId,
              studentName: entry.seed.studentName,
              message:
                "Placement taken from the student profile; no enrollment exists for this academic year.",
            })),
          insufficientData: decisions
            .filter((d) => d.insufficientData)
            .map((d) => ({
              studentProfileId: d.studentProfileId,
              studentName: d.studentName,
              message: "No examination results were found, so the decision rests on absent data.",
            })),
          provisionalRollNumbers:
            input.rollNumberPolicy === "SEQUENTIAL" ? rollAssignments.size : 0,
          targetEnrollmentsCreated: outcome.targetSessionsWritten,
        },
        promotions: outcome.createdPromotions,
      },
      `Processed ${decisions.length} student(s): ${summary.promoted} promoted, ${summary.conditionalPromoted} conditional, ${summary.graduated} graduated, ${summary.transferred} transferred, ${summary.retained} retained${summary.demoted ? `, ${summary.demoted} demoted` : ""}.`,
      201
    );
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * GET /api/promotions/execute
 * Promotion history, optionally scoped to a student, source year, or class.
 */
export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;
    const { searchParams } = new URL(request.url);
    const studentProfileId = searchParams.get("studentProfileId");
    const academicYearId = searchParams.get("academicYearId");
    const classId = searchParams.get("classId");

    const where: Prisma.ClassPromotionWhereInput = { tenantId };

    if (studentProfileId) where.studentProfileId = studentProfileId;
    if (academicYearId) where.fromAcademicYearId = academicYearId;
    if (classId) where.fromClassId = classId;

    const promotions = await prisma.classPromotion.findMany({
      where,
      include: {
        studentProfile: {
          select: {
            studentId: true,
            firstName: true,
            lastName: true,
            rollNumber: true,
          },
        },
        fromClass: { select: { classId: true, name: true } },
        toClass: { select: { classId: true, name: true } },
        fromAcademicYear: { select: { yearId: true, label: true } },
        toAcademicYear: { select: { yearId: true, label: true } },
        decidedByUser: { select: { name: true, role: true } },
      },
      orderBy: { decidedAt: "desc" },
    });

    return successResponse(promotions, "Promotion history retrieved successfully");
  } catch (error) {
    return handleApiError(error);
  }
}
