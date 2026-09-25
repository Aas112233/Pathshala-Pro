import { describe, expect, it } from "vitest";
import {
  NOT_COPIED_CONFIGURATION,
  ROLLOVER_FINDING_CODES,
  ROLLOVER_FINDING_SEVERITY,
  ROLLOVER_SEVERITIES,
  planRollover,
  type RolloverFeeStructure,
  type RolloverFindingCode,
  type RolloverPlan,
  type RolloverRule,
} from "@/lib/rollover-plan";

/**
 * The rollover plan, decided without a database.
 *
 * These are the semantics the wizard will render. Getting them wrong here means
 * the surface is wrong too, which is the point of the module existing.
 */

const CLASSES = [
  { id: "cls-1", name: "Class 1", classNumber: 1 },
  { id: "cls-2", name: "Class 2", classNumber: 2 },
  { id: "cls-3", name: "Class 3", classNumber: 3 },
];

function rule(overrides: Partial<RolloverRule> = {}): RolloverRule {
  return {
    classId: "cls-1",
    minimumAttendance: 75,
    minimumOverallPercentage: 40,
    minimumPerSubject: 33,
    maxFailedSubjects: 0,
    allowConditionalPromotion: false,
    autoPromote: true,
    nextClassId: "cls-2",
    isActive: true,
    ...overrides,
  };
}

function fee(overrides: Partial<RolloverFeeStructure> = {}): RolloverFeeStructure {
  return {
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
    ...overrides,
  };
}

/** April 2025 → March 2026, closed, declaring Sunday as the weekly day off. */
const SOURCE = {
  id: "ay-2025",
  label: "2025-2026",
  startDate: "2025-04-01T00:00:00.000Z",
  endDate: "2026-03-31T00:00:00.000Z",
  isClosed: true,
  nonWorkingWeekdays: [0] as unknown,
};

function createTarget(overrides: Record<string, unknown> = {}) {
  return {
    mode: "CREATE" as const,
    yearId: "AY2026",
    label: "2026-2027",
    startDate: "2026-04-01T00:00:00.000Z",
    endDate: "2027-03-31T00:00:00.000Z",
    ...overrides,
  };
}

function existingTarget(overrides: Record<string, unknown> = {}) {
  return {
    mode: "EXISTING" as const,
    academicYearId: "ay-2026",
    label: "2026-2027",
    startDate: "2026-04-01T00:00:00.000Z",
    endDate: "2027-03-31T00:00:00.000Z",
    isClosed: false,
    nonWorkingWeekdays: [0] as unknown,
    enrolledStudents: 0,
    ...overrides,
  };
}

interface PlanOverrides {
  source?: Partial<typeof SOURCE> & {
    promotionRules?: RolloverRule[];
    feeStructures?: RolloverFeeStructure[];
  };
  target?: ReturnType<typeof createTarget> | ReturnType<typeof existingTarget>;
  targetPromotionRules?: RolloverRule[];
  targetFeeStructures?: RolloverFeeStructure[];
  allClasses?: typeof CLASSES;
  existingYearIds?: string[];
  copy?: { promotionRules: boolean; feeStructures: boolean };
}

function plan(overrides: PlanOverrides = {}): RolloverPlan {
  return planRollover({
    source: {
      ...SOURCE,
      promotionRules: [rule()],
      feeStructures: [fee()],
      ...overrides.source,
    },
    target: overrides.target ?? createTarget(),
    targetPromotionRules: overrides.targetPromotionRules ?? [],
    targetFeeStructures: overrides.targetFeeStructures ?? [],
    allClasses: overrides.allClasses ?? CLASSES,
    existingYearIds: overrides.existingYearIds ?? [],
    copy: overrides.copy ?? { promotionRules: true, feeStructures: true },
  });
}

/** Every finding code the plan produced, blocker or warning. */
function codes(result: RolloverPlan): RolloverFindingCode[] {
  return [...result.blockers, ...result.warnings].map((finding) => finding.code);
}

// ---------------------------------------------------------------------------

