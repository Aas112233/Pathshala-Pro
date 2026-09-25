// @vitest-environment node
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  PROMOTION_REASON_CODES,
  decidePromotion,
  applyOverride,
  type PromotionCandidate,
  type PromotionReason,
  type PromotionRuleInput,
  type SubjectResultInput,
} from "@/lib/promotion-engine";

/**
 * The `promotions.reasons` guard.
 *
 * `promotions/calculate/page.tsx` renders every reason through
 * `tReason(reason.code, reason.params)` — a call site whose key is a runtime
 * value, so the repository-wide literal-key scanner in
 * `i18n-parity-and-interpolation.test.ts` is structurally unable to see it. The
 * namespace can therefore be entirely absent (it was) and nothing complains:
 * use-intl does not throw on a missing message, it logs and renders the raw key
 * path, so every promotion reason showed as `promotions.reasons.MEETS_CRITERIA`
 * in all four locales.
 *
 * Four things are pinned here:
 *   1. the engine's runtime vocabulary is exactly the codes it can emit;
 *   2. every code has a non-empty message in all four locales;
 *   3. no locale interpolates a variable the engine never supplies for that
 *      code — which would render as an empty gap or a literal `{placeholder}`;
 *   4. the namespace holds no key the engine cannot emit, so a renamed code
 *      cannot leave an orphaned translation behind.
 */

const LOCALES = ["en", "ur", "hi", "bn"] as const;

function loadLocale(lang: string): Record<string, any> {
  return JSON.parse(
    fs.readFileSync(path.join(process.cwd(), `src/messages/${lang}.json`), "utf8")
  );
}

function extractVariables(str: string): string[] {
  const matches = str.match(/\{([a-zA-Z0-9_]+)\}/g);
  return matches ? matches.map((m) => m.replace(/[{}]/g, "")) : [];
}

// --- fixtures (same shapes as promotion-engine.test.ts) --------------------

function makeRule(overrides: Partial<PromotionRuleInput> = {}): PromotionRuleInput {
  return {
    id: "rule-1",
    classId: "class-1",
    academicYearId: "ay-2025",
    minimumAttendance: 75,
    minimumOverallPercentage: 40,
    minimumPerSubject: 33,
    maxFailedSubjects: 0,
    allowConditionalPromotion: false,
    autoPromote: true,
    nextClassId: "class-2",
    ...overrides,
  };
}

function subject(name: string, percentage: number): SubjectResultInput {
  return {
    subjectId: `sub-${name.toLowerCase()}`,
    subjectName: name,
    percentage,
    status: percentage >= 33 ? "PASS" : "FAIL",
    grade: percentage >= 40 ? "C" : "F",
    createdAt: "2026-03-01T00:00:00.000Z",
  };
}

function makeCandidate(overrides: Partial<PromotionCandidate> = {}): PromotionCandidate {
  return {
    studentProfileId: "stu-1",
    studentId: "STU-001",
    studentName: "Ayesha Khan",
    rollNumber: "001",
    fromClassId: "class-1",
    fromClassName: "Class 1",
    fromClassNumber: 1,
    examResults: [subject("Math", 80), subject("Science", 75), subject("English", 90)],
    attendanceRate: 92,
    attendancePresentDays: 92,
    attendanceTotalDays: 100,
    ...overrides,
  };
}

/** Two subjects, the second below the per-subject floor. */
const ONE_FAILURE = [subject("Math", 80), subject("Science", 20)];

/**
 * One reachable scenario per reason code.
 *
 * This table is the contract. A code added to the engine without a scenario
 * here fails the coverage assertion below, which is what forces the vocabulary
 * and the translations to be extended together.
 */
function reasonScenarios(): Array<{ label: string; reasons: PromotionReason[] }> {
  const happy = decidePromotion(makeCandidate(), makeRule());

  return [
    {
      label: "clears every threshold",
      reasons: happy.reasons,
    },
    {
      label: "clears every threshold in a terminal class",
      reasons: decidePromotion(makeCandidate(), makeRule({ nextClassId: null })).reasons,
    },
    {
      label: "exceeds the failed-subject allowance",
      reasons: decidePromotion(makeCandidate({ examResults: ONE_FAILURE }), makeRule()).reasons,
    },
    {
      label: "passes every subject but misses the overall floor",
      reasons: decidePromotion(
        makeCandidate({ examResults: [subject("Math", 34), subject("Science", 34)] }),
        makeRule()
      ).reasons,
    },
    {
      label: "passes every subject but misses the attendance floor",
      reasons: decidePromotion(makeCandidate({ attendanceRate: 50 }), makeRule()).reasons,
    },
    {
      label: "has no results at all",
      reasons: decidePromotion(makeCandidate({ examResults: [] }), makeRule()).reasons,
    },
    {
      label: "is conditionally eligible pending a re-examination",
      reasons: decidePromotion(
        makeCandidate({ examResults: ONE_FAILURE }),
        makeRule({ allowConditionalPromotion: true })
      ).reasons,
    },
    {
      label: "repeats the final class",
      reasons: decidePromotion(
        makeCandidate({ examResults: ONE_FAILURE }),
        makeRule({ nextClassId: null })
      ).reasons,
    },
    {
      label: "was overridden by an operator",
      reasons: applyOverride(happy, { action: "RETAINED", reason: "Parent requested retention." })
        .reasons,
    },
    {
      label: "was transferred out",
      reasons: applyOverride(happy, { action: "TRANSFERRED" }).reasons,
    },
  ];
}

