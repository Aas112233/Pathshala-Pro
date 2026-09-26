import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  errorResponse,
  unauthorized,
  forbidden,
  notFound,
  badRequest,
  handleApiError,
} from "@/lib/api-response";
import { updateAcademicYearSchema } from "@/lib/schemas";
import { requireApiAccess } from "@/lib/api-auth";
import { hasRolePermission } from "@/lib/permissions";
import {
  clearAcademicYearCache,
  clearCurrentAcademicYear,
  setCurrentAcademicYear,
} from "@/lib/academic-year-guards";
import { logAuditEvent } from "@/lib/audit-logger";
import { loadYearClosePreflight } from "@/lib/rollover-preflight-roster";
import { runYearClosePreflight } from "@/lib/rollover-preflight";
import { finaliseAcademicYearSessions } from "@/lib/academic-year-finalisation-roster";
import {
  buildLockedFieldsDetails,
  getAcademicYearUsageCounts,
  hasAcademicYearOperationalUsage,
  integrityViolation,
  lockedDeleteMessage,
  lockedUpdateMessage,
} from "@/lib/data-integrity";
import { ApiError } from "@/lib/api-error";

/**
 * GET /api/academic-years/[id]
 * Get a single academic year by ID
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

    const academicYear = await prisma.academicYear.findUnique({
      where: { id, tenantId },
      include: {
        feeVouchers: {
          take: 5,
          select: {
            voucherId: true,
            feeType: true,
            totalDue: true,
            status: true,
          },
        },
        salaryLedgers: {
          take: 5,
          select: {
            month: true,
            year: true,
            netPayable: true,
            status: true,
          },
        },
        examResults: {
          take: 5,
          select: {
            exam: {
              select: {
                name: true,
                type: true,
              },
            },
            subject: {
              select: {
                name: true,
                code: true,
              },
            },
            studentProfile: {
              select: {
                firstName: true,
                lastName: true,
                studentId: true,
              },
            },
            grade: true,
            status: true,
          },
        },
      },
    });

    if (!academicYear) {
      return notFound("Academic year not found");
    }

    return successResponse(academicYear);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PUT /api/academic-years/[id]
 * Update an academic year
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { tenantId, user } = access.authContext;
    const { id } = await params;

    const body = await request.json();
    const validation = updateAcademicYearSchema.safeParse(body);

    if (!validation.success) {
      const errors = validation.error.errors.map((err: any) => ({
        field: err.path.join("."),
        code: err.code,
        message: err.message,
      }));
      return badRequest("Invalid input", errors);
    }

    const data = validation.data;

    // Year-lifecycle changes carry their own capability. `academic:manage`
    // already gates this route's module tier, but promotion and day-to-day
    // academic administration are different responsibilities from freezing a
    // year, so the flag writes are re-checked against the dedicated grant.
    const changesLifecycle = data.isClosed !== undefined || data.isCurrent !== undefined;
    if (changesLifecycle && !hasRolePermission(user.role, "academic:rollover:execute")) {
      return forbidden(
        "Closing an academic year or switching the operating year requires the academic rollover capability."
      );
    }

    // Check if academic year exists
    const existingYear = await prisma.academicYear.findUnique({
      where: { id, tenantId },
    });

    if (!existingYear) {
      return notFound("Academic year not found");
    }

    if (existingYear.isClosed) {
      return integrityViolation(
        lockedUpdateMessage("Academic year", "it has already been closed"),
        [
          {
            field: "isClosed",
            code: "locked",
            message:
              "Closed academic years are read-only. Reopen support should be a separate controlled workflow if needed.",
          },
        ]
      );
    }

    const usageCounts = await getAcademicYearUsageCounts(tenantId, id);
    // Fee structures, rollover lineage and clone provenance are configuration,
    // not history: they must block deletion but must not freeze a still-empty
    // year's identity fields against a rename or date correction.
    const hasUsage = hasAcademicYearOperationalUsage(usageCounts);
    const attemptedFrozenFields = ["yearId", "label", "startDate", "endDate"].filter((field) =>
      Object.prototype.hasOwnProperty.call(body, field)
    );

    if (hasUsage && attemptedFrozenFields.length > 0) {
      return integrityViolation(
        lockedUpdateMessage(
          "Academic year",
          "operational records already exist in this academic year"
        ),
        buildLockedFieldsDetails(
          attemptedFrozenFields,
          "operational records already exist in this academic year"
        )
      );
    }

    // Check year ID uniqueness if changing
    if (data.yearId && data.yearId !== existingYear.yearId) {
      const idExists = await prisma.academicYear.findFirst({
        where: { tenantId, yearId: data.yearId, id: { not: id } },
      });

      if (idExists) {
        return badRequest("Year ID already in use", [
          { field: "yearId", code: "duplicate", message: "Year ID already exists" },
        ]);
      }
    }

    // Validate dates if provided
    const startDate = data.startDate ? new Date(data.startDate) : undefined;
    const endDate = data.endDate ? new Date(data.endDate) : undefined;

    if (startDate && isNaN(startDate.getTime())) {
      return badRequest("Invalid start date", [
        { field: "startDate", code: "invalid", message: "Start date must be a valid date" },
      ]);
    }

    if (endDate && isNaN(endDate.getTime())) {
      return badRequest("Invalid end date", [
        { field: "endDate", code: "invalid", message: "End date must be a valid date" },
      ]);
    }

    const effectiveStart = startDate ?? existingYear.startDate;
    const effectiveEnd = endDate ?? existingYear.endDate;

    if (effectiveStart >= effectiveEnd) {
      return badRequest("Invalid dates", [
        {
          field: "startDate",
          code: "invalid",
          message: "Start date must be before end date",
        },
      ]);
    }

    // A year that is closed and current at the same time has no meaning, and
    // the two flags are written by different branches below.
    if (data.isClosed === true && data.isCurrent === true) {
      return badRequest("A year cannot be closed and made current in the same request.", [
        {
          field: "isCurrent",
          code: "CONFLICTING_FLAGS",
          message: "A closed academic year cannot be the current year.",
        },
      ]);
    }

    type YearUpdatePayload = {
      yearId?: string;
      label?: string;
      startDate?: Date;
      endDate?: Date;
      isClosed?: boolean;
    };

    const updatePayload: YearUpdatePayload = {};
    if (data.yearId !== undefined) updatePayload.yearId = data.yearId;
    if (data.label !== undefined) updatePayload.label = data.label;
    if (startDate !== undefined) updatePayload.startDate = startDate;
    if (endDate !== undefined) updatePayload.endDate = endDate;
    if (data.isClosed !== undefined) updatePayload.isClosed = data.isClosed;

    const closingYear = data.isClosed === true && !existingYear.isClosed;
    const makingCurrent = data.isCurrent === true;

    // ---------------------------------------------------------------------
    // Pre-flight gate on close.
    //
    // Closing is the last moment at which "this cohort never crossed the
    // boundary" is still fixable. Afterwards the year is read-only and the
    // students are stranded in it, so a blocker here is terminal — the same
    // checks GET /api/academic-years/[id]/preflight reports are enforced here.
    // ---------------------------------------------------------------------
    if (closingYear) {
      // The year row is already in hand, so it is handed over rather than read
      // again — which also removes the case where the loader cannot find a year
      // this route just proved exists.
      const { input } = await loadYearClosePreflight({
        tenantId,
        academicYearId: id,
        year: existingYear,
      });
      const preflight = runYearClosePreflight(input);

      if (!preflight.canProceed) {
        return errorResponse(
          `Pre-flight checks blocked closing '${existingYear.label}': ${preflight.counts.blockers} blocker(s) must be resolved first.`,
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
    }

    const { updated: updatedAcademicYear, finalisation } = await prisma.$transaction(async (tx) => {
      const displacedCurrent = makingCurrent
        ? await tx.academicYear.findFirst({
            where: { tenantId, isCurrent: true, id: { not: id } },
            select: { id: true, label: true },
          })
        : null;

      // The write itself is tenant-scoped, not just the pre-transaction check:
      // a row deleted after the check would otherwise be resurrected by id.
      if (Object.keys(updatePayload).length > 0) {
        const written = await tx.academicYear.updateMany({
          where: { id, tenantId },
          data: updatePayload,
        });
        if (written.count === 0) {
          // Throwing rolls the transaction back, so no partial lifecycle write
          // can survive a year that vanished mid-request.
          throw ApiError.notFound("Academic year not found");
        }
      }

      // Re-read inside the transaction so the response describes what this
      // request actually wrote, not a stale pre-transaction snapshot.
      const updated = await tx.academicYear.findFirst({
        where: { id, tenantId },
        select: {
          id: true,
          yearId: true,
          label: true,
          startDate: true,
          endDate: true,
          isClosed: true,
          isCurrent: true,
          updatedAt: true,
        },
      });
      if (!updated) {
        throw ApiError.notFound("Academic year not found");
      }

      if (makingCurrent) {
        await setCurrentAcademicYear(tx, tenantId, id);
      }

      // Closing the operating year retires it as "current": a closed year
      // cannot be the year the institute is working in, and leaving the flag
      // set would make resolution skip past it to a weaker tier.
      if (closingYear) {
        await clearCurrentAcademicYear(tx, tenantId, id);
      }

      // ---------------------------------------------------------------------
      // Freeze the year's results onto every session in it.
      //
      // Deliberately inside the transaction and after the flags are settled: a
      // year must never end up closed without its snapshot, and there is no
      // inverse — nothing in this codebase reopens a closed year — so a failure
      // here has to abort the close rather than leave the year frozen and
      // unfinalised forever.
      // ---------------------------------------------------------------------
      const finalisation = closingYear
        ? await finaliseAcademicYearSessions(tx, { tenantId, academicYearId: id })
        : null;

      // Written inside the transaction. Switching or closing the operating year
      // changes what every other record means, so the entry cannot be optional.
      await logAuditEvent(
        {
          tenantId,
          userId: user.id,
          userEmail: user.email,
          action: closingYear ? "CLOSE" : makingCurrent ? "ROLLOVER" : "UPDATE",
          entity: "AcademicYear",
          entityId: id,
          details: {
            changedFields: Object.keys(updatePayload),
            before: {
              yearId: existingYear.yearId,
              label: existingYear.label,
              isClosed: existingYear.isClosed,
              isCurrent: existingYear.isCurrent,
            },
            displacedCurrentYear: displacedCurrent ?? null,
            // Recorded on the close entry so the audit trail can answer "what
            // was frozen, and for how many students" without re-deriving it.
            finalisation: finalisation
              ? {
                  sessions: finalisation.sessions,
                  withResults: finalisation.withResults,
                  withoutResults: finalisation.withoutResults,
                  resultsConsidered: finalisation.resultsConsidered,
                  averagePercentage: finalisation.averagePercentage,
                  pages: finalisation.pages,
                }
              : null,
          },
        },
        tx
      );

      return { updated, finalisation };
      },
      // A close finalises every session in the year, which is thousands of
      // writes; the default five-second interactive budget is nowhere near
      // enough and would fail only on the largest schools, which is the worst
      // possible place to discover a timeout.
      { timeout: 120_000, maxWait: 15_000 }
    );

    // The resolved-year cache is keyed by tenant and lives 60s; a switch or a
    // close makes it wrong immediately.
    clearAcademicYearCache();

    if (!finalisation) {
      return successResponse(updatedAcademicYear, "Academic year updated successfully");
    }

    // The count is surfaced rather than logged, because a student with no
    // results is left without a final percentage — and that is the operator's
    // last chance to notice before the year is out of reach for good.
    const noResultsNote =
      finalisation.withoutResults > 0
        ? ` ${finalisation.withoutResults} student(s) had no results recorded and were left without a final percentage.`
        : "";

    return successResponse(
      { ...updatedAcademicYear, finalisation },
      `Academic year '${updatedAcademicYear.label}' closed. ${finalisation.withResults} transcript(s) finalised.${noResultsNote}`
    );
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/academic-years/[id]
 * Delete an academic year
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { tenantId, user } = access.authContext;
    const { id } = await params;

    // Deleting a year is a lifecycle act, like closing it.
    if (!hasRolePermission(user.role, "academic:rollover:execute")) {
      return forbidden("Deleting an academic year requires the academic rollover capability.");
    }

    // Check if academic year exists
    const existingYear = await prisma.academicYear.findUnique({
      where: { id, tenantId },
    });

    if (!existingYear) {
      return notFound("Academic year not found");
    }

    // PUT refuses every edit to a closed year; DELETE must refuse too, or the
    // close ceremony's "irreversible" becomes quietly upgradeable to "deleted".
    // Deleting the current year stays possible (a just-created mistake year can
    // be current with zero history); resolution falls through to the next tier
    // and the cache is cleared below.
    if (existingYear.isClosed) {
      return integrityViolation(
        lockedUpdateMessage("Academic year", "it has already been closed and its history is frozen"),
        [
          {
            field: "isClosed",
            code: "locked",
            message:
              "Closed academic years are read-only and cannot be deleted. Reopen support would be a separate controlled workflow.",
          },
        ]
      );
    }

    const usageCounts = await getAcademicYearUsageCounts(tenantId, id);
    if (Object.values(usageCounts).some((count) => count > 0)) {
      return integrityViolation(lockedDeleteMessage("Academic year", usageCounts), [
        {
          field: "id",
          code: "in_use",
          message:
            "Academic years with linked finance, exam, or promotion records cannot be deleted.",
        },
      ]);
    }

    await prisma.$transaction(async (tx) => {
      // Tenant-scoped delete, not delete-by-id: the existence check above and
      // the write must not be able to act on different rows.
      const deleted = await tx.academicYear.deleteMany({ where: { id, tenantId } });
      if (deleted.count === 0) {
        throw ApiError.notFound("Academic year not found");
      }

      // Deleting a year is a lifecycle event like any other; the audit row has
      // to outlive the row it describes, so it is written in the same
      // transaction as the delete.
      await logAuditEvent(
        {
          tenantId,
          userId: user.id,
          userEmail: user.email,
          action: "DELETE",
          entity: "AcademicYear",
          entityId: id,
          details: {
            yearId: existingYear.yearId,
            label: existingYear.label,
            isClosed: existingYear.isClosed,
            isCurrent: existingYear.isCurrent,
          },
        },
        tx
      );
    });

    clearAcademicYearCache();

    return successResponse(null, "Academic year deleted successfully");
  } catch (error) {
    return handleApiError(error);
  }
}
