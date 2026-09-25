/**
 * Rollover pre-flight validation.
 *
 * Pure and database-free, exactly like `promotion-engine.ts`, and for the same
 * reason: the checks that gate a year-end rollover must be the *same* checks
 * whether they run to warn an operator in the UI or to refuse a write in a
 * route handler. A gate that exists only in the UI is not a gate.
 *
 * Two entry points, because a rollover has two decision points:
 *   - `runPromotionPreflight` — is this cohort ready to cross a year boundary?
 *   - `runYearClosePreflight` — is this year ready to be frozen?
 *
 * Findings carry a structured `code` and `params`; the UI translates them.
 * `message` is an English fallback for logs and API consumers, never for
 * display. Same convention as promotion reasons.
 *
 * Severity is declared once, in `PREFLIGHT_SEVERITY`. A finding's severity is a
 * property of what went wrong, not of which entry point noticed it.
 */

export const PREFLIGHT_SEVERITIES = ["blocker", "warning"] as const;
export type PreflightSeverity = (typeof PREFLIGHT_SEVERITIES)[number];

export type PreflightCode =
  // --- year boundary -------------------------------------------------------
  | "SAME_ACADEMIC_YEAR"
  | "TARGET_YEAR_NOT_AFTER_SOURCE"
  | "YEAR_ALREADY_CLOSED"
  // --- rule readiness ------------------------------------------------------
  | "NO_PROMOTION_RULE"
  | "CLASS_WITHOUT_NEXT_CLASS"
  | "NEXT_CLASS_NOT_FOUND"
  // --- cohort integrity ----------------------------------------------------
  | "EMPTY_COHORT"
  | "STUDENT_WITHOUT_SESSION"
  | "STUDENT_WITHOUT_RESULTS"
  | "MISSING_ROLL_NUMBER"
  | "MISSING_DEMOGRAPHICS"
  | "DUPLICATE_ENROLLMENT"
  | "DUPLICATE_ROLL_NUMBER"
  // --- outcome readiness ---------------------------------------------------
  | "UNPROMOTED_STUDENT"
  | "UNISSUED_EXIT_DOCUMENT"
  | "ATTENDANCE_BELOW_REQUIREMENT";

/**
 * The single declaration of what each finding means for the operation.
 *
 * A blocker refuses the write. A warning is surfaced and the write proceeds —
 * warnings exist because "we noticed something you should look at" and "this
 * will corrupt data" are different messages, and flattening them into one
 * either trains operators to ignore the list or blocks legitimate work.
 */
export const PREFLIGHT_SEVERITY: Record<PreflightCode, PreflightSeverity> = {
  SAME_ACADEMIC_YEAR: "blocker",
  TARGET_YEAR_NOT_AFTER_SOURCE: "blocker",
  YEAR_ALREADY_CLOSED: "blocker",

  NO_PROMOTION_RULE: "blocker",
  CLASS_WITHOUT_NEXT_CLASS: "blocker",
  NEXT_CLASS_NOT_FOUND: "blocker",

  EMPTY_COHORT: "blocker",
  DUPLICATE_ENROLLMENT: "blocker",
  DUPLICATE_ROLL_NUMBER: "blocker",
  MISSING_ROLL_NUMBER: "blocker",

  STUDENT_WITHOUT_SESSION: "warning",
  STUDENT_WITHOUT_RESULTS: "warning",
  MISSING_DEMOGRAPHICS: "warning",

  UNPROMOTED_STUDENT: "blocker",
  UNISSUED_EXIT_DOCUMENT: "warning",
  /**
   * A warning, and deliberately so. The year is over and the register is
   * closed; refusing the close would trap the whole year over a figure nobody
   * can now change. What the finding buys is the operator's last cheap look —
   * after the close the outcomes are frozen and a change has to go through the
   * admin repair path.
   */
  ATTENDANCE_BELOW_REQUIREMENT: "warning",
};

export type PreflightSubjectKind = "year" | "class" | "student";

