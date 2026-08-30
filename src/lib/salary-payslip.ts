/**
 * Payroll Engine — Server-side, Decimal-precise, LOP/proration-aware
 * Covers: days-in-month, mid-month joiner, attendance+leave LOP, earnings/deductions, 2-stage GL, batch idempotency, PAID immutability
 */
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { postDoubleEntryJournal } from '@/lib/accounting-engine';

// ── Types ───────────────────────────────────────────────────────────────

export interface PayrollAllowances {
  hra?: number | string | Prisma.Decimal; // House Rent
  medical?: number | string | Prisma.Decimal;
  transport?: number | string | Prisma.Decimal;
  special?: number | string | Prisma.Decimal;
  other?: number | string | Prisma.Decimal;
}

export interface PayrollDeductionsConfig {
  pfRate?: number; // 0.0833 = 8.33% default, or 0 for flat
  pfFlat?: number | string | Prisma.Decimal;
  taxAmount?: number | string | Prisma.Decimal;
  loanInstallment?: number | string | Prisma.Decimal; // active advance recovery
}

export interface CalculatePayrollParams {
  tenantId: string;
  staffProfileId: string;
  year: number; // 2026
  month: number; // 1..12
  academicYearId?: string; // optional for SalaryLedger FK
  allowances?: PayrollAllowances;
  deductionsConfig?: PayrollDeductionsConfig;
  // Override base salary if needed (else from StaffProfile.baseSalary)
  baseSalaryOverride?: number | string | Prisma.Decimal;
}

export interface EarningsBreakdown {
  baseSalary: Prisma.Decimal;
  hra: Prisma.Decimal;
  medical: Prisma.Decimal;
  transport: Prisma.Decimal;
  special: Prisma.Decimal;
  other: Prisma.Decimal;
  grossSalary: Prisma.Decimal;
}

export interface DeductionsBreakdown {
  lopDays: number;
  lopAmount: Prisma.Decimal;
  /** Amount actually applied/collected this period (capped at what remains of gross). */
  pfAmount: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  loanRecovery: Prisma.Decimal;
  /** Sum of the *applied* amounts above — always <= grossSalary. */
  totalDeductions: Prisma.Decimal;
}

export interface PayrollCalculation {
  tenantId: string;
  staffProfileId: string;
  staffName?: string;
  year: number;
  month: number;
  daysInMonth: number;
  payableDays: number;
  isProrated: boolean;
  proratedUnpaidDays: number;
  attendance: { present: number; absent: number; leaveUnpaid: number; unpaidDays: number };
  earnings: EarningsBreakdown;
  deductions: DeductionsBreakdown;
  netPayable: Prisma.Decimal;
  dailyRate: Prisma.Decimal;
  /**
   * Aggregate amount that could not be collected this period because
   * configured PF/tax/loan recovery exceeded what remained of gross after
   * higher-priority deductions. Always >= 0. This is reportable, uncollected
   * money — it must be surfaced (e.g. carried into next month's loan
   * recovery, or flagged to payroll admin), never silently discarded.
   */
  shortfall: Prisma.Decimal;
}

// ── Helpers ─────────────────────────────────────────────────────────────

const D = (v: number | string | Prisma.Decimal | null | undefined): Prisma.Decimal => {
  if (v instanceof Prisma.Decimal) return v;
  if (v == null || v === '') return new Prisma.Decimal(0);
  return new Prisma.Decimal(v);
};

export const getDaysInMonth = (year: number, month: number): number => {
  // month 1..12
  return new Date(year, month, 0).getDate();
};

export const getProratedUnpaidDays = (hireDate: Date | null | undefined, year: number, month: number): number => {
  if (!hireDate) return 0;
  const y = hireDate.getFullYear();
  const m = hireDate.getMonth() + 1;
  if (y !== year || m !== month) return 0;
  // Joined on day D -> days before D are unpaid (e.g., joined 15th => 14 unpaid)
  const day = hireDate.getDate();
  return Math.max(0, day - 1);
};

