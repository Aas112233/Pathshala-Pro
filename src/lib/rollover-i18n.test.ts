// @vitest-environment node
import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { createTranslator } from "next-intl";
import {
  NOT_COPIED_CONFIGURATION,
  NOT_COPIED_KEYS,
  ROLLOVER_FINDING_CODES,
  ROLLOVER_MODES,
  ROLLOVER_SKIP_REASONS,
  type RolloverFeeStructure,
  type RolloverRule,
} from "@/lib/rollover-plan";

/**
 * The `rollover.*` namespace guard.
 *
 * The rollover wizard is the third surface that renders server-side findings
 * from a runtime `code` + `params`, and the third place a missing or malformed
 * namespace can hide — the repository-wide literal-key scanner cannot see a
 * template-literal key, and use-intl does not throw on a missing message. The
 * panel's own `catch` then substitutes the module's English `message`, so the
 * failure mode is not a crash: it is a screen that quietly speaks the wrong
 * language at the moment an operator authorises a write.
 *
 * Six things are pinned here:
 *   1. each code-keyed sub-namespace holds exactly the module's runtime list;
 *   2. every entry is non-empty in all four locales;
 *   3. no locale interpolates a variable the module never supplies;
 *   4. every locale interpolates the same variables in the same order as en;
 *   5. the messages actually **format** — a placeholder wrapped in straight
 *      quotes is an ICU escape and renders as literal `{name}` text, which is
 *      the defect the first draft of these translations shipped;
 *   6. `fields` labels every column the two copyable tables can report as
 *      changed, and no column that neither of them has.
 */

const LOCALES = ["en", "ur", "hi", "bn"] as const;

function loadLocale(lang: string): Record<string, any> {
  return JSON.parse(
    fs.readFileSync(path.join(process.cwd(), `src/messages/${lang}.json`), "utf8")
  );
}

function rollover(lang: string): Record<string, any> {
  return loadLocale(lang).rollover ?? {};
}

function extractVariables(str: string): string[] {
  const matches = str.match(/\{([a-zA-Z0-9_]+)\}/g);
  return matches ? matches.map((m) => m.replace(/[{}]/g, "")) : [];
}

/**
 * A representative row from each copyable table.
 *
 * The `fields` map is checked against these rather than against a hand-written
 * list, so a column added to `RolloverRule` or `RolloverFeeStructure` fails this
 * test until it has a label — which is the point, because `changedFields` is
 * rendered and an unlabelled column would reach the operator as a database
 * name.
 */
const RULE_SAMPLE: RolloverRule = {
  classId: "cls-1",
  minimumAttendance: 75,
  minimumOverallPercentage: 40,
  minimumPerSubject: 33,
  maxFailedSubjects: 0,
  allowConditionalPromotion: false,
  autoPromote: true,
  nextClassId: "cls-2",
  isActive: true,
};

const FEE_SAMPLE: RolloverFeeStructure = {
  classId: "cls-1",
  tuitionFee: 1000,
  labFee: 100,
  computerFee: 50,
  examFee: 200,
  sportsFee: 0,
  libraryFee: 0,
  otherFee: 0,
  totalMonthlyFee: 1350,
  billingCycle: "MONTHLY",
  notes: null,
  isActive: true,
};

/** Every column either table can report as changed, minus the match key. */
const DIFFABLE_COLUMNS = [
  ...new Set(
    [...Object.keys(RULE_SAMPLE), ...Object.keys(FEE_SAMPLE)].filter(
      (column) => column !== "classId"
    )
  ),
].sort();

/**
 * One realistic params object per finding code, taken from the module's own
 * call sites. `rollover-plan.test.ts` exercises the scenarios; this table only
 * has to carry the params so the formatter can be run against them.
 */
