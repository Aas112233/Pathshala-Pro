# Mathematical Integrity Audit — Pathshala-Pro

**Scope:** every arithmetic path in fees, payroll, examinations, the general ledger and campus operations.
**Method:** five parallel domain audits against the live working tree, with every material claim verified by executing the arithmetic (Node / `Prisma.Decimal`) rather than by reading alone.
**Date:** 2026-08-31 · **Lines of code reviewed:** ~4,500 across 60+ files.

> **Caveat on line numbers.** The working tree carried ~60 uncommitted modifications during the audit and `src/lib/math-utils.ts` changed three times while agents were running. Line references are accurate as of the snapshot above and may drift by a few lines. Symbol names are stable.

---

## 1. Executive Math Integrity Scorecard

| Domain | Accuracy (1–10) | Rounding Precision | Div-by-Zero Safe | Loophole Risk |
|---|---:|---|---|---|
| **Fee Management & Invoicing** | **4** | ⚠️ Split — `Decimal` in the accrual path, raw `Float` in structures/reports | ⚠️ Guarded in helpers, not at call sites | 🔴 **Critical** — overpayments vanish, arrears compound |
| **HR, Attendance & Payroll** | **3** | 🔴 Raw `Float` on all three live routes | ✅ `daysInMonth` guarded | 🔴 **Critical** — no LOP/proration in production at all |
| **Examinations, GPA & Ranking** | **4** | ⚠️ `Math.round(x*100)/100` half-cent bug in every board engine | ✅ All percentage sites guarded | 🔴 **Critical** — ties get distinct ranks |
| **Double-Entry Accounting / GL** | **5** | ✅ `Decimal` end-to-end | ✅ No unguarded division found | 🟠 High — 10 of 11 write sites bypass the balance guard |
| **Campus & Auxiliary Operations** | **3** | 🔴 `Float` money columns; fine never rounded on the live route | ⚠️ Guarded in shadow tests only | 🔴 **Critical** — every capacity/stock check is a TOCTOU race |
| **Shared helpers** (`math-utils.ts`) | **4** | 🔴 Epsilon no-op at scale; negatives round toward zero | ✅ | 🟠 High — the correct helpers exist but have **no production callers** |

**Totals: 23 Critical · 32 High · 38 Medium · 19 Low.**

### The single most important structural finding

The five helper functions that would have prevented most of this — `roundCurrency`, `addCurrency`, `allocatePayment`, `clamp`, `calculateVoucherTotals` — existed and were **correct enough to pass their own tests**, yet had **zero production callers**. Every live path re-implements the arithmetic inline. That is why the same bug class appears in six places in fees, three in payroll and three in exams.

A green test suite in this codebase has repeatedly indicated that a *mock* was correct, not the code. Three production bugs are actively masked by passing tests (see §2.1, §2.3, §2.5).

---

## 2. Identified Mathematical Bugs & Loopholes

### 2.1 Fee Management & Invoicing

| # | Sev | Location | Defect |
|---|---|---|---|
| F1 | 🔴 Critical | `src/lib/fee-service.ts:620-647` | Overpayment never reaches the wallet |
| F2 | 🔴 Critical | `src/app/api/fees/batch/route.ts:126-140,202` | Arrears re-summed every cycle — compounds |
| F3 | 🔴 Critical | `src/app/api/fees/collect-direct/route.ts:66-85,129`; `bulk-collect/route.ts:80-108` | Non-atomic `amountPaid` write; lost updates |
| F4 | 🟠 High | `src/app/api/fees/route.ts:170`; `[id]/route.ts:159-170` | `lateFine` absent from every `totalDue` formula |
| F5 | 🟠 High | `src/lib/fee-service.ts:20-31` | Negative concession value inflates revenue |
| F6 | 🟠 High | `batch/route.ts:202` vs `:237-246` | Arrears billed on the voucher, never debited to AR |
| F8 | 🟡 Medium | `src/lib/math-utils.ts:2-5` | `roundCurrency` wrong on 6.58% of half-cent boundaries |
| F12 | 🟡 Medium | `src/prisma/schema.prisma:260-266,294-296,319-327,355` | 16 money columns are `Float` |

**F1 — Overpayment silently disappears.** `collectFeePayment` locks and queries a table called `FeeInvoice`:

```ts
const lockedRows = await tx.$queryRaw`SELECT id, "netAmount", "paidAmount" FROM "FeeInvoice" ... FOR UPDATE`;
// ...
} catch {
  // Non-fatal if table not yet migrated
}
```

There is **no `FeeInvoice` model** in `schema.prisma` (the models are `FeeVoucher`, `FeeInvoiceItem`, `Transaction`, `FeeHead`). The query raises `P2021` on every invocation; the bare `catch {}` converts a hard schema error into a silently wrong money decision, leaving `remainingDue = payment`, so `excessToWallet` stays `0`.

