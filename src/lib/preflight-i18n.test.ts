// @vitest-environment node
import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { createTranslator } from "next-intl";
import {
  PREFLIGHT_SEVERITY,
  runPromotionPreflight,
  runYearClosePreflight,
  type PreflightClass,
  type PreflightCode,
  type PreflightFinding,
  type PreflightRule,
  type PromotionPreflightInput,
  type PromotionPreflightStudent,
  type YearClosePreflightInput,
  type YearClosePreflightStudent,
} from "@/lib/rollover-preflight";

/**
 * The `promotions.preflight.codes` / `.fixes` guard.
 *
 * `RolloverPreflightPanel` renders every finding through
 * `t(\`codes.${finding.code}\`, finding.params)` — a key that is a runtime
 * value, so the repository-wide literal-key scanner in
 * `i18n-parity-and-interpolation.test.ts` cannot see it. The namespace was
 * therefore absent in all four locales for as long as the panel has existed,
 * and nothing complained: use-intl does not throw on a missing message, it
 * returns the raw key path, which the panel swallows into its `catch` and
 * replaces with the server's English `message`. So the gate that exists to stop
 * an operator spoke English in Urdu, Hindi and Bengali, and its `fixes` lookup
 * rendered as an empty line under every finding.
 *
 * `promotions.reasons` already had this guard (`promotion-reason-i18n.test.ts`);
 * the preflight vocabulary did not. Five things are pinned here:
 *   1. the runtime vocabulary is exactly the codes the module can emit;
 *   2. every code has a non-empty message *and* a non-empty remedy in all four
 *      locales;
 *   3. no locale interpolates a variable the module never supplies for that
 *      code, which would render as a literal `{placeholder}`;
 *   4. the namespace holds no key the module cannot emit;
 *   5. every locale interpolates the same variables in the same order as en.
 */

const LOCALES = ["en", "ur", "hi", "bn"] as const;

/**
 * Every code the module can emit, read off the severity map rather than
 * restated. A code added to the union without a scenario below fails the
 * coverage assertion, which is what forces the vocabulary and the translations
 * to move together.
 */
const DECLARED_CODES = Object.keys(PREFLIGHT_SEVERITY) as PreflightCode[];

function loadLocale(lang: string): Record<string, any> {
  return JSON.parse(
    fs.readFileSync(path.join(process.cwd(), `src/messages/${lang}.json`), "utf8")
  );
}

function extractVariables(str: string): string[] {
  const matches = str.match(/\{([a-zA-Z0-9_]+)\}/g);
  return matches ? matches.map((m) => m.replace(/[{}]/g, "")) : [];
}

// --- fixtures (same shapes as rollover-preflight.test.ts) ------------------

const FROM_YEAR = {
  id: "ay-2025",
  label: "2025-2026",
  startDate: new Date("2025-04-01"),
  isClosed: false,
};

const TO_YEAR = {
  id: "ay-2026",
  label: "2026-2027",
  startDate: new Date("2026-04-01"),
  isClosed: false,
};

const CLASS_5: PreflightClass = { id: "cls-5", name: "Class 5", classNumber: 5 };
const CLASS_6: PreflightClass = { id: "cls-6", name: "Class 6", classNumber: 6 };

const MINIMUM_ATTENDANCE = 75;

function rule(overrides: Partial<PreflightRule> = {}): PreflightRule {
  return {
    classId: CLASS_5.id,
    nextClassId: CLASS_6.id,
    isActive: true,
    minimumAttendance: MINIMUM_ATTENDANCE,
    ...overrides,
  };
}

const FULL_DEMOGRAPHICS = {
  guardianName: "Karim Khan",
  guardianContact: "03001234567",
  dateOfBirth: new Date("2014-06-01"),
  gender: "MALE",
};

function student(overrides: Partial<PromotionPreflightStudent> = {}): PromotionPreflightStudent {
  return {
    studentProfileId: "stu-1",
    studentId: "S001",
    studentName: "Ali Khan",
    rollNumber: "12",
    hasExamResults: true,
    demographics: { ...FULL_DEMOGRAPHICS },
    enrolledAcademicYearIds: [FROM_YEAR.id],
    ...overrides,
  };
}

function promotionInput(
  overrides: Partial<PromotionPreflightInput> = {}
): PromotionPreflightInput {
  return {
    fromYear: FROM_YEAR,
    toYear: TO_YEAR,
    fromClass: CLASS_5,
    allClasses: [CLASS_5, CLASS_6],
    rule: rule(),
    cohort: [student()],
    ...overrides,
  };
}