export interface PreflightSubject {
  kind: PreflightSubjectKind;
  id: string;
  label: string;
}

export interface PreflightFinding {
  code: PreflightCode;
  severity: PreflightSeverity;
  /** What the finding is about, so the UI can deep-link to it. */
  subject: PreflightSubject;
  params: Record<string, string | number>;
  /** English fallback for logs and non-UI API consumers. Not for display. */
  message: string;
}

/**
 * Fields a student must carry before a year is frozen. These are the fields a
 * leaving certificate is composed from; discovering a blank guardian name while
 * printing a transfer certificate is too late to fix it.
 *
 * `rollNumber` is deliberately absent: an empty roll number is a blocker in its
 * own right (`MISSING_ROLL_NUMBER`), because a rollover would carry the blank
 * into the next year rather than merely reporting it.
 */
export const REQUIRED_DEMOGRAPHIC_FIELDS = [
  "guardianName",
  "guardianContact",
  "dateOfBirth",
  "gender",
] as const;

export type RequiredDemographicField = (typeof REQUIRED_DEMOGRAPHIC_FIELDS)[number];

/**
 * What a student is expected to hold after leaving the roster. Matched as an
 * intersection: a school that issues a study certificate instead of a character
 * certificate to its graduates is not doing anything wrong.
 *
 * A warning, not a blocker — documents are routinely issued after the year is
 * frozen, and the year-end close must not be held hostage to the print queue.
 */
export const EXIT_DOCUMENT_EXPECTATION: Record<string, readonly string[]> = {
  GRADUATED: ["CHARACTER", "MARKSHEET", "STUDY"],
  TRANSFERRED: ["TRANSFER"],
};

// ---------------------------------------------------------------------------
// Input shapes
// ---------------------------------------------------------------------------

export interface PreflightYear {
  id: string;
  label: string;
  startDate: Date | string;
  isClosed: boolean;
}

export interface PreflightClass {
  id: string;
  name: string;
  classNumber: number;
}

export interface PreflightRule {
  classId: string;
  nextClassId: string | null;
  isActive: boolean;
  /**
   * The class's attendance requirement, as a percentage.
   *
   * Required rather than optional, and for the same reason severity is: a rule
   * that arrived without this field would make the close-time attendance check
   * compare against `undefined` and quietly never fire. A check that cannot
   * announce its own absence is not a check.
   *
   * The promotion engine reads the same value when it decides, so the two can
   * never judge the same student against different bars.
   */
  minimumAttendance: number;
}

export interface PreflightDemographics {
  guardianName?: string | null;
  guardianContact?: string | null;
  dateOfBirth?: Date | string | null;
  gender?: string | null;
}

export interface PreflightStudent {
  studentProfileId: string;
  studentId: string;
  studentName: string;
  rollNumber: string;
  hasExamResults: boolean;
  demographics: PreflightDemographics;
}

export interface PromotionPreflightStudent extends PreflightStudent {
  /**
   * Enrollment rows the student holds for the two years in play. A source-year
   * row is what makes a placement authoritative; a target-year row means the
   * student has already been placed in the year they are being promoted into.
   */
  enrolledAcademicYearIds: readonly string[];
}

export interface PromotionPreflightInput {
  fromYear: PreflightYear;
  toYear: PreflightYear;
  fromClass: PreflightClass;
  /**
   * Every class in the school. Required to answer "is this class terminal?"
   * honestly — the promotion engine can only see the rule, and a rule with a
   * null `nextClassId` looks identical whether the class is the final year or
   * somebody forgot to configure it.
   */
  allClasses: readonly PreflightClass[];
  /** The active rule for the source class, or null when none exists. */
  rule: PreflightRule | null;
  /** The students this run will actually act on. */
  cohort: readonly PromotionPreflightStudent[];
}

