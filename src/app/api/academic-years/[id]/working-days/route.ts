import { NextRequest } from "next/server";
import { successResponse, handleApiError } from "@/lib/api-response";
import { ApiError } from "@/lib/api-error";
import { requireApiAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { assertAcademicYearOpen } from "@/lib/academic-year-guards";
import {
  assertNonWorkingWeekdays,
  enumerateWorkingDays,
  nonWorkingWeekdayNames,
  policyFromFirstDayOfWeek,
  readWorkingDayPolicy,
  type Weekday,
} from "@/lib/working-days";

/**
 * GET /api/academic-years/[id]/working-days
 * PUT /api/academic-years/[id]/working-days
 *
 * The academic year's working-day policy, and the count that follows from it.
 *
 * This is the write half of roadmap item 21. `working-days.ts` holds the
 * arithmetic; this route is where the policy is declared and where the count is
 * reported. There is no generated table of working days and no "regenerate"
 * step, deliberately: holidays are configured *after* the year is opened, so a
 * materialised list would be stale the first time someone adds a two-week
 * break, and staleness that requires remembering to re-run something is the
 * defect this module exists to avoid. The count is derived on demand from the
 * range, the policy and the holidays, so it cannot disagree with them.
 *
 * ## Why the response reports two calendars
 *
 * `AcademicHoliday` carries `affectsStaff` and `affectsStudents`, so a school's
 * students and its staff genuinely have different working-day counts — exam
 * leave closes the school to students while staff still attend. Reporting one
 * number would be exactly the conflation that produced the attendance defects
 * this module was written to fix, so both are reported side by side.
 *
 * ## Why an undeclared year reports `calendar: null`
 *
 * Null, never zero. Zero is a real answer (a month that is entirely holiday),
 * and a year whose policy has not been declared has no answer at all. Returning
 * `0` would put a number in front of an operator that looks like a fact.
 */

interface WorkingDayYearRow {
  id: string;
  label: string;
  yearId: string;
  startDate: Date;
  endDate: Date;
  isClosed: boolean;
  nonWorkingWeekdays: unknown;
}

interface HolidayRow {
  startDate: Date;
  endDate: Date;
  affectsStaff: boolean;
  affectsStudents: boolean;
}

function calendarFor(params: {
  year: { startDate: Date; endDate: Date };
  nonWorkingWeekdays: readonly Weekday[];
  holidays: readonly HolidayRow[];
  scope: "students" | "staff";
}) {
  const holidays = params.holidays.filter((holiday) =>
    params.scope === "students" ? holiday.affectsStudents : holiday.affectsStaff
  );

  const result = enumerateWorkingDays({
    startDate: params.year.startDate,
    endDate: params.year.endDate,
    nonWorkingWeekdays: params.nonWorkingWeekdays,
    holidays,
  });

  return {
    totalCalendarDays: result.totalCalendarDays,
    weekendDays: result.weekendDays,
    holidayWorkingDays: result.holidayWorkingDays,
    holidayCalendarDays: result.holidayCalendarDays,
    workingDays: result.count,
  };
}

/**
 * Reads the year and derives the report. Used by both verbs, so a PUT returns
 * exactly what the following GET will return rather than a hand-built echo that
 * could drift from it.
 */
async function loadYearReport(tenantId: string, yearId: string) {
  const year = (await prisma.academicYear.findFirst({
    where: { id: yearId, tenantId },
    select: {
      id: true,
      label: true,
      yearId: true,
      startDate: true,
      endDate: true,
      isClosed: true,
      nonWorkingWeekdays: true,
    },
  })) as WorkingDayYearRow | null;

  if (!year) throw ApiError.notFound("Academic year not found");

  // A corrupt stored value is refused rather than repaired: a policy of `[7]`
  // is a data defect and must not be silently coerced to Sunday.
  //
  // It is re-thrown as an explicit `ApiError` rather than left to propagate.
  // `handleApiError`'s fallback deliberately masks unclassified errors, so a
  // bare `Error` would reach the operator as a code-less "Internal server
  // error" — loud in the server log and useless in the UI, which is the same
  // "wrong with nothing to signal it" shape this module was written to remove.
  // 500, not 422: the caller sent nothing wrong. The status is 500 because the
  // *stored* value is broken, and the message says how to repair it — a valid
  // PUT overwrites the column and succeeds.
  let policy;
  try {
    policy = readWorkingDayPolicy(year.nonWorkingWeekdays);
  } catch (error) {
    throw new ApiError(
      `This academic year's stored working-day policy cannot be read (${
        error instanceof Error ? error.message : "unknown reason"
      }). Saving a valid policy here will replace it.`,
      500,
      [
        {
          field: "nonWorkingWeekdays",
          code: "INVALID_STORED_WORKING_DAY_POLICY",
          message: "The stored policy is not a list of weekday numbers 0 (Sunday) to 6 (Saturday).",
        },
      ]
    );
  }

  const yearSummary = {
    id: year.id,
    label: year.label,
    yearId: year.yearId,
    startDate: new Date(year.startDate).toISOString(),
    endDate: new Date(year.endDate).toISOString(),
    isClosed: year.isClosed,
  };

  if (!policy) {
    // The tenant's calendar-display setting is offered only as a pre-fill for a
    // form a human confirms. It is never used to compute anything.
    const tenant = await prisma.tenant.findUnique({
      where: { tenantId },
      select: { firstDayOfWeek: true },
    });
    const suggested = policyFromFirstDayOfWeek(tenant?.firstDayOfWeek);

    return {
      year: yearSummary,
      policy: {
        declared: false,
        nonWorkingWeekdays: [] as number[],
        nonWorkingWeekdayNames: [] as string[],
        suggestion: suggested
          ? {
              nonWorkingWeekdays: suggested.nonWorkingWeekdays,
              source: "tenantFirstDayOfWeek" as const,
              firstDayOfWeek: tenant?.firstDayOfWeek ?? null,
            }
          : null,
      },
      calendar: null,
    };
  }

  const holidays = (await prisma.academicHoliday.findMany({
    where: {
      tenantId,
      academicYearId: year.id,
      startDate: { lte: year.endDate },
      endDate: { gte: year.startDate },
    },
    select: { startDate: true, endDate: true, affectsStaff: true, affectsStudents: true },
  })) as HolidayRow[];

  const shared = {
    year: yearSummary,
    policy: {
      declared: true,
      nonWorkingWeekdays: [...policy.nonWorkingWeekdays],
      nonWorkingWeekdayNames: nonWorkingWeekdayNames(policy.nonWorkingWeekdays),
      suggestion: null,
    },
  };

  return {
    ...shared,
    calendar: {
      students: calendarFor({
        year,
        nonWorkingWeekdays: policy.nonWorkingWeekdays,
        holidays,
        scope: "students",
      }),
      staff: calendarFor({
        year,
        nonWorkingWeekdays: policy.nonWorkingWeekdays,
        holidays,
        scope: "staff",
      }),
    },
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;
    const { id } = await params;

    const report = await loadYearReport(tenantId, id);

    return successResponse(
      report,
      report.policy.declared
        ? "Working-day policy declared"
        : "No working-day policy is declared for this academic year"
    );
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;
    const { id } = await params;

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      throw ApiError.badRequest(
        "A JSON body carrying nonWorkingWeekdays is required.",
        [
          {
            field: "nonWorkingWeekdays",
            code: "MISSING_BODY",
            message: "Send { nonWorkingWeekdays: [0, 6] }.",
          },
        ]
      );
    }

    let nonWorkingWeekdays: Weekday[];
    try {
      nonWorkingWeekdays = assertNonWorkingWeekdays(
        (body as { nonWorkingWeekdays?: unknown }).nonWorkingWeekdays as readonly unknown[]
      );
    } catch (error) {
      throw ApiError.badRequest(
        error instanceof Error ? error.message : "Invalid working-day policy.",
        [
          {
            field: "nonWorkingWeekdays",
            code: "INVALID_WORKING_DAY_POLICY",
            message: "Send an array of integers 0 (Sunday) to 6 (Saturday).",
          },
        ]
      );
    }

    // The closed-year boundary applies here even though this writes a column on
    // the year itself rather than a year-scoped row: the working-day count is an
    // input to the attendance rate and to the payroll denominator, so changing
    // it after the close would silently move figures the close declared frozen.
    await assertAcademicYearOpen(tenantId, id);

    await prisma.academicYear.update({
      where: { id },
      data: { nonWorkingWeekdays },
    });

    const report = await loadYearReport(tenantId, id);

    return successResponse(
      report,
      `Working-day policy saved: ${
        nonWorkingWeekdays.length === 0
          ? "no weekly days off"
          : nonWorkingWeekdayNames(nonWorkingWeekdays).join(", ")
      }`
    );
  } catch (error) {
    return handleApiError(error);
  }
}