function closeStudent(
  overrides: Partial<YearClosePreflightStudent> = {}
): YearClosePreflightStudent {
  return {
    studentProfileId: "stu-1",
    studentId: "S001",
    studentName: "Ali Khan",
    rollNumber: "12",
    hasExamResults: true,
    demographics: { ...FULL_DEMOGRAPHICS },
    classId: CLASS_5.id,
    className: CLASS_5.name,
    enrollmentCountForYear: 1,
    promotionAction: "PROMOTED",
    certificateTypes: [],
    attendanceRate: null,
    isActive: true,
    ...overrides,
  };
}

function closeInput(overrides: Partial<YearClosePreflightInput> = {}): YearClosePreflightInput {
  return {
    year: FROM_YEAR,
    allClasses: [CLASS_5, CLASS_6],
    rules: [rule()],
    students: [closeStudent()],
    ...overrides,
  };
}

/**
 * One reachable scenario per code.
 *
 * `DUPLICATE_ENROLLMENT` appears twice on purpose: it is the only code with two
 * call sites, and the two disagree about which params they supply. The
 * intersection below is computed across both so a message cannot interpolate a
 * value that one of them omits — the defect this table exists to prevent.
 */
const SCENARIOS: Array<{ code: PreflightCode; label: string; findings: PreflightFinding[] }> = [
  {
    code: "SAME_ACADEMIC_YEAR",
    label: "the target year is the source year",
    findings: runPromotionPreflight(promotionInput({ toYear: FROM_YEAR })).blockers,
  },
  {
    code: "TARGET_YEAR_NOT_AFTER_SOURCE",
    label: "the target year starts before the source year",
    findings: runPromotionPreflight(
      promotionInput({ toYear: { ...TO_YEAR, startDate: new Date("2024-04-01") } })
    ).blockers,
  },
  {
    code: "YEAR_ALREADY_CLOSED",
    label: "the year being closed is already closed",
    findings: runYearClosePreflight(closeInput({ year: { ...FROM_YEAR, isClosed: true } }))
      .blockers,
  },
  {
    code: "NO_PROMOTION_RULE",
    label: "the class has no promotion rule",
    findings: runPromotionPreflight(promotionInput({ rule: null })).blockers,
  },
  {
    code: "NEXT_CLASS_NOT_FOUND",
    label: "the rule points at a class that does not exist",
    findings: runPromotionPreflight(
      promotionInput({ rule: rule({ nextClassId: "cls-gone" }) })
    ).blockers,
  },
  {
    code: "CLASS_WITHOUT_NEXT_CLASS",
    label: "a mid-ladder class has no next class configured",
    findings: runPromotionPreflight(promotionInput({ rule: rule({ nextClassId: null }) }))
      .blockers,
  },
  {
    code: "EMPTY_COHORT",
    label: "the class has no active students",
    findings: runPromotionPreflight(promotionInput({ cohort: [] })).blockers,
  },
  {
    code: "STUDENT_WITHOUT_SESSION",
    label: "the student has no enrollment row for the source year",
    findings: runPromotionPreflight(
      promotionInput({ cohort: [student({ enrolledAcademicYearIds: [] })] })
    ).warnings,
  },
  {
    code: "STUDENT_WITHOUT_RESULTS",
    label: "the student has no examination results",
    findings: runPromotionPreflight(
      promotionInput({ cohort: [student({ hasExamResults: false })] })
    ).warnings,
  },
  {
    code: "MISSING_ROLL_NUMBER",
    label: "the student has no roll number",
    findings: runPromotionPreflight(promotionInput({ cohort: [student({ rollNumber: "" })] }))
      .blockers,
  },
  {
    code: "MISSING_DEMOGRAPHICS",
    label: "the student is missing a required demographic field",
    findings: runPromotionPreflight(
      promotionInput({
        cohort: [student({ demographics: { ...FULL_DEMOGRAPHICS, guardianName: "" } })],
      })
    ).warnings,
  },
  {
    // Call site one of two: the promotion path, where the student is already
    // placed in the target year.
    code: "DUPLICATE_ENROLLMENT",
    label: "the student is already enrolled in the target year",
    findings: runPromotionPreflight(
      promotionInput({ cohort: [student({ enrolledAcademicYearIds: [TO_YEAR.id] })] })
    ).blockers,
  },
  {
    // Call site two of two: the close, where one student can hold several rows
    // for a single year.
    code: "DUPLICATE_ENROLLMENT",
    label: "the student holds several enrollment rows for the year being closed",
    findings: runYearClosePreflight(
      closeInput({ students: [closeStudent({ enrollmentCountForYear: 2 })] })
    ).blockers,
  },
  {
    code: "DUPLICATE_ROLL_NUMBER",
    label: "two students in one class share a roll number",
    findings: runPromotionPreflight(
      promotionInput({
        cohort: [student(), student({ studentProfileId: "stu-2", studentId: "S002" })],
      })
    ).blockers,
  },
  {
    code: "UNPROMOTED_STUDENT",
    label: "a student is still enrolled with no promotion record",
    findings: runYearClosePreflight(
      closeInput({ students: [closeStudent({ promotionAction: null })] })
    ).blockers,
  },
  {
    code: "UNISSUED_EXIT_DOCUMENT",
    label: "a graduate holds none of the expected certificates",
    findings: runYearClosePreflight(
      closeInput({ students: [closeStudent({ promotionAction: "GRADUATED" })] })
    ).warnings,
  },
  {
    code: "ATTENDANCE_BELOW_REQUIREMENT",
    label: "a student finished the year below the class requirement",
    findings: runYearClosePreflight(
      closeInput({ students: [closeStudent({ attendanceRate: 50 })] })
    ).warnings,
  },
];

