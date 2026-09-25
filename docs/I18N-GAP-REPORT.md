# i18n gap report — RESOLVED

**Status: closed.** All 148 keys listed below were authored on 2026-09-25 across all four locales.
`src/lib/i18n-parity-and-interpolation.test.ts` is green (12/12) and the full suite is
99 files / 1017 tests, 0 failures.

Kept as the record of how the gap was found and measured, and of the correction it forced.
§4 is superseded by §5.

## 1. What was found

The four locale files in the working tree did not match `HEAD`. Measured against
`git show HEAD:src/messages/<locale>.json`:

| | en | ur | hi | bn |
|---|---|---|---|---|
| leaves in HEAD | 5047 | 5047 | 5047 | 5047 |
| leaves in working tree, before recovery | 4994 | 4994 | 4994 | 4994 |
| leaves in working tree, after recovery | 5050 | 5050 | 5050 | 5050 |
| value mismatches among shared keys | 0 | 0 | 0 | 0 |

The divergence was purely *missing* keys, never edited ones — 53 leaves absent per locale, all of
them `feesExtras.batchInvoice.*` and `pdf.*`. Those are **restored**, and the working tree is now
`HEAD` plus exactly the three `attendance.filters.status.*` keys added by the attendance-vocabulary
convergence. Verified: **0 leaves lost against `HEAD`, 3 gained**, identical across all four locales.

So the reduction that removed those 53 leaves is not what this report is about — it touched
namespaces no code references, and it is fully repaired.

**The 146 keys in §2 are a different and older problem, and this is the part that matters: they are
absent from `HEAD` as well as from the working tree.** `promotions.calculator` holds the same 56
keys at `HEAD` and in the working tree; `promotions.reasons` and `promotions.preflight` exist in
neither. This is therefore not recoverable content that something destroyed — it is translation
work that the code references and that was **never committed at all**. `git log`, `git reflog`,
`git stash list`, `origin/main` and the `.next` build cache were all checked; none has ever held it.

## 2. What the code asks for and the messages do not have

**146 distinct keys, referenced from 148 sites, across 11 namespaces**, plus one whole namespace
that is reachable only through a variable and so cannot be found by scanning literals:

- **`promotions.reasons`** — absent entirely, at `HEAD` as well as in the working tree.
  `src/app/(dashboard)/promotions/calculate/page.tsx:143` binds it and line 493 calls
  `tReason(reason.code, reason.params)`. A scanner over literals cannot see it, which is why it is
  called out separately.

### What a missing message actually does — a correction

An earlier version of this report claimed a missing message **throws**, on the reasoning that
`src/i18n/request.ts` sets neither `onError` nor `getMessageFallback`. That is wrong, and the
installed package says so plainly. In `use-intl` — the engine behind the next-intl 4.8.3 this
project has installed (`node_modules/use-intl/dist/esm/production/initializeConfig-*.js`):

- the default `onError` is `console.error`;
- the default `getMessageFallback` returns `` `${namespace}.${key}` `` — the raw key path.

So a missing message **logs an error to the console and renders the raw key path into the UI**. It
degrades; it does not break the page. That lowers every entry below from "crash" to "untranslated
text the user can see" — the promotions page shows `promotions.calculator.cancel` where it means
"Cancel" — which is still worth fixing, but it is not an outage. The thing that has actually been
failing is the guard test, not the application.

| Namespace | Missing keys | Worst-affected file |
|---|---|---|
| `promotions.calculator` | 80 | `src/app/(dashboard)/promotions/calculate/page.tsx` |
| `accounting.statements` | 28 | `src/app/(dashboard)/accounting/statements/page.tsx` |
| `promotions.preflight` | 13 | `src/app/(dashboard)/academic-year/page.tsx` |
| `systemAdmin` | 8 | `src/components/system-admin/tenant-session-policy-panel.tsx` |
| `academicYear` | 6 | `src/app/(dashboard)/academic-year/page.tsx` |
| `auth` | 5 | `src/components/providers/idle-session-guard.tsx` |
| `collection` | 3 | `src/app/(dashboard)/fees/collection/page.tsx` |
| `certificates` | 1 | `src/hooks/use-certificates.ts` |
| `header.academicYear` | 1 | `src/components/layout/academic-year-selector.tsx` |
| `students` | 1 | `src/components/students/student-form-modal.tsx` |
| `studentPerformance` | 1 | `src/app/(dashboard)/students/performance/page.tsx` |

