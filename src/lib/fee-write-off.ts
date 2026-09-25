import { Prisma } from "@prisma/client";
import { ApiError } from "@/lib/api-error";
import { GL_CODES } from "@/lib/constants";
import { getNextVoucherNumber } from "@/lib/accounting-sequence";

/**
 * The outstanding-fee sweep (roadmap item 23) — a **pre-close step** that
 * disposes of balances a school has decided it will not collect.
 *
 * ## Why this is a waiver-shaped entry, not a deletion
 *
 * A balance is a financial record: it says "this was billed and not paid".
 * Removing it without a journal entry would rewrite what the year's revenue
 * was. So the sweep posts the same double entry every other forgiveness in this
 * codebase posts — debit an expense, credit accounts receivable — and then
 * brings the voucher's `totalDue` and `balance` down by the amount written off.
 * The voucher stays, the record of what was billed stays, and only the
 * receivable is cleared.
 *
 * ## The expense account is the school's decision
 *
 * {@link WRITE_OFF_EXPENSE_ACCOUNT} names where the loss lands, and the sweep
 * **refuses** until the tenant's chart of accounts carries it. An account code
 * this module invents and writes to silently would be an accounting policy
 * nobody chose; refusing until it is configured puts that choice back with the
 * school, which is where item 23 has always said it belongs.
 *
 * ## Why the sweep is per voucher
 *
 * Consolidating per student would produce one tidy figure and lose which fee
 * head and month the money was owed on — exactly the detail a parent queries
 * and an auditor asks for. The plan reports per student as well, so the
 * operator reads it as "twelve students" while the write stays per voucher.
 */

/** The GL account a written-off balance is charged to. Must be configured. */
export const WRITE_OFF_EXPENSE_ACCOUNT = GL_CODES.WRITE_OFF_EXPENSE;
/** The receivable the entry credits. Same account every other forgiveness uses. */
export const WRITE_OFF_RECEIVABLE_ACCOUNT = GL_CODES.RECEIVABLE;

/** Voucher statuses that carry collectable money. Same set the arrears sweep uses. */
export const WRITE_OFF_ELIGIBLE_STATUSES = ["PENDING", "PARTIAL", "OVERDUE"] as const;
export type WriteOffEligibleStatus = (typeof WRITE_OFF_ELIGIBLE_STATUSES)[number];

/** A ceiling, because the sweep runs in one transaction and each row posts a journal. */
export const MAX_WRITE_OFF_ROWS = 200;

export const WRITE_OFF_SKIP_REASONS = [
  /** The voucher is already settled; there is nothing to dispose of. */
  "NOTHING_OUTSTANDING",
] as const;
export type WriteOffSkipReason = (typeof WRITE_OFF_SKIP_REASONS)[number];

/** One voucher's outstanding position, as the loader supplies it. */
export interface WriteOffCandidate {
  voucherId: string;
  voucherNumber: string;
  studentProfileId: string;
  studentName: string;
  feeType: string;
  billingMonth: number | null;
  status: string;
  /** The collectable balance, as a plain number. */
  balance: number;
}

export interface WriteOffSweepRow {
  voucherId: string;
  voucherNumber: string;
  studentProfileId: string;
  studentName: string;
  /** Human-readable identity, e.g. "TUITION · March". */
  label: string;
  balance: number;
  reason: { code: WriteOffSkipReason; message: string } | null;
}

export interface WriteOffSweepInput {
  /** The vouchers the loader read for this year. */
  candidates: readonly WriteOffCandidate[];
  /**
   * The largest total the sweep will dispose of in one run. A school writing
   * off more than this in a single action is making a decision big enough to
   * want to see spelled out, so it is refused rather than executed.
   */
  maxTotal?: number;
}