describe("the year boundary", () => {
  it("proceeds when the target starts after the source", () => {
    const result = plan();

    expect(result.canProceed).toBe(true);
    expect(codes(result)).not.toContain("TARGET_YEAR_NOT_AFTER_SOURCE");
  });

  it("refuses a target that is the source", () => {
    const result = plan({ target: existingTarget({ academicYearId: SOURCE.id }) });

    expect(result.canProceed).toBe(false);
    expect(codes(result)).toContain("TARGET_IS_SOURCE");
  });

  it.each([
    ["identical to the source's", SOURCE.startDate],
    ["earlier than the source's", "2025-01-01T00:00:00.000Z"],
  ])("refuses a target start date %s", (_label, startDate) => {
    const result = plan({ target: createTarget({ startDate }) });

    expect(result.canProceed).toBe(false);
    expect(codes(result)).toContain("TARGET_YEAR_NOT_AFTER_SOURCE");
  });

  it("names both years and both dates, so the refusal is checkable", () => {
    const result = plan({ target: createTarget({ startDate: SOURCE.startDate }) });
    const finding = result.blockers.find((f) => f.code === "TARGET_YEAR_NOT_AFTER_SOURCE")!;

    expect(finding.params).toMatchObject({
      sourceLabel: "2025-2026",
      targetLabel: "2026-2027",
    });
    // Interpolation values, not a pre-baked sentence: the UI renders code + params.
    expect(String(finding.params.sourceStart)).toBe(SOURCE.startDate);
    expect(String(finding.params.targetStart)).toBe(SOURCE.startDate);
  });
});

describe("the target year", () => {
  it("refuses a new year whose end is not after its start", () => {
    const result = plan({ target: createTarget({ endDate: "2026-01-01T00:00:00.000Z" }) });

    expect(result.canProceed).toBe(false);
    expect(codes(result)).toContain("TARGET_DATES_INVALID");
  });

  it("refuses a year id that is already in use", () => {
    const result = plan({ existingYearIds: ["AY2026"] });

    expect(result.canProceed).toBe(false);
    expect(codes(result)).toContain("DUPLICATE_YEAR_ID");
  });

  it("refuses to roll into a closed year", () => {
    const result = plan({ target: existingTarget({ isClosed: true }) });

    expect(result.canProceed).toBe(false);
    expect(codes(result)).toContain("TARGET_YEAR_CLOSED");
  });

  it("warns, but proceeds, when the target already holds students", () => {
    const result = plan({ target: existingTarget({ enrolledStudents: 214 }) });

    expect(result.canProceed).toBe(true);
    expect(codes(result)).toContain("TARGET_YEAR_HAS_STUDENTS");
  });

  it("warns when the source is still open, because its records can still move", () => {
    const result = plan({ source: { isClosed: false } });

    expect(result.canProceed).toBe(true);
    expect(codes(result)).toContain("SOURCE_YEAR_STILL_OPEN");
  });

  it("says nothing about an open source when the source is closed", () => {
    expect(codes(plan())).not.toContain("SOURCE_YEAR_STILL_OPEN");
  });
});

describe("the working-day policy", () => {
  it("carries the source's policy into a new year", () => {
    const result = plan();

    expect(result.target.writesWorkingDayPolicy).toBe(true);
    expect(result.target.nonWorkingWeekdays).toEqual([0]);
    expect(result.target.nonWorkingWeekdayNames).toEqual(["sunday"]);
  });

  it("uses an explicit override instead of the source's policy", () => {
    const result = plan({
      target: createTarget({ nonWorkingWeekdays: [5, 6] }),
    });

    expect(result.target.nonWorkingWeekdays).toEqual([5, 6]);
    expect(result.target.nonWorkingWeekdayNames).toEqual(["friday", "saturday"]);
  });

  it("warns and reports undeclared when neither year declares a policy", () => {
    const result = plan({ source: { nonWorkingWeekdays: null } });

    // Null is undeclared, and undeclared is not "no days off".
    expect(result.target.nonWorkingWeekdays).toBeNull();
    expect(result.target.nonWorkingWeekdayNames).toEqual([]);
    expect(codes(result)).toContain("WORKING_DAY_POLICY_UNDECLARED");
  });

  it("throws on an override that is not a weekday list, rather than guessing", () => {
    expect(() => plan({ target: createTarget({ nonWorkingWeekdays: [7] }) })).toThrow();
    expect(() =>
      plan({ target: createTarget({ nonWorkingWeekdays: [0, 1, 2, 3, 4, 5, 6] }) })
    ).toThrow();
  });

  it("leaves an existing year's own policy alone and says so", () => {
    const result = plan({ target: existingTarget({ nonWorkingWeekdays: [5, 6] }) });

    expect(result.target.writesWorkingDayPolicy).toBe(false);
    // The target's policy is what the target will hold — not the source's.
    expect(result.target.nonWorkingWeekdays).toEqual([5, 6]);
    expect(codes(result)).toContain("TARGET_WORKING_DAY_POLICY_KEPT");
  });

  it("stays quiet when an existing year's policy already matches", () => {
    const result = plan({ target: existingTarget({ nonWorkingWeekdays: [0] }) });

    expect(codes(result)).not.toContain("TARGET_WORKING_DAY_POLICY_KEPT");
  });
});