Counts are per *reference site*. A file that declares several namespaces —
`promotions/calculate/page.tsx` declares `promotions.calculator`, `promotions.reasons` and
`promotions.preflight` — is attributed to the first namespace that could have satisfied the key,
and `cancel` is referenced from more than one file, so these figures sum to 147 against 148 sites
and 146 distinct keys. The lists below are the inventory to work from.

### Full list

**`promotions.calculator`** (80)

- `attendance` — `src/app/(dashboard)/promotions/calculate/page.tsx`
- `attendanceNotTracked` — `src/app/(dashboard)/promotions/calculate/page.tsx`
- `cancel` — `src/app/(dashboard)/promotions/calculate/page.tsx`
- `certificateNotIssued` — `src/app/(dashboard)/promotions/calculate/page.tsx`
- `certificatesIssued` — `src/app/(dashboard)/promotions/calculate/page.tsx`
- `certificatesSkipped` — `src/app/(dashboard)/promotions/calculate/page.tsx`
- `clearOverride` — `src/app/(dashboard)/promotions/calculate/page.tsx`
- `clearSelection` — `src/app/(dashboard)/promotions/calculate/page.tsx`
- `closedYearOption` — `src/app/(dashboard)/promotions/calculate/page.tsx`
- `confirmDemotion` — `src/app/(dashboard)/promotions/calculate/page.tsx`
- `confirmExecuteSelected` — `src/app/(dashboard)/promotions/calculate/page.tsx`
- `confirmExecuteWithExits` — `src/app/(dashboard)/promotions/calculate/page.tsx`
- `demoteAction` — `src/app/(dashboard)/promotions/calculate/page.tsx`
- `demotionDialogDescription` — `src/app/(dashboard)/promotions/calculate/page.tsx`
- `demotionDialogTitle` — `src/app/(dashboard)/promotions/calculate/page.tsx`
- `demotionHint` — `src/app/(dashboard)/promotions/calculate/page.tsx`
- `demotionTargetClass` — `src/app/(dashboard)/promotions/calculate/page.tsx`
- `emptyRoster` — `src/app/(dashboard)/promotions/calculate/page.tsx`
- `emptyRosterHint` — `src/app/(dashboard)/promotions/calculate/page.tsx`
- `executeSelected` — `src/app/(dashboard)/promotions/calculate/page.tsx`
- `executeSuccess` — `src/app/(dashboard)/promotions/calculate/page.tsx`
- `exitDocumentsDescription` — `src/app/(dashboard)/promotions/calculate/page.tsx`
- `exitDocumentsTitle` — `src/app/(dashboard)/promotions/calculate/page.tsx`
- `goToAcademicYears` — `src/app/(dashboard)/promotions/calculate/page.tsx`
- `graduating` — `src/app/(dashboard)/promotions/calculate/page.tsx`
- `insufficientDataFlag` — `src/app/(dashboard)/promotions/calculate/page.tsx`
- `insufficientDataWarning` — `src/app/(dashboard)/promotions/calculate/page.tsx`
- `issueCharacterCertificate` — `src/app/(dashboard)/promotions/calculate/page.tsx`
- `issueCharacterCertificates` — `src/app/(dashboard)/promotions/calculate/page.tsx`
- `issueTransferCertificate` — `src/app/(dashboard)/promotions/calculate/page.tsx`
- `issueTransferCertificates` — `src/app/(dashboard)/promotions/calculate/page.tsx`
- `leavingRoster` — `src/app/(dashboard)/promotions/calculate/page.tsx`
- `leftSchool` — `src/app/(dashboard)/promotions/calculate/page.tsx`
- `legacyPlacementFlag` — `src/app/(dashboard)/promotions/calculate/page.tsx`
- `legacyPlacementWarning` — `src/app/(dashboard)/promotions/calculate/page.tsx`
- `lowerClass` — `src/app/(dashboard)/promotions/calculate/page.tsx`
- `manualAction` — `src/app/(dashboard)/promotions/calculate/page.tsx`
- `manualOverride` — `src/app/(dashboard)/promotions/calculate/page.tsx`
- `next` — `src/app/(dashboard)/promotions/calculate/page.tsx`
- `no` — `src/app/(dashboard)/promotions/calculate/page.tsx`
- `noCertificatePermissionHint` — `src/app/(dashboard)/promotions/calculate/page.tsx`
- `noLowerClasses` — `src/app/(dashboard)/promotions/calculate/page.tsx`
- `noOptions` — `src/app/(dashboard)/promotions/calculate/page.tsx`
- `noStudentsSelected` — `src/app/(dashboard)/promotions/calculate/page.tsx`
- `noTargetYearDescription` — `src/app/(dashboard)/promotions/calculate/page.tsx`
- `noTargetYearOptions` — `src/app/(dashboard)/promotions/calculate/page.tsx`
- `noTargetYearTitle` — `src/app/(dashboard)/promotions/calculate/page.tsx`
- `overrideNotSelected` — `src/app/(dashboard)/promotions/calculate/page.tsx`
- `previous` — `src/app/(dashboard)/promotions/calculate/page.tsx`
- `printCertificate` — `src/app/(dashboard)/promotions/calculate/page.tsx`
- `rangeOf` — `src/app/(dashboard)/promotions/calculate/page.tsx`
- `readyToPromoteSelected` — `src/app/(dashboard)/promotions/calculate/page.tsx`
- `rollNumberPolicy` — `src/app/(dashboard)/promotions/calculate/page.tsx`
- `rollNumberPolicyDescription` — `src/app/(dashboard)/promotions/calculate/page.tsx`
- `rollNumberPolicyPreserve` — `src/app/(dashboard)/promotions/calculate/page.tsx`
- `rollNumberPolicySequential` — `src/app/(dashboard)/promotions/calculate/page.tsx`
- `rowsPerPage` — `src/app/(dashboard)/promotions/calculate/page.tsx`
- `searchClassPlaceholder` — `src/app/(dashboard)/promotions/calculate/page.tsx`
- `searchStudents` — `src/app/(dashboard)/promotions/calculate/page.tsx`
- `searchYearPlaceholder` — `src/app/(dashboard)/promotions/calculate/page.tsx`
- `selectAll` — `src/app/(dashboard)/promotions/calculate/page.tsx`
- `selectDemotionTarget` — `src/app/(dashboard)/promotions/calculate/page.tsx`
- `selectTargetYear` — `src/app/(dashboard)/promotions/calculate/page.tsx`
- `selectTargetYearDescription` — `src/app/(dashboard)/promotions/calculate/page.tsx`
- `selectTargetYearPlaceholder` — `src/app/(dashboard)/promotions/calculate/page.tsx`
- `selectedCount` — `src/app/(dashboard)/promotions/calculate/page.tsx`
- `setActionFor` — `src/app/(dashboard)/promotions/calculate/page.tsx`
- `status.demoted` — `src/app/(dashboard)/promotions/calculate/page.tsx`
- `status.graduated` — `src/app/(dashboard)/promotions/calculate/page.tsx`
- `status.transferred` — `src/app/(dashboard)/promotions/calculate/page.tsx`
- `studentId` — `src/app/(dashboard)/promotions/calculate/page.tsx`
- `summaryFooter` — `src/app/(dashboard)/promotions/calculate/page.tsx`
- `targetYear` — `src/app/(dashboard)/promotions/calculate/page.tsx`
- `targetYearSuggested` — `src/app/(dashboard)/promotions/calculate/page.tsx`
- `terminalClassDescription` — `src/app/(dashboard)/promotions/calculate/page.tsx`
- `terminalClassTitle` — `src/app/(dashboard)/promotions/calculate/page.tsx`
- `transferCertificatePurpose` — `src/app/(dashboard)/promotions/calculate/page.tsx`
- `transferredOut` — `src/app/(dashboard)/promotions/calculate/page.tsx`
- `warningsTitle` — `src/app/(dashboard)/promotions/calculate/page.tsx`
- `yes` — `src/app/(dashboard)/promotions/calculate/page.tsx`