const CODE_PARAMS: Record<string, Record<string, string | number>> = {
  TARGET_IS_SOURCE: { year: "2025-2026" },
  TARGET_YEAR_NOT_AFTER_SOURCE: {
    sourceLabel: "2025-2026",
    targetLabel: "2026-2027",
    sourceStart: "2025-04-01T00:00:00.000Z",
    targetStart: "2026-03-01T00:00:00.000Z",
  },
  TARGET_YEAR_CLOSED: { targetLabel: "2026-2027" },
  TARGET_DATES_INVALID: {
    targetLabel: "2026-2027",
    startDate: "2026-04-01T00:00:00.000Z",
    endDate: "2026-03-01T00:00:00.000Z",
  },
  DUPLICATE_YEAR_ID: { yearId: "AY2026" },
  TARGET_WILL_HAVE_NO_PROMOTION_RULES: {
    targetLabel: "2026-2027",
    sourceLabel: "2025-2026",
  },
  SOURCE_YEAR_STILL_OPEN: { sourceLabel: "2025-2026" },
  TARGET_YEAR_HAS_STUDENTS: { targetLabel: "2026-2027", count: 42 },
  NOTHING_REQUESTED: { targetLabel: "2026-2027" },
  WORKING_DAY_POLICY_UNDECLARED: {
    sourceLabel: "2025-2026",
    targetLabel: "2026-2027",
  },
  TARGET_WORKING_DAY_POLICY_KEPT: {
    targetLabel: "2026-2027",
    sourceLabel: "2025-2026",
    sourcePolicy: "sunday",
    targetPolicy: "sunday, saturday",
  },
  SOURCE_HAS_NO_FEE_STRUCTURES: { sourceLabel: "2025-2026" },
  DANGLING_NEXT_CLASS: { className: "Class 5", nextClassId: "cls-gone" },
  ORPHAN_RULE_CLASS: { classId: "cls-gone", sourceLabel: "2025-2026" },
};

/** The chrome keys that carry interpolation. */
const INTERPOLATED_CHROME = [
  "rowsUnit",
  "changedFields",
  "workingDayPolicyCarried",
  "workingDayPolicyKept",
  "successOpened",
  "successRolledInto",
  "createdDetail",
  "updatedDetail",
] as const;

const CHROME_PARAMS: Record<string, Record<string, string | number>> = {
  rowsUnit: { count: 3 },
  changedFields: { fields: "Minimum attendance" },
  workingDayPolicyCarried: { days: "Sunday" },
  workingDayPolicyKept: { days: "Sunday" },
  successOpened: { targetLabel: "2026-2027", sourceLabel: "2025-2026" },
  successRolledInto: { targetLabel: "2026-2027", sourceLabel: "2025-2026" },
  createdDetail: { count: 3 },
  updatedDetail: { count: 2 },
};

describe("the rollover vocabulary matches the module", () => {
  it("codes, fixes, skipReasons and notCopied are keyed by the module's own lists", () => {
    for (const lang of LOCALES) {
      const messages = rollover(lang);

      expect(Object.keys(messages.codes ?? {}), `[${lang}] codes`).toEqual(
        [...ROLLOVER_FINDING_CODES]
      );
      expect(Object.keys(messages.fixes ?? {}), `[${lang}] fixes`).toEqual([
        ...ROLLOVER_FINDING_CODES,
      ]);
      expect(Object.keys(messages.skipReasons ?? {}), `[${lang}] skipReasons`).toEqual([
        ...ROLLOVER_SKIP_REASONS,
      ]);
      expect(Object.keys(messages.notCopied ?? {}), `[${lang}] notCopied`).toEqual([
        ...NOT_COPIED_KEYS,
      ]);
    }
  });

  it("every entry is a non-empty string in every locale", () => {
    const problems: string[] = [];

    for (const lang of LOCALES) {
      const messages = rollover(lang);

      for (const code of ROLLOVER_FINDING_CODES) {
        for (const namespace of ["codes", "fixes"] as const) {
          const value = messages[namespace]?.[code];
          if (typeof value !== "string" || value.trim().length === 0) {
            problems.push(`[${lang}] ${namespace}.${code}`);
          }
        }
      }

      for (const reason of ROLLOVER_SKIP_REASONS) {
        const value = messages.skipReasons?.[reason];
        if (typeof value !== "string" || value.trim().length === 0) {
          problems.push(`[${lang}] skipReasons.${reason}`);
        }
      }

      for (const entry of NOT_COPIED_CONFIGURATION) {
        for (const part of ["title", "reason"] as const) {
          const value = messages.notCopied?.[entry.key]?.[part];
          if (typeof value !== "string" || value.trim().length === 0) {
            problems.push(`[${lang}] notCopied.${entry.key}.${part}`);
          }
        }
      }
    }

    expect(problems).toEqual([]);
  });

  it("the chrome keys the panel reads are all present", () => {
    // Named rather than derived: these are the strings the wizard and the panel
    // render by literal key, so a typo in either would otherwise show up as a
    // raw key path on screen rather than as a failure here.
    const required = [
      "title",
      "description",
      "sourceYearLabel",
      "sourceYearHint",
      "modeLabel",
      "modeCreate",
      "modeCreateHint",
      "modeExisting",
      "modeExistingHint",
      "targetYearLabel",
      "targetYearHint",
      "copyTitle",
      "copyDescription",
      "copyPromotionRules",
      "copyPromotionRulesHint",
      "copyFeeStructures",
      "copyFeeStructuresHint",
      "nothingSelected",
      "preview",
      "previewing",
      "apply",
      "applying",
      "recheck",
      "cancel",
      "previewTitle",
      "previewDescription",
      "blockersLabel",
      "warningsLabel",
      "ready",
      "blocked",
      "resolveFirst",
      "previewNotice",
      "createdLabel",
      "updatedLabel",
      "skippedLabel",
      "notRequested",
      "emptyCreated",
      "emptyUpdated",
      "emptySkipped",
      "classLabel",
      "reasonLabel",
      "notCopiedTitle",
      "notCopiedDescription",
      "workingDayPolicyLabel",
      "workingDayPolicyUndeclared",
      "nothingCarried",
      "forbidden",
      "selectSourceYear",
      "selectTargetYear",
      "fillTargetDetails",
    ];

    for (const lang of LOCALES) {
      const messages = rollover(lang);
      const missing = required.filter(
        (key) => typeof messages[key] !== "string" || messages[key].trim().length === 0
      );
      expect(missing, `[${lang}]`).toEqual([]);
    }
  });
});

