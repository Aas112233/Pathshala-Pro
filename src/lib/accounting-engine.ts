import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getNextVoucherNumber } from '@/lib/accounting-sequence';

export type JournalSide = 'DEBIT' | 'CREDIT';

export interface JournalLineInput {
  accountCode: string;
  side: JournalSide;
  amount: Prisma.Decimal;
  narration?: string;
  studentId?: string;
  staffId?: string;
}

export interface PostJournalParams {
  tenantId: string;
  voucherType: 'PAYROLL_ACCRUAL' | 'PAYROLL_DISBURSEMENT' | 'RECEIPT' | 'JOURNAL';
  reference: string;
  narration: string;
  postingDate?: Date;
  createdById?: string;
  lines: JournalLineInput[];
  idempotencyKey?: string;
}

const VOUCHER_TYPE_MAP: Record<PostJournalParams['voucherType'], 'JOURNAL' | 'PAYMENT' | 'RECEIPT' | 'SALARY'> = {
  PAYROLL_ACCRUAL: 'SALARY',
  PAYROLL_DISBURSEMENT: 'PAYMENT',
  RECEIPT: 'RECEIPT',
  JOURNAL: 'JOURNAL',
};

export async function postDoubleEntryJournal(
  tx: Prisma.TransactionClient | typeof prisma,
  params: PostJournalParams
): Promise<{ journalId: string; entryNumber: string }> {
  const { tenantId, voucherType, reference, narration, lines, idempotencyKey } = params;

  if (lines.length < 2) {
    throw new Error(`Journal ${reference} requires at least two lines, received ${lines.length}`);
  }

  // Round every line to 2dp *before* summing, and reject negative amounts,
  // before any DB access. A contra-entry must flip `side`, not negate the
  // amount — a negative/negative pair (e.g. Dr -100 / Cr -100) is arithmetically
  // "balanced" but corrupts every downstream SUM(debitAmount)/SUM(creditAmount)
  // report, which assumes non-negative Decimal(15,2) columns. Rounding first
  // also matches what Postgres will actually store, so an in-memory-balanced
  // check can't diverge from what's persisted (SUM(round(x)) !== round(SUM(x))).
  const roundedLines = lines.map((l) => {
    if (!l.amount.isFinite()) {
      throw new Error(`Journal ${reference} has a non-finite line amount for account ${l.accountCode}`);
    }
    if (l.amount.isNegative()) {
      throw new Error(
        `Journal ${reference} has a negative line amount (${l.amount.toFixed(2)}) for account ${l.accountCode} — flip "side" instead of negating the amount`,
      );
    }
    return { ...l, amount: l.amount.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP) };
  });

  const totalDebit = roundedLines.filter(l => l.side === 'DEBIT').reduce((acc, l) => acc.add(l.amount), new Prisma.Decimal(0));
  const totalCredit = roundedLines.filter(l => l.side === 'CREDIT').reduce((acc, l) => acc.add(l.amount), new Prisma.Decimal(0));

  if (!totalDebit.equals(totalCredit)) {
    throw new Error(`Double-entry imbalance: Debit ${totalDebit.toFixed(2)} != Credit ${totalCredit.toFixed(2)} for ${reference}`);
  }
  if (totalDebit.isZero()) throw new Error(`Journal ${reference} is zero-amount`);

  if (idempotencyKey) {
    const existing = await (tx as any).journalEntry?.findFirst?.({
      where: { tenantId, reference: idempotencyKey },
    });
    if (existing) {
      return { journalId: existing.id, entryNumber: existing.entryNumber };
    }
    const audit = await (tx as any).auditLog?.findFirst?.({
      where: { tenantId, action: 'JOURNAL_POST', entity: 'Journal', entityId: idempotencyKey },
    });
    if (audit) {
      return { journalId: audit.entityId ?? idempotencyKey, entryNumber: audit.details?.entryNumber ?? idempotencyKey };
    }
  }

  // Resolve account codes to IDs
  const codes = Array.from(new Set(lines.map(l => l.accountCode)));
  const accounts = await (tx as any).chartOfAccount.findMany({
    where: { tenantId, code: { in: codes }, isActive: true },
  });
  const accountMap = new Map(accounts.map((a: any) => [a.code, a.id]));
  for (const code of codes) {
    if (!accountMap.has(code)) throw new Error(`ChartOfAccount ${code} not configured for tenant ${tenantId}`);
  }

  const mappedVoucherType = VOUCHER_TYPE_MAP[voucherType] as any;
  const entryNumber = await getNextVoucherNumber(tx as Prisma.TransactionClient, tenantId, mappedVoucherType as any);

  const journal = await (tx as any).journalEntry.create({
    data: {
      tenantId,
      entryNumber,
      voucherType: mappedVoucherType,
      postingDate: params.postingDate ?? new Date(),
      postingStatus: "POSTED",
      narration,
      reference: idempotencyKey ?? reference,
      totalDebit,
      totalCredit,
      createdById: params.createdById ?? "system",
      lineItems: {
        create: roundedLines.map(l => ({
          tenantId,
          accountId: accountMap.get(l.accountCode)!,
          debitAmount: l.side === 'DEBIT' ? l.amount : new Prisma.Decimal(0),
          creditAmount: l.side === 'CREDIT' ? l.amount : new Prisma.Decimal(0),
          narration: l.narration ?? narration,
          studentId: l.studentId,
          staffId: l.staffId,
        })),
      },
    },
  });

  // Persist idempotency marker for audit
  try {
    await (tx as any).auditLog?.create?.({
      data: {
        tenantId,
        userId: params.createdById ?? null,
        action: 'JOURNAL_POST',
        entity: 'Journal',
        entityId: idempotencyKey ?? journal.id,
        details: {
          entryNumber: journal.entryNumber,
          voucherType,
          reference: idempotencyKey ?? reference,
          narration,
          totalDebit: totalDebit.toFixed(2),
          totalCredit: totalCredit.toFixed(2),
        },
      },
    });
  } catch {}

  return { journalId: journal.id, entryNumber: journal.entryNumber };
}