> **Pay 6,000 on a 1,200 voucher** → `appliedToInvoice = 6,000.00`, `excessToWallet = 0.00`. AR is credited 6,000 against a 1,200 receivable; the 4,800 is gone, with no `StudentWalletLedger` row.

**Masked by a passing test:** `fee-service.test.ts:152-154` mocks `$queryRaw` to return a `FeeInvoice` row that cannot exist, so the assertion `excessToWallet === "1000.00"` passes. **The suite is green and the production path is broken.**

**F2 — Arrears compound on themselves.** The carry-forward query has no period bound and no "already rolled forward" flag:

```ts
const unpaid = await prisma.feeVoucher.findMany({
  where: { tenantId, studentProfileId: { in: studentIds },
           status: { in: ["PENDING", "PARTIAL", "OVERDUE"] } },  // no date filter
  select: { studentProfileId: true, balance: true },
});
```

A February voucher whose `balance` already *contains* January's arrears is re-summed in March, and March's — containing both — is re-summed in April.

> One January voucher, balance 1,000, unpaid, 5,000/month base. **Arrears billed: Feb 1,000 → Mar 7,000 → Apr 19,000.** True unpaid is 1,000. After 12 runs the student has been billed for the same 1,000 a dozen times.

**F3 — Concurrent collections lose money.** The voucher is read at `collect-direct/route.ts:66-71` **outside** `$transaction` (which opens at `:87`), with no `FOR UPDATE`, and the write at `:129` is absolute (`amountPaid: newAmountPaid`) rather than incremental.

> Two concurrent 600 payments on a 1,200 voucher both read `amountPaid = 0`, both compute 600, both write 600. **600 collected is erased.** Additionally `amountPaid` is never clamped to `totalDue`, so paying 1,500 on 1,200 stores `amountPaid = 1500`; a following 600 payment then computes `applied = min(600, max(0, 1200 − 1500)) = 0` and books the entire 600 to the wallet of an already-`PAID` voucher.

**F4 — Late fines are never billed.** `applyLateFineSurcharge` (`fee-service.ts:506-586`) posts `Dr 1030 / Cr 4060` and writes **no** voucher state. No `totalDue` formula anywhere includes `lateFine`, though the column exists at `schema.prisma:263`. A 500 fine is on the books and never on the bill. A related trap: `discountAmount` is persisted un-clamped while `PUT` rejects `discount > base`, so once an over-concession is stored the voucher becomes **permanently un-editable** (HTTP 400 on any field).

**F5 — A negative concession *increases* the bill.** `fee-service.ts:20-31` guards only the upper bound:

```ts
d = Prisma.Decimal.min(val, eligible);        // val = -500 -> d = -500
total = total.add(d);
if (total.greaterThan(tuitionGross)) total = tuitionGross;   // no lower bound
```

`discountValue` is a `Float` with no DB constraint and no `.max()` in the Zod schema. A `FIXED_AMOUNT` of `-500` on a 4,000 fee yields a concession of **−500**, and `netAnnualDue = annualBase − (−6000) = annualBase + 6,000`.

**F8 — Rounding is wrong at scale (shared across all domains).** The `+ Number.EPSILON` nudge is a no-op once the value's ULP exceeds EPSILON, and it biases negatives toward zero:

| input | current | correct |
|---|---:|---:|
| `128.075` | **128.07** | 128.08 |
| `128.045` | **128.04** | 128.05 |
| `-1.005` | **−1.00** | −1.01 |
| `-2.675` | **−2.67** | −2.68 |

Measured over every half-cent boundary in 100.00–5,000.00: **32,241 / 490,001 wrong (6.58%)**.

---

### 2.2 HR, Attendance & Payroll

| # | Sev | Location | Defect |
|---|---|---|---|
| C1 | 🔴 Critical | `salary-payslip.ts:197-200` + `:243-260` | Net clamped to 0; shortfall discarded; journal cannot balance |
| C2 | 🔴 Critical | `salary-payslip.ts:190-192` | PF charged on the un-prorated full base |
| C3 | 🔴 Critical | `salary-payslip.ts:444-460` | `paidAmount` overwritten, not incremented |
| C4 | 🔴 Critical | repo-wide | The Decimal payroll engine is **dead code** |
| H1 | 🟠 High | `salary-payslip.ts:140-142` | ABSENT + approved leave summed, not unioned |
| H2 | 🟠 High | `salary-payslip.ts:132-137`; `attendance-service.ts:275-296` | `Math.ceil(Δms/864e5)+1` off-by-one |
| H3 | 🟠 High | `salary-payslip.ts:183-184` | Calendar-day divisor vs working-day numerator |
| H7 | 🟠 High | `attendance-service.ts:138-139` | Half-days scored as full absences |
| H9 | 🟠 High | `api/salary/bulk/route.ts:89` | Raw float, unclamped, unrounded |