export const getAttendanceUnpaidDays = async (
  tx: Prisma.TransactionClient | typeof prisma,
  tenantId: string,
  staffProfileId: string,
  year: number,
  month: number
): Promise<{ present: number; absent: number; leaveUnpaid: number; unpaidDays: number }> => {
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 0, 23, 59, 59, 999);

  // Staff attendance — ABSENT counts as unpaid; LEAVE status handled via LeaveApplication
  const attendances = await (tx as any).attendance.findMany({
    where: { tenantId, staffProfileId, date: { gte: start, lte: end } },
    select: { status: true, date: true },
  });

  const present = attendances.filter((a: any) => a.status === 'PRESENT').length;
  const absentRecords = attendances.filter((a: any) => a.status === 'ABSENT');
  const absent = absentRecords.length;

  // Calendar-day key (date components only, no time-of-day) so the same day
  // reached via an ABSENT attendance row and via an approved-leave range
  // collapses to one entry instead of being counted twice.
  const dateKey = (d: Date): string => d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate();

  const unpaidDateKeys = new Set<string>();
  for (const a of absentRecords) unpaidDateKeys.add(dateKey(new Date(a.date)));

  // Approved leaves that overlap this month — each overlapping day counts as unpaid
  // LeaveApplication has fromDate/toDate, status APPROVED, applicantType STAFF
  const leaves = await (tx as any).leaveApplication.findMany({
    where: {
      tenantId,
      staffProfileId,
      applicantType: 'STAFF',
      status: 'APPROVED',
      fromDate: { lte: end },
      toDate: { gte: start },
    },
    select: { fromDate: true, toDate: true, leaveType: true },
  });

  const clampToMonth = (d: Date): Date => {
    if (d.getTime() < start.getTime()) return new Date(start);
    if (d.getTime() > end.getTime()) return new Date(end);
    return d;
  };

  let leaveUnpaid = 0;
  for (const l of leaves) {
    // All approved staff leaves are treated as unpaid for payroll unless leaveType is explicitly PAID
    // Extend here if you add LeaveType.PAID
    const s = clampToMonth(new Date(l.fromDate));
    const e = clampToMonth(new Date(l.toDate));
    const cursor = new Date(s.getFullYear(), s.getMonth(), s.getDate());
    const last = new Date(e.getFullYear(), e.getMonth(), e.getDate());
    let days = 0;
    while (cursor.getTime() <= last.getTime()) {
      unpaidDateKeys.add(dateKey(cursor));
      days += 1;
      cursor.setDate(cursor.getDate() + 1);
    }
    leaveUnpaid += days; // kept for the returned shape; may double-count vs. `absent` on overlapping days
  }

  // unpaidDays is the size of the de-duplicated set of unpaid calendar dates
  // (ABSENT attendance UNION approved-unpaid-leave dates), not `absent +
  // leaveUnpaid`, so a day marked both ABSENT and covered by an approved
  // leave is only counted once.
  const unpaidDays = Math.min(unpaidDateKeys.size, getDaysInMonth(year, month));

  return { present, absent, leaveUnpaid, unpaidDays };
};

// ── Core Calculation ────────────────────────────────────────────────────