export interface YearClosePreflightStudent extends PreflightStudent {
  classId: string | null;
  className: string | null;
  /**
   * Enrollment rows held for the year being closed.
   *
   * 0 means the student is placed by their profile only, so the year cannot be
   * *proven* to be theirs — that is a warning. 1 is normal. More than 1 is a
   * defect, and the database's unique index says it should be impossible.
   */
  enrollmentCountForYear: number;
  /** Action recorded by the rollover, or null when the student was never rolled over. */
  promotionAction: string | null;
  /** Certificate types the student holds in an active status. */
  certificateTypes: readonly string[];
  /**
   * Attendance across the year being closed, or `null` when the school records
   * none for this student.
   *
   * `null` is never enforced. It means "not tracked", not "0%", and the two
   * must not be conflated here: `null < 75` is `true` in JavaScript, so a
   * school that does not use the attendance module would otherwise be handed a
   * defaulter list composed entirely of its own missing data.
   */
  attendanceRate: number | null;
  /**
   * Still on the active roster. An unpromoted student who has already left by
   * an administrative route is not stranded in the year; they are history.
   */
  isActive: boolean;
}

export interface YearClosePreflightInput {
  year: PreflightYear;
  allClasses: readonly PreflightClass[];
  /** Active promotion rules for the year. */
  rules: readonly PreflightRule[];
  /** Active students placed in the year, with their rollover evidence. */
  students: readonly YearClosePreflightStudent[];
}

export interface PreflightReport {
  /** True when there is no blocker. Warnings never stop a write. */
  canProceed: boolean;
  blockers: PreflightFinding[];
  warnings: PreflightFinding[];
  counts: { blockers: number; warnings: number };
  /** Full per-code counts, before any truncation. */
  countsByCode: Partial<Record<PreflightCode, number>>;
  /** Codes whose finding list was truncated for transport. */
  truncatedCodes: PreflightCode[];
}

/**
 * Findings are capped per code so a school with four thousand unmarked
 * students produces a bounded payload with an honest total, rather than a
 * multi-megabyte response nobody can read.
 */
export const MAX_FINDINGS_PER_CODE = 50;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function finding(
  code: PreflightCode,
  subject: PreflightSubject,
  params: Record<string, string | number>,
  message: string
): PreflightFinding {
  return { code, severity: PREFLIGHT_SEVERITY[code], subject, params, message };
}

function yearSubject(year: PreflightYear): PreflightSubject {
  return { kind: "year", id: year.id, label: year.label };
}

function classSubject(cls: PreflightClass): PreflightSubject {
  return { kind: "class", id: cls.id, label: cls.name };
}

function studentSubject(student: PreflightStudent): PreflightSubject {
  return { kind: "student", id: student.studentProfileId, label: student.studentName };
}

function hasValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (value instanceof Date) return !Number.isNaN(value.getTime());
  if (typeof value === "string") return value.trim().length > 0;
  return true;
}

function startOf(year: PreflightYear): number {
  return new Date(year.startDate).getTime();
}

/** The lowest-numbered class above `classNumber`, or null when there is none. */
export function nextHigherClass(
  allClasses: readonly PreflightClass[],
  classNumber: number
): PreflightClass | null {
  let best: PreflightClass | null = null;
  for (const cls of allClasses) {
    if (cls.classNumber <= classNumber) continue;
    if (!best || cls.classNumber < best.classNumber) best = cls;
  }
  return best;
}

// ---------------------------------------------------------------------------
// Shared check groups
// ---------------------------------------------------------------------------

/**
 * The year boundary must be crossed, and crossed forwards. Returns early
 * because every downstream check assumes two distinct years — reporting
 * "already enrolled in the target year" for each student when the target year
 * *is* the source year would bury the one finding that matters.
 */