**`accounting.statements`** (28)

- `academicYear` — `src/app/(dashboard)/accounting/statements/page.tsx`
- `aging30Days` — `src/app/(dashboard)/accounting/statements/page.tsx`
- `aging60Days` — `src/app/(dashboard)/accounting/statements/page.tsx`
- `aging90Plus` — `src/app/(dashboard)/accounting/statements/page.tsx`
- `agingAnalysis` — `src/app/(dashboard)/accounting/statements/page.tsx`
- `agingCurrent` — `src/app/(dashboard)/accounting/statements/page.tsx`
- `allAcademicYears` — `src/app/(dashboard)/accounting/statements/page.tsx`
- `arrears` — `src/app/(dashboard)/accounting/statements/page.tsx`
- `baseAmount` — `src/app/(dashboard)/accounting/statements/page.tsx`
- `billingPeriod` — `src/app/(dashboard)/accounting/statements/page.tsx`
- `close` — `src/app/(dashboard)/accounting/statements/page.tsx`
- `collectedBy` — `src/app/(dashboard)/accounting/statements/page.tsx`
- `copySummary` — `src/app/(dashboard)/accounting/statements/page.tsx`
- `discountAmount` — `src/app/(dashboard)/accounting/statements/page.tsx`
- `dueDate` — `src/app/(dashboard)/accounting/statements/page.tsx`
- `generateStatement` — `src/app/(dashboard)/accounting/statements/page.tsx`
- `generating` — `src/app/(dashboard)/accounting/statements/page.tsx`
- `journalDetails` — `src/app/(dashboard)/accounting/statements/page.tsx`
- `paymentReference` — `src/app/(dashboard)/accounting/statements/page.tsx`
- `receiptDetails` — `src/app/(dashboard)/accounting/statements/page.tsx`
- `salaryDetails` — `src/app/(dashboard)/accounting/statements/page.tsx`
- `selectEntityRequired` — `src/app/(dashboard)/accounting/statements/page.tsx`
- `shareStatement` — `src/app/(dashboard)/accounting/statements/page.tsx`
- `summaryCopied` — `src/app/(dashboard)/accounting/statements/page.tsx`
- `totalOverdue` — `src/app/(dashboard)/accounting/statements/page.tsx`
- `transactionDetails` — `src/app/(dashboard)/accounting/statements/page.tsx`
- `voucherDetails` — `src/app/(dashboard)/accounting/statements/page.tsx`
- `whatsappShare` — `src/app/(dashboard)/accounting/statements/page.tsx`

