import { describe, expect, it } from "vitest";
import {
  MAX_WRITE_OFF_ROWS,
  WRITE_OFF_ELIGIBLE_STATUSES,
  WRITE_OFF_EXPENSE_ACCOUNT,
  WRITE_OFF_RECEIVABLE_ACCOUNT,
  planWriteOffSweep,
  type WriteOffCandidate,
} from "@/lib/fee-write-off";

/**
 * The outstanding-fee sweep, decided without a database.
 *
 * The planner is the part an operator approves, so these assert what the plan
 * promises rather than what the write happens to do.
 */

function candidate(overrides: Partial<WriteOffCandidate> = {}): WriteOffCandidate {
  return {
    voucherId: "v-1",
    voucherNumber: "FV-000001",
    studentProfileId: "sp-1",
    studentName: "Ayaan Rahman",
    feeType: "TUITION",
    billingMonth: 3,
    status: "OVERDUE",
    balance: 1500,
    ...overrides,
  };
}

describe("the write-off plan", () => {
  it("lists every candidate with a row, so the operator sees the whole picture", () => {
    const plan = planWriteOffSweep({ candidates: [candidate()] });

    expect(plan.rows).toHaveLength(1);
    expect(plan.counts.written).toBe(1);
    expect(plan.canProceed).toBe(true);
  });

  it("totals the balances and counts distinct students, not vouchers", () => {
    const plan = planWriteOffSweep({
      candidates: [
        candidate(),
        candidate({ voucherId: "v-2", voucherNumber: "FV-000002", balance: 500 }),
        // Six unpaid months for one student is one student owing, not six.
        candidate({
          voucherId: "v-3",
          voucherNumber: "FV-000003",
          studentProfileId: "sp-2",
          studentName: "Zara Islam",
          billingMonth: 4,
        }),
        candidate({
          voucherId: "v-4",
          voucherNumber: "FV-000004",
          studentProfileId: "sp-2",
          studentName: "Zara Islam",
          billingMonth: 5,
        }),
      ],
    });

    expect(plan.total).toBe(5000);
    expect(plan.counts.written).toBe(4);
    expect(plan.studentCount).toBe(2);
  });

  it("names the fee head and month, because that is what a parent queries", () => {
    const plan = planWriteOffSweep({ candidates: [candidate()] });

    expect(plan.rows[0].label).toBe("TUITION · March");
  });

  it("skips a voucher with nothing outstanding rather than posting a zero journal", () => {
    const plan = planWriteOffSweep({
      candidates: [candidate({ balance: 0 }), candidate({ voucherId: "v-2", balance: 100 })],
    });

    expect(plan.counts.written).toBe(1);
    expect(plan.counts.skipped).toBe(1);
    expect(plan.rows[0].reason?.code).toBe("NOTHING_OUTSTANDING");
    expect(plan.total).toBe(100);
  });

  it("treats a status that carries no collectable money as nothing to dispose of", () => {
    // PAID and VOID are not in the eligible set, so a loader that over-reads
    // them cannot turn a settled voucher into a write-off.
    expect(WRITE_OFF_ELIGIBLE_STATUSES).not.toContain("PAID");
    expect(WRITE_OFF_ELIGIBLE_STATUSES).not.toContain("VOID");

    const plan = planWriteOffSweep({ candidates: [candidate({ status: "PAID" })] });

    expect(plan.counts.written).toBe(0);
    expect(plan.rows[0].reason?.code).toBe("NOTHING_OUTSTANDING");
  });

  it("refuses a sweep bigger than one transaction can post journals for", () => {
    const candidates = Array.from({ length: MAX_WRITE_OFF_ROWS + 1 }, (_, index) =>
      candidate({ voucherId: `v-${index}`, voucherNumber: `FV-${index}` })
    );
    const plan = planWriteOffSweep({ candidates });

    expect(plan.blockers.map((blocker) => blocker.code)).toContain("TOO_MANY_ROWS");
    expect(plan.canProceed).toBe(false);
  });

  it("refuses a sweep with nothing in it, rather than reporting success over zero rows", () => {
    const plan = planWriteOffSweep({ candidates: [] });

    expect(plan.blockers.map((blocker) => blocker.code)).toContain("NOTHING_TO_WRITE_OFF");
    expect(plan.canProceed).toBe(false);
  });

  it("honours a total ceiling, because a very large write-off deserves its own decision", () => {
    const plan = planWriteOffSweep({
      candidates: [candidate({ balance: 5000 })],
      maxTotal: 1000,
    });

    expect(plan.blockers.map((blocker) => blocker.code)).toContain("TOTAL_TOO_LARGE");
    expect(plan.canProceed).toBe(false);
  });

  it("names the two accounts the entry will post against", () => {
    const plan = planWriteOffSweep({ candidates: [candidate()] });

    expect(plan.accounts.expense).toBe(WRITE_OFF_EXPENSE_ACCOUNT);
    expect(plan.accounts.receivable).toBe(WRITE_OFF_RECEIVABLE_ACCOUNT);
  });

  it("rounds to two places rather than carrying float dust into a journal", () => {
    const plan = planWriteOffSweep({
      candidates: [candidate({ balance: 1500.005 }), candidate({ voucherId: "v-2", balance: 0.004 })],
    });

    // 1500.005 -> 1500.01 half-up; 0.004 -> 0.00, which is then skipped.
    expect(plan.total).toBe(1500.01);
    expect(plan.counts.written).toBe(1);
  });
});