export async function calculateEmployeePayroll(
  params: CalculatePayrollParams,
  tx: Prisma.TransactionClient | typeof prisma = prisma
): Promise<PayrollCalculation> {
  const { tenantId, staffProfileId, year, month, allowances = {}, deductionsConfig = {}, baseSalaryOverride } = params;

  if (month < 1 || month > 12) throw new Error('month must be 1..12');
  if (year < 2000 || year > 2100) throw new Error('year out of range');

  const staff = await (tx as any).staffProfile.findUnique({
    where: { id: staffProfileId },
    select: { id: true, tenantId: true, firstName: true, lastName: true, baseSalary: true, hireDate: true, joiningDate: true, isActive: true },
  });
  if (!staff) throw new Error('StaffProfile not found');
  if (staff.tenantId !== tenantId) throw new Error('Tenant mismatch for staff');
  if (!staff.isActive) throw new Error('Cannot payroll inactive staff');

  const daysInMonth = getDaysInMonth(year, month);
  const proratedUnpaidDays = getProratedUnpaidDays(staff.hireDate ?? staff.joiningDate ?? null, year, month);
  const isProrated = proratedUnpaidDays > 0;

  const attendance = await getAttendanceUnpaidDays(tx, tenantId, staffProfileId, year, month);
  const unpaidDays = Math.min(proratedUnpaidDays + attendance.unpaidDays, daysInMonth);
  const payableDays = Math.max(0, daysInMonth - unpaidDays);

  // Earnings — Decimal(15,2)
  const baseSalary = D(baseSalaryOverride ?? staff.baseSalary);
  const hra = D(allowances.hra);
  const medical = D(allowances.medical);
  const transport = D(allowances.transport);
  const special = D(allowances.special);
  const other = D(allowances.other);
  const grossSalary = baseSalary.add(hra).add(medical).add(transport).add(special).add(other);

  const dailyRate = daysInMonth ? grossSalary.div(daysInMonth) : new Prisma.Decimal(0);

  // LOP as the *residual* of proration, not `dailyRate x unpaidDays`: the
  // latter rounds twice (once implicitly in the displayed daily rate, once in
  // the LOP amount), so the payslip's printed daily rate multiplied by the
  // days shown no longer equals the actual deduction (off by a paisa). The
  // residual form guarantees earnedGross + lopAmount === grossSalary exactly;
  // the displayed `dailyRate` below is informational only.
  const earnedGross = daysInMonth
    ? grossSalary.mul(payableDays).div(daysInMonth).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
    : new Prisma.Decimal(0);
  const lopAmount = grossSalary.sub(earnedGross).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

  // Deductions — each *configured* amount is capped against what remains of
  // gross after higher-priority deductions, so `netPayable` is non-negative
  // BY CONSTRUCTION and the accrual journal (gross debited in full; net + pf
  // + tax + loan + lop credited) always balances. Previously, netPayable was
  // clamped to 0 without capping the credited pf/tax/loan lines, which made
  // debits != credits whenever configured deductions exceeded gross —
  // postDoubleEntryJournal correctly rejects that, which aborted the entire
  // batch payroll transaction for every other employee already processed in
  // the same run. Priority: LOP (inherent to the period, bounded <= gross by
  // construction since unpaidDays is clamped to daysInMonth) -> PF (statutory)
  // -> Tax (statutory) -> Loan recovery (the most deferrable). Any amount
  // that could not be collected this period is reported in `shortfall`, never
  // silently discarded.
  const pfFlat = deductionsConfig.pfFlat != null ? D(deductionsConfig.pfFlat) : null;
  // PF (Provident Fund) is computed on Basic Salary per Bangladeshi labor law,
  // not on Gross Salary (which includes exempt allowances like HRA, medical, etc.)
  const baseSalaryForPF = baseSalary; // already Decimal from line 175
  const pfRate = deductionsConfig.pfRate != null ? D(deductionsConfig.pfRate) : new Prisma.Decimal(0.0833); // 8.33% as Decimal
  const configuredPfAmount = pfFlat != null ? pfFlat : baseSalaryForPF.mul(pfRate).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  const configuredTaxAmount = D(deductionsConfig.taxAmount).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  const configuredLoanRecovery = D(deductionsConfig.loanInstallment).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

  let remainingAfterLop = grossSalary.sub(lopAmount);
  if (remainingAfterLop.isNegative()) remainingAfterLop = new Prisma.Decimal(0); // defensive only; lopAmount <= grossSalary by construction

  const pfAmount = Prisma.Decimal.min(configuredPfAmount, remainingAfterLop);
  const remainingAfterPf = remainingAfterLop.sub(pfAmount);

  const taxAmount = Prisma.Decimal.min(configuredTaxAmount, remainingAfterPf);
  const remainingAfterTax = remainingAfterPf.sub(taxAmount);

  const loanRecovery = Prisma.Decimal.min(configuredLoanRecovery, remainingAfterTax);
  const netPayable = remainingAfterTax.sub(loanRecovery).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

  const totalDeductions = lopAmount.add(pfAmount).add(taxAmount).add(loanRecovery).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  const shortfall = configuredPfAmount
    .sub(pfAmount)
    .add(configuredTaxAmount.sub(taxAmount))
    .add(configuredLoanRecovery.sub(loanRecovery))
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

  const earnings: EarningsBreakdown = { baseSalary, hra, medical, transport, special, other, grossSalary };
  const deductions: DeductionsBreakdown = { lopDays: unpaidDays, lopAmount, pfAmount, taxAmount, loanRecovery, totalDeductions };

  return {
    tenantId,
    staffProfileId,
    staffName: `${staff.firstName} ${staff.lastName}`.trim(),
    year,
    month,
    daysInMonth,
    payableDays,
    isProrated,
    proratedUnpaidDays,
    attendance,
    earnings,
    deductions,
    netPayable,
    dailyRate: dailyRate.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
    shortfall,
  };
}