describe("the configuration diff", () => {
  it("creates every source rule in a new year", () => {
    const result = plan({
      source: {
        promotionRules: [rule({ classId: "cls-1" }), rule({ classId: "cls-2", nextClassId: "cls-3" })],
      },
    });

    expect(result.promotionRules.requested).toBe(true);
    expect(result.promotionRules.counts).toEqual({ created: 2, updated: 0, skipped: 0 });
    expect(result.promotionRules.created.map((row) => row.className)).toEqual([
      "Class 1",
      "Class 2",
    ]);
  });

  it("reports a re-run as nothing to do, which is what makes it idempotent", () => {
    // The target already holds exactly what the source holds.
    const result = plan({
      target: existingTarget(),
      targetPromotionRules: [rule()],
      targetFeeStructures: [fee()],
    });

    expect(result.promotionRules.counts).toEqual({ created: 0, updated: 0, skipped: 1 });
    expect(result.feeStructures.counts).toEqual({ created: 0, updated: 0, skipped: 1 });
    expect(result.writes).toEqual({ created: 0, updated: 0 });
    expect(result.promotionRules.skipped[0].reason?.code).toBe("ALREADY_IDENTICAL");
  });

  it("updates rather than duplicates when the target's row differs", () => {
    const result = plan({
      target: existingTarget(),
      targetPromotionRules: [rule({ minimumAttendance: 60 })],
    });

    expect(result.promotionRules.counts).toEqual({ created: 0, updated: 1, skipped: 0 });
    const row = result.promotionRules.updated[0];
    expect(row.changedFields).toEqual(["minimumAttendance"]);
    // The written values are the source's, not a merge of the two.
    expect(row.values.minimumAttendance).toBe(75);
  });

  it("names every differing field, and never the match key", () => {
    const result = plan({
      target: existingTarget(),
      targetPromotionRules: [
        rule({ minimumAttendance: 60, maxFailedSubjects: 2, isActive: false }),
      ],
    });

    expect(result.promotionRules.updated[0].changedFields.sort()).toEqual([
      "isActive",
      "maxFailedSubjects",
      "minimumAttendance",
    ]);

    // `classId` identifies the row. Reporting it as a change would describe a
    // different row rather than a change to this one.
    for (const bucket of [
      result.promotionRules.created,
      result.promotionRules.updated,
      result.promotionRules.skipped,
    ]) {
      for (const row of bucket) {
        expect(row.changedFields).not.toContain("classId");
      }
    }
  });

  it("writes nothing at all for a configuration that was not requested", () => {
    const result = plan({ copy: { promotionRules: false, feeStructures: true } });

    // Empty rather than "here is what you would have copied": a UI that renders
    // `created` must not show writes that will never happen.
    expect(result.promotionRules).toEqual({
      requested: false,
      created: [],
      updated: [],
      skipped: [],
      counts: { created: 0, updated: 0, skipped: 0 },
    });
    expect(result.feeStructures.requested).toBe(true);
  });

  it("skips a rule whose class is gone, and says which one", () => {
    const result = plan({
      source: { promotionRules: [rule({ classId: "cls-gone" })] },
    });

    expect(result.promotionRules.counts.skipped).toBe(1);
    expect(result.promotionRules.skipped[0].reason?.code).toBe("CLASS_MISSING");
    // Reported, because a rule that silently fails to travel is a class that
    // silently cannot be promoted next year.
    expect(codes(result)).toContain("ORPHAN_RULE_CLASS");
  });

  it("counts writes across both configurations", () => {
    const result = plan({
      source: {
        promotionRules: [rule({ classId: "cls-1" }), rule({ classId: "cls-2" })],
        feeStructures: [fee({ classId: "cls-1" })],
      },
      target: existingTarget(),
      targetPromotionRules: [rule({ classId: "cls-2", minimumAttendance: 90 })],
    });

    // One new rule, one changed rule, one new fee structure.
    expect(result.writes).toEqual({ created: 2, updated: 1 });
  });
});

