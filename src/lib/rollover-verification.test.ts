import { describe, expect, it } from "vitest";
import {
  VERIFICATION_KEYS,
  buildRolloverVerification,
  type RolloverVerificationInput,
} from "@/lib/rollover-verification";

/**
 * The post-rollover verification checklist, decided without a database.
 *
 * These are the judgements an operator walks through before treating a freshly
 * rolled-over year as live. Getting one wrong here means the year looks ready
 * when it is not, which is the exact failure the checklist exists to prevent.
 */

function input(overrides: {
  target?: Partial<RolloverVerificationInput["target"]>;
  rollover?: RolloverVerificationInput["rollover"];
} = {}): RolloverVerificationInput {
  return {
    rollover: overrides.rollover ?? {
      mode: "CREATE",
      copyPromotionRules: true,
      copyFeeStructures: true,
      copyTimetables: true,
      feeBalancePolicy: "CARRY_BALANCE",
      workingDayPolicyCarried: true,
    },
    target: {
      label: "2026-2027",
      activePromotionRules: 3,
      promotionRules: 3,
      feeStructures: 3,
      timetableSlots: 24,
      timetableSlotsNeedingReview: 0,
      enrolledStudents: 120,
      workingDayPolicyDeclared: true,
      feeBalancePolicy: "CARRY_BALANCE",
      isCurrent: false,
      ...overrides.target,
    },
  };
}

function byKey(result: ReturnType<typeof buildRolloverVerification>, key: string) {
  const entry = result.items.find((item) => item.key === key);
  if (!entry) throw new Error(`No checklist item for ${key}`);
  return entry;
}

describe("the post-rollover verification checklist", () => {
  it("covers a fixed set of checks, so a new one cannot be forgotten quietly", () => {
    const result = buildRolloverVerification(input());
    expect(result.items.map((item) => item.key).sort()).toEqual([...VERIFICATION_KEYS].sort());
  });

  it("reports a ready year with nothing needing attention", () => {
    const result = buildRolloverVerification(input());

    expect(result.ready).toBe(true);
    expect(result.counts.attention).toBe(0);
    // Six are `ok` and one — the operating-year note — is `info`. Readiness is
    // the absence of attention, not the presence of only `ok`, because a
    // rollover deliberately does not switch the operating year.
    expect(result.counts.ok).toBe(6);
    expect(result.counts.info).toBe(1);
  });

  it("refuses to call a year ready when it holds no active promotion rule", () => {
    const result = buildRolloverVerification(
      input({ target: { activePromotionRules: 0, promotionRules: 3 } })
    );

    expect(byKey(result, "promotionRulesActive").status).toBe("attention");
    expect(result.ready).toBe(false);
  });

  it("checks the active count, not the total, because inactive rules promote nobody", () => {
    const result = buildRolloverVerification(
      input({ target: { activePromotionRules: 0, promotionRules: 5 } })
    );

    const entry = byKey(result, "promotionRulesActive");
    expect(entry.params).toMatchObject({ count: 5 });
  });

  it("treats a declined fee-structure copy as information, not as a failure", () => {
    const result = buildRolloverVerification(
      input({
        rollover: {
          mode: "CREATE",
          copyPromotionRules: true,
          copyFeeStructures: false,
          copyTimetables: false,
          feeBalancePolicy: null,
          workingDayPolicyCarried: false,
        },
        target: { feeStructures: 0 },
      })
    );

    expect(byKey(result, "feeStructuresPresent").status).toBe("info");
  });

  it("treats a missing fee structure the operator did ask for as needing attention", () => {
    const result = buildRolloverVerification(input({ target: { feeStructures: 0 } }));

    expect(byKey(result, "feeStructuresPresent").status).toBe("attention");
    expect(result.ready).toBe(false);
  });

  it("surfaces unreviewed timetable slots, because a copied grid is a proposal", () => {
    const result = buildRolloverVerification(
      input({ target: { timetableSlots: 24, timetableSlotsNeedingReview: 24 } })
    );

    const entry = byKey(result, "timetableReviewed");
    expect(entry.status).toBe("attention");
    expect(entry.params).toMatchObject({ count: 24, total: 24 });
    expect(result.ready).toBe(false);
  });

  it("calls a copied grid reviewed once nothing is flagged any more", () => {
    const result = buildRolloverVerification(
      input({ target: { timetableSlots: 24, timetableSlotsNeedingReview: 0 } })
    );

    expect(byKey(result, "timetableReviewed").status).toBe("ok");
  });

  it("will not call a year with no students ready", () => {
    const result = buildRolloverVerification(input({ target: { enrolledStudents: 0 } }));

    expect(byKey(result, "studentsEnrolled").status).toBe("attention");
    expect(result.ready).toBe(false);
  });

  it("flags an undeclared working-day policy, because day counts then have no denominator", () => {
    const result = buildRolloverVerification(
      input({ target: { workingDayPolicyDeclared: false } })
    );

    expect(byKey(result, "workingDayPolicyDeclared").status).toBe("attention");
    expect(result.ready).toBe(false);
  });

  it("flags an unstated fee-balance policy rather than letting the omission read as a choice", () => {
    const result = buildRolloverVerification(input({ target: { feeBalancePolicy: null } }));

    expect(byKey(result, "feeBalancePolicyStated").status).toBe("attention");
    expect(result.ready).toBe(false);
  });

  it("reports an unswitched operating year as information, never as a defect", () => {
    const result = buildRolloverVerification(input({ target: { isCurrent: false } }));

    // A rollover deliberately does not switch the operating year, so this must
    // not be able to make `ready` false.
    expect(byKey(result, "operatingYearUnchanged").status).toBe("info");
    expect(result.ready).toBe(true);
  });

  it("works for a year that was never opened by a rollover at all", () => {
    const result = buildRolloverVerification(input({ rollover: null }));

    expect(result.ready).toBe(true);
  });

  it("carries the target year's label, so a report cannot be mistaken for another year's", () => {
    expect(buildRolloverVerification(input()).targetLabel).toBe("2026-2027");
  });
});