// ── Guards ──────────────────────────────────────────────────────────────

export function assertNotPaid(ledger: { status: string } | null, action: string) {
  if (ledger && ledger.status === 'PAID') {
    throw new Error(`SalaryLedger is PAID — ${action} is forbidden (immutable)`);
  }
}

// ── Stage 1: Accrual — debit salaries, credit payables ─────────────────

export async function postPayrollAccrual(
  tx: Prisma.TransactionClient | typeof prisma,
  calc: PayrollCalculation,
  salaryLedgerId: string,
  executedById?: string
) {
  // Academic vs Admin salary account split — heuristic by department; default 5010
  // Caller can override via StaffProfile.department mapping; here we use generic 5010 Academic Staff Salaries
  const salaryAccount = '5010'; // Academic Staff Salaries
  const lines: import('./accounting-engine').JournalLineInput[] = [
    // Debit: Gross Salary expense
    { accountCode: salaryAccount, side: 'DEBIT', amount: calc.earnings.grossSalary, narration: `Payroll accrual ${calc.year}-${String(calc.month).padStart(2,'0')} Gross`, staffId: calc.staffProfileId },
    // Credit: Payable (Net)
    { accountCode: '2020', side: 'CREDIT', amount: calc.netPayable, narration: `Salary & Wages Payable`, staffId: calc.staffProfileId },
  ];
  if (!calc.deductions.pfAmount.isZero()) {
    lines.push({ accountCode: '2030', side: 'CREDIT', amount: calc.deductions.pfAmount, narration: `PF Payable` });
  }
  if (!calc.deductions.taxAmount.isZero()) {
    lines.push({ accountCode: '2040', side: 'CREDIT', amount: calc.deductions.taxAmount, narration: `TDS Payable` });
  }
  if (!calc.deductions.loanRecovery.isZero()) {
    lines.push({ accountCode: '1040', side: 'CREDIT', amount: calc.deductions.loanRecovery, narration: `Advance/Loan Recovery` });
  }
  if (!calc.deductions.lopAmount.isZero()) {
    // LOP savings — net off against expense: Credit same salary account
    lines.push({ accountCode: salaryAccount, side: 'CREDIT', amount: calc.deductions.lopAmount, narration: `LOP ${calc.deductions.lopDays}d` });
    // Adjust debit to gross already includes LOP; crediting LOP reduces expense to payable+pf+tax+loan = gross - lop
    // But we already debited gross; crediting lop + payable + pf... must balance: gross == payable+pf+tax+loan+lop
    // Verify: payable = gross - lop - pf - tax - loan → gross == payable+lop+pf+tax+loan
  }

  return postDoubleEntryJournal(tx, {
    tenantId: calc.tenantId,
    voucherType: 'PAYROLL_ACCRUAL',
    reference: `PAYROLL-ACCRUAL-${salaryLedgerId}`,
    narration: `Payroll accrual ${calc.staffName ?? calc.staffProfileId} ${calc.year}-${String(calc.month).padStart(2,'0')}`,
    createdById: executedById,
    lines,
    idempotencyKey: `payroll-accrual-${salaryLedgerId}`,
  });
}

// ── Stage 2: Disbursement — debit payable, credit bank ─────────────────