**`promotions.preflight`** (13)

- `blocked` — `src/components/shared/rollover-preflight-panel.tsx`
- `blockersLabel` — `src/components/shared/rollover-preflight-panel.tsx`
- `description` — `src/components/shared/rollover-preflight-panel.tsx`
- `passed` — `src/components/shared/rollover-preflight-panel.tsx`
- `recheck` — `src/components/shared/rollover-preflight-panel.tsx`
- `resolveFirst` — `src/components/shared/rollover-preflight-panel.tsx`
- `studentsScanned` — `src/app/(dashboard)/academic-year/page.tsx`
- `studentsTruncated` — `src/components/shared/rollover-preflight-panel.tsx`
- `title` — `src/components/shared/rollover-preflight-panel.tsx`
- `truncatedNote` — `src/components/shared/rollover-preflight-panel.tsx`
- `warningsLabel` — `src/components/shared/rollover-preflight-panel.tsx`
- `yearCloseDescription` — `src/components/shared/rollover-preflight-panel.tsx`
- `yearCloseTitle` — `src/components/shared/rollover-preflight-panel.tsx`

**`systemAdmin`** (8)

- `sessionPolicyAllowHint` — `src/components/system-admin/tenant-session-policy-panel.tsx`
- `sessionPolicyAllowLabel` — `src/components/system-admin/tenant-session-policy-panel.tsx`
- `sessionPolicyDescription` — `src/components/system-admin/tenant-session-policy-panel.tsx`
- `sessionPolicySave` — `src/components/system-admin/tenant-session-policy-panel.tsx`
- `sessionPolicySaveFailed` — `src/components/system-admin/tenant-session-policy-panel.tsx`
- `sessionPolicySaved` — `src/components/system-admin/tenant-session-policy-panel.tsx`
- `sessionPolicySingleHint` — `src/components/system-admin/tenant-session-policy-panel.tsx`
- `sessionPolicyTitle` — `src/components/system-admin/tenant-session-policy-panel.tsx`

**`academicYear`** (6)

- `closeSuccess` — `src/app/(dashboard)/academic-year/page.tsx`
- `closeSuccessMissingResults` — `src/app/(dashboard)/academic-year/page.tsx`
- `operatingYear` — `src/app/(dashboard)/academic-year/page.tsx`
- `setAsCurrent` — `src/app/(dashboard)/academic-year/page.tsx`
- `setCurrentError` — `src/app/(dashboard)/academic-year/page.tsx`
- `setCurrentSuccess` — `src/app/(dashboard)/academic-year/page.tsx`

**`auth`** (5)

- `idleCountdown` — `src/components/providers/idle-session-guard.tsx`
- `idleDescription` — `src/components/providers/idle-session-guard.tsx`
- `idleSignOut` — `src/components/providers/idle-session-guard.tsx`
- `idleStay` — `src/components/providers/idle-session-guard.tsx`
- `idleTitle` — `src/components/providers/idle-session-guard.tsx`

**`collection`** (3)

- `selectMonthsPrompt` — `src/app/(dashboard)/fees/collection/page.tsx`
- `selectPaymentMethodError` — `src/app/(dashboard)/fees/collection/page.tsx`
- `selectPaymentMethodPrompt` — `src/app/(dashboard)/fees/collection/page.tsx`

**`certificates`** (1)

- `bulkIssueFailed` — `src/hooks/use-certificates.ts`