function yearBoundaryFindings(
  fromYear: PreflightYear,
  toYear: PreflightYear
): PreflightFinding[] {
  if (fromYear.id === toYear.id) {
    return [
      finding(
        "SAME_ACADEMIC_YEAR",
        yearSubject(toYear),
        { sourceYear: fromYear.label, targetYear: toYear.label },
        "The target academic year is the source academic year. A promotion must cross a year boundary."
      ),
    ];
  }

  if (startOf(toYear) <= startOf(fromYear)) {
    return [
      finding(
        "TARGET_YEAR_NOT_AFTER_SOURCE",
        yearSubject(toYear),
        {
          sourceYear: fromYear.label,
          targetYear: toYear.label,
          sourceStartDate: new Date(fromYear.startDate).toISOString().slice(0, 10),
          targetStartDate: new Date(toYear.startDate).toISOString().slice(0, 10),
        },
        `'${toYear.label}' does not start after '${fromYear.label}'.`
      ),
    ];
  }

  return [];
}

function closedYearFindings(years: readonly PreflightYear[]): PreflightFinding[] {
  return years
    .filter((year) => year.isClosed)
    .map((year) =>
      finding(
        "YEAR_ALREADY_CLOSED",
        yearSubject(year),
        { year: year.label },
        `Academic year '${year.label}' is closed and read-only.`
      )
    );
}

/**
 * Rule readiness for one class.
 *
 * The `CLASS_WITHOUT_NEXT_CLASS` check is the one that earns this module its
 * keep. `PromotionRule.nextClassId === null` is how the engine spells "final
 * class", so a school that leaves it blank on Class 5 while Class 6 exists does
 * not get an error — it gets every student in Class 5 marked GRADUATED and
 * removed from the roster. There is no way to notice that from the rule alone;
 * it only becomes visible when the rule is compared against the class ladder.
 *
 * A school that genuinely wants a mid-ladder class to be terminal has to say so
 * by configuring the next class and overriding individual students, because
 * "this class has no next class" is not a statement the rule can make safely.
 */
function ruleFindings(
  fromClass: PreflightClass,
  allClasses: readonly PreflightClass[],
  rule: PreflightRule | null
): PreflightFinding[] {
  if (!rule || !rule.isActive) {
    return [
      finding(
        "NO_PROMOTION_RULE",
        classSubject(fromClass),
        { className: fromClass.name },
        `No active promotion rule is configured for '${fromClass.name}'. Eligibility cannot be evaluated without one.`
      ),
    ];
  }

  if (rule.nextClassId) {
    if (allClasses.some((cls) => cls.id === rule.nextClassId)) return [];
    return [
      finding(
        "NEXT_CLASS_NOT_FOUND",
        classSubject(fromClass),
        { className: fromClass.name, nextClassId: rule.nextClassId },
        `The promotion rule for '${fromClass.name}' points at a next class that does not exist.`
      ),
    ];
  }

  const higher = nextHigherClass(allClasses, fromClass.classNumber);
  if (!higher) return [];

  return [
    finding(
      "CLASS_WITHOUT_NEXT_CLASS",
      classSubject(fromClass),
      {
        className: fromClass.name,
        classNumber: fromClass.classNumber,
        higherClassName: higher.name,
        higherClassNumber: higher.classNumber,
      },
      `'${fromClass.name}' has no next class configured, but '${higher.name}' exists above it. Every student in '${fromClass.name}' would be marked GRADUATED.`
    ),
  ];
}

/**
 * Profile-level findings that apply to every student, in either scope.
 *
 * `demographics` is read defensively even though the type declares it required:
 * this is a safety gate, and a gate that throws is worse than no gate at all —
 * it would turn a missing field into a 500 on the write path instead of a
 * finding an operator can act on.
 */
function studentProfileFindings(student: PreflightStudent): PreflightFinding[] {
  const findings: PreflightFinding[] = [];

  if (!student.rollNumber?.trim()) {
    findings.push(
      finding(
        "MISSING_ROLL_NUMBER",
        studentSubject(student),
        { studentName: student.studentName, studentId: student.studentId },
        `${student.studentName} has no roll number. A rollover would carry the blank into the next year.`
      )
    );
  }

  const demographics = student.demographics ?? {};
  const missing = REQUIRED_DEMOGRAPHIC_FIELDS.filter(
    (field) => !hasValue(demographics[field])
  );

  if (missing.length > 0) {
    findings.push(
      finding(
        "MISSING_DEMOGRAPHICS",
        studentSubject(student),
        {
          studentName: student.studentName,
          studentId: student.studentId,
          fields: missing.join(", "),
          missingCount: missing.length,
        },
        `${student.studentName} is missing ${missing.join(", ")}.`
      )
    );
  }

  return findings;
}