export async function postSalaryDisbursement(
  tx: Prisma.TransactionClient | typeof prisma,
  params: {
    tenantId: string;
    salaryLedgerId: string;
    amount: Prisma.Decimal | number | string;
    bankAccountCode?: string;
    executedById?: string;
    /**
     * Distinguishes this disbursement from any other disbursement against the
     * same ledger (e.g. the running cumulative paidAmount after this call).
     * Without this, every call — including a genuine second, partial
     * disbursement — shares the same idempotency key, so
     * postDoubleEntryJournal's idempotency check returns the *first*
     * disbursement's journal and silently skips posting the second one.
     */
    idempotencySuffix?: string;
  }
) {
  const amount = D(params.amount);
  if (amount.lessThanOrEqualTo(0)) throw new Error('Disbursement amount must be >0');

  const idempotencyKey = params.idempotencySuffix
    ? `payroll-pay-${params.salaryLedgerId}-${params.idempotencySuffix}`
    : `payroll-pay-${params.salaryLedgerId}`;

  return postDoubleEntryJournal(tx, {
    tenantId: params.tenantId,
    voucherType: 'PAYROLL_DISBURSEMENT',
    reference: `PAYROLL-PAY-${params.salaryLedgerId}`,
    narration: `Salary disbursement ${params.salaryLedgerId}`,
    createdById: params.executedById,
    lines: [
      { accountCode: '2020', side: 'DEBIT', amount, narration: `Salary Payable` },
      { accountCode: params.bankAccountCode ?? '1010', side: 'CREDIT', amount, narration: `Bank/Cash` },
    ],
    idempotencyKey,
  });
}

// ── Batch Processor — idempotent, transactional ────────────────────────

export interface BatchPayrollResult {
  staffProfileId: string;
  salaryLedgerId: string;
  netPayable: string; // Decimal string 2dp
  status: string;
  isNew: boolean;
}

export async function executeBatchMonthlyPayroll(params: {
  tenantId: string;
  year: number;
  month: number;
  academicYearId: string;
  executedById: string;
  staffIds?: string[]; // if omitted, all active staff for tenant
  allowancesMap?: Record<string, PayrollAllowances>; // per-staff allowances
  deductionsMap?: Record<string, PayrollDeductionsConfig>;
}): Promise<BatchPayrollResult[]> {
  const { tenantId, year, month, academicYearId, executedById, staffIds, allowancesMap = {}, deductionsMap = {} } = params;

  // Validate academic year not closed
  const ay = await prisma.academicYear.findFirst({ where: { id: academicYearId, tenantId } });
  if (!ay) throw new Error('AcademicYear not found');
  if (ay.isClosed) throw new Error('AcademicYear is closed — payroll is read-only');

  return prisma.$transaction(async (tx) => {
    const where: any = { tenantId, isActive: true };
    if (staffIds?.length) where.id = { in: staffIds };

    const staffList = await tx.staffProfile.findMany({ where, select: { id: true } });
    const results: BatchPayrollResult[] = [];

    for (const { id: staffProfileId } of staffList) {
      // Idempotency: skip if ledger already exists for tenant+staff+year+month
      const existing = await tx.salaryLedger.findFirst({
        where: { tenantId, staffProfileId, year, month },
        select: { id: true, status: true, netPayable: true },
      });
      if (existing) {
        results.push({
          staffProfileId,
          salaryLedgerId: existing.id,
          netPayable: new Prisma.Decimal(existing.netPayable).toFixed(2),
          status: existing.status,
          isNew: false,
        });
        continue;
      }

      const calc = await calculateEmployeePayroll(
        {
          tenantId,
          staffProfileId,
          year,
          month,
          academicYearId,
          allowances: allowancesMap[staffProfileId],
          deductionsConfig: deductionsMap[staffProfileId],
        },
        tx as any
      );

      // Snapshot itemized details — store Decimal as string via toFixed(2) for Float legacy compat + Decimal fields
      const ledger = await tx.salaryLedger.create({
        data: {
          tenantId,
          staffProfileId,
          academicYearId,
          month,
          year,
          baseSalary: calc.earnings.baseSalary.toNumber(), // legacy Float
          deductions: calc.deductions.totalDeductions.toNumber(),
          advances: calc.deductions.loanRecovery.toNumber(),
          netPayable: calc.netPayable.toNumber(),
          // Decimal-precise
          grossSalary: calc.earnings.grossSalary,
          totalEarnings: calc.earnings.grossSalary,
          totalDeductions: calc.deductions.totalDeductions,
          lopDays: calc.deductions.lopDays,
          lopAmount: calc.deductions.lopAmount,
          pfAmount: calc.deductions.pfAmount,
          taxAmount: calc.deductions.taxAmount,
          loanRecovery: calc.deductions.loanRecovery,
          daysInMonth: calc.daysInMonth,
          payableDays: calc.payableDays,
          isProrated: calc.isProrated,
          earningsBreakdown: {
            baseSalary: calc.earnings.baseSalary.toFixed(2),
            hra: calc.earnings.hra.toFixed(2),
            medical: calc.earnings.medical.toFixed(2),
            transport: calc.earnings.transport.toFixed(2),
            special: calc.earnings.special.toFixed(2),
            other: calc.earnings.other.toFixed(2),
            grossSalary: calc.earnings.grossSalary.toFixed(2),
            dailyRate: calc.dailyRate.toFixed(2),
          },
          deductionsBreakdown: {
            lopDays: calc.deductions.lopDays,
            lopAmount: calc.deductions.lopAmount.toFixed(2),
            pfAmount: calc.deductions.pfAmount.toFixed(2),
            taxAmount: calc.deductions.taxAmount.toFixed(2),
            loanRecovery: calc.deductions.loanRecovery.toFixed(2),
            totalDeductions: calc.deductions.totalDeductions.toFixed(2),
            attendance: calc.attendance,
            // Uncollected amount, if configured pf/tax/loan exceeded what remained
            // of gross after higher-priority deductions. Always 0.00 unless the
            // employee's deductions were mis-configured relative to their gross
            // this period — surfaced here rather than silently discarded so it
            // can be reviewed and carried forward.
            shortfall: calc.shortfall.toFixed(2),
          },
          status: 'PENDING',
        },
        select: { id: true, netPayable: true, status: true },
      });

      // Stage 1 GL Accrual — uses same tx for atomicity
      await postPayrollAccrual(tx as any, calc, ledger.id, executedById);

      results.push({
        staffProfileId,
        salaryLedgerId: ledger.id,
        netPayable: calc.netPayable.toFixed(2),
        status: 'PENDING',
        isNew: true,
      });
    }

    return results;
  }, { maxWait: 10000, timeout: 60000 });
}