describe("rollover interpolates the same variables in every locale", () => {
  it("no locale uses a variable the module never supplies for that code", () => {
    const problems: string[] = [];

    for (const lang of LOCALES) {
      const messages = rollover(lang);

      for (const code of ROLLOVER_FINDING_CODES) {
        const supplied = new Set(Object.keys(CODE_PARAMS[code] ?? {}));
        for (const variable of extractVariables(messages.codes?.[code] ?? "")) {
          if (!supplied.has(variable)) {
            problems.push(
              `[${lang}] codes.${code} uses {${variable}} but the module supplies ` +
                `[${[...supplied].sort().join(", ")}]`
            );
          }
        }
      }
    }

    expect(problems).toEqual([]);
  });

  it("every locale matches en's variables, in en's order", () => {
    const en = rollover("en");
    const problems: string[] = [];

    const pairs: Array<[string, Record<string, any>, Record<string, any>]> = [
      ["codes", en.codes, {}],
      ["fixes", en.fixes, {}],
    ];

    for (const lang of LOCALES) {
      const messages = rollover(lang);

      for (const [namespace, enTable] of pairs) {
        for (const code of ROLLOVER_FINDING_CODES) {
          const expected = extractVariables(enTable[code] ?? "").join(",");
          const actual = extractVariables(messages[namespace]?.[code] ?? "").join(",");
          if (expected !== actual) {
            problems.push(`[${lang}] ${namespace}.${code}: en [${expected}] vs [${actual}]`);
          }
        }
      }

      for (const key of INTERPOLATED_CHROME) {
        const expected = extractVariables(en[key] ?? "").join(",");
        const actual = extractVariables(messages[key] ?? "").join(",");
        if (expected !== actual) {
          problems.push(`[${lang}] ${key}: en [${expected}] vs [${actual}]`);
        }
      }
    }

    expect(problems).toEqual([]);
  });
});