describe("the outcome the wizard must not produce", () => {
  it("refuses a new year that would hold no promotion rule", () => {
    const result = plan({ copy: { promotionRules: false, feeStructures: true } });

    // Without a rule the target cannot promote anyone, so the wizard's own next
    // step is impossible. This is the "looks finished" trap, as a blocker.
    expect(result.canProceed).toBe(false);
    expect(codes(result)).toContain("TARGET_WILL_HAVE_NO_PROMOTION_RULES");
  });

  it("refuses the same way when the source had no rules to copy", () => {
    const result = plan({ source: { promotionRules: [] } });

    expect(result.canProceed).toBe(false);
    expect(codes(result)).toContain("TARGET_WILL_HAVE_NO_PROMOTION_RULES");
  });

  it("refuses when the only rules carried across are inactive", () => {
    const result = plan({ source: { promotionRules: [rule({ isActive: false })] } });

    expect(result.canProceed).toBe(false);
    expect(codes(result)).toContain("TARGET_WILL_HAVE_NO_PROMOTION_RULES");
  });

  it("allows a roll-into when the target already has its own active rule", () => {
    const result = plan({
      target: existingTarget(),
      targetPromotionRules: [rule({ classId: "cls-3", nextClassId: null })],
      copy: { promotionRules: false, feeStructures: false },
    });

    expect(result.canProceed).toBe(true);
    expect(codes(result)).toContain("NOTHING_REQUESTED");
  });

  it("warns about a rule pointing at a class that no longer exists", () => {
    const result = plan({
      source: { promotionRules: [rule({ nextClassId: "cls-gone" })] },
    });

    // Carried as it stands — the target year is open and can be corrected — but
    // surfaced, because a dangling reference looks configured.
    expect(result.canProceed).toBe(true);
    expect(codes(result)).toContain("DANGLING_NEXT_CLASS");
  });

  it("warns when the source has no fee structures to carry", () => {
    const result = plan({ source: { feeStructures: [] } });

    expect(codes(result)).toContain("SOURCE_HAS_NO_FEE_STRUCTURES");
  });
});

describe("the plan's own shape", () => {
  it("proceeds exactly when there is no blocker", () => {
    expect(plan().canProceed).toBe(true);
    expect(plan().counts.blockers).toBe(0);

    const blocked = plan({ existingYearIds: ["AY2026"] });
    expect(blocked.canProceed).toBe(false);
    expect(blocked.counts.blockers).toBe(blocked.blockers.length);
  });

  it("records provenance only for a year the wizard opened", () => {
    // A year that already existed was not cloned from anything; claiming a
    // source for it would be a claim the data does not support.
    expect(plan().target.clonedFromId).toBe(SOURCE.id);
    expect(plan({ target: existingTarget() }).target.clonedFromId).toBeNull();
  });

  it("echoes both years as ISO dates", () => {
    const result = plan();

    expect(result.source).toMatchObject({
      id: SOURCE.id,
      label: SOURCE.label,
      startDate: SOURCE.startDate,
      endDate: SOURCE.endDate,
      isClosed: true,
    });
    expect(result.target.startDate).toBe("2026-04-01T00:00:00.000Z");
  });

  it("publishes the exclusion list verbatim", () => {
    expect(plan().notCopied).toBe(NOT_COPIED_CONFIGURATION);
  });
});