**C4 — the architectural headline.** `grep` across `src/**` shows `salary-payslip.ts` and `attendance-service.ts` are imported by **nothing except their own tests**. Every live payroll write (`POST /api/salary`, `POST /api/salary/bulk`, `PUT /api/salary/[id]`) uses raw JS floats and never touches the LOP/proration engine. **Production payroll has no loss-of-pay and no proration at all.**

**C1 — clamping net pay breaks the books.** `netPayable` is clamped to 0 but the residual is thrown away, while the accrual journal debits *gross* and credits the *clamped* net:

> Base 60,000, Apr-2026, loan instalment 70,000 → deductions 74,998, net −14,998 → **0**.
> Journal: `Dr 5010 50,000` vs `Cr 2020 0 + Cr 2030 4,165 + Cr 1040 50,000 = 54,165` → **imbalance 4,165** → `accounting-engine.ts:43` throws.
> Because `executeBatchMonthlyPayroll` wraps *all* staff in one `$transaction` with no per-staff savepoint, **one over-deducted employee aborts payroll for the entire school.**

**C3 — duplicate disbursements.** `assertNotPaid` blocks only `status === 'PAID'`, and the update assigns rather than increments:

```ts
if (amount.greaterThan(net)) throw ...;              // 20,000 <= 50,000 -> allowed twice
data: { paidAmount: amount.toNumber(), ... }         // ASSIGN, not INCREMENT
```

> Net 50,000. Disburse 20,000 → `paidAmount = 20,000`, status `PARTIAL`. Disburse 20,000 again → allowed; the bank credits another 20,000; `paidAmount` is **written as 20,000 again**. **40,000 leaves the bank; the ledger records 20,000.**

**H1 — leave days counted twice.** The comment names the fix and then implements the opposite:

```ts
// Avoid double-counting: ... take max of absent vs leave overlap — here sum but cap at daysInMonth
const unpaidDays = Math.min(absent + leaveUnpaid, getDaysInMonth(year, month));
```

`leaves/[id]/route.ts:54` auto-creates attendance rows only `if (!exists)`, so a teacher marked `ABSENT` *before* leave approval has both records. 5-day leave also marked absent → **10 unpaid days instead of 5**; at 90,000/month that is a **15,000 over-deduction**.

**H3 — the divisor does not match the numerator.** Absences can only be recorded on working days (~22–26/month) but the divisor is calendar days (28–31). Identical behaviour, identical gross, 2 absences:

| Month | Days | Daily rate | LOP (2 days) |
|---|---:|---:|---:|
| Feb-2026 | 28 | 2,142.86 | **4,285.71** |
| Apr-2026 | 30 | 2,000.00 | **4,000.00** |
| Jan-2026 | 31 | 1,935.48 | **3,870.97** |

A **414.74 swing** for the same behaviour. Separately, `payableDays` is floored at `daysInMonth − workingDays`, so a fully-absent employee still draws roughly a sixth of salary.

**H7 — half-days are not half.** `attendance-service.ts:138-139` excludes the `halfDayCount` it tallies one line earlier, while `math-utils.ts:18-27` already contains the correct implementation — **which this file does not use**. 40 students, 30 present + 5 half-day + 5 absent: service reports **75.00%**, truth is **81.25%**.

---

### 2.3 Examinations, GPA & Ranking

| # | Sev | Location | Defect |
|---|---|---|---|
| 1 | 🔴 Critical | `src/lib/grading.ts:338-343` | Ordinal ranking — no tie detection whatsoever |
| 3–5 | 🔴 Critical | `grading.ts:44-52` vs `board-engines/grading.ts:8-16` vs `exam-results/route.ts:18-26` | Four divergent grade scales; `Tenant.gpaScale` never read |
| 6 | 🔴 Critical | `board-engines/grading.ts:24`; `grading.ts:94-95` | Band lookup assumes descending order |
| 7 | 🔴 Critical | `api/exams/[id]/batch-report-cards/route.ts:187` | Fabricated attendance printed on report cards |
| 2 | 🔴 Critical | `batch-report-cards/route.ts:174` vs `:212` | Rank denominator ≠ displayed denominator |
| 16 | 🟠 High | `api/reports/exams/route.ts:107-113` | Mean-of-percentages with integer pre-rounding |
| 17 | 🟠 High | `cbse-engine.ts:100-103`; `fbise-engine.ts:122-125` | Unweighted GPA; **no credit field exists anywhere** |

**#1 — ties receive different ranks.** There is no tie branch; `rank = idx + 1` is a row number:

```ts
scored.sort((a, b) => b.percentage - a.percentage);
scored.forEach((item, idx) => { item.rank = idx + 1; ... });
```