/**
 * The params supplied by **every** call site for a code — the intersection, not
 * the union.
 *
 * A union would be the wrong contract: `DUPLICATE_ENROLLMENT` is emitted by two
 * call sites and only one of them used to supply `count`, so a union-based check
 * would have blessed a message that rendered a literal `{count}` for every
 * promotion. Only a value that is always present can be interpolated.
 */
const alwaysSupplied = new Map<string, Set<string>>();
for (const scenario of SCENARIOS) {
  const keys = new Set(Object.keys(scenario.findings[0]?.params ?? {}));
  const previous = alwaysSupplied.get(scenario.code);
  alwaysSupplied.set(
    scenario.code,
    previous ? new Set([...previous].filter((key) => keys.has(key))) : keys
  );
}

describe("preflight finding vocabulary", () => {
  it("the scenarios reach exactly the declared codes", () => {
    const covered = new Set(SCENARIOS.map((scenario) => scenario.code));

    // A code with no scenario is dead vocabulary, or a scenario was lost.
    expect(DECLARED_CODES.filter((code) => !covered.has(code))).toEqual([]);
    expect([...covered].filter((code) => !DECLARED_CODES.includes(code))).toEqual([]);
  });

  it("every scenario actually emits the code it is named for", () => {
    const problems = SCENARIOS.filter(
      (scenario) => !scenario.findings.some((finding) => finding.code === scenario.code)
    ).map((scenario) => `${scenario.code} (${scenario.label})`);

    expect(problems).toEqual([]);
  });

  it("every finding carries an English message for logs and API consumers", () => {
    for (const scenario of SCENARIOS) {
      for (const finding of scenario.findings) {
        expect(finding.message.length, `${scenario.label} / ${finding.code}`).toBeGreaterThan(0);
      }
    }
  });

  it("a param supplied by only one of two call sites is not always available", () => {
    // The mechanism the intersection relies on, asserted rather than assumed:
    // if both DUPLICATE_ENROLLMENT call sites ever supply the same keys again
    // this becomes a no-op, and a future third call site would silently widen
    // what a message may interpolate.
    expect([...alwaysSupplied.get("DUPLICATE_ENROLLMENT")!].sort()).toEqual([
      "count",
      "studentId",
      "studentName",
      "year",
    ]);
  });
});