describe("rollover messages actually format", () => {
  /**
   * The check that was missing from every other guard in this repository.
   *
   * Asking whether a message string *contains* `{className}` is not the
   * question. In ICU MessageFormat a single quote opens an escaped literal, so
   * `'{className}'` contains the placeholder, satisfies every string-level
   * check, and renders the ten characters `{className}` on screen. The first
   * draft of these translations did exactly that — in all four locales, on the
   * screen where an operator authorises copying a year's configuration.
   *
   * So the vocabulary is run through the real formatter with the params the
   * module supplies, and the output must contain no placeholder syntax at all.
   */
  for (const lang of LOCALES) {
    it(`[${lang}] substitutes every placeholder`, () => {
      const messages = loadLocale(lang);
      const leaks: string[] = [];

      const t = createTranslator({ locale: lang, messages, namespace: "rollover" });
      const format = (key: string, params: object) =>
        String((t as unknown as (k: string, p: object) => string)(key, params));

      for (const code of ROLLOVER_FINDING_CODES) {
        for (const namespace of ["codes", "fixes"] as const) {
          const rendered = format(`${namespace}.${code}`, CODE_PARAMS[code] ?? {});
          if (/\{[a-zA-Z0-9_]+\}/.test(rendered)) {
            leaks.push(`${namespace}.${code}: ${rendered}`);
          }
        }
      }

      for (const key of INTERPOLATED_CHROME) {
        const rendered = format(key, CHROME_PARAMS[key]);
        if (/\{[a-zA-Z0-9_]+\}/.test(rendered)) {
          leaks.push(`${key}: ${rendered}`);
        }
      }

      expect(leaks).toEqual([]);
    });
  }

  it("[en] renders the values it was given, not the placeholder names", () => {
    const t = createTranslator({
      locale: "en",
      messages: loadLocale("en"),
      namespace: "rollover",
    });
    const format = (key: string, params: object) =>
      String((t as unknown as (k: string, p: object) => string)(key, params));

    const rendered = format("successOpened", {
      targetLabel: "2026-2027",
      sourceLabel: "2025-2026",
    });

    expect(rendered).toContain("2026-2027");
    expect(rendered).toContain("2025-2026");
    expect(rendered).not.toContain("targetLabel");
    expect(rendered).not.toContain("sourceLabel");
  });
});

describe("rollover.fields labels every diffable column", () => {
  it("has a label for each column of both copyable tables", () => {
    const en = rollover("en").fields ?? {};

    expect(Object.keys(en).sort()).toEqual(DIFFABLE_COLUMNS);
  });

  it("labels them in every locale, none left in English", () => {
    const en = rollover("en").fields ?? {};
    const problems: string[] = [];

    for (const lang of LOCALES) {
      const fields = rollover(lang).fields ?? {};

      for (const column of DIFFABLE_COLUMNS) {
        const value = fields[column];
        if (typeof value !== "string" || value.trim().length === 0) {
          problems.push(`[${lang}] fields.${column} is missing`);
        } else if (lang !== "en" && value === en[column]) {
          problems.push(`[${lang}] fields.${column} is still English`);
        }
      }
    }

    expect(problems).toEqual([]);
  });
});

describe("the exclusion disclosure is translated, not echoed", () => {
  it("no locale repeats the module's English reason verbatim", () => {
    const problems: string[] = [];

    for (const lang of LOCALES.filter((l) => l !== "en")) {
      const messages = rollover(lang);

      for (const entry of NOT_COPIED_CONFIGURATION) {
        const translated = messages.notCopied?.[entry.key]?.reason;
        if (translated === entry.reason) {
          problems.push(`[${lang}] notCopied.${entry.key}.reason is the module's English`);
        }
      }
    }

    expect(problems).toEqual([]);
  });

  it("still explains each exclusion rather than just naming it", () => {
    // A title with no reason would be a shrug. The module's own contract says
    // an entry with no reason is not a disclosure, so the translations keep the
    // reason longer than the title in every locale.
    const problems: string[] = [];

    for (const lang of LOCALES) {
      const messages = rollover(lang);

      for (const entry of NOT_COPIED_CONFIGURATION) {
        const title = messages.notCopied?.[entry.key]?.title ?? "";
        const reason = messages.notCopied?.[entry.key]?.reason ?? "";
        if (reason.length <= title.length) {
          problems.push(`[${lang}] notCopied.${entry.key}.reason is not a sentence`);
        }
      }
    }

    expect(problems).toEqual([]);
  });
});

describe("the rollover mode vocabulary", () => {
  it("has a label and a hint for each mode the module accepts", () => {
    const problems: string[] = [];

    for (const lang of LOCALES) {
      const messages = rollover(lang);

      for (const mode of ROLLOVER_MODES) {
        const label = messages[mode === "CREATE" ? "modeCreate" : "modeExisting"];
        const hint = messages[mode === "CREATE" ? "modeCreateHint" : "modeExistingHint"];
        if (typeof label !== "string" || label.trim().length === 0) {
          problems.push(`[${lang}] mode${mode} has no label`);
        }
        if (typeof hint !== "string" || hint.trim().length === 0) {
          problems.push(`[${lang}] mode${mode} has no hint`);
        }
      }
    }

    expect(problems).toEqual([]);
  });
});