> A: 92.40 → Rank 1 · B: 92.40 → **Rank 2** · C: 91.00 → Rank 3.
> Standard competition ranking gives 1, 1, 3. Dense gives 1, 1, 2. The code gives 1, 2, 3.

The UI then hardens this into a factual claim: `class-gradebook-matrix.tsx:79` does `students.find(s => s.rank === 1)` and renders "1st Position". With a tie at the top, **the class topper is decided by roll number, not marks** — the cohort query orders by `rollNumber asc, firstName asc`.

Notably, the float-equality variant of this bug is *not* present: the ranking key is pre-quantised at `grading.ts:319`. The defect is purely the absence of tie handling — and **not one test in the suite has two equal percentages**, so all 21 tests pass.

**#3–5 — the same paper scores three different grades.** A student with **75/100** is persisted with `gradePoint` **3.3**, **4.0** or **4.5** depending on which endpoint wrote the row. Worse, `cbse-engine.ts:8` and `fbise-engine.ts:7` import `DEFAULT_GPA_BANDS` from `./grading`, which is the **NCTB 5-point Bangladesh table** — so CBSE and FBISE students are graded on Bangladesh's scale. `Tenant.gpaScale` (`schema.prisma:46`) exists to fix exactly this and is read by **no code anywhere**.

**#6 — a tenant override would silently invert grading.** `bands.find(b => pct >= b.min) ?? bands[bands.length - 1]` returns the first match, correct only for a descending table. With an ascending table, **85% resolves to F** — and the `?? last band` fallback guarantees a plausible-looking grade instead of an error.

**#7 — invented attendance.** `const att = attendanceMap.get(st.id) || { present: 85, total: 90 }` — a student with zero attendance rows is printed at **94.44%** on a signed report card. `promotion-service.ts:119-121` returns **0%** in the same situation and thereby auto-retains them. Two opposite fabrications for the same missing data.

**#16 — the wrong average.** `Math.round(result.percentage)` truncates each row to an integer, then the aggregate is the mean of those integers. With mixed maxima: Exam A 5/50 (10%) and Exam B 400/500 (80%) → mean-of-percentages **45%**, true ratio-of-sums **73.6%**.

---

### 2.4 Double-Entry Accounting & General Ledger

**Scope corrections:** the models named in the brief (`AccountingTransaction`, `LedgerAccount`, `FiscalPeriod`) do not exist — the real ones are `JournalEntry`, `JournalLineItem`, `ChartOfAccount`, `FiscalYear`, `FinancialPeriod`. Account codes are **4-digit, 1000s tier** (Assets 1010–1500, Liabilities 2010–2060, Equity 3010–3030, Revenue 4010–4070, Expenses 5010–5080), not 10000s. **No code classifies accounts by code range at all** — classification is entirely by the `AccountType` enum.

| # | Sev | Location | Defect |
|---|---|---|---|
| F2 | 🔴 Critical | `fee-service.ts:282,390,473,546,702`; `auxiliary-service.ts:163,290`; `period-closing.ts:264`; `void/route.ts:64` | **10 of 11** journal writes bypass the only balance guard |
| F3 | 🔴 Critical | `accounting-engine.ts:40-45` vs `schema.prisma:1614-1615` | Assert-then-round vs the DB's per-line rounding |
| F1 | 🔴 Critical | `salary-payslip.ts:199` + `accounting-engine.ts:43` | Payroll clamp breaks the identity → whole batch aborts (see §2.2 C1) |
| F7 | 🟠 High | `financial-reports.ts:65,145,227` | `isActive: true` silently drops accounts → unbalanced balance sheet |
| F8 | 🟠 High | `api/accounting/profit-loss/route.ts:28-86` | The production P&L **never reads the GL** |
| F9 | 🟠 High | `api/accounting/statements/route.ts:203-206,326-328` | Opening balance read from a pre-sort running balance |
| F5 | 🟠 High | `period-closing.ts:200,215` | Negative debit/credit amounts from contra balances |
| F4 | 🟠 High | `period-closing.ts:118-129` | No row lock → concurrent close posts retained earnings twice |

**F2 — the invariant is asserted, never derived.** `fee-service.ts:289-293` writes `totalDebit: grossAmount, totalCredit: grossAmount` — the same value on both sides. It happens to be correct today; nothing enforces it. There is no `CHECK` constraint and **no migrations directory** (the project uses `db push`).

**F3 — balanced in memory, unbalanced on disk.** The engine asserts on unrounded `Decimal`, but the column is `Decimal(15,2)`, so Postgres rounds each line independently:

| Account | Side | Passed in | Stored |
|---|---|---:|---:|
| 1010 Main Bank | Dr | 0.005 | **0.01** |
| 1020 Petty Cash | Dr | 0.005 | **0.01** |
| 4010 Tuition Revenue | Cr | 0.010 | 0.01 |
| | | Dr 0.010 / Cr 0.010 ✅ | **Dr 0.02 / Cr 0.01 ❌** |

Latent today (payroll rounds every component), but live the moment anyone adds unit-cost allocation or FX conversion.

**What is genuinely correct — do not "fix" it:** the balance-sheet algebra is **provably sound**. Since `Σ(dr − cr) = 0` across balanced journals, `A = L + E + (R − X)` holds exactly, and `financial-reports.ts:257/263/269/284` implements precisely that. The `voucherType: { not: "CLOSING" }` filter makes it idempotent against re-running after a year-end close. **Multi-tenant isolation is structurally sound** — every aggregate carries `tenantId`, and `JournalLineItem` inherits isolation through the FK.

**F8 — two P&Ls in one product.** `/api/accounting/profit-loss` computes cash-basis (`Transaction.amountPaid − SalaryLedger.paidAmount − Expense.amount`) and never touches `JournalEntry`. The GL-based `generateProfitAndLossReport` has **zero production callers**.

> December salaries accrued 1,200,000 but disbursed 900,000 in January → cash-basis reports 900,000, GL reports 1,200,000. **Surplus differs by 300,000**, on two screens in the same product, with no labelling of basis.

**F9 — running balances stamped before sorting.** `vouchers.forEach` computes `runningBalance`, *then* `allEntries.sort(...)` runs. `openingBalance` is read from `priorEntries.at(-1).runningBalance` — the last **stamped** entry, not the last chronological one. In the traced case this **overstates opening and closing balance by 8,000**. The STAFF branch has no `sort()` at all. The ACCOUNT branch already does this correctly at `:504-516` — the pattern just was not applied to the other two.

---

### 2.5 Campus & Auxiliary Operations

**Precondition:** `src/lib/auxiliary-service.ts` is **dead, non-compiling code** — three `upsert` calls fail typecheck (`TS2353: 'tenantId_studentProfileId' does not exist`) because `HostelAllocation` and `TransportAllocation` declare no `@@unique`. Every capacity guarantee in that file is theoretical.

| # | Sev | Location | Defect |
|---|---|---|---|
| 1 | 🔴 Critical | `api/hostel-allocations/route.ts:70-73` | Bed overbooking — count-then-create, no lock, no DB constraint |
| 2 | 🔴 Critical | `api/library/issues/route.ts:87-89,118` | `availableCopies` decremented with no `gt: 0` guard |
| 3 | 🔴 Critical | `api/library/issues/[id]/return/route.ts:25-26` | Client-controlled `fineAmount`, unvalidated |
| 4 | 🔴 Critical | `api/transport/allocations/route.ts:66-76` | **No seat-capacity check at all** |
| 5,6 | 🔴 Critical | `api/inventory/transactions/route.ts:57,83`; `[id]/route.ts:16-23` | Stock TOCTOU → negative inventory |
| 7 | 🟠 High | `return/route.ts:29-32`; `auxiliary-service.ts:126-131` | Day count via elapsed ms — DST + sub-day |
| 14 | 🟡 Medium | `inventory/page.tsx:110` vs `pdf-templates/inventory-stock-report.tsx:73` | Reorder thresholds disagree |

**#1 — overbooking by construction.** `count` and `create` are separate awaits with no transaction, no `FOR UPDATE`, and no unique constraint to backstop. Postgres runs READ COMMITTED, so two requests both observe 3 occupants of a 4-bed room and both create. **Result: 5 active allocations in a 4-bed room.** The UI renders `5/4 (125%)` in red — it visualises the corruption without preventing it.

**#4 — transport has no capacity rule in production.** `route.vehicleId` is read but the vehicle row is never fetched, so `vehicle.capacity` is never compared against active allocations. This is the only endpoint that creates transport allocations, so the capacity rule — implemented only in the dead `auxiliary-service.ts` — **is enforced nowhere**. A 40-seat bus accepts a 200th consecutive allocation.

**#7 — DST overbills a full day.** `Math.ceil((returnDate − dueDate) / 86_400_000)` measures *elapsed time*, not calendar days:

| Scenario | Elapsed | `ceil` | Truth |
|---|---:|---:|---:|
| Due Oct 31 00:00 EDT → Nov 2 00:00 EST (fall back) | 2.0417 d | **3** | **2** |
| Returned 09:00 **on** the due date | 0.375 d | **1** | **0** |

A book returned nine hours into its due date is billed a full day's fine.

**#3 — the client sets its own fine.** `if (typeof body.fineAmount === "number") fineAmount = body.fineAmount;` — `NaN` and `Infinity` are both `typeof "number"`, and negatives pass. `POST {"fineAmount": -500}` persists **−500** and posts it to the GL. A correct validator already exists and is never imported: `returnBookSchema` at `src/lib/schemas.ts:574-576` has **zero references repo-wide**.