// ── Disbursement helper — marks PAID and posts Stage 2 ─────────────────

export async function disburseSalaryLedger(params: {
  tenantId: string;
  salaryLedgerId: string;
  amount?: Prisma.Decimal | number | string; // default full netPayable
  bankAccountCode?: string;
  executedById: string;
}): Promise<{ ledgerId: string; paidAmount: string }> {
  return prisma.$transaction(async (tx) => {
    const ledger: any = await tx.salaryLedger.findFirst({
      where: { id: params.salaryLedgerId, tenantId: params.tenantId },
    });
    if (!ledger) throw new Error('SalaryLedger not found');
    assertNotPaid(ledger, 'disburse');

    const net = D(ledger.netPayable);
    // Accumulate against whatever has already been disbursed, rather than
    // overwriting it — a second, partial disbursement call must add to the
    // first one's `paidAmount`, not replace it, and must be validated against
    // the *outstanding* balance, not the full netPayable (which is why a
    // legitimate second disbursement for the remainder used to erroneously
    // succeed and then wipe out the record of the first payment).
    const alreadyPaid = D(ledger.paidAmount ?? 0);
    const outstanding = net.sub(alreadyPaid);
    const amount = params.amount != null ? D(params.amount) : outstanding;

    if (amount.lessThanOrEqualTo(0)) throw new Error('Disbursement amount must be >0');
    if (amount.greaterThan(outstanding)) {
      throw new Error(
        `Disbursement ${amount.toFixed(2)} exceeds outstanding balance ${outstanding.toFixed(2)} (netPayable ${net.toFixed(2)}, already paid ${alreadyPaid.toFixed(2)})`,
      );
    }

    const newPaidAmount = alreadyPaid.add(amount).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

    await postSalaryDisbursement(tx as any, {
      tenantId: params.tenantId,
      salaryLedgerId: ledger.id,
      amount,
      bankAccountCode: params.bankAccountCode,
      executedById: params.executedById,
      idempotencySuffix: newPaidAmount.toFixed(2),
    });

    const updated: any = await tx.salaryLedger.update({
      where: { id: ledger.id },
      data: {
        paidAmount: newPaidAmount.toNumber(),
        status: newPaidAmount.greaterThanOrEqualTo(net) ? 'PAID' : 'PARTIAL',
        paidAt: new Date(),
      },
      select: { id: true, paidAmount: true },
    });

    return { ledgerId: updated.id, paidAmount: new Prisma.Decimal(updated.paidAmount).toFixed(2) };
  }, { maxWait: 10000, timeout: 60000 });
}
