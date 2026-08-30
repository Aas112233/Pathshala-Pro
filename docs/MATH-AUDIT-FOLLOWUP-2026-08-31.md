# Deep Mathematical, Actuarial & Numerical Precision Audit — Follow-Up

**Date:** 2026-08-31 · **Relationship to prior audit:** this is a second, independent pass on top of the same-day `docs/MATH-INTEGRITY-AUDIT.md`. That audit built the shared helper libraries (`src/lib/math-utils.ts`, `src/lib/domain-math.ts`) and flagged that they had zero production callers. This pass verifies that claim against the *current* tree, re-confirms which P0–P3 items are still open, and adds several concrete defects the first pass did not document.

**Method:** four parallel domain audits (fees, payroll, examinations/ranking, general ledger), each required to cite `file:line` and prove every claim by tracing the actual code. I then independently re-read the highest-severity claims myself against the live files before including them here.

**Important correction to the sub-audits' own work:** two of the four domain audits (fees, payroll) initially cited test files at `src/lib/_tests/{net-payable-clamp,pf-calculation,fee-total-due,prorate-precision}.test.ts`. **These files do not exist anywhere in the repository** — `src/lib/_tests/` is not a real directory. I removed every claim that depended on them and re-verified the underlying code-level findings directly against the real files (`fee-service.ts`, `fee-service.test.ts`, `fee-structures.test.ts`, `salary-payslip.ts`, `salary-payslip.test.ts`). The corrected picture is in most cases **worse** than what was originally reported, because the "existing DB-backed test coverage" those fabricated files implied does not actually exist — see §Payroll Test Coverage below. Every finding in this document has been checked against a file I read directly; none rely on the fabricated paths.