describe("promotions.preflight.codes and .fixes are complete in every locale", () => {
  for (const lang of LOCALES) {
    it(`[${lang}] defines a non-empty message and remedy for every code`, () => {
      const messages = loadLocale(lang).promotions?.preflight ?? {};
      const missing: string[] = [];

      for (const code of DECLARED_CODES) {
        for (const namespace of ["codes", "fixes"] as const) {
          const value = messages[namespace]?.[code];
          if (typeof value !== "string" || value.trim().length === 0) {
            missing.push(`${namespace}.${code}`);
          }
        }
      }

      expect(missing).toEqual([]);
    });
  }

  it("the namespaces hold no key the module cannot emit", () => {
    const problems: string[] = [];

    for (const lang of LOCALES) {
      const messages = loadLocale(lang).promotions?.preflight ?? {};

      for (const namespace of ["codes", "fixes"] as const) {
        for (const key of Object.keys(messages[namespace] ?? {})) {
          if (!DECLARED_CODES.includes(key as PreflightCode)) {
            problems.push(`[${lang}] ${namespace}."${key}" is not a preflight code`);
          }
        }
      }
    }

    expect(problems).toEqual([]);
  });

  it("no locale interpolates a variable the module never supplies for that code", () => {
    const problems: string[] = [];

    for (const lang of LOCALES) {
      const messages = loadLocale(lang).promotions?.preflight ?? {};

      for (const code of DECLARED_CODES) {
        const value = messages.codes?.[code];
        if (typeof value !== "string") continue;

        const supplied = alwaysSupplied.get(code) ?? new Set<string>();
        for (const variable of extractVariables(value)) {
          if (!supplied.has(variable)) {
            problems.push(
              `[${lang}] codes.${code} uses {${variable}} but every call site supplies ` +
                `[${[...supplied].sort().join(", ")}]`
            );
          }
        }
      }
    }

    expect(problems).toEqual([]);
  });

  it("every locale interpolates the same variables in the same order as en", () => {
    const en = loadLocale("en").promotions?.preflight ?? {};
    const problems: string[] = [];

    for (const lang of LOCALES) {
      const messages = loadLocale(lang).promotions?.preflight ?? {};

      for (const namespace of ["codes", "fixes"] as const) {
        for (const code of DECLARED_CODES) {
          const expected = extractVariables(String(en[namespace]?.[code] ?? "")).join(",");
          const actual = extractVariables(String(messages[namespace]?.[code] ?? "")).join(",");
          if (expected !== actual) {
            problems.push(`[${lang}] ${namespace}.${code}: en [${expected}] vs [${actual}]`);
          }
        }
      }
    }

    expect(problems).toEqual([]);
  });
});

describe("the shared weekday vocabulary", () => {
  it("names all seven days, indexed the way working-days.ts numbers them", () => {
    const keys = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];

    for (const lang of LOCALES) {
      const weekdays = loadLocale(lang).weekdays ?? {};
      expect(Object.keys(weekdays), lang).toEqual(keys);

      for (const key of keys) {
        expect(typeof weekdays[key], `[${lang}] weekdays.${key}`).toBe("string");
        expect(weekdays[key].trim().length, `[${lang}] weekdays.${key}`).toBeGreaterThan(0);
      }
    }
  });

  it("does not leave a locale sharing the English name", () => {
    const en = loadLocale("en").weekdays;

    for (const lang of LOCALES.filter((l) => l !== "en")) {
      const weekdays = loadLocale(lang).weekdays ?? {};
      const identical = Object.keys(en).filter((key) => weekdays[key] === en[key]);

      expect(identical, `[${lang}] untranslated`).toEqual([]);
    }
  });
});

describe("promotions.preflight.codes actually interpolate", () => {
  /**
   * The check that was missing.
   *
   * Every assertion above this point treats a message as a string and asks
   * whether it contains `{className}`. That is not the question. In ICU
   * MessageFormat a single quote starts an escaped literal, so a message
   * written as `'{className}'` contains the placeholder, passes every check
   * here, and renders the eight characters `{className}` on screen — which is
   * exactly what the first draft of these translations did, in all four
   * locales, on a gate whose whole purpose is to be read.
   *
   * So the vocabulary is formatted with the real formatter, with the params the
   * module actually supplies, and the output is required to be free of any
   * remaining placeholder syntax.
   */
  for (const lang of LOCALES) {
    it(`[${lang}] substitutes every placeholder the module supplies`, () => {
      const messages = loadLocale(lang);
      const t = createTranslator({ locale: lang, messages, namespace: "promotions.preflight" });

      const leaks: string[] = [];
      for (const scenario of SCENARIOS) {
        const finding = scenario.findings.find((entry) => entry.code === scenario.code);
        if (!finding) continue;

        const rendered = String(
          (t as unknown as (key: string, params: object) => string)(
            `codes.${finding.code}`,
            finding.params
          )
        );

        if (/\{[a-zA-Z0-9_]+\}/.test(rendered)) {
          leaks.push(`${finding.code}: ${rendered}`);
        }
      }

      expect(leaks).toEqual([]);
    });
  }

  it("[en] renders the values it was given, not the placeholder names", () => {
    const messages = loadLocale("en");
    const t = createTranslator({ locale: "en", messages, namespace: "promotions.preflight" });
    const scenario = SCENARIOS.find((entry) => entry.code === "EMPTY_COHORT")!;
    const finding = scenario.findings.find((entry) => entry.code === "EMPTY_COHORT")!;

    const rendered = String(
      (t as unknown as (key: string, params: object) => string)(
        "codes.EMPTY_COHORT",
        finding.params
      )
    );

    expect(rendered).toContain(String(finding.params.className));
    expect(rendered).toContain(String(finding.params.year));
    expect(rendered).not.toContain("className");
    expect(rendered).not.toContain("year");
  });
});