**#14 — the dashboard hides out-of-stock items.** `it.quantity <= it.minStockLevel && it.quantity > 0` excludes a zero-quantity item from the low-stock alert, while the PDF omits the `> 0` clause. Same item: dashboard **0**, PDF **1**. (The `<=` comparison is correct in both — the extra clause is the bug.)

> **Three test files test themselves.** `library.test.ts`, `hostel.test.ts` and `transport.test.ts` import **no production module** — each declares its own copy of the formula inside the test file and asserts against that. 24 tests, all green, all tautological. `hostel.test.ts:68-76` "proves" over-allocation is blocked by calling a local `validateRoomCapacity(4,4)`, while the real endpoint has no lock at all.

---

## 3. Concrete Math & Code Fixes

### 3.1 Shipped in this change

Two modules, pure and dependency-free so they can be tested exhaustively:

**`src/lib/math-utils.ts`** — hardened core (all existing exports preserved, 6/6 pre-existing tests green):

```ts
// Epsilon-free, sign-symmetric rounding. The string-exponent form removes the
// binary representation error BEFORE the rounding decision:
//   Number("128.075e2") === 12807.5   but   128.075 * 100 === 12807.499999999998
export function roundTo(value: number, decimals = 2): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** decimals;
  const shifted = Number(`${value}e${decimals}`);
  if (!Number.isFinite(shifted)) {
    return (value < 0 ? -1 : 1) * (Math.round(Math.abs(value) * factor) / factor);
  }
  // Math.round breaks ties toward +Infinity; negate first for symmetric behaviour.
  const rounded = shifted < 0 ? -Math.round(-shifted) : Math.round(shifted);
  if (rounded === 0) return 0;
  return Number(`${rounded}e${-decimals}`);
}

export function roundCurrency(value: number): number { return roundTo(value, 2); }
export function roundCurrencyStrict(value: number, field = "amount"): number { /* throws on non-finite */ }

// Closes the overflow hole: 1e308 / 1e-308 returned Infinity.
export function safeDivide(n: number, d: number, fallback = 0): number {
  if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) return fallback;
  const result = n / d;
  return Number.isFinite(result) ? result : fallback;
}

// Throws on inverted bounds instead of returning a value below the minimum.
export function clamp(v: number, min: number, max = Number.POSITIVE_INFINITY): number {
  if (!Number.isFinite(v)) return min;
  if (min > max) throw new RangeError(`clamp: lower bound ${min} exceeds upper bound ${max}`);
  return Math.min(max, Math.max(min, v));
}

// Guarantees applied + excess === payment, and refuses to erase a refund.
export function allocatePayment(payment: number, balance: number) { /* throws on negative/NaN/Infinity */ }

// Canonical `base - concession + arrears + lateFine`, computed in integer cents.
export function calculateVoucherTotals(input): VoucherTotals   // strict: throws on over-concession
export function computeVoucherTotals(input): VoucherTotals & { concessionCapped; sanitised }  // lenient: clamps + reports
```

**`src/lib/domain-math.ts`** — new, the domain formulas:

| Helper | Fixes |
|---|---|
| `daysInMonth`, `prorate`, `perDaySalary`, `computeLop` | H3 — `computeLop` returns the *proration residual*, which **conserves money** (`gross === earned + lop`, exactly). See the paisa note below. |
| `inclusiveDays(from, to)` | H2 — calendar days via UTC, not `ceil(Δms)+1` |
| `computeNetPayable` | C1 — clamps at zero **and returns `shortfall`** so the journal can balance |
| `computePercentage`, `computeAggregatePercentage` | #16, #23 — ratio-of-sums, clamped, div-by-zero safe |
| `computeWeightedGpa` | #17 — `Σ(gp·cr)/Σ(cr)` with an unweighted fallback |
| `resolveGradePoint` | #6 — sorts defensively, throws on a gap instead of falling through to F |
| `rankStudents(rows, scoreOf, {policy})` | #1 — competition (default) / dense / ordinal, tie-aware on rounded keys |
| `daysBetween`, `computeOverdueFine` | #7, #8 — DST-immune calendar days, never negative, capped, 2dp |
| `canAllocate`, `occupancyRate` | #1, #4 — `capacity > 0 && allocated < capacity` |
| `applyStockDelta` | #5, #6 — returns `null` to *reject*, never silently clamps |
| `needsReorder` | #14 — one inclusive threshold |
| `sumSides`, `assertJournalBalance` | F3 — **rounds each line first**, then asserts; rejects negatives |
| `classifyAccountCode` | F11 — exhaustive half-open numeric ranges, throws on unclassified |
| `computeBalanceSheet` | F7, F13 — returns `difference` so the caller can raise, not return a silent `false` |