I could not execute the test suite in this sandbox (the shell's zed integration is broken here: `libasound.so.2: cannot open shared object file`), so the new regression tests in `src/lib/math-audit-followup-2026-08-31.test.ts` were verified by hand-tracing the production code against each assertion, not by running `vitest`. Please run `npx vitest run src/lib/math-audit-followup-2026-08-31.test.ts` to confirm before relying on them.

---

## 1. Executive Mathematical Rigor Scorecard

| Domain | Formula Correctness | Rounding Safety | Div-by-Zero Safe | Underflow/Clamp Safe | Score (1–10) |
|---|---|---|---|---|---:|
| **Shared helpers** (`math-utils.ts`, `domain-math.ts`) | ✅ Correct, exhaustively unit-tested | ✅ String-exponent rounding, integer-cent summation | ✅ `safeDivide`/guards everywhere | ✅ Explicit clamp + reported shortfall | **9** — but see "zero production callers" below |
| **Fee invoicing & payments** | ⚠️ One live silent under-billing bug (ALL_HEADS concession clamp); one dead-code overpayment bug | ✅ `Prisma.Decimal` used correctly, no float drift | ✅ Guarded | ⚠️ Race conditions on `amountPaid`/wallet balance (lost updates), not underflow per se | **5** |
| **Payroll / LOP / proration** | 🔴 Clamping `netPayable` to 0 without capping deductions can **abort the entire tenant's batch payroll run** | ⚠️ LOP double-rounds vs. displayed daily rate (1-paisa drift) | ✅ Guarded | 🔴 Shortfall silently discarded (no liability recorded); partial disbursement overwrites `paidAmount` | **3** |
| **Examinations, GPA & ranking** | 🔴 Four independently-maintained, disagreeing grade tables; hardcoded pass cutoff contradicts letter grade in the same function | ✅ No unguarded division; `roundTo` shared correctly | ✅ Guarded at every live schema boundary | 🔴 No clamp on `obtainedMarks > maxMarks` — percentages >100% can be persisted | **4** |
| **Grace marks** | 🔴 Entire automated allocator is dead code (zero callers); DB-level backstop (`migration.sql`) is never applied; even if wired up, doesn't recompute the parent record's `percentage`/`grade`/`status` | n/a | ✅ | 🔴 Per-subject/per-student caps not re-seeded across runs | **2** (feature is unreachable, so it neither helps nor actively harms today — but is unsafe the moment it's wired up) |
| **Double-entry ledger** | ⚠️ Totals correctly recomputed from lines (not trusted from caller), but **no negative-amount guard** — a negated contra entry is accepted as "balanced" | 🔴 No line-level rounding-before-insert in the one live multi-item split path (`generateFeeInvoice`) — classic `SUM(round(x)) ≠ round(SUM(x))` | ✅ No unguarded division | ⚠️ `isBalanced` returned as a boolean in the (unused) reporting layer instead of thrown | **6** |
| **Attendance feeding promotion decisions** | 🔴 Zero-attendance (no data) is treated as 0%, not "unknown" — auto-retains students with missing records | n/a | ⚠️ `totalDays === 0` returns `0`, not `null` | n/a | **4** |

**Total distinct findings in this pass: 8 Critical/High-severity, 9 Medium, 4 Low**, on top of the prior audit's already-open P0–P3 backlog.

### The one finding that explains most of the others

`domain-math.ts`'s own header comment says: *"the audit found the same formula implemented between three and five times per domain, with the copies disagreeing."* That is still true today. A sitewide grep confirms **every function in `domain-math.ts` (`sumSides`, `assertJournalBalance`, `classifyAccountCode`, `computeBalanceSheet`, `computePercentage`, `computeAggregatePercentage`, `computeWeightedGpa`, `resolveGradePoint`, `rankStudents`, `computeLop`, `computeNetPayable`, `prorate`) has zero callers outside `domain-math.ts` itself and `math-integrity.test.ts`.** The well-designed, well-tested single source of truth exists and is correct — and nothing in the running application calls it. Every finding below is a concrete instance of that gap.

---

## 2. Exhaustive Mathematical Flaws & Loophole Catalog

### 2.1 Fee invoicing & payments (`src/lib/fee-service.ts`)

**F1 — `computeStackedConcession` clamps an `ALL_HEADS` concession against the wrong base (live, silent under-billing).** `fee-service.ts:8-32`.

```ts
const eligible = c.appliesToHead && c.appliesToHead !== "TUITION" ? gross : tuitionGross;  // L20 — correct numerator
...
if (total.greaterThan(tuitionGross)) total = tuitionGross;                                  // L30 — wrong denominator for the final clamp
```

For an `ALL_HEADS` concession, the numerator (L20) correctly uses the full billed base (`gross`), but the final safety clamp (L30) *always* compares against `tuitionGross`, even when the concession was never scoped to tuition. `appliesToHead` is restricted to `"TUITION" | "ALL_HEADS"` by `schemas.ts:128`, and all three live invoicing routes (`batch`, `bulk-collect`, `collect-direct`) pass exactly this mismatched `(tuitionGross, baseGross)` pair.

**Input:** tuition subtotal = 200, full monthly bill = 1,500, a 1,000 `FIXED_AMOUNT` concession scoped `ALL_HEADS`.
**Actual output:** concession = **200.00**. **Expected:** concession = **1,000.00** (it's ≤ the 1,500 actually billed).
**Effect:** the student is silently overbilled by 800 every month the concession is active, with no error, warning, or `concessionCapped` flag surfaced anywhere. Verified directly by reading `fee-service.ts:1-32` and reproduced in `math-audit-followup-2026-08-31.test.ts`.

**F2 — `collectFeePayment` queries a table that does not exist in the schema; the failure is silently swallowed (currently dead code, live landmine).** `fee-service.ts:595-648`.

```ts
const lockedRows = await tx.$queryRaw<...>`
  SELECT id, "netAmount", "paidAmount" FROM "FeeInvoice" WHERE id = ${feeVoucherId} ... FOR UPDATE
`;
```

`schema.prisma` has no `FeeInvoice` model (only `FeeVoucher` and `FeeInvoiceItem` — confirmed by grep). This raw query throws on every real invocation; the `catch {}` around it is empty, so `remainingDue` keeps its initial value of `payment`. Trace with `payment = 6000` against a real balance of 1,200: `appliedToInvoice` ends up as the full 6,000 and `excessToWallet` stays 0 — the 4,800 excess never reaches the wallet.

**Verified:** `collectFeePayment` has **zero callers** anywhere under `src/app/**` (confirmed by grep) — it is only invoked from `fee-service.test.ts`, whose mock (`fee-service.test.ts:152-154`) fabricates a `{ id, netAmount, paidAmount }` row shape from a table that cannot exist against this schema, so the test is green while certifying a code path that can never run in production. This is a real, correct bug in the function body, but not currently reachable — it becomes exploitable the moment a future payment-gateway integration (the `GATEWAY_ONLINE`/`WALLET_CREDIT` options already declared in `CollectFeePaymentParams`) is wired to it.

**F3 — Non-atomic voucher payment write allows a lost update (live).** `src/app/api/fees/collect-direct/route.ts`. The voucher is read outside `$transaction` and the write sets `amountPaid`/`balance` to absolute computed values rather than `{ increment: appliedToInvoice }`. Two concurrent 600 payments against a 1,200 voucher can each read `amountPaid = 0`, each compute 600, and each write 600 — the GL correctly records 1,200 collected via journal inserts, but the voucher-level `amountPaid`/`balance` that parents and staff actually see ends up wrong. `bulk-collect/route.ts` batches within one transaction but is exposed to the identical race across two separate concurrent requests. *(This matches the prior audit's P0 item; re-confirmed still open at the current lines.)*

**F4 — `applyLateFineSurcharge` posts to the GL but never updates the voucher (live).** `fee-service.ts:507-587`. The function only creates the 2-leg journal entry; it never calls `feeVoucher.update`. All three live invoicing routes hardcode `lateFine: 0` at voucher creation and nowhere else, and both `totalDue` recompute formulas (`fees/route.ts:170`, `[id]/route.ts:163-166`) omit `lateFine` entirely. **Effect:** assessing a 500 late fine correctly posts to the GL, but the voucher's displayed `balance` never reflects it — the ledger and the voucher permanently disagree, and there is no UI path for a parent to pay off a fine the voucher doesn't know exists.

**F5 — Unlocked read-then-write race on the wallet's running balance (live).** `fee-service.ts:51-78` (`createWalletLedgerIfNeeded`). The prior `balanceAfter` is read with no row lock; two concurrent overpayments for the same student can both read the same stale balance and each insert a `balanceAfter` computed from it. The sum of `amount` deltas stays correct, but the specific `balanceAfter` column — the reason the table exists — becomes wrong for one of the two rows.

**F6 — Arrears query has no period bound (compounding bills, matches prior audit's F2, reconfirmed).** `fees/batch/route.ts:128-134` sums *every* unpaid voucher's `balance` as "arrears" with no filter distinguishing already-carried-forward balances from new ones. A ₨1,000 unpaid January balance becomes ₨1,000 of February arrears, then compounds into March, etc.

**What's already correct:** every arithmetic step inside `fee-service.ts` uses `Prisma.Decimal`, not raw floats — no IEEE754 drift in the money math itself. `generateFeeInvoice`'s `netPayable` cannot go negative because the over-concession check throws *before* the subtraction (`fee-service.ts:184-186`), matching `math-utils.ts`'s strict `calculateVoucherTotals` semantics even though it's a separate, hand-rolled implementation. The `appliedToInvoice + excessToWallet === payment` invariant holds algebraically in `collectFeePayment`'s branches — F2 is about the *input* being wrong, not this arithmetic. The negative-concession bug from the prior audit (F5 there) is fixed: `schemas.ts:127` now enforces `discountValue >= 0`.

### 2.2 Payroll (`src/lib/salary-payslip.ts`)

**P1 — Clamping `netPayable` to 0 without capping the credited deductions can abort an entire batch payroll run (Critical, new finding).** `salary-payslip.ts:197-263`.

```ts
const totalDeductions = lopAmount.add(pfAmount).add(taxAmount).add(loanRecovery);   // L197 — uncapped
let netPayable = grossSalary.sub(totalDeductions);
if (netPayable.isNegative()) netPayable = new Prisma.Decimal(0);                     // L199 — net clamped...
```

`postPayrollAccrual` (`salary-payslip.ts:233-263`) then debits the full, uncapped `grossSalary` and credits the clamped `netPayable` *plus* the full, uncapped `pfAmount`/`taxAmount`/`loanRecovery`. `accounting-engine.ts`'s `postDoubleEntryJournal` recomputes both sides from the actual lines and throws `Double-entry imbalance` if they disagree (`accounting-engine.ts:43-45`) — which they will, whenever deductions exceed gross.

**Input:** `gross = 10,000`; `pf = 10,000`; `tax = 999,999`; `loan = 999,999` (a mis-configured loan recovery or PF-rate typo — not an exotic input). `totalDeductions = 2,009,998` → `netPayable` clamps to 0. Debit side = 10,000.00; credit side = 0 + 10,000 + 999,999 + 999,999 = 2,009,998.00.
**Actual output:** `postDoubleEntryJournal` throws. **This throw is uncaught between `calculateEmployeePayroll` and `executeBatchMonthlyPayroll`'s shared `prisma.$transaction(...)`**, so one employee's bad configuration rolls back every other employee's payroll already processed in the same batch — nobody in that tenant gets paid that month until the offending record is found. Reproduced against the real `postDoubleEntryJournal` function in `math-audit-followup-2026-08-31.test.ts`.

The root cause is that `domain-math.ts`'s `computeNetPayable` — built specifically to report a `shortfall` instead of silently clamping (its own doc comment: *"Clamping net to 0 without recording the shortfall silently writes off the unrecovered loan/PF/TDS and leaves the accrual journal unable to balance"*) — is never called by `salary-payslip.ts`.

**P2 — Partial disbursement overwrites `paidAmount` and reuses a stale idempotency key, silently dropping the second GL entry (Critical).** `salary-payslip.ts:430-468, 296`.

`disburseSalaryLedger` writes `paidAmount: amount.toNumber()` (an overwrite, not an increment) and `postSalaryDisbursement`'s `idempotencyKey` is `'payroll-pay-${salaryLedgerId}'` — identical regardless of amount. `assertNotPaid` only blocks `status === 'PAID'`, not `'PARTIAL'`.

**Sequence:** `netPayable = 5000`. Call 1: disburse 3000 → journal posted, ledger `paidAmount=3000, status='PARTIAL'`. Call 2: disburse the remaining 2000 → `assertNotPaid` passes (status is `'PARTIAL'`, not `'PAID'`); `postDoubleEntryJournal`'s idempotency check finds the existing journal under the same reference from call 1 and returns it **without posting anything new**; meanwhile the ledger row is updated to `paidAmount: 2000` (overwriting the 3000 from call 1) and `status` stays `'PARTIAL'` (2000 ≠ 5000). **End state:** the ledger shows 2000 paid, `'PARTIAL'`, with only the first 3000 ever reaching the GL — the first payment's own record is gone and the second has no journal trail.

**P3 — LOP double-rounds relative to the displayed daily rate (Medium, reconciliation drift).** `salary-payslip.ts:183-184, 219`. `domain-math.ts` explicitly warns against this pattern (*"the payslip's printed daily rate multiplied by the days no longer equals the deducted amount"*), and `salary-payslip.ts` does exactly that: `lopAmount = dailyRate.mul(unpaidDays)` from the **unrounded** quotient, while the **displayed** `dailyRate` is rounded independently. Example: `gross=30,000, days=31, unpaid=5` → `lopAmount = 4,838.71` but `displayedDailyRate(967.74) × 5 = 4,838.70` — a 1-paisa gap between the number printed on the payslip and the number actually deducted.

**P4 — Attendance/leave overlap double-counts unpaid days (Medium).** `salary-payslip.ts:130-142`. The code comment says "take max" but the code **sums** `absent + leaveUnpaid` with no deduplication of overlapping dates, only capping the *total* at `daysInMonth`. A day marked both `ABSENT` and covered by an approved leave is counted twice, inflating LOP.

**P5 — No `shortfall` tracking anywhere in `PayrollCalculation` (High).** `salary-payslip.ts:57-72`. There is no field to record the unrecovered amount when deductions exceed gross — the exact gap `domain-math.computeNetPayable` was built to close.

**Decimal/JSON leak (Medium/High, affects reporting, not the payroll engine's own writes):** `salary-payslip.ts` itself writes Float legacy columns via `.toNumber()` correctly and Decimal columns with native `Prisma.Decimal` objects (both correct). But `src/app/api/reports/salary/route.ts` and `src/app/api/accounting/statements/route.ts` read `SalaryLedger.netPayable`/`credit` (a `Decimal`) without `.toNumber()` and place the raw object directly into a `NextResponse.json(...)` body. `JSON.stringify` calls `Decimal.prototype.toJSON`, which returns a **string** — so `netPayable` serializes as `"5000.00"` (string) while sibling fields like `paidAmount` serialize as `5000` (number) in the *same* API response. Reproduced exactly in `math-audit-followup-2026-08-31.test.ts`.

**What's already correct:** PF is computed on basic salary, not gross, matching Bangladeshi labor-law convention (`baseSalaryForPF = baseSalary`, `salary-payslip.ts:190`) with correct flat-vs-percentage selection. `netPayable` itself never goes negative and is never `NaN`. `daysInMonth` (a duplicate of `domain-math.ts`'s version, but currently numerically identical) never returns 0 in the guarded call path, so there is no live division-by-zero. `SalaryLedger`'s `@@unique([tenantId, staffProfileId, year, month])` constraint makes re-running batch payroll for an already-processed month safely idempotent at the ledger level (P2 is specifically about a second *disbursement* call, not a duplicate *ledger* creation).

### 2.3 Payroll test coverage — corrected

**`src/lib/salary-payslip.test.ts` imports nothing from `../salary-payslip` and tests nothing about the real module** (independently verified by reading the file in full). Every assertion is inline `number` arithmetic (`grossEarnings = baseSalary + totalAllowances`, etc.) disconnected from `Prisma.Decimal`, `calculateEmployeePayroll`, PF-on-basic, LOP, or the batch/disbursement functions. **There is no other payroll test file in the repository** — the `net-payable-clamp.test.ts`/`pf-calculation.test.ts` files an earlier pass of this audit cited do not exist. **Net assessment: the payroll engine that calculates and disburses real salaries has zero automated test coverage today**, which is a more severe gap than the original sub-audit reported.

### 2.4 Examinations, GPA & ranking (`src/lib/grading.ts` — there is no separate `grading-ranking.ts`; `grading-ranking.test.ts` imports from `grading.ts`)

**G1 — No clamp on `obtainedMarks`; percentages over 100% can be computed and persisted (High).** `grading.ts` imports only `safePercentage` from `math-utils.ts` (which does **not** clamp), never `domain-math.ts`'s `computePercentage` (which explicitly clamps `obtained` into `[0, max]`). `createExamResultNewSchema` (`schemas.ts:280`) bounds `obtainedMarks` below at 0 but has **no upper bound tied to `maxMarks`** — unlike exam creation, which does cross-check `passMarks > maxMarks`. Input `obtained=150, max=100` → `safePercentage` returns **150**, and nothing stops a report card from displaying 150%.

**G2 — Four independently-maintained grade tables disagree on the same score (Critical if ever unified via tenant config, High today).**

| Source | 75% maps to | GPA |
|---|---|---|
| `grading.ts` `DEFAULT_GPA_BANDS` | "B" | 3.3 |
| `board-engines/grading.ts` `DEFAULT_GPA_BANDS` (used by `cbse-engine.ts`/`fbise-engine.ts`/`nctb-engine.ts`, i.e. `promotion-service.ts`) | "A" | 4.0 |
| `exam-results/route.ts` `GRADING_SCALE` (the table actually used by the live `POST`/`PUT /api/exam-results`) | "A" | 4.5 |

Verified directly: `board-engines/grading.ts:10-18` and `grading.ts:46-54` are two literal, differently-numbered band tables. `Tenant.gpaScale` (`schema.prisma:46`) exists precisely to let a tenant configure one canonical table, and is written by the system-admin settings page but **read by zero production code** — confirmed by grep. The same student's same subject score can show a different letter grade and GPA depending on which endpoint last touched the record.

**G3 — Ascending-band landmine, latent today.** `board-engines/grading.ts:24-27` (`toGrade`) and `grading.ts:91-94` (`getGradeFromBands`) both use `bands.find(b => percentage >= b.min)`, which is only correct for a table sorted **descending**. `domain-math.ts`'s `resolveGradePoint` defensively sorts before matching for exactly this reason, and neither `toGrade` nor `getGradeFromBands` calls it. Currently harmless only because `Tenant.gpaScale` is unused (G2) — the moment it's wired up, an admin pasting an ascending band array via the unvalidated `system-admin/settings` textarea grades every student in the tenant off the first (lowest) band.

**G4 — Hardcoded pass/fail cutoff contradicts the letter grade computed two lines above, in the same function.** `grading.ts:324` (`calculateClassMeritRankings`):

```ts
const passed = !st.results.some((r) => r.maxMarks > 0 && r.obtainedMarks / r.maxMarks < 0.33);
```

This ignores the `gradingSystem` parameter used moments earlier to assign the letter grade. Under `DEFAULT_GPA_BANDS` the real fail cutoff is 40% ("E" band). **Input:** 35/100 → `letterGrade = "F"` (35 < 40) but `passed = true` (35 ≥ 33) — the same subject record simultaneously says "F" and "passed." `evaluateSubjectComponents` (`grading.ts:264-265`), in the same file, derives its cutoff correctly from the active band table — the two functions disagree with each other, not just with the standard.

**G5 — Ranking itself is correct.** `grading.ts:341-352` implements standard competition ranking (1,1,3) and is *not* vulnerable to float-noise ties, because scores are rounded to 2dp (via `safePercentage`) before comparison — the same `roundTo` primitive `domain-math.ts`'s `rankStudents` uses. (The prior audit's claim that this function had "no tie detection whatsoever" is stale — it has since been fixed.) It is, however, a fourth independent reimplementation with a single hardcoded policy, no `dense`/`ordinal` option, and no `tieBreak` hook, unlike the configurable `rankStudents` in `domain-math.ts`.

**G6 — Grace marks: the algorithm exists but is entirely unreachable, and would corrupt persisted data if it were ever wired up.**
- There is **no UI or API endpoint anywhere** to enter grace marks — grep for `graceMarksGiven`/`graceReason`/`graceApprovedById` across `src/app/api/**` returns nothing.
- The only code that writes these fields is the automated allocator in `promotion-service.ts:196-257` (`executePromotionBatch`), gated behind `gracePolicy.autoApply` (default `false`). **`executePromotionBatch` itself has zero callers anywhere in `src/app/**`** (confirmed by grep) — the entire subsystem is dead code.
- If it were invoked: both the per-subject and per-student ceilings are checked correctly and simultaneously for each grant *within one call*. But `totalGraceForStudent` resets to 0 every call and is never seeded from grace already recorded on other rows, so a re-run or a partial-transaction retry can exceed the configured per-student cap with nothing catching it. Allocation order is undefined (`examResults`/`componentResults` are fetched with no `orderBy`), so which subjects get rescued when the deficit exceeds the cap is arbitrary, not deficit-optimized.
- **Confirmed the DB write is incomplete:** the grace-mark update touches `originalObtained, graceMarksGiven, obtainedMarks, graceReason, graceApprovedById` but never `percentage`/`grade`/`gradePoint`/`status` on `ExamResult` — these denormalized columns are left at their pre-grace values permanently. For the component path it's worse: only the child component's `obtainedMarks` is updated; the parent `ExamResult`'s own `obtainedMarks`/`percentage`/etc. (the subject total) is never touched at all, so it diverges from the sum of its now-graced components. (The promotion *decision itself* is unaffected — it re-derives from an in-memory object — but any report card, transcript, or gradebook reading `ExamResult` directly will show the stale, pre-grace figures forever.)
- The DB-level backstop that should catch this (`src/prisma/migration.sql` — `chk_marks_range`, `trg_grace_cap_component`/`_exam`) is **never applied**: `package.json` only exposes `prisma db push`, which syncs the Prisma schema, not arbitrary SQL triggers/constraints. This entire defense-in-depth layer is dead documentation. It also has its own bug even in principle — `check_grace_limit()` scopes its "total grace" `SUM` to a single `examResultId` (i.e., a true per-subject check applied using the per-*student* configured limit), so it wouldn't actually enforce a cross-subject student total even if it were live.

**G7 — Attendance feeding the promotion gate treats "no data" as "0%", auto-retaining students with missing records.** `promotion-service.ts:119-121` computes `attendancePct = totalDays ? ... : 0`. `domain-math.ts`'s `computeAttendancePercentage` was built specifically to return `null` ("unknown") instead of `0` ("auto-retains a student for a data-entry gap") — and is not called here. A freshly-admitted mid-year student with zero attendance rows is retained for a data gap, not for actual absence.

**Test coverage:** every cohort fixture in both `grading.test.ts` and `grading-ranking.test.ts` uses `maxMarks: 100` for every subject, so ratio-of-sums and mean-of-percentages are mathematically identical in every existing test — no test in the suite could catch a regression that silently switched aggregation strategy. No test asserts `passed` and `letterGrade` agree (would have caught G4). No test covers `obtainedMarks > maxMarks` (G1), a `maxMarks ≤ 0` edge case, or grace marks (`promotion-service.ts` has no test file at all).

**What's already correct:** zero-`maxMarks` division safety is solid at every live schema boundary (`min(1)` constraints on exam/subject/result creation schemas); `safePercentage`/`getGradeFromBands` degrade to 0 rather than crashing if a zero ever did get through. Singleton and fully-tied cohorts terminate with sensible ranks (verified by hand-trace). `roundTo`'s string-exponent rounding is shared correctly between `grading.ts` (via `safePercentage`) and `domain-math.ts`, so wherever rounding does happen, it's the same safe primitive.

### 2.5 General ledger (`src/lib/accounting-engine.ts`, `financial-reports.ts`, `period-closing.ts`)

**L1 — No negative-amount guard in `postDoubleEntryJournal` (High, live).** `accounting-engine.ts:34-46`. Totals are correctly recomputed from the actual line items (not trusted from a caller-supplied total) using exact `Prisma.Decimal` equality — good. But there is no check that any line's `amount ≥ 0`. `domain-math.ts`'s `assertJournalBalance` explicitly rejects negative amounts ("flip side instead of negating"); this production function has no equivalent. **Input:** a debit line of −100 and a credit line of −100. `totalDebit.equals(totalCredit)` → true; `totalDebit.isZero()` → false. **The pair is persisted as "balanced,"** writing negative values into `debitAmount`/`creditAmount` columns that every downstream `SUM()` implicitly assumes are non-negative. Reproduced against the real function in `math-audit-followup-2026-08-31.test.ts` (the negative pair sails past the balance check; it only fails later, for an unrelated reason, in the test fixture).

**L2 — `generateFeeInvoice`'s multi-item split has no line-level rounding before insert (High, live, classic penny-drift).** `fee-service.ts:174-298`. `grossAmount`/`netPayable`/per-item legs are accumulated as exact, unrounded `Prisma.Decimal` values with no `.toDecimalPlaces(2)` and no call to `assertJournalBalance`/`sumSides` before `journalEntry.create`. **Input:** three revenue items of `33.333` each (nothing in the function's types forbids 3-decimal input). `grossAmount = netPayable = 99.999` exactly; the header (`totalDebit`/`totalCredit`) is `99.999` on both sides, so a header-level check reports balanced. On disk, Postgres rounds the AR debit leg (`99.999` → `100.00`) and each revenue credit leg independently (`33.333` → `33.33` × 3 = `99.99`). **Actual: `Dr 100.00` vs `Cr 99.99` — unbalanced by one cent in the subledger**, even though the header looked fine. This is exactly the failure mode `domain-math.ts`'s `sumSides` doc comment warns about, unguarded here because the function never calls it. This path is live (used by admission/enrollment fee posting).

**L3 — A third, independent, Float-based ledger implementation for the student-facing statement (Medium/High, live).** `src/app/api/accounting/statements/route.ts:142-217` builds its running balance directly from `FeeVoucher.totalDue`/`Transaction.amountPaid` — both plain `Float` columns — using raw `+=`/`-=` on JS numbers, never touching `JournalEntry`/`JournalLineItem` or any `domain-math.ts`/`math-utils.ts` helper. This is a second general ledger, disagreeing in principle with the Decimal-based GL that `financial-reports.ts` correctly builds, and it is exposed to ordinary IEEE754 drift (`0.1 + 0.2 !== 0.3`) on every voucher/payment shown to a parent, unguarded by `roundCurrency`.

**L4 — Balance-sheet/trial-balance reporting is correct in isolation but has zero production callers (Medium).** `financial-reports.ts`'s `generateTrialBalanceReport`/`generateProfitAndLossReport`/`generateBalanceSheetReport` classify accounts via the stored `ChartOfAccount.accountType` enum (not fragile string comparison — that specific risk does not exist here) and correctly implement the Assets = Liabilities + Equity + Surplus equation. But grep confirms **no route imports `financial-reports.ts`** — `/api/accounting/profit-loss` does not call it. `isBalanced` is returned as a boolean rather than thrown on mismatch, contrary to `computeBalanceSheet`'s own stated design intent, but this is moot while the report layer is unreachable. `classifyAccountCode`'s exhaustiveness guard (which would catch a `ChartOfAccount` row whose numeric `code` disagrees with its stored `accountType`) is likewise wired into nothing.

**L5 — Reversal/void is the one place the codebase follows its own guidance (Low, correct — noted so it isn't "fixed" incorrectly).** `src/app/api/transactions/[id]/void/route.ts:64-88` creates a mirrored journal entry that swaps the debit/credit **columns**, never negating an amount — exactly matching `domain-math.ts`'s prescription. Gaps are only in verification depth: no `assertJournalBalance` re-check before insert, and zero test coverage (grep for `void`/`reversal` across `*.test.ts` returns nothing).

**What's already correct:** every production read site that touches `debitAmount`/`creditAmount`/`totalDebit`/`totalCredit` (`analytics-service.ts`, `financial-reports.ts`, `period-closing.ts`) uses proper `Prisma.Decimal` methods (`.plus/.minus/.toNumber/.equals/.isZero`) — no raw-number coercion bugs found in the GL's own Decimal handling. Account classification uses a real stored enum column, not string parsing of the account code.

---

## 3. Numerical Helper Library — status and what's genuinely still missing

`src/lib/math-utils.ts` and `src/lib/domain-math.ts` **already implement everything the audit brief asked for**, correctly:

- `safeRound` → `roundTo(num, decimals)` (string-exponent rounding, immune to the `1.005 → 1.00` bug).
- `safeDivide(numerator, denominator, fallback)` → exists, also guards result overflow.
- `clamp(value, min, max)` → exists, throws on inverted bounds rather than silently misbehaving.
- Standard competition ranking with epsilon-safe tie comparison → `rankStudents(rows, scoreOf, { policy: "competition" | "dense" | "ordinal", precision })`.
- Integer-cent summation, payment/wallet allocation, voucher totals, LOP, GPA, ledger balance assertions — all present.

**Do not re-implement these.** The problem this audit found is adoption, not design. The concretely missing pieces are small, targeted additions for gaps the existing library doesn't cover:

```ts
// src/lib/math-utils.ts — proposed additions

/**
 * Serialize a Prisma.Decimal-bearing object for an API response without
 * leaking Decimal.toJSON()'s string output next to plain numeric siblings
 * (see finding P5/Decimal-JSON-leak). Call at the API boundary, not earlier —
 * internal arithmetic should stay on Decimal/Number as appropriate.
 */
export function decimalsToNumbers<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    out[key] =
      value !== null && typeof value === "object" && typeof (value as any).toNumber === "function"
        ? (value as { toNumber(): number }).toNumber()
        : value;
  }
  return out as T;
}

/**
 * Net payable that reports a shortfall instead of writing off unrecovered
 * deductions (mirrors domain-math.ts's computeNetPayable, but for a caller
 * already working in Prisma.Decimal so no float round-trip is needed).
 * Returning the shortfall lets the caller post a balancing liability line
 * (Dr Loan Receivable / Cr matching account) so postDoubleEntryJournal never
 * sees an unbalanceable batch.
 */
export function computeNetPayableDecimal(
  gross: Prisma.Decimal,
  totalDeductions: Prisma.Decimal,
): { netPayable: Prisma.Decimal; shortfall: Prisma.Decimal } {
  const raw = gross.sub(totalDeductions);
  return {
    netPayable: raw.isNegative() ? new Prisma.Decimal(0) : raw,
    shortfall: raw.isNegative() ? raw.abs() : new Prisma.Decimal(0),
  };
}
```

And one addition to `domain-math.ts`'s ledger family, since `postDoubleEntryJournal` is the one function every live journal write actually calls and it currently has no negative-amount guard (finding L1):

```ts
// src/lib/domain-math.ts — proposed addition, or inline in accounting-engine.ts
export function assertNoNegativeLines(lines: ReadonlyArray<{ amount: Prisma.Decimal | number }>): void {
  for (const line of lines) {
    const n = typeof line.amount === "number" ? line.amount : line.amount.toNumber();
    if (n < 0) {
      throw new RangeError(`Journal line amount ${n} is negative — flip "side" instead of negating the amount`);
    }
  }
}
```

These are the only genuinely new primitives this pass found missing. Everything else needed is wiring, not design.

---

## 4. Automated Actuarial & Stress Test Suite

`src/lib/math-integrity.test.ts` (from the prior audit) already covers, against the pure helpers: leap-year LOP (Feb 2024/2026), GPA with zero credit hours, over-concession clamping/throwing, division-by-zero fallbacks, and the general-ledger equilibrium invariant with the exact `0.005 + 0.005 vs 0.01` penny-drift case. I did not duplicate those.

I added `src/lib/math-audit-followup-2026-08-31.test.ts`, which calls the **real production functions** (not re-implemented copies) to close the specific gap the prior suite has — every one of `domain-math.ts`'s helpers is well-tested, but nothing tests whether production code actually behaves the way those helpers say it should:

1. **10,000-iteration randomized fractional-cent stress test** — `addCurrency(...)` against a deterministic xorshift64 PRNG, asserting `SUM(round(item)) === round(SUM(item))` holds for every trial, plus a 100,000-iteration `0.01` accumulation proving the raw-float version drifts while `addCurrency` doesn't.
2. **Finding F1 regression** — calls the real `computeStackedConcession` and documents today's actual output (200) next to the intended output (1000) in a comment, so a future fix is a deliberate, visible one-line change.
3. **Finding P1 regression** — calls the real `postDoubleEntryJournal` with the exact line shape `postPayrollAccrual` builds for an over-deducted employee, and asserts it throws `Double-entry imbalance` — proving the batch-abort risk against production code, not a description of it.
4. **Finding L1 regression** — calls the real `postDoubleEntryJournal` with a negated debit/credit pair and proves the balance-equality check does not reject it.
5. **Decimal/JSON-leak reproduction** — a minimal, self-contained proof that `JSON.stringify({ decimalField, numberField })` produces mismatched JSON types for two fields an API consumer would reasonably expect to both be numbers.

Run with:

```bash
npx vitest run src/lib/math-audit-followup-2026-08-31.test.ts
```

**I was unable to execute this in the current sandbox** (`libasound.so.2` missing, breaking the shell's zed integration for every command including `node --version`). Every assertion was hand-traced against the actual source of `fee-service.ts`, `accounting-engine.ts`, and `math-utils.ts` read in this session, and cross-checked against `Prisma.Decimal`'s (decimal.js) documented `toString()`/`toJSON()` behavior, but please run it before relying on it.

---

## 5. Priority remediation order

1. **F1** — fix `computeStackedConcession`'s final clamp to compare against the same base its `ALL_HEADS` numerator used, not always `tuitionGross`. Live, silent revenue loss.
2. **L1** — add a negative-amount guard to `postDoubleEntryJournal` (the snippet in §3). Currently the single point every live journal write goes through, and it has no defense against a negated contra-entry.
3. **P1/P5** — route `calculateEmployeePayroll`'s net-payable clamp through a shortfall-reporting function (§3's `computeNetPayableDecimal`) and post a balancing liability line, so one mis-configured employee record can no longer roll back an entire tenant's payroll batch.
4. **F2/F3/F5** — the three concurrency/dead-code issues in fee collection (delete or fix the `FeeInvoice` query; move the voucher read inside the transaction with row locking and `increment`; lock the wallet-balance read). Matches the prior audit's P0 list — still open.
5. **P2** — fix `disburseSalaryLedger` to accumulate `paidAmount` and vary the disbursement idempotency key by amount/attempt.
6. **G1/G4** — clamp `obtainedMarks` at `maxMarks` (schema + `computePercentage`), and make `calculateClassMeritRankings`'s pass/fail check derive from the same band table as the letter grade.
7. **G2/G3** — pick one canonical grade table per board and wire `Tenant.gpaScale` through `resolveGradePoint`'s defensive sort, rather than three tables that silently disagree.
8. **L2/L3** — add `sumSides`/rounding-before-insert to `generateFeeInvoice`'s multi-item split, and repoint `accounting/statements/route.ts` at the Decimal-based GL instead of a parallel Float ledger.
9. **G6** — either delete the unreachable grace-mark subsystem or, if it's wanted, wire it to a real endpoint, seed `totalGraceForStudent` from existing grants, and make it update the denormalized `percentage`/`grade`/`status` fields it currently leaves stale.
10. Stop assigning raw `Prisma.Decimal` objects into any object passed to `NextResponse.json(...)` — call `.toNumber()` (or the proposed `decimalsToNumbers` helper) at every API boundary.

None of the above have been applied to production code in this pass — this document and the new test file are audit artifacts only, per the scope of the request.
