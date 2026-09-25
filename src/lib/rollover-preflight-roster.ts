import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-error";
import { attendanceRateFromCounts } from "@/lib/attendance-rate";
import { ACTIVE_CERTIFICATE_STATUSES } from "@/lib/certificate-numbering";
import { loadPromotionCohort } from "@/lib/promotion-roster";
import type {
  PreflightClass,
  PreflightRule,
  PreflightYear,
  PromotionPreflightInput,
  PromotionPreflightStudent,
  YearClosePreflightInput,
  YearClosePreflightStudent,
} from "@/lib/rollover-preflight";

/**
 * Evidence loading for the rollover pre-flight gate.
 *
 * Mirrors `promotion-roster.ts`: the pure checks in `rollover-preflight.ts`
 * decide, and this module only fetches. Keeping the queries here means the
 * preview route and the write path assemble the *same* input, so a cohort that
 * passes the gate in the UI cannot fail it in the handler for a reason nobody
 * can see.
 */

const YEAR_SELECT = {
  id: true,
  label: true,
  startDate: true,
  isClosed: true,
} as const;

const CLASS_SELECT = { id: true, name: true, classNumber: true } as const;

/**
 * Upper bound on how many students one year-close report loads.
 *
 * The check is whole-year by nature, so it cannot be paginated without lying
 * about the result. It can, however, be bounded — and when the bound is hit the
 * caller is told, so a partial report is never mistaken for a clean one.
 */
export const MAX_PREFLIGHT_STUDENTS = 5000;

export interface PreflightScanInfo {
  students: number;
  truncated: boolean;
}

// ---------------------------------------------------------------------------
// Promotion scope
// ---------------------------------------------------------------------------

/**
 * Loaders throw `ApiError` rather than returning a result union, matching
 * `assertAcademicYearOpen`. A missing year or class is a 404 the caller should
 * not have to unpack, and every caller already funnels through
 * `handleApiError`. It also removes a silent-failure shape: a caller that
 * forgot to check `ok` would have quietly skipped the gate.
 */
export interface LoadPromotionPreflightParams {
  tenantId: string;
  fromAcademicYearId: string;
  toAcademicYearId: string;
  classId: string;
  /** When given, only these students are judged — matching the write path's selection. */
  studentProfileIds?: readonly string[];
}

/**
 * Assemble the promotion-scope pre-flight input.
 *
 * The cohort itself comes from `loadPromotionCohort`, the same loader the
 * preview and the execute route use, so the gate sees exactly the students the
 * promotion would move.
 */