const scenarios = reasonScenarios();

/** Every param key the engine supplies, per reason code. */
const suppliedParams = new Map<string, Set<string>>();
for (const scenario of scenarios) {
  for (const reason of scenario.reasons) {
    const keys = suppliedParams.get(reason.code) ?? new Set<string>();
    for (const key of Object.keys(reason.params)) keys.add(key);
    suppliedParams.set(reason.code, keys);
  }
}

describe("promotion reason vocabulary", () => {
  it("declares no duplicate codes", () => {
    expect(new Set(PROMOTION_REASON_CODES).size).toBe(PROMOTION_REASON_CODES.length);
    expect(PROMOTION_REASON_CODES.length).toBeGreaterThan(0);
  });

  it("every scenario emits at least one reason", () => {
    for (const scenario of scenarios) {
      expect(scenario.reasons.length, scenario.label).toBeGreaterThan(0);
    }
  });

  it("the scenarios reach exactly the declared codes", () => {
    const emitted = new Set(scenarios.flatMap((s) => s.reasons.map((r) => r.code)));

    // A code with no scenario is dead vocabulary, or a scenario was lost.
    expect([...PROMOTION_REASON_CODES].filter((code) => !emitted.has(code))).toEqual([]);
    // A scenario emitting something undeclared cannot happen (the union is
    // derived from the list), but the assertion documents that.
    expect([...emitted].filter((code) => !PROMOTION_REASON_CODES.includes(code as never))).toEqual(
      []
    );
  });

  it("every reason carries an English message for logs and API consumers", () => {
    for (const scenario of scenarios) {
      for (const reason of scenario.reasons) {
        expect(typeof reason.message, `${scenario.label} / ${reason.code}`).toBe("string");
        expect(reason.message.length, `${scenario.label} / ${reason.code}`).toBeGreaterThan(0);
      }
    }
  });
});

describe("promotions.reasons is complete in every locale", () => {
  for (const lang of LOCALES) {
    it(`[${lang}] defines a non-empty message for every reason code`, () => {
      const messages = loadLocale(lang).promotions?.reasons ?? {};

      const missing: string[] = [];
      for (const code of PROMOTION_REASON_CODES) {
        const value = messages[code];
        if (typeof value !== "string" || value.trim().length === 0) {
          missing.push(code);
        }
      }

      expect(missing).toEqual([]);
    });
  }

  it("the namespace holds no key the engine cannot emit", () => {
    const problems: string[] = [];

    for (const lang of LOCALES) {
      const messages = loadLocale(lang).promotions?.reasons ?? {};
      for (const key of Object.keys(messages)) {
        if (!PROMOTION_REASON_CODES.includes(key as never)) {
          problems.push(`[${lang}] "${key}" is not a promotion reason code`);
        }
      }
    }

    expect(problems).toEqual([]);
  });

  it("no locale interpolates a variable the engine never supplies", () => {
    const problems: string[] = [];

    for (const lang of LOCALES) {
      const messages = loadLocale(lang).promotions?.reasons ?? {};

      for (const code of PROMOTION_REASON_CODES) {
        const value = messages[code];
        if (typeof value !== "string") continue;

        const supplied = suppliedParams.get(code) ?? new Set<string>();
        for (const variable of extractVariables(value)) {
          if (!supplied.has(variable)) {
            problems.push(
              `[${lang}] ${code} uses {${variable}} but the engine supplies [${[...supplied]
                .sort()
                .join(", ")}]`
            );
          }
        }
      }
    }

    expect(problems).toEqual([]);
  });

  it("every locale uses the same interpolation variables as en", () => {
    const en = loadLocale("en").promotions?.reasons ?? {};
    const problems: string[] = [];

    for (const lang of LOCALES) {
      const messages = loadLocale(lang).promotions?.reasons ?? {};

      for (const code of PROMOTION_REASON_CODES) {
        const expected = extractVariables(String(en[code] ?? "")).sort().join(",");
        const actual = extractVariables(String(messages[code] ?? "")).sort().join(",");
        if (expected !== actual) {
          problems.push(`[${lang}] ${code}: en [${expected}] vs [${actual}]`);
        }
      }
    }

    expect(problems).toEqual([]);
  });
});