describe("the published exclusion list", () => {
  it("gives every entry a reason", () => {
    for (const entry of NOT_COPIED_CONFIGURATION) {
      expect(entry.reason.trim().length).toBeGreaterThan(0);
    }
  });

  it("names each thing once", () => {
    const keys = NOT_COPIED_CONFIGURATION.map((entry) => entry.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("includes the two exclusions that matter most", () => {
    const keys = NOT_COPIED_CONFIGURATION.map((entry) => entry.key);
    // The timetable is excluded structurally — it has no unique key, so item
    // 18's upsert semantics are unsatisfiable for it.
    expect(keys).toContain("timetables");
    // The fee-balance policy is excluded because it is a money decision, not
    // because it was overlooked.
    expect(keys).toContain("feeBalancePolicy");
  });
});

// ---------------------------------------------------------------------------
// Coverage first: a vocabulary that is not exercised cannot be checked.
// ---------------------------------------------------------------------------

describe("the finding vocabulary", () => {
  const scenarios: { code: RolloverFindingCode; make: () => RolloverPlan }[] = [
    {
      code: "TARGET_IS_SOURCE",
      make: () => plan({ target: existingTarget({ academicYearId: SOURCE.id }) }),
    },
    {
      code: "TARGET_YEAR_NOT_AFTER_SOURCE",
      make: () => plan({ target: createTarget({ startDate: SOURCE.startDate }) }),
    },
    {
      code: "TARGET_YEAR_CLOSED",
      make: () => plan({ target: existingTarget({ isClosed: true }) }),
    },
    {
      code: "TARGET_DATES_INVALID",
      make: () => plan({ target: createTarget({ endDate: "2026-01-01T00:00:00.000Z" }) }),
    },
    {
      code: "DUPLICATE_YEAR_ID",
      make: () => plan({ existingYearIds: ["AY2026"] }),
    },
    {
      code: "TARGET_WILL_HAVE_NO_PROMOTION_RULES",
      make: () => plan({ copy: { promotionRules: false, feeStructures: false } }),
    },
    {
      code: "SOURCE_YEAR_STILL_OPEN",
      make: () => plan({ source: { isClosed: false } }),
    },
    {
      code: "TARGET_YEAR_HAS_STUDENTS",
      make: () => plan({ target: existingTarget({ enrolledStudents: 5 }) }),
    },
    {
      code: "NOTHING_REQUESTED",
      make: () => plan({ copy: { promotionRules: false, feeStructures: false } }),
    },
    {
      code: "WORKING_DAY_POLICY_UNDECLARED",
      make: () => plan({ source: { nonWorkingWeekdays: null } }),
    },
    {
      code: "TARGET_WORKING_DAY_POLICY_KEPT",
      make: () => plan({ target: existingTarget({ nonWorkingWeekdays: [5, 6] }) }),
    },
    {
      code: "SOURCE_HAS_NO_FEE_STRUCTURES",
      make: () => plan({ source: { feeStructures: [] } }),
    },
    {
      code: "DANGLING_NEXT_CLASS",
      make: () => plan({ source: { promotionRules: [rule({ nextClassId: "cls-gone" })] } }),
    },
    {
      code: "ORPHAN_RULE_CLASS",
      make: () => plan({ source: { promotionRules: [rule({ classId: "cls-gone" })] } }),
    },
  ];

  it("is covered end to end: every code has a scenario that produces it", () => {
    const produced = new Set(scenarios.flatMap((scenario) => codes(scenario.make())));
    const uncovered = ROLLOVER_FINDING_CODES.filter((code) => !produced.has(code));

    expect(uncovered).toEqual([]);
  });

  it.each(scenarios)("$code is produced by its scenario", ({ code, make }) => {
    expect(codes(make())).toContain(code);
  });

  it("decides a severity for every code, and invents none", () => {
    expect(Object.keys(ROLLOVER_FINDING_SEVERITY).sort()).toEqual(
      [...ROLLOVER_FINDING_CODES].sort()
    );
    for (const code of ROLLOVER_FINDING_CODES) {
      expect(ROLLOVER_SEVERITIES).toContain(ROLLOVER_FINDING_SEVERITY[code]);
    }
  });

  it("stamps each finding with the severity its code was given", () => {
    const result = plan({ existingYearIds: ["AY2026"], source: { isClosed: false } });

    for (const finding of [...result.blockers, ...result.warnings]) {
      expect(finding.severity).toBe(ROLLOVER_FINDING_SEVERITY[finding.code]);
    }
    expect(result.blockers.every((f) => f.severity === "blocker")).toBe(true);
    expect(result.warnings.every((f) => f.severity === "warning")).toBe(true);
  });
});