export async function loadPromotionPreflight(
  params: LoadPromotionPreflightParams
): Promise<PromotionPreflightInput> {
  const { tenantId, fromAcademicYearId, toAcademicYearId, classId } = params;

  const [fromYear, toYear, fromClass, allClasses, rule] = await Promise.all([
    prisma.academicYear.findFirst({
      where: { id: fromAcademicYearId, tenantId },
      select: YEAR_SELECT,
    }),
    prisma.academicYear.findFirst({
      where: { id: toAcademicYearId, tenantId },
      select: YEAR_SELECT,
    }),
    prisma.class.findFirst({
      where: { id: classId, tenantId },
      select: CLASS_SELECT,
    }),
    prisma.class.findMany({
      where: { tenantId },
      select: CLASS_SELECT,
      orderBy: { classNumber: "asc" },
    }),
    prisma.promotionRule.findFirst({
      where: { tenantId, classId, academicYearId: fromAcademicYearId, isActive: true },
      select: { classId: true, nextClassId: true, isActive: true, minimumAttendance: true },
    }),
  ]);

  if (!fromYear) throw ApiError.notFound("Source academic year not found");
  if (!toYear) throw ApiError.notFound("Target academic year not found");
  if (!fromClass) throw ApiError.notFound("Class not found");

  const cohort = await loadPromotionCohort({
    tenantId,
    fromAcademicYearId: fromYear.id,
    classId: fromClass.id,
    className: fromClass.name,
    classNumber: fromClass.classNumber,
  });

  const selection = params.studentProfileIds
    ? new Set(params.studentProfileIds)
    : null;
  const entries = selection
    ? cohort.entries.filter((entry) => selection.has(entry.seed.studentProfileId))
    : cohort.entries;

  const studentIds = entries.map((entry) => entry.seed.studentProfileId);

  // One probe for both questions: does the student hold a row for the year they
  // are leaving (authoritative placement), and do they already hold one for the
  // year they are being promoted into (a placement this run would overwrite).
  const enrollmentRows = studentIds.length
    ? await prisma.studentAcademicSession.findMany({
        where: {
          tenantId,
          studentProfileId: { in: studentIds },
          academicYearId: { in: [fromYear.id, toYear.id] },
        },
        select: { studentProfileId: true, academicYearId: true },
      })
    : [];

  const yearsByStudent = new Map<string, string[]>();
  for (const row of enrollmentRows) {
    const list = yearsByStudent.get(row.studentProfileId);
    if (list) list.push(row.academicYearId);
    else yearsByStudent.set(row.studentProfileId, [row.academicYearId]);
  }

  const students: PromotionPreflightStudent[] = entries.map((entry) => ({
    studentProfileId: entry.seed.studentProfileId,
    studentId: entry.seed.studentId,
    studentName: entry.seed.studentName,
    rollNumber: entry.seed.rollNumber,
    hasExamResults: entry.candidate.examResults.length > 0,
    demographics: entry.seed.demographics,
    enrolledAcademicYearIds: yearsByStudent.get(entry.seed.studentProfileId) ?? [],
  }));

  return {
    fromYear,
    toYear,
    fromClass,
    allClasses,
    rule: (rule as PreflightRule | null) ?? null,
    cohort: students,
  };
}

// ---------------------------------------------------------------------------
// Year-close scope
// ---------------------------------------------------------------------------

export interface YearClosePreflightLoad {
  input: YearClosePreflightInput;
  scan: PreflightScanInfo;
}

export interface LoadYearClosePreflightParams {
  tenantId: string;
  academicYearId: string;
  /**
   * A year the caller has already read. Passing it skips a redundant read and,
   * more importantly, removes the case where the loader cannot find a year the
   * caller just proved exists.
   */
  year?: PreflightYear;
}

interface SessionStudentRow {
  studentProfileId: string;
  rollNumber: string;
  classId: string;
  className: string;
  studentId: string;
  studentName: string;
  isActive: boolean;
  demographics: YearClosePreflightStudent["demographics"];
}

/**
 * Assemble the year-close pre-flight input.
 *
 * The student set is "everyone the year holds", not "everyone currently
 * active": a graduate leaves the roster during the promotion run, and their
 * leaving certificate is still owed after the fact. Excluding non-active
 * students would make the unissued-document check fire only for the students
 * who least need it.
 *
 * Students with no enrollment row for the year are included only when they also
 * have no enrollment in a *later* year. A student who was admitted straight
 * into the following year is not stranded in this one, and reporting them as
 * such would bury the real cases.
 */
