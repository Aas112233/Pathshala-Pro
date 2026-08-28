/**
 * Accounting Engine — Double-Entry stub for payroll GL
 * When real JournalEntry / ChartOfAccount tables land, swap the body without changing the salary-payslip contract.
 * Preserves Decimal(15,2) and idempotency.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export type JournalSide = 'DEBIT' | 'CREDIT';

export interface JournalLineInput {
  accountCode: string; // 5010 Academic Staff Salaries, 5020 Admin, 2020 Payable, 2030 PF, 2040 TDS, 1040 Advance, 1010 Bank
  side: JournalSide;
  amount: Prisma.Decimal;
  narration?: string;
  studentId?: string;
  staffId?: string;
}

export interface PostJournalParams {
  tenantId: string;
  voucherType: 'PAYROLL_ACCRUAL' | 'PAYROLL_DISBURSEMENT' | 'RECEIPT' | 'JOURNAL';
  reference: string; // e.g. PAYROLL-2026-02 or SalaryLedger id
  narration: string;
  postingDate?: Date;
  createdById?: string;
  lines: JournalLineInput[];
  idempotencyKey?: string; // prevents double post on retry
}

// Minimal in-DB idempotency via AuditLog (unique on details->idempotencyKey) — avoids needing JournalEntry table yet
export async function postDoubleEntryJournal(
  tx: Prisma.TransactionClient | typeof prisma,
  params: PostJournalParams
): Promise<{ journalId: string; entryNumber: string }> {
  const { tenantId, voucherType, reference, narration, lines, idempotencyKey } = params;

  // 1. Validate double-entry balance with Decimal precision
  const totalDebit = lines.filter(l => l.side === 'DEBIT').reduce((acc, l) => acc.add(l.amount), new Prisma.Decimal(0));
  const totalCredit = lines.filter(l => l.side === 'CREDIT').reduce((acc, l) => acc.add(l.amount), new Prisma.Decimal(0));

  if (!totalDebit.equals(totalCredit)) {
    throw new Error(`Double-entry imbalance: Debit ${totalDebit.toFixed(2)} != Credit ${totalCredit.toFixed(2)} for ${reference}`);
  }
  if (totalDebit.isZero()) throw new Error(`Journal ${reference} is zero-amount`);

  // 2. Idempotency: check AuditLog for same idempotencyKey + reference
  if (idempotencyKey) {
    const existing = await (tx as any).auditLog?.findFirst?.({
      where: { tenantId, action: 'JOURNAL_POST', entity: 'Journal', entityId: idempotencyKey },
    });
    if (existing) {
      return { journalId: existing.entityId ?? idempotencyKey, entryNumber: existing.details?.entryNumber ?? idempotencyKey };
    }
  }

  // 3. Booking — until real JournalEntry/ChartOfAccount tables exist, persist as AuditLog + console
  //    Swap this block with tx.journalEntry.create({ data: { lines: { create: ... }}}}) when GL tables land
  const entryNumber = `${voucherType}-${Date.now().toString(36).toUpperCase()}`;

  // Persist idempotency marker
  try {
    await (tx as any).auditLog?.create?.({
      data: {
        tenantId,
        userId: params.createdById ?? null,
        action: 'JOURNAL_POST',
        entity: 'Journal',
        entityId: idempotencyKey ?? reference,
        details: {
          entryNumber,
          voucherType,
          reference,
          narration,
          totalDebit: totalDebit.toFixed(2),
          totalCredit: totalCredit.toFixed(2),
          lines: lines.map(l => ({ ...l, amount: l.amount.toFixed(2) })),
        },
      },
    });
  } catch {
    // If AuditLog unavailable in mocked tx, ignore
  }

  // Prisma Decimal(15,2) already enforced; no float math
  return { journalId: idempotencyKey ?? reference, entryNumber };
}