function missingResultsFinding(student: PreflightStudent): PreflightFinding | null {
  if (student.hasExamResults) return null;
  return finding(
    "STUDENT_WITHOUT_RESULTS",
    studentSubject(student),
    { studentName: student.studentName, studentId: student.studentId },
    `${student.studentName} has no examination results, so their outcome rests on absent data.`
  );
}

/**
 * Two students in one cohort sharing a roll number means the source-year roll
 * assignment is already broken, and the target-year assignment inherits the
 * ambiguity. The database enforces uniqueness per (year, class, roll), so this
 * can only happen across sections — which is exactly the case that produces a
 * silent collision in the target class.
 */
function duplicateRollFindings(
  students: readonly PreflightStudent[],
  scope: { className: string }
): PreflightFinding[] {
  const byRoll = new Map<string, PreflightStudent[]>();

  for (const student of students) {
    const roll = student.rollNumber.trim();
    if (!roll) continue;
    const bucket = byRoll.get(roll);
    if (bucket) bucket.push(student);
    else byRoll.set(roll, [student]);
  }

  const findings: PreflightFinding[] = [];
  for (const [roll, holders] of byRoll) {
    if (holders.length < 2) continue;
    findings.push(
      finding(
        "DUPLICATE_ROLL_NUMBER",
        studentSubject(holders[0]),
        {
          className: scope.className,
          rollNumber: roll,
          count: holders.length,
          students: holders.map((s) => s.studentName).join(", "),
        },
        `Roll number '${roll}' is held by ${holders.length} students in '${scope.className}'.`
      )
    );
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Entry points
// ---------------------------------------------------------------------------

/**
 * Is this cohort ready to be promoted out of `fromYear` and into `toYear`?
 *
 * Called by the preview route to warn, and by the execute route to refuse. The
 * write path must treat `canProceed === false` as terminal.
 */
export function runPromotionPreflight(input: PromotionPreflightInput): PreflightReport {
  const boundary = yearBoundaryFindings(input.fromYear, input.toYear);
  if (boundary.length > 0) return summarisePreflight(boundary);

  const findings: PreflightFinding[] = [
    ...closedYearFindings([input.fromYear, input.toYear]),
    ...ruleFindings(input.fromClass, input.allClasses, input.rule),
  ];

  if (input.cohort.length === 0) {
    findings.push(
      finding(
        "EMPTY_COHORT",
        classSubject(input.fromClass),
        { className: input.fromClass.name, year: input.fromYear.label },
        `No active students are enrolled in '${input.fromClass.name}' for '${input.fromYear.label}'.`
      )
    );
    return summarisePreflight(findings);
  }

  for (const student of input.cohort) {
    findings.push(...studentProfileFindings(student));

    const withoutResults = missingResultsFinding(student);
    if (withoutResults) findings.push(withoutResults);

    // A source-year enrollment row is what makes the placement authoritative.
    // Without one the student's "current class" is where they are *now*, which
    // is not necessarily where they were then.
    if (!student.enrolledAcademicYearIds.includes(input.fromYear.id)) {
      findings.push(
        finding(
          "STUDENT_WITHOUT_SESSION",
          studentSubject(student),
          {
            studentName: student.studentName,
            studentId: student.studentId,
            year: input.fromYear.label,
          },
          `${student.studentName} has no enrollment record for '${input.fromYear.label}'; their placement is taken from the student profile.`
        )
      );
    }

    // Already placed in the target year. The execute path would upsert over it,
    // silently overwriting a placement somebody else made.
    //
    // `count` is 1 here by construction, and it is supplied rather than left
    // out on purpose. This code has a second call site — the year close, where
    // a student can hold several rows for one year — and a param supplied at
    // only one of two call sites cannot be interpolated: the message would
    // render a literal `{count}` for whichever caller omitted it. A translator
    // has no way to know that from the code, so the shape is made uniform here.
    if (student.enrolledAcademicYearIds.includes(input.toYear.id)) {
      findings.push(
        finding(
          "DUPLICATE_ENROLLMENT",
          studentSubject(student),
          {
            studentName: student.studentName,
            studentId: student.studentId,
            year: input.toYear.label,
            count: 1,
          },
          `${student.studentName} is already enrolled in '${input.toYear.label}'. Promoting them again would overwrite that placement.`
        )
      );
    }
  }

  findings.push(
    ...duplicateRollFindings(input.cohort, { className: input.fromClass.name })
  );

  return summarisePreflight(findings);
}

/**
 * Is this year ready to be frozen?
 *
 * Closing a year is the last moment at which "this cohort never crossed the
 * boundary" is still fixable. After the close, the year is read-only and the
 * students are stranded in it.
 *
 * Only two of the checks warn rather than block: unissued exit documents and
 * attendance shortfalls. Both describe something that is already true and can
 * still be acted on — or knowingly accepted — once the year is frozen.
 * Everything that would silently mis-place a student blocks.
 */
export function runYearClosePreflight(input: YearClosePreflightInput): PreflightReport {
  const findings: PreflightFinding[] = closedYearFindings([input.year]);

  const ruleByClass = new Map(input.rules.map((rule) => [rule.classId, rule]));

  // --- rules -----------------------------------------------------------------
  const classById = new Map(input.allClasses.map((cls) => [cls.id, cls]));
  const occupiedClassIds = new Set(
    input.students
      .map((student) => student.classId)
      .filter((id): id is string => Boolean(id))
  );

  for (const classId of occupiedClassIds) {
    const cls = classById.get(classId);
    if (!cls) continue;
    const rule = ruleByClass.get(classId);
    // A class with students but no rule can never be rolled over. Report it
    // once per class rather than once per student.
    findings.push(...ruleFindings(cls, input.allClasses, rule ?? null));
  }

  // --- students --------------------------------------------------------------
  for (const student of input.students) {
    findings.push(...studentProfileFindings(student));

    const withoutResults = missingResultsFinding(student);
    if (withoutResults) findings.push(withoutResults);

    // No enrollment row for the year. We cannot tell a legacy record from a
    // student who belongs to a later year, so this is reported, not enforced.
    if (student.enrollmentCountForYear === 0) {
      findings.push(
        finding(
          "STUDENT_WITHOUT_SESSION",
          studentSubject(student),
          {
            studentName: student.studentName,
            studentId: student.studentId,
            year: input.year.label,
          },
          `${student.studentName} has no enrollment record for '${input.year.label}'; their placement is taken from the student profile.`
        )
      );
    } else if (student.enrollmentCountForYear > 1) {
      findings.push(
        finding(
          "DUPLICATE_ENROLLMENT",
          studentSubject(student),
          {
            studentName: student.studentName,
            studentId: student.studentId,
            year: input.year.label,
            count: student.enrollmentCountForYear,
          },
          `${student.studentName} holds ${student.enrollmentCountForYear} enrollment records for '${input.year.label}'.`
        )
      );
    }

    // The headline check. An active student enrolled in a year that is being
    // closed with no promotion record never crossed the boundary, and once the
    // year is frozen there is no way back.
    if (student.promotionAction === null && student.isActive && student.enrollmentCountForYear >= 1) {
      findings.push(
        finding(
          "UNPROMOTED_STUDENT",
          studentSubject(student),
          {
            studentName: student.studentName,
            studentId: student.studentId,
            className: student.className ?? "",
            year: input.year.label,
          },
          `${student.studentName} is still enrolled in '${input.year.label}' with no promotion record. Run the year-end promotion before closing.`
        )
      );
    }

    // --- attendance ----------------------------------------------------------
    //
    // Not a duplicate of the promotion engine's `LOW_ATTENDANCE`. The engine
    // judges with whatever was on file the moment it ran, and registers keep
    // being marked for the rest of the year — so a student promoted in November
    // on 78% can finish the year at 68%, and the promotion record still says
    // they crossed. Only the close sees the whole year, and the close is the
    // last point at which the discrepancy is still cheap to act on.
    //
    // The `!== null` guard carries the whole check. `null` means the school
    // records no attendance, and `null < 75` is `true` in JavaScript, so
    // dropping the guard would report every student in an attendance-less
    // school as a defaulter — the exact defect that made the reports disagree
    // before `attendance-rate.ts` existed.
    //
    // No rule for the class means no requirement to compare against, so the
    // student is skipped rather than judged against an invented default.
    if (student.attendanceRate !== null) {
      const classRule = student.classId ? ruleByClass.get(student.classId) : undefined;

      if (classRule && student.attendanceRate < classRule.minimumAttendance) {
        findings.push(
          finding(
            "ATTENDANCE_BELOW_REQUIREMENT",
            studentSubject(student),
            {
              studentName: student.studentName,
              studentId: student.studentId,
              className: student.className ?? "",
              year: input.year.label,
              actual: student.attendanceRate,
              required: classRule.minimumAttendance,
            },
            `${student.studentName} attended ${student.attendanceRate}% of '${input.year.label}', below the ${classRule.minimumAttendance}% required for ${student.className ?? "their class"}.`
          )
        );
      }
    }

    // --- exit documents ------------------------------------------------------
    const expected = student.promotionAction
      ? EXIT_DOCUMENT_EXPECTATION[student.promotionAction]
      : undefined;

    if (expected && expected.length > 0) {
      const held = new Set(student.certificateTypes);
      if (!expected.some((type) => held.has(type))) {
        findings.push(
          finding(
            "UNISSUED_EXIT_DOCUMENT",
            studentSubject(student),
            {
              studentName: student.studentName,
              studentId: student.studentId,
              action: student.promotionAction ?? "",
              expectedDocuments: expected.join(", "),
            },
            `${student.studentName} left as ${student.promotionAction} without a ${expected.join(" / ")} certificate.`
          )
        );
      }
    }
  }

  findings.push(
    ...duplicateRollFindings(input.students, {
      className: `${input.year.label} cohort`,
    })
  );

  return summarisePreflight(findings);
}

/**
 * Fold a flat finding list into a transportable report.
 *
 * `counts` is computed over the full list, so truncation never hides how many
 * problems exist — only how many are shipped in one payload.
 */
export function summarisePreflight(
  findings: readonly PreflightFinding[],
  options: { perCodeLimit?: number } = {}
): PreflightReport {
  const perCodeLimit = options.perCodeLimit ?? MAX_FINDINGS_PER_CODE;

  const countsByCode: Partial<Record<PreflightCode, number>> = {};
  const keptByCode: Partial<Record<PreflightCode, number>> = {};
  const truncatedCodes = new Set<PreflightCode>();

  const blockers: PreflightFinding[] = [];
  const warnings: PreflightFinding[] = [];
  let blockerCount = 0;
  let warningCount = 0;

  for (const item of findings) {
    countsByCode[item.code] = (countsByCode[item.code] ?? 0) + 1;

    if (item.severity === "blocker") blockerCount++;
    else warningCount++;

    const kept = keptByCode[item.code] ?? 0;
    if (kept >= perCodeLimit) {
      truncatedCodes.add(item.code);
      continue;
    }
    keptByCode[item.code] = kept + 1;

    if (item.severity === "blocker") blockers.push(item);
    else warnings.push(item);
  }

  return {
    canProceed: blockerCount === 0,
    blockers,
    warnings,
    counts: { blockers: blockerCount, warnings: warningCount },
    countsByCode,
    truncatedCodes: [...truncatedCodes],
  };
}