export async function loadYearClosePreflight(
  params: LoadYearClosePreflightParams
): Promise<YearClosePreflightLoad> {
  const { tenantId, academicYearId } = params;

  const year =
    params.year ??
    (await prisma.academicYear.findFirst({
      where: { id: academicYearId, tenantId },
      select: YEAR_SELECT,
    }));

  if (!year) throw ApiError.notFound("Academic year not found");

  // Resolved first because the legacy-student filter needs the set of years
  // that come after this one.
  const laterYears = await prisma.academicYear.findMany({
    where: { tenantId, startDate: { gt: year.startDate } },
    select: { id: true },
  });
  const excludedYearIds = [year.id, ...laterYears.map((y) => y.id)];

  const [allClasses, rules, sessions, legacyProfiles] = await Promise.all([
    prisma.class.findMany({
      where: { tenantId },
      select: CLASS_SELECT,
      orderBy: { classNumber: "asc" },
    }),
    prisma.promotionRule.findMany({
      where: { tenantId, academicYearId, isActive: true },
      select: { classId: true, nextClassId: true, isActive: true, minimumAttendance: true },
    }),
    prisma.studentAcademicSession.findMany({
      where: { tenantId, academicYearId },
      select: {
        studentProfileId: true,
        rollNumber: true,
        classId: true,
        class: { select: { name: true } },
        studentProfile: {
          select: {
            studentId: true,
            firstName: true,
            lastName: true,
            status: true,
            guardianName: true,
            guardianContact: true,
            dateOfBirth: true,
            gender: true,
          },
        },
      },
      take: MAX_PREFLIGHT_STUDENTS + 1,
    }),
    prisma.studentProfile.findMany({
      where: {
        tenantId,
        status: "ACTIVE",
        academicSessions: { none: { academicYearId: { in: excludedYearIds } } },
      },
      select: {
        id: true,
        studentId: true,
        firstName: true,
        lastName: true,
        rollNumber: true,
        classId: true,
        class: { select: { name: true } },
        guardianName: true,
        guardianContact: true,
        dateOfBirth: true,
        gender: true,
      },
      take: MAX_PREFLIGHT_STUDENTS + 1,
    }),
  ]);

  const truncated =
    sessions.length > MAX_PREFLIGHT_STUDENTS ||
    legacyProfiles.length > MAX_PREFLIGHT_STUDENTS;

  const sessionRows: SessionStudentRow[] = sessions
    .slice(0, MAX_PREFLIGHT_STUDENTS)
    .map((row) => ({
      studentProfileId: row.studentProfileId,
      rollNumber: row.rollNumber,
      classId: row.classId,
      className: row.class.name,
      studentId: row.studentProfile.studentId,
      studentName: `${row.studentProfile.firstName} ${row.studentProfile.lastName}`.trim(),
      isActive: row.studentProfile.status === "ACTIVE",
      demographics: {
        guardianName: row.studentProfile.guardianName,
        guardianContact: row.studentProfile.guardianContact,
        dateOfBirth: row.studentProfile.dateOfBirth,
        gender: row.studentProfile.gender,
      },
    }));

  const legacyRows: SessionStudentRow[] = legacyProfiles
    .slice(0, MAX_PREFLIGHT_STUDENTS)
    .map((profile) => ({
      studentProfileId: profile.id,
      rollNumber: profile.rollNumber,
      classId: profile.classId ?? "",
      className: profile.class?.name ?? "",
      studentId: profile.studentId,
      studentName: `${profile.firstName} ${profile.lastName}`.trim(),
      isActive: true,
      demographics: {
        guardianName: profile.guardianName,
        guardianContact: profile.guardianContact,
        dateOfBirth: profile.dateOfBirth,
        gender: profile.gender,
      },
    }));

  // Counted over the year's session rows, which is the correct scope: a
  // `legacyRow` holds no enrollment for this year by construction, so its count
  // is genuinely 0 and must not be borrowed from anywhere else.
  //
  // Worth stating because it looks like an under-count: `StudentAcademicSession`
  // carries no unique index on (tenantId, academicYearId, studentProfileId), so
  // a count above 1 is reachable and `DUPLICATE_ENROLLMENT` is a real check
  // rather than a belt-and-braces one.
  const enrollmentCountByStudent = new Map<string, number>();
  for (const row of sessionRows) {
    enrollmentCountByStudent.set(
      row.studentProfileId,
      (enrollmentCountByStudent.get(row.studentProfileId) ?? 0) + 1
    );
  }

  const studentIds = [
    ...new Set([...sessionRows, ...legacyRows].map((row) => row.studentProfileId)),
  ];

  const [promotionRows, resultRows, certificateRows, attendanceRows] = await Promise.all([
    studentIds.length
      ? prisma.classPromotion.findMany({
          where: {
            tenantId,
            fromAcademicYearId: academicYearId,
            studentProfileId: { in: studentIds },
          },
          select: { studentProfileId: true, status: true },
          // Newest first, so the map below keeps the operative record when a
          // student somehow carries more than one.
          orderBy: { decidedAt: "desc" },
        })
      : Promise.resolve([] as Array<{ studentProfileId: string; status: string }>),
    studentIds.length
      ? prisma.examResult.groupBy({
          by: ["studentProfileId"],
          where: { tenantId, academicYearId, studentProfileId: { in: studentIds } },
        })
      : Promise.resolve([] as Array<{ studentProfileId: string }>),
    studentIds.length
      ? prisma.certificate.findMany({
          where: {
            tenantId,
            studentProfileId: { in: studentIds },
            status: { in: [...ACTIVE_CERTIFICATE_STATUSES] },
          },
          select: { studentProfileId: true, certificateType: true },
        })
      : Promise.resolve([] as Array<{ studentProfileId: string; certificateType: string }>),
    // Status counts rather than rows: the gate only needs the ratio, and a year
    // of registers for a whole school is a lot of rows to move for one number.
    // Scoped by `academicYearId` exactly as `promotion-roster.ts` scopes it, so
    // the close-time figure is the same one the promotion engine judged with.
    studentIds.length
      ? prisma.attendance.groupBy({
          by: ["studentProfileId", "status"],
          where: { tenantId, academicYearId, studentProfileId: { in: studentIds } },
          _count: { _all: true },
        })
      : Promise.resolve(
          [] as Array<{
            studentProfileId: string | null;
            status: string;
            _count: { _all: number };
          }>
        ),
  ]);

  const actionByStudent = new Map<string, string>();
  for (const row of promotionRows) {
    if (!actionByStudent.has(row.studentProfileId)) {
      actionByStudent.set(row.studentProfileId, row.status);
    }
  }

  const studentsWithResults = new Set(resultRows.map((row) => row.studentProfileId));

  const certificateTypesByStudent = new Map<string, string[]>();
  for (const row of certificateRows) {
    const list = certificateTypesByStudent.get(row.studentProfileId);
    if (list) list.push(row.certificateType);
    else certificateTypesByStudent.set(row.studentProfileId, [row.certificateType]);
  }

  const attendanceCountsByStudent = new Map<string, Record<string, number>>();
  for (const row of attendanceRows) {
    // Attendance is recorded against staff as well as students, so the column
    // is nullable and a staff row can appear in this grouping.
    if (!row.studentProfileId) continue;
    const counts = attendanceCountsByStudent.get(row.studentProfileId) ?? {};
    counts[row.status] = (counts[row.status] ?? 0) + row._count._all;
    attendanceCountsByStudent.set(row.studentProfileId, counts);
  }

  const students: YearClosePreflightStudent[] = [...sessionRows, ...legacyRows].map(
    (row) => ({
      studentProfileId: row.studentProfileId,
      studentId: row.studentId,
      studentName: row.studentName,
      rollNumber: row.rollNumber,
      hasExamResults: studentsWithResults.has(row.studentProfileId),
      demographics: row.demographics,
      classId: row.classId || null,
      className: row.className || null,
      enrollmentCountForYear: enrollmentCountByStudent.get(row.studentProfileId) ?? 0,
      promotionAction: actionByStudent.get(row.studentProfileId) ?? null,
      certificateTypes: certificateTypesByStudent.get(row.studentProfileId) ?? [],
      // `rate` is null when no teaching days are on file — which the gate
      // treats as "not tracked" and never enforces.
      attendanceRate: attendanceRateFromCounts(
        attendanceCountsByStudent.get(row.studentProfileId) ?? {}
      ).rate,
      isActive: row.isActive,
    })
  );

  return {
    input: {
      year,
      allClasses: allClasses as PreflightClass[],
      rules: rules as PreflightRule[],
      students,
    },
    scan: { students: students.length, truncated },
  };
}

/** Re-exported so callers can type the year they load without importing twice. */
export type { PreflightYear };