> **The LOP paisa is irreducible — a policy decision is required.** For gross 100,000 over 31 days with 3 unpaid days: the rounded daily rate is 3,225.81, so `rate × days = 9,677.43`; the proration residual is `100,000 − 90,322.58 = 9,677.42`. **Both cannot hold at once.** `computeLop` returns the residual, because conservation (`gross === earned + lop`) is what keeps the ledger and the payroll register reconcilable — the printed daily rate is then informational. The alternative (bill `rate × days` and let the paisa land in earnings) is equally defensible, but the codebase must pick one; today it picks neither consistently, since `lopAmount` uses the unrounded rate while the payslip prints the rounded one.

### 3.2 Call-site patches still required (priority order)

The helpers above only pay off once wired in. Highest-value patches:

| Priority | Fix | Where |
|---|---|---|
| **P0** | Delete the `FeeInvoice` query or point it at `FeeVoucher`; change `catch {}` to rethrow | `fee-service.ts:620-636` |
| **P0** | Bound the arrears query by period and mark vouchers `arrearsCarriedForward` | `fees/batch/route.ts:126-140` |
| **P0** | Move the voucher read inside `$transaction` with `FOR UPDATE`; increment `amountPaid` by the **applied** portion only; add an idempotency key | `collect-direct/route.ts:66-129`, `bulk-collect/route.ts:80-108` |
| **P0** | Serialise capacity checks: `SELECT … FOR UPDATE` on the room/vehicle row, then count, then create. Add `@@unique([tenantId, roomId, bedNumber])` | `hostel-allocations/route.ts:70`, `transport/allocations/route.ts:66` |
| **P0** | Make stock writes atomic: `updateMany({ where: { quantity: { gte: Math.abs(delta) } } })` and assert `count === 1` | `inventory/transactions/route.ts:57,83`; `[id]/route.ts:16` |
| **P1** | Replace `rank = idx + 1` with `rankStudents(cohort, r => r.percentage)` | `grading.ts:338-343` |
| **P1** | Record the shortfall and add the balancing `Dr 2020 / Cr 1040` lines; wrap each employee in a savepoint | `salary-payslip.ts:197-260` |
| **P1** | `paidAmount: alreadyPaid.plus(amount)` and validate against `net − alreadyPaid` | `salary-payslip.ts:444-460` |
| **P1** | Route all 11 journal writes through `assertJournalBalance`; add `CHECK (totalDebit = totalCredit)` in a real migration | `fee-service.ts` ×5, `auxiliary-service.ts` ×2, `period-closing.ts`, `void/route.ts` |
| **P1** | Union ABSENT and approved-leave dates in a `Set`; replace `ceil(Δms)+1` with `inclusiveDays` | `salary-payslip.ts:132-142` |
| **P2** | One canonical grade table per board; wire `Tenant.gpaScale` | `grading.ts:44`, `board-engines/grading.ts:8`, `exam-results/route.ts:18` |
| **P2** | Share one denominator between the ranking input and the displayed percentage; drop the `|| { present: 85, total: 90 }` fabrication | `batch-report-cards/route.ts:174,187,212` |
| **P2** | Validate `fineAmount` with `returnBookSchema` (add `.finite()`) and clamp | `library/issues/[id]/return/route.ts:25` |
| **P2** | Point `/api/accounting/profit-loss` at `generateProfitAndLossReport` | `profit-loss/route.ts:28-86` |
| **P2** | Sort before computing running balances — hoist the ACCOUNT-branch pattern to all three | `statements/route.ts:203,326` |
| **P3** | Migrate the 16 `Float` money columns to `Decimal(15,2)`; delete the `Number(x.toFixed(2))` narrowing | `schema.prisma:260-266,294-296,319-327,355` |
| **P3** | Thread `currencyCode` through `moneyScale()` — KWD/OMR/BHD declare `decimals: 3` but every calc hardcodes 2 | `currencies.ts:117-143` |
| **P3** | Delete `auxiliary-service.ts` (cannot compile, no callers) and repoint the three shadow test files at the real helpers | — |

---

## 4. Automated Mathematical Unit Test Suite

**`src/lib/math-integrity.test.ts`** — 65 tests, all passing. Run with:

```bash
npx vitest run src/lib/math-integrity.test.ts
npx vitest run src/lib/math-integrity.test.ts src/lib/math-utils.test.ts   # 71 tests
```

Every case reproduces a specific audited defect against the pure helpers. Coverage of the requested edge cases:

| Required case | Covered by | Result |
|---|---|---|
| Division by zero | `division by zero` (6 tests) | `safeDivide`, `safePercentage`, `computePercentage`, `computeAggregatePercentage`, `prorate`, `perDaySalary`, `computeLop`, `occupancyRate` all return the fallback instead of `NaN`/`Infinity`. Includes **result overflow** (`1e308 / 1e-308`), which `safeDivide` previously missed. |
| Fractional penny additions (`0.1 + 0.2`) | `fractional penny drift` (8 tests) | Asserts the raw float bug (`expect(0.1 + 0.2).not.toBe(0.3)`) and the fix. 1,000 × `0.01` sums to exactly `10`. Registers the measured half-cent failures (`128.075 → 128.08`). |
| 100% concession vs 0 balance | `concessions and voucher totals` (9 tests) | Full concession settles to `totalDue: 0, balance: 0`; over-concession throws on the interactive path and is clamped **and reported** on the batch path; overpayment routes to the wallet with `applied + excess === payment` held across a table of cases. |
| Rank ties with identical percentages | `class ranking and ties` (8 tests) | Ties share a rank; competition `[1,1,3,4]`, dense `[1,1,2,3]`, ordinal `[1,2,3,4]`; `92.4` vs `92.40000000000001` cannot be split; ordering is deterministic under input reversal. |
| Multi-month LOP proration (28/30/31) | `payroll proration across month lengths` (9 tests) | Feb-2026 **4,285.71** · Apr-2026 **4,000.00** · Jan-2026 **3,870.97**, each asserted exactly 2dp. Plus leap Feb-2024 (29 days) and mid-month joinee proration. |
| DST / sub-day day counting | `library overdue fines` (5 tests) | Fall-back transition bills **2** days (not 3); a 09:00 return on the due date bills **0**; early returns never produce a negative fine; grace period and cap enforced. |
| Capacity / overbooking / negative stock | `capacity and inventory` (4 tests) | `canAllocate(0,0) === false`; `applyStockDelta(10, -11) === null` (reject, not clamp); inclusive reorder threshold. |
| Ledger equilibrium | `general ledger equilibrium` (7 tests) | Unbalanced journals throw; **round-then-assert** catches `Dr 0.005 + Dr 0.005 vs Cr 0.01`; `0.1 + 0.2 vs 0.3` balances; negative amounts and single-line journals rejected; account-code boundaries `1999`/`2000`/`999`/`6000`; net loss is **−20,000**, not 0. |

**Verification:**

```
✓ src/lib/math-utils.test.ts        (6 tests)    existing suite, unbroken
✓ src/lib/math-integrity.test.ts   (65 tests)    new
✓ grading / grading-ranking / fee-service / auxiliary-service
  / salary-payslip / attendance-service          (42 tests)  downstream consumers, unbroken
Tests  113 passed ·  0 lint errors, 0 lint warnings
npx tsc --noEmit  →  no errors in the new or modified modules
```

### Known coverage gap (deliberate)

The suite tests **pure helpers**, not endpoints. The concurrency defects (F3, #1, #2, #4, #5) are time-of-check-to-time-of-use races that cannot be reproduced by a pure unit test — they need either a live Postgres with `Promise.all` on two connections, or a mock whose `count`/`update` ordering can be interleaved. **These are the highest-value tests still to write**, and the P0 atomicity patches should land together with them.

---

## 5. Remediation Roadmap

1. **Ship P0 (today).** The four P0 items are live money loss or unbounded overbilling: overpayments vanishing, arrears compounding, concurrent collections erasing payments, and overbooking/negative stock.
2. **Adopt the helpers (this week).** Wire `domain-math.ts` into the 30+ inline arithmetic sites. Until then the helpers are correct-but-unused — precisely the failure mode that caused this audit's findings.
3. **Fix the misleading tests (this week).** `fee-service.test.ts:152` mocks a table that cannot exist; `library/hostel/transport.test.ts` test private copies of the formulas. A green suite that does not touch production code is worse than no suite, because it removes the signal that would have caught these bugs.
4. **Schema work (this sprint).** Migrate the `Float` money columns, add `CHECK (totalDebit = totalCredit)` and non-negativity constraints, add the `@@unique` backstops for bed/seat allocation, and introduce a real migrations directory.
5. **Decide the domain policies explicitly.** These are business decisions the code currently makes by accident:
   - Ranking: **competition (1,1,3)** — matches the existing "1st/2nd/3rd Position" UI wording.
   - LOP basis: **calendar days or working days** — must be one, consistently, and the divisor must match the numerator.
   - LOP rounding: **residual (conserves money) vs `rate × days` (payslip foots)** — pick one; see §3.1.
   - Attendance with no data: **`null` (unknown)** — never 0% (auto-retains) and never 94% (fabricated).
   - P&L basis: **accrual** — serve the GL report; keep cash-basis as a separately labelled view.
   - Grade scale: **one canonical table per board**, driven by `Tenant.gpaScale`.