**`header.academicYear`** (1)

- `currentSuffix` — `src/components/layout/academic-year-selector.tsx`

**`students`** (1)

- `selectGender` — `src/components/students/student-form-modal.tsx`

**`studentPerformance`** (1)

- `attendanceNotTracked` — `src/app/(dashboard)/students/performance/page.tsx`

## 3. What is *not* affected

- **`pdfDocs.*`** — present and complete (`feeVoucher`, `markSheet`, `reportCard`,
  `salaryPayslip`). An earlier scan flagged it; the hit was a code comment containing the
  literal string `useTranslations("pdfDocs.*")`, not a real reference.
- **`feesExtras.batchInvoice.*` / `pdf.*`** — restored from HEAD. Unreferenced by code.
- All other 67 namespaces referenced by code resolve fully.

## 4. Recommendation (superseded — see §5)

The evidence changed while this report was being written, so the earlier advice — "check your
editor's local history before re-authoring" — has to be revised. What is now established:

1. These 146 keys are absent from `HEAD` too. `promotions.calculator` is identical between `HEAD`
   and the working tree, and `promotions.reasons`/`promotions.preflight` exist in neither.
2. Nothing in git has ever held them, and the `.next` cache does not either.
3. A missing message renders the raw key path and logs; it does not crash the page.

That leaves three options, and they are genuinely a product decision rather than a technical one:

- **Author them.** 146 keys × 4 locales. The English is mechanical for most entries — the call site
  fixes the meaning — and `ur`/`hi`/`bn` can follow the style already in those files. This is
  additive, needs no migration, and is the only route that turns
  `src/lib/i18n-parity-and-interpolation.test.ts` green.
- **Recover from outside git.** Still worth one look, because if a copy exists it is strictly better
  than re-translating: an editor's local history for `src/messages/*.json`, or a
  `scripts/merge-*.cjs` source block.
- **Delete the references.** Not recommended for anything user-visible, but reasonable for keys on a
  surface that was never finished — the `sessionPolicy*` block in
  `src/components/system-admin/tenant-session-policy-panel.tsx` is the obvious candidate.

**Do not leave it as it is.** The guard test is the only thing that has been reporting this, and it
has been red for long enough that a red suite is now the expected state — which is how the next real
failure gets ignored.

## 5. Resolution (2026-09-25)

Authored **148 keys × 4 locales = 592 entries**. How, and the guards used:

- Every path was confirmed absent from `en` **before** writing, so no authored text could be
  overwritten by a guess.
- Additive only, verified against `HEAD` leaf-by-leaf: **lost 0, changed 0, gained 151** in each of
  the four locales — the 148 below, plus the three `attendance.filters.status.*` keys from the
  attendance-vocabulary increment.
- Format preserved: 2-space indent, CRLF, no BOM, no trailing newline — asserted after each write
  and round-tripped through `json.loads`.
- Interpolation variables were extracted from the call sites rather than guessed, and the parity
  test confirms the `{var}` set matches `en` for every key.

Two things the exercise turned up that are worth keeping:

1. **Namespace attribution has to come from the translator binding, not the shortest path.**
   `promotions/calculate/page.tsx` binds three translators (`promotions.calculator`,
   `promotions.reasons`, `promotions.preflight`). A first pass attributed each key to the *shortest*
   candidate path and filed 78 of them under `promotions.reasons`; the correct binding is
   `promotions.calculator`. Authoring from that attribution would have put the text where nothing
   reads it — and the guard test would still have passed, because it accepts a key that resolves
   under *any* namespace the file declares.
2. **`promotions.reasons` is still empty, and that is a genuine remaining gap.** It is reached only
   through `tReason(reason.code, reason.params)` at
   `src/app/(dashboard)/promotions/calculate/page.tsx:493`, so no scanner over literals can see it.
   Every promotion reason therefore still renders as a raw key path. Fixing it means taking the
   reason-code set from `promotion-engine.ts` as the key list — a separate, smaller piece of work,
   and the one remaining known instance of this defect class.

### Verification

| Check | Result |
|---|---|
| `i18n-parity-and-interpolation.test.ts` | 12/12 pass (was 11 pass / 1 fail) |
| Repository-wide key guard | 0 problems (was 148 sites / 146 keys) |
| Interpolation-variable parity, ur / hi / bn | pass |
| Leaf diff vs `HEAD`, per locale | lost 0, changed 0, gained 151 |
| Locale leaves | 5047 (HEAD) → 5198 |
| Full suite | 99 files / 1017 tests, 0 failures |
| `tsc --noEmit` | clean |