export interface WriteOffSweepPlan {
  canProceed: boolean;
  blockers: { code: string; message: string }[];
  rows: WriteOffSweepRow[];
  counts: { written: number; skipped: number };
  /** The sum that will be disposed of, across every written row. */
  total: number;
  /** Distinct students affected, which is how the operator reads the number. */
  studentCount: number;
  maxRows: number;
  accounts: {
    expense: string;
    receivable: string;
  };
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Two decimal places, half-up — the rounding the rest of the fee code uses. */
function money(value: number): number {
  return new Prisma.Decimal(value).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toNumber();
}

export function planWriteOffSweep(input: WriteOffSweepInput): WriteOffSweepPlan {
  const blockers: { code: string; message: string }[] = [];
  const rows: WriteOffSweepRow[] = [];

  const eligible = input.candidates.filter((candidate) =>
    (WRITE_OFF_ELIGIBLE_STATUSES as readonly string[]).includes(candidate.status)
  );

  for (const candidate of input.candidates) {
    const balance = money(candidate.balance);
    if (!(eligible as readonly WriteOffCandidate[]).includes(candidate)) {
      rows.push({
        voucherId: candidate.voucherId,
        voucherNumber: candidate.voucherNumber,
        studentProfileId: candidate.studentProfileId,
        studentName: candidate.studentName,
        label: `${candidate.feeType}${candidate.billingMonth ? ` · ${MONTH_NAMES[candidate.billingMonth - 1]}` : ""}`,
        balance,
        reason: {
          code: "NOTHING_OUTSTANDING",
          message: `The voucher is ${candidate.status}, so it carries no collectable balance.`,
        },
      });
      continue;
    }
    if (balance <= 0) {
      rows.push({
        voucherId: candidate.voucherId,
        voucherNumber: candidate.voucherNumber,
        studentProfileId: candidate.studentProfileId,
        studentName: candidate.studentName,
        label: `${candidate.feeType}${candidate.billingMonth ? ` · ${MONTH_NAMES[candidate.billingMonth - 1]}` : ""}`,
        balance,
        reason: {
          code: "NOTHING_OUTSTANDING",
          message: "The voucher carries no outstanding balance.",
        },
      });
      continue;
    }

    rows.push({
      voucherId: candidate.voucherId,
      voucherNumber: candidate.voucherNumber,
      studentProfileId: candidate.studentProfileId,
      studentName: candidate.studentName,
      label: `${candidate.feeType}${candidate.billingMonth ? ` · ${MONTH_NAMES[candidate.billingMonth - 1]}` : ""}`,
      balance,
      reason: null,
    });
  }

  const written = rows.filter((row) => row.reason === null);
  const total = money(written.reduce((sum, row) => sum + row.balance, 0));

  if (written.length > MAX_WRITE_OFF_ROWS) {
    blockers.push({
      code: "TOO_MANY_ROWS",
      message: `The sweep found ${written.length} voucher(s) to dispose of, which exceeds the ${MAX_WRITE_OFF_ROWS} one transaction can post journals for. Restrict the year or run it after collecting what can still be collected.`,
    });
  }

  const maxTotal = input.maxTotal;
  if (maxTotal !== undefined && total > maxTotal) {
    blockers.push({
      code: "TOTAL_TOO_LARGE",
      message: `The sweep would dispose of ${total}, which exceeds the ${maxTotal} ceiling for one run. Write off in smaller batches.`,
    });
  }

  if (written.length === 0) {
    blockers.push({
      code: "NOTHING_TO_WRITE_OFF",
      message: "No voucher in this year carries an outstanding balance, so there is nothing to sweep.",
    });
  }

  return {
    canProceed: blockers.length === 0,
    blockers,
    rows,
    counts: { written: written.length, skipped: rows.length - written.length },
    total,
    studentCount: new Set(written.map((row) => row.studentProfileId)).size,
    maxRows: MAX_WRITE_OFF_ROWS,
    accounts: {
      expense: WRITE_OFF_EXPENSE_ACCOUNT,
      receivable: WRITE_OFF_RECEIVABLE_ACCOUNT,
    },
  };
}

export interface ApplyWriteOffSweepParams {
  tenantId: string;
  executedById: string;
  reason?: string;
  /** The rows the plan marked writable. */
  rows: readonly { voucherId: string; studentProfileId: string; balance: number; label: string }[];
  expenseAccountCode?: string;
  receivableAccountCode?: string;
}

export interface WriteOffApplication {
  journalEntryIds: string[];
  writtenCount: number;
  total: number;
}

/**
 * Apply the sweep inside a caller-supplied transaction.
 *
 * Writes only the rows the plan marked writable, and posts one balanced journal
 * per voucher — the same Dr expense / Cr receivable shape `waiveLateFine` uses.
 * The expense account is required here and the write throws if the tenant's
 * chart of accounts does not carry it, so a sweep can never post against an
 * account nobody configured.
 */
export async function applyWriteOffSweep(
  tx: Prisma.TransactionClient,
  params: ApplyWriteOffSweepParams
): Promise<WriteOffApplication> {
  const {
    tenantId,
    executedById,
    reason,
    rows,
    expenseAccountCode = WRITE_OFF_EXPENSE_ACCOUNT,
    receivableAccountCode = WRITE_OFF_RECEIVABLE_ACCOUNT,
  } = params;

  if (rows.length === 0) {
    throw ApiError.badRequest("The sweep has no rows to write off.");
  }

  const codes = [expenseAccountCode, receivableAccountCode];
  const accounts = await tx.chartOfAccount.findMany({
    where: { tenantId, code: { in: codes }, isActive: true },
  });
  const accountMap = new Map(accounts.map((account) => [account.code, account.id]));
  // Throwing rather than falling back to a default: a default account code is
  // an accounting policy chosen by whoever wrote the default.
  if (!accountMap.has(expenseAccountCode)) {
    throw ApiError.badRequest(
      `The write-off expense account (${expenseAccountCode}) is not configured in this tenant's chart of accounts, so the sweep cannot post. Configure it first.`
    );
  }
  if (!accountMap.has(receivableAccountCode)) {
    throw ApiError.badRequest(
      `Accounts Receivable (${receivableAccountCode}) is not configured, so the sweep cannot post.`
    );
  }

  const journalEntryIds: string[] = [];
  let total = new Prisma.Decimal(0);

  for (const row of rows) {
    const amount = new Prisma.Decimal(row.balance).toDecimalPlaces(
      2,
      Prisma.Decimal.ROUND_HALF_UP
    );
    if (amount.lessThanOrEqualTo(0)) continue;

    // Locked row-by-row rather than as one bulk statement, because the balance
    // the journal must match is the one in the database now, not the one the
    // plan read.
    const locked = await tx.$queryRaw<
      Array<{ id: string; balance: Prisma.Decimal; totalDue: Prisma.Decimal; amountPaid: Prisma.Decimal }>
    >`
      SELECT id, "balance", "totalDue", "amountPaid"
      FROM "FeeVoucher"
      WHERE id = ${row.voucherId} AND "tenantId" = ${tenantId}
      FOR UPDATE
    `;
    if (locked.length === 0) {
      throw ApiError.badRequest(`Voucher ${row.voucherId} no longer exists.`);
    }
    const outstanding = new Prisma.Decimal(locked[0].balance);
    // The plan's figure is what the operator approved; the database's figure is
    // what is actually owed. Writing the smaller of the two means a payment
    // that landed between preview and confirm can never over-write the debt.
    const disposed = Prisma.Decimal.min(amount, outstanding);
    if (disposed.lessThanOrEqualTo(0)) continue;

    const voucherNumber = await getNextVoucherNumber(tx, tenantId, "JOURNAL");
    const journal = await tx.journalEntry.create({
      data: {
        tenantId,
        entryNumber: voucherNumber,
        voucherType: "JOURNAL",
        postingDate: new Date(),
        postingStatus: "POSTED",
        narration: `Outstanding fee written off — ${row.label} (voucher ${row.voucherId})${reason ? ` | ${reason}` : ""}`,
        reference: row.voucherId,
        totalDebit: disposed,
        totalCredit: disposed,
        createdById: executedById,
        lineItems: {
          create: [
            {
              tenantId,
              accountId: accountMap.get(expenseAccountCode)!,
              debitAmount: disposed,
              creditAmount: new Prisma.Decimal(0),
              narration: `Fee written off — ${row.label}`,
              studentId: row.studentProfileId,
            },
            {
              tenantId,
              accountId: accountMap.get(receivableAccountCode)!,
              debitAmount: new Prisma.Decimal(0),
              creditAmount: disposed,
              narration: `Receivable cleared — ${row.label}`,
              studentId: row.studentProfileId,
            },
          ],
        },
      },
    });
    journalEntryIds.push(journal.id);
    total = total.add(disposed);

    const totalDue = new Prisma.Decimal(locked[0].totalDue).minus(disposed);
    const amountPaid = new Prisma.Decimal(locked[0].amountPaid);
    const newBalance = Prisma.Decimal.max(new Prisma.Decimal(0), totalDue.minus(amountPaid));
    const newStatus = newBalance.isZero()
      ? "PAID"
      : amountPaid.greaterThan(0)
        ? "PARTIAL"
        : "OVERDUE";

    await tx.feeVoucher.update({
      where: { id: row.voucherId },
      data: {
        totalDue: { decrement: disposed },
        balance: newBalance.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
        status: newStatus,
      },
    });
  }

  return {
    journalEntryIds,
    writtenCount: journalEntryIds.length,
    total: total.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toNumber(),
  };
}
