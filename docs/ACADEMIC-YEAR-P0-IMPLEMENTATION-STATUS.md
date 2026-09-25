# Academic Year Module — Wave P0 Implementation Status

**Date:** 2026-09-24 · updated 2026-09-25
**Predecessors:** `docs/ACADEMIC-YEAR-MODULE-AUDIT.md` (current-state audit) · `docs/ACADEMIC-YEAR-INDUSTRY-GAP-ANALYSIS.md` (roadmap)
**Scope delivered:** Wave P0 — *Progression correctness*, plus the Wave P1 items in §9–§11

---

## 1. Verification evidence

| Check | Command | Result |
|---|---|---|
| Types | `npx tsc --noEmit` | clean, 0 errors |
| Tests | `npx vitest run` | **97 files / 974 tests, 0 failures** |
| Lint | `npx eslint <touched files>` | 0 errors (only pre-existing `no-explicit-any` and unused-import warnings) |

Baseline before this work was 684 passed with 4 pre-existing failures in 3 files. The suite is now
fully green: **+90 new tests** (60 engine, 20 execute-route, 6 roster-filter, 4 elsewhere), and the
4 previously failing tests pass. The exit-document work in §8 adds a further 39, the Wave P1 year
lifecycle work (the `isCurrent` resolver, lifecycle audit, rollover RBAC) adds 28, the pre-flight
gate in §9 adds 64, the year-close finalisation in §10 adds 32, and the attendance convergence in
§11 adds 14 while moving 6.

**Exactly one schema change was needed** (§"The one schema change" below). Everything else writes
columns that already existed as `String`: `StudentStatus.GRADUATED` and
`StudentAcademicSession.promotionStatus` were in the schema and had simply never been written.

---

## 2. P0 item status

The roadmap defined six P0 items. **All six shipped.**

| # | Item | Status | Where |
|---|---|---|---|
| 1 | Explicit target-year selector; **refuse execution when target equals source** | ✅ Done | `promotions/execute/route.ts`, `promotions/calculate/route.ts`, `promotions/calculate/page.tsx` |
| 2 | Write the **target-year** `StudentAcademicSession` — section/group policy, new roll numbers, `promotionStatus: "ENROLLED"` | ✅ Done | `promotions/execute/route.ts` |
| 3 | Implement graduation — `GRADUATED` as a first-class action; write `promotionStatus` **and** `StudentProfile.status`; record an exit date | ✅ Done | `promotion-engine.ts`, `promotions/execute/route.ts` |
| 4 | Exit / transfer workflow — `StudentStatus.TRANSFERRED` driven from the year-end surface | ✅ Done | `promotion-engine.ts`, `promotions/execute/route.ts`, promotions UI |
| 5 | Conditional-promotion handling — include conditional students in the execution set; surface `reExam*` | ✅ Done | `promotion-engine.ts`, UI roster |
| 6 | Demote path — extend the action enum and rule evaluation | ✅ Done | `promotion-engine.ts` (`DEMOTED`, override-only) |

### The one schema change

`StudentProfile.exitDate DateTime?` was added, plus a `[tenantId, exitDate]` index. Both are
additive; the column is nullable and no backfill was required. Applied with
`prisma db push` — the database reported itself in sync with no data-loss warnings.

This was needed because an exit that cannot record *when* it happened is not auditable, and
`updatedAt` is not an exit date. Everything else in P0 shipped without touching the schema.

### Graduation and transfer are deliberately different

Both leave the active roster, but they are not the same event — one owes a transcript, the other a
transfer certificate — so they are modelled as distinct actions rather than one "left" flag:

| | `GRADUATED` | `TRANSFERRED` |
|---|---|---|
| `StudentProfile.status` | `GRADUATED` | `TRANSFERRED` |
| `StudentAcademicSession.promotionStatus` (source year) | `GRADUATED` | `TRANSFERRED` |
| Target-year enrollment | none | none |
| Source marks frozen | yes | yes |
| `exitDate` written | yes | yes |
| Derivable from exam results | yes (terminal class, criteria met) | **no — override only** |

A transfer is an external event (the family is leaving), so no rule may derive one. That invariant
is asserted in `promotion-engine.test.ts`, together with a check that every action in the enum is
reachable either from a rule or from an override — so an action can never exist that no code path
can produce.

---

## 3. The defect that started this (G1)

`POST /api/promotions/execute` previously accepted `toAcademicYearId` and `status` **from the
request body**. The promotions UI sent `toAcademicYearId: selectedYear` — the *source* year. The
result: a student's class advanced while they were never enrolled in the following academic year.
The write path also trusted the client's `status`, so any caller holding the promote permission
could promote an ineligible student.

Both holes are closed:

- `toAcademicYearId` must differ from `fromAcademicYearId` **and** the target year must start
  strictly after the source year. Enforced in the execute route and in the admin repair path.
- The action is recomputed server-side through the shared engine. A client-supplied action is
  honoured **only** as an explicit, audited per-student override.
- `createClassPromotionSchema` — which encoded the unsafe contract — was deleted outright.

---

## 4. Additional defects found and fixed during implementation

These were not in the original audit. All four are consequences of the same underlying confusion
between the year-scoped placement and the "current" pointer.

### B1 — Promoted students appeared twice in the roster *(high)*
`src/app/api/students/route.ts` filtered class+year with `OR`: session match **OR** profile match.
A promoted student has a session row for the new year *and* a still-valid profile pointer to the old
class, so they matched both classes in the same year. The profile fallback is now gated on
`academicSessions: { none: { academicYearId } }` — it applies only to students with no placement row
for the requested year.

### B2 — Searching inside a class silently returned the whole class *(medium)*
The same block **assigned** to `where.OR`, clobbering the single-term search filter built above it.
The placement clause is now appended to `where.AND`, so it composes with search instead of replacing it.

### B3 — A retained student kept the previous year's roll number *(low)*
The profile update was skipped whenever `targetClassId === fromClassId` — which is exactly the
retention case. The profile is now refreshed for every non-graduating student, with section and group
preserved on retention and cleared on advancement.

### B4 — Corrupted records had no supported repair path *(medium)*
Schools that already ran promotions hold `ClassPromotion` rows with `toAcademicYearId ===
fromAcademicYearId`. The only fix was raw SQL. `PATCH /api/admin/historical-data` now accepts
`toAcademicYearId` under the same invariants as the live endpoint, and validates `status` against
`PROMOTION_ACTIONS` rather than accepting any string.

---

## 5. What shipped

### New modules
- **`src/lib/promotion-engine.ts`** — pure, database-free decision engine. The single home for
  promotion semantics. Exports `decidePromotion`, `applyOverride`, `summariseDecisions`,
  `suggestTargetAcademicYear`, `computeAttendanceRate`/`FromCounts`, `locksSourceYearResults`,
  `assignTargetRollNumbers`, `promotionStatusFor`, `studentStatusFor`, `PROMOTION_ACTIONS`.
- **`src/lib/promotion-roster.ts`** — `loadPromotionCohort`, the shared cohort loader. Session rows
  are authoritative; profile-derived placements are included but flagged. One grouped attendance
  query replaces a per-student N+1.

### Rewritten
- **`POST /api/promotions/execute`** — cohort-scoped, server-authoritative, one `prisma.$transaction`
  (120s). Four guards before any write: target ≠ source; both years exist and are open; target starts
  after source; an active rule exists. Writes a source-year snapshot and a target-year enrollment;
  graduates leave the roster; source marks are locked only when `locksSourceYearResults`.
- **`GET /api/promotions/calculate`** — delegates to the same engine and the same loader, so preview
  and write cannot drift. Adds attendance, a `summary`, the resolved target year plus its options,
  structured reasons, and data-quality warnings. A terminal class now reports `GRADUATED` instead of
  the old `RETAINED` with the message "Final class - No promotion needed".
- **`promotions/calculate/page.tsx`** — target-year selector, selectable `ERPDataTable` roster that
  default-selects advancing and exiting students, roll-number policy, six metric cards (including
  transfers), warning banners, a blocking state when no next academic year exists, and a per-row
  action menu for manual overrides. Overriding a student ticks their row, and an override on an
  unticked student blocks the submit rather than being silently dropped.
- **`src/hooks/use-exams.ts`** — `PromotionDecisionView`, `PromotionCalculationResult`,
  `ExecutePromotionsResult`; `useExecutePromotions` now takes `ExecutePromotionsInput`.

### Key semantics now enforced
| Situation | Behaviour |
|---|---|
| Terminal class, criteria met | `GRADUATED`; no target-year enrollment; `StudentProfile.status = GRADUATED`, class cleared, `exitDate` recorded |
| Terminal class, criteria not met | `RETAINED` (repeats the final class) |
| Retained, non-terminal | Class unchanged, **still enrolled in the next year**; section/group preserved |
| Transfer-out (override only) | `TRANSFERRED`; no target-year enrollment; `exitDate` recorded; marks frozen |
| Demotion (override only) | Requires an explicit lower target class; rejected if the target is not lower |
| No exam results at all | `RETAINED`, flagged `insufficientData` — never a silent pass |
| No attendance records | Attendance **not enforced** (institutions not using the module are not blocked) |
| Roll number collides in target year | `PRESERVE` → 400 with the conflicts; `SEQUENTIAL` → deterministic reassignment |
| Client supplies a `status` | Ignored. Server recomputes. |
| Empty `studentProfileIds` array | 400 `EMPTY_SELECTION` — never treated as "the whole class" |
| Manual action on an unselected student | Blocked in the UI before submit; the server rejects it as `NOT_IN_COHORT` |

### i18n
58 new keys per locale: 49 under `promotions.calculator`, plus a new `promotions.reasons` namespace
with 9 entries. Key and interpolation parity verified across `en`, `ur`, `hi`, `bn`. Promotion
reasons are structured codes — the UI translates them; the engine never emits display English.

### Tests added
| File | Tests | Covers |
|---|---|---|
| `promotion-engine.test.ts` | 60 | Every rule branch, overrides, status mapping, roll-number policies, exit semantics, action-set consistency |
| `promotion-execute-api.test.ts` | 22 | The G1 regression guard, server authority, graduation, transfer-out, demotion into a lower class, retention, roll-number conflicts, empty selection, single-transaction write |
| `students-placement-filter.test.ts` | 6 | Roster placement invariants (B1) and search composition (B2) |
| `certificate-numbering.test.ts` | 17 | Sequence parsing by position (B5), the all-digit-suffix trap, prefix scoping, contiguous allocation |
| `certificates-bulk-api.test.ts` | 15 | One transaction per batch, contiguous numbering from one probe, skipping already-issued students, tenant scoping, rejected batches |

---

## 6. Remaining work

### P1 — Safety, validation & governance
- **Pre-flight validation pass** — a hard gate: target equals source, class without a rule, students
  with no source-year session, class with no `nextClassId`, duplicate enrollments, missing demographics.
- **Explicit `isCurrent` flag** on `AcademicYear`, switched transactionally. Today overlapping years
  resolve arbitrarily via `findFirst`.
- **Rollover RBAC** — a dedicated `academic:rollover:execute` capability, re-validated server-side.
- **Audit log on year lifecycle** — create / update / close / rollover.
- **Wire `assertAcademicYearOpen`** into every write path for a year-scoped model — ✅ delivered,
  see §12. **The original wording of this item was wrong.** It asked for the guard to be extended to
  "library, hostel, transport, concessions, wallet", and none of those five models has an
  `academicYearId` at all. The real set is 13 year-scoped models, and the actual gap was six routes
  across three of them.
- **Finalize GPA/percentage** into `StudentAcademicSession` at close — ✅ delivered, see §10.
- **Attendance reconciliation report** before close — ✅ delivered, see §13. The figures the report
  shows were made correct in §11; §13 adds the gate that surfaces deficits *at close time*, so a
  cohort with mass absenteeism no longer closes silently. It is a **warning**, not a blocker — the
  year is over and the register is closed, so a shortfall must never be what strands a year.
- **In-app backup/restore prerequisite** on the rollover surface — not built, deliberately. See §12.8.
- **Transfer-certificate issuance** — ✅ delivered, see §8.
- **Demotion from the UI** — ✅ delivered, see §8.

Already delivered as a by-product of the execute rewrite: transactional bulk execution with
pre-resolved lookups (P1 item 8). Re-runs are *blocked* rather than idempotent — a second attempt for
the same source year returns `409 ALREADY_PROMOTED` listing the affected students, which fails loudly
instead of double-writing.

**Literal idempotency is open but is a convenience, not a correctness gap.** The whole batch runs in
a single `$transaction`, so a failure rolls back whole and a retry is a clean attempt — there is no
such thing as a half-applied promotion to re-run. `ALREADY_PROMOTED` therefore only fires on a
genuine second run against a year that was already promoted, which is exactly the case that *should*
be refused. Making it re-runnable would remove a working safety check to save an operator one
confirmation, so it sits below the correctness items.

### P2 — The rollover wizard
Source → target selection, selective copy toggles, upsert match keys, `clonedFrom` provenance,
"set as current" transactional switch, copied config arriving inactive, dry-run, working-day
generation, fee-balance carry-forward policy.

**Hard ordering constraint from the roadmap still holds: P0 before P2.** A wizard that copies
configuration into a year students never enter is worse than no wizard — it looks finished.

---

## 7. One deliberate design decision worth flagging

`StudentProfile.classId` is a **single** "where they are now" pointer, while
`StudentAcademicSession` is the authoritative per-year record. Promotion writes both.

This means that immediately after a promotion, `StudentProfile.classId` points at the *upcoming*
class while the current year is still running. That is intentional and safe, because every
year-scoped read is now resolved through the session first (B1). The alternative — leaving the
profile stale — is what caused the double-listing in the first place.

If you later want the profile to reflect only the *active* year, the clean way is to derive it from
the active year's session rather than to stop writing it at promotion time.

---

## 8. P0 leftovers — delivered

The two items P0 left open were the two ends of the same story: a student could leave the roster by
demotion or by exit, and neither end produced a complete outcome.

### 8.1 Demotion with a target class

`DEMOTED` was fully implemented in the engine and the API but had no UI path, because it is
incomplete without a lower target class and the roster menu offered only one-click actions.

- The roster's override state changed from `Record<string, PromotionAction>` to
  `Record<string, { action, toClassId? }>`.
- Choosing "Demote to a lower class" opens a picker listing only classes whose `classNumber` is below
  the source class, highest first. The server re-validates (`INVALID_DEMOTION_TARGET`); the filter
  exists so the operator cannot pick a value guaranteed to be rejected.
- `resolvedStudents` now derives a demotion's target from the override rather than from the rule's
  next class, which was the bug the old code would have shipped: a demotion rendered as "no move".
- Where a demotion's target class cannot be resolved, the roster and the Excel export show a generic
  lower-class label. They must **never** fall back to the source class — that reads as "no move" for a
  student who is moving down.

Coverage: two new route tests (a successful demotion enrolling the student in the lower class for the
target year; a demotion pointing at a *higher* class being refused).

### 8.2 Issuing the documents the exits owe

The exit workflow recorded who left and when but issued nothing. Graduates and transfers need
different documents — a transfer certificate records a departure to another school, a character
certificate records the conduct of a student who completed here — so both are offered.

- **`POST /api/certificates/bulk`** issues one certificate per student in one transaction. Issuing a
  class-sized batch through the single-issue route meant N round-trips that each re-read the same
  "latest certificate number" row and allocated the same sequence.
- **Numbers are allocated once per batch**, server-side, producing a contiguous run. The client never
  composes a certificate number.
- **A student who already holds an active certificate of a single-active type is skipped and
  reported**, not duplicated and not failing the batch. A school issuing 60 transfer certificates
  should not lose 59 of them because one student was already processed. Only `TRANSFER` is
  single-active: bonafide, character, study and marksheet certificates are purpose-bound and
  legitimately repeat.
- **The panel lives on the result of the run, not on the roster.** The roster is refetched afterwards
  and exited students are no longer enrolled in the source class, so they disappear from it — exactly
  the students who need a certificate are the ones the list no longer shows.
- **Gated on `certificates:write`.** The promote permission and the certificate permission are
  different grants; an operator may hold one and not the other. Without it the panel explains the
  situation instead of offering a button that would 403.
- **Printing is shared.** The ~70-line print routine moved out of the certificates page into
  `useCertificatePrinter`, so a template change cannot land in one surface and miss the other.

### 8.3 Two defects found while building this

**B5 — certificate numbering was not sequential.** `nextCertificateSequence` read the sequence as the
*last* segment of the number. Since numbers carry a random capability suffix, that segment is hex and
is not numeric — so `parseInt` returned `NaN` and the sequence reset to `1` on every issue. Every
certificate minted since the suffix was introduced carries sequence `00001`; the random suffix kept
them unique, so nothing errored and nothing was noticed. The sequence is now read by **position**
(the first segment after `CERT-<TYPE>-<YEAR>-`), which also fixes a second-order trap: an all-digit
hex suffix (~2% of suffixes) would otherwise have been read as a sequence of tens of millions.

**B6 — a parent or student session could not issue certificates, and now provably cannot.** Worth
recording as a *non*-defect: `POST /api/certificates` declares no permission, which looks like an open
door. It is not — `requireApiAccess` derives the module from the API path (`certificates`) and the
action from the method (`POST` → `write`), and `PARENT`/`STUDENT` hold only `read`. Verified rather
than assumed; no change needed.


---

## 9. The rollover pre-flight gate (Wave P1)

### 9.1 Why it exists

Every guard added in Wave P0 is a guard on a *specific* mistake: the target year must differ from the
source year, the class must have a rule, a demotion must name a lower class. None of them catch the
failures that look perfectly valid at every individual checkpoint and are only wrong in aggregate.
The two that mattered most:

- **A rule with a null `nextClassId` is how the engine spells "final class."** So a school that leaves
  the next class blank on Class 5 while Class 6 exists does not get an error — it gets every student in
  Class 5 marked `GRADUATED` and removed from the roster. The rule is internally consistent; it is only
  wrong when compared against the class ladder. This is the single most destructive silent failure in
  the module, and it was reachable before this work.
- **A student already placed in the target year.** The execute path `upsert`s the target-year
  enrollment, so a placement made by somebody else would be silently overwritten rather than reported.

### 9.2 One implementation, two callers

`src/lib/rollover-preflight.ts` is pure and database-free, like `promotion-engine.ts` and for the same
reason: the checks that gate a rollover must be the *same* checks whether they run to warn an operator
or to refuse a write. **A gate that exists only in the UI is a suggestion.**

- `runPromotionPreflight` — is this cohort ready to cross a year boundary?
- `runYearClosePreflight` — is this year ready to be frozen?

`src/lib/rollover-preflight-roster.ts` assembles the input. The promotion scope reuses
`loadPromotionCohort`, the same loader the preview and the execute route use, so the gate sees exactly
the students the promotion would move. The year-close scope loads the whole year, because that is what
closing a year means.

### 9.3 Severity is declared once

`PREFLIGHT_SEVERITY` maps every code to `blocker` or `warning` in one table, and it is typed as
`Record<PreflightCode, PreflightSeverity>` — so adding a code without deciding its severity does not
compile. A blocker refuses the write; a warning is surfaced and the write proceeds. Flattening the two
either trains operators to ignore the list or blocks legitimate work.

| Blocker | Warning |
|---|---|
| `SAME_ACADEMIC_YEAR`, `TARGET_YEAR_NOT_AFTER_SOURCE`, `YEAR_ALREADY_CLOSED` | `STUDENT_WITHOUT_SESSION`, `STUDENT_WITHOUT_RESULTS` |
| `NO_PROMOTION_RULE`, `CLASS_WITHOUT_NEXT_CLASS`, `NEXT_CLASS_NOT_FOUND` | `MISSING_DEMOGRAPHICS` |
| `EMPTY_COHORT`, `DUPLICATE_ENROLLMENT`, `DUPLICATE_ROLL_NUMBER`, `MISSING_ROLL_NUMBER` | `UNISSUED_EXIT_DOCUMENT` |
| `UNPROMOTED_STUDENT` | |

`UNISSUED_EXIT_DOCUMENT` is deliberately a warning: documents are routinely printed after the year is
frozen, and a year-end close must not be held hostage to the print queue.

### 9.4 What it can prove, and what it can only report

Two checks are honest about the limits of the data rather than pretending to certainty:

- **A student with no enrollment row for the year** cannot be *proven* to belong to it. They may be a
  legacy record, or a new admission straight into the following year. Blocking on that would make the
  close unfinishable, so it is a warning. The loader also excludes students who hold an enrollment in a
  *later* year, so the common false positive never appears.
- **An unpromoted student who has already left the roster** by an administrative route is not stranded
  in the year. Only an *active* student with no promotion record blocks the close.

### 9.5 Enforcement points

| Surface | Behaviour |
|---|---|
| `POST /api/promotions/execute` | `409 PREFLIGHT_FAILED` with the blocker findings as `details`; non-blocking findings are returned in `warnings.preflight` on success |
| `PUT /api/academic-years/[id]` (closing) | `409` with the blocker findings; not run for ordinary edits or for a year that is already closed |
| `GET /api/promotions/preflight` | `200` with `canProceed: false` — a blocked readiness report is a *successful read*, so the UI renders findings instead of an error |
| `GET /api/academic-years/[id]/preflight` | same, plus `scan: { students, truncated }` |

The read routes return `200` even when blocked, on purpose. Returning `409` would make the UI treat a
readiness check as a failure and hide the very findings it exists to show.

### 9.6 Bounded payloads

Findings are capped at 50 per code. `counts` is computed over the full list and `countsByCode` carries
the true per-code totals, so truncation never hides how many problems exist — only how many are
shipped in one response. The year-close scan is capped at 5,000 students and reports
`scan.truncated` when the cap is reached, so a partial report is never mistaken for a clean one.

### 9.7 Loaders throw instead of returning a result union

The loaders throw `ApiError` on a missing year or class, matching `assertAcademicYearOpen`. This is not
only a style choice: an earlier draft returned `{ ok, reason }`, and the close route's
`if (preflightLoad.ok)` guard meant that a loader which could not find the year **silently skipped the
gate entirely**. The route now hands over the year it has already read, so that state cannot arise, and
the loader cannot quietly decline to run.

### 9.8 UI surface

- `RolloverPreflightPanel` (`src/components/shared/rollover-preflight-panel.tsx`) renders the report on
  both rollover surfaces. Findings are translated from `code` + `params`, with the server's English
  `message` as a fallback — a gate must never blank out the page it is guarding.
- The promotion roster shows the report above the roster table, scoped to the current selection, and
  the Execute action is disabled while a blocker stands. The server enforces the same gate regardless;
  the UI exists so the operator is not surprised.
- The academic year edit sheet fetches readiness only once the operator ticks "closed" — the report is
  a whole-year scan, and running it on every visit to the sheet would be a lot of work for a question
  nobody asked.
- 42 i18n keys per locale (`promotions.preflight.*`) across `en`, `ur`, `hi`, `bn`. Verified: 0 keys
  removed, 0 keys changed, full parity across the four files.

### 9.9 Coverage

| Suite | Tests |
|---|---|
| `rollover-preflight.test.ts` | 45 — every code, both scopes, severity table, truncation |
| `rollover-preflight-api.test.ts` | 11 — both read routes, including "blocked is still 200" |
| `academic-years-api.test.ts` | 24 (was 19) — 5 new: unpromoted student, unconfigured class, warning-only close, duplicate roll, and that an ordinary edit does not run the gate |
| `promotion-execute-api.test.ts` | 26 (was 23) — 3 new: mid-ladder class with no next class, already-enrolled student, warnings returned with the result |

**One existing fixture was wrong and had to change.** Three tests exercised "graduates a terminal
class" by giving Class 5 a null `nextClassId` while Class 6 existed — which is now precisely the
blocker. They were rewritten to use a genuine final class (Class 10, nothing above it), and the
mid-ladder case is asserted as a blocker instead. The old fixture was encoding the dangerous
assumption this gate exists to remove.

---

## 10. Year-close finalisation and the closed-year write boundary (Wave P1, continued)

### 10.1 The columns nobody wrote

`StudentAcademicSession` has carried `finalGpa`, `finalPercentage`, `totalMarks`, `obtainedMarks` and
`snapshot` since the schema was written. Before this change **no code path wrote any of them** — the
only occurrence anywhere in `src/` was a read in `GET /api/students/[id]`. Every session row carried
`finalGpa: null` and `finalPercentage: null` for the rest of time, and `totalMarks`/`obtainedMarks`
stayed at the `0` that `ensureStudentAcademicSession` writes at creation.

That is a quiet problem rather than a loud one, and it became urgent the moment the pre-flight gate
shipped: closing a year is a one-way door with no reopen path, so anything not frozen at close can
never be frozen at all.

### 10.2 One arithmetic, shared with the decision

`src/lib/academic-year-finalisation.ts` is pure and database-free, like `promotion-engine.ts` and
`rollover-preflight.ts`. Its central invariant:

> `finalPercentage` is computed by the same code path that decided the promotion.

`decidePromotion` averages the latest result per subject through `latestResultPerSubject` +
`averagePercentage`. Those two functions were **extracted out of the engine and exported** so that
finalisation calls them over the same rows. A snapshot that disagreed with the promotion it was based
on would be worse than no snapshot at all, because it would be trusted.

| Figure | Definition | Why |
|---|---|---|
| `finalPercentage` | mean of the latest result per subject | the number the promotion decision used |
| `finalGpa` | mean of the per-subject `gradePoint` | a board GPA is the average of subject grade points, not the grade of the average |
| `totalMarks` / `obtainedMarks` | sums over the same latest-per-subject winners | the marks the student actually finished on |
| `snapshot` | `{ academicYearId, finalisedAt, finalPercentage, finalGpa, totalMarks, obtainedMarks, subjects[] }` | lets a transcript be reconstructed from the session row alone |

`finalGpa` is deliberately **not** `toGrade(finalPercentage).point`. Grade points 4.0 and 5.0 average
to 4.5, which no band maps to an 80% average — and that is correct, not a bug. Storing the band-derived
figure instead would produce a GPA no registrar would recognise. It is also exactly what
`domain-math.computeWeightedGpa` degenerates to, since no credit hours are configured anywhere in the
schema.

Each frozen subject also records the `examId` it came from, which answers the most-asked question about
a frozen mark: which sitting produced it.

### 10.3 Null is not zero

A student with no results for the year gets `finalPercentage: null`, not `0`. Zero is a real mark;
"never examined" is not the same thing, and writing `0` would invent a failing grade on a row that can
never be corrected. `counts.withoutResults` reports them, and the close response names the number so
the office gets one last chance to notice before the year is out of reach.

### 10.4 No cap, because a cap here is permanent

The pre-flight scan caps at 5,000 students and reports `truncated`, which is right for a read-only
diagnostic: truncation costs a finding. The same cap on finalisation would cost a transcript, with no
reopen path to repair it. So finalisation **pages** — 500 sessions per page, cursor on `id` — rather
than capping. Only the *report* of who had no results is bounded, at 50 entries, with the true count
always reported alongside.

Writes are batched 25 at a time inside the close transaction, and the transaction budget was raised
from the 5-second default to 120 seconds. A close is now thousands of writes, and the largest schools
are exactly where a default timeout would fail.

### 10.5 Where it runs, and why there

Inside the close transaction in `PUT /api/academic-years/[id]`, after the flags are settled and before
the audit entry — so the entry can record what was frozen. Not before the transaction: that would open
a window where a year is still open but already carries finals computed from results that are still
editable. Not after: a failure there would leave the year closed with no snapshot and no way back.

The summary is returned on the close response and written into the `CLOSE` audit entry.

### 10.6 The closed-year write boundary

Four write paths were reaching past the read-only boundary of a closed year and creating or moving
year-scoped records inside a frozen year.

| Surface | Guard |
|---|---|
| `POST /api/students` | refuses to place a new student into a closed year, before the transaction opens |
| `PUT /api/students/[id]` | refuses the **placement** write; a profile-only edit still succeeds |
| `POST /api/timetables` | single and bulk; a batch touching any closed year is refused whole |
| `PUT`, `DELETE /api/timetables/[id]` | the entry's year governs, whether or not the request changes it |

The subtle part is what is **not** blocked. A `StudentProfile` is "where this student is now" and
belongs to no single year, so correcting a guardian's phone number must keep working while a closed
year is selected in the year switcher. A guard that refused the whole request would make every student
in the school uneditable for as long as history is open. Only the year-scoped `StudentAcademicSession`
row is protected.

### 10.7 UI

The close toast was generic ("Academic year updated successfully") and would have swallowed the
finalisation counts, making the honest reporting decorative. It now reads the structured payload and
reports how many transcripts were finalised and how many students had no results. Two new i18n keys
per locale across `en`, `ur`, `hi`, `bn`; verified 0 keys removed, 0 keys changed, full parity.

### 10.8 Coverage

| Suite | Tests |
|---|---|
| `academic-year-finalisation.test.ts` | 17 — including a cross-check that the snapshot's `finalPercentage` equals `decidePromotion`'s `metrics.overallPercentage` for the same rows |
| `academic-year-write-guards.test.ts` | 10 — all five write sites, plus the two "must not over-block" cases |
| `academic-years-api.test.ts` | 30 (was 24) — 6 new: the figures written, the summary returned, null-not-zero, the audit entry, no finalisation on a non-close, and paging past one page |
| `promotion-engine.test.ts` | 60 — unchanged, which is the evidence that the extraction did not alter a single decision |

The guard tests assert the *reason*, not just the status: they require the response body to carry
`ACADEMIC_YEAR_CLOSED` and the "closed and read-only" message. A test that only checked for `409`
would still pass if the guard were deleted and some unrelated conflict happened to fire.

### 10.9 Verified while building this (found, not fixed — out of scope)

- **`Tenant.gpaScale` is write-only.** The system-admin settings screen saves it; no calculation reads
  it. It was the intended override for `board-engines/grading.ts`, whose band table is likewise
  unreachable — `getBoardEngine` and the three board calculators have no caller outside their own
  directory. There are consequently **two different grade tables** in the codebase
  (`exam-grading.GRADING_SCALE`, the live one, and `board-engines.grading.DEFAULT_GPA_BANDS`, dead), and
  they disagree: 70% is 4.5 points under one and 4.0 under the other. Finalisation uses the
  `gradePoint` already persisted on each result, so it follows the live table. Wiring `gpaScale` up, or
  deleting the dead path, is a separate decision.
- **`domain-math.computeAggregatePercentage` disagrees with the promotion engine on purpose.** It uses
  the ratio of sums and documents why the mean of percentages is wrong — a 10-mark quiz weighted
  equally with a 100-mark final. It has no production caller. Finalisation follows the live engine
  rather than the dead helper: changing the aggregate changes promotion outcomes, so it belongs in
  `promotion-engine.ts`, once, for both.
- **`POST /api/academic-years` accepts `isClosed` in its schema and drops it.** A year cannot be
  created closed, which is why the close has exactly one home. Harmless, but the schema field is
  misleading to read.

## 11. One attendance rate, seven surfaces (Wave P1, continued)

### 11.1 The defect

`POST /api/attendance` rewrites every student's status to `HOLIDAY` when an academic holiday covers
the date. So a school with a long break accumulates holiday rows for the *whole* school — and only
the promotion engine dropped them from the denominator. Every other surface counted them as days
absent.

Seven surfaces computed a student attendance rate, and no two agreed:

| Surface | LATE | HALF_DAY | EXCUSED | HOLIDAY |
|---|---|---|---|---|
| `promotion-engine.ts` (now `attendance-rate.ts`) | attended | not attended | not attended | excluded |
| `reports/attendance` | not attended | not attended | not attended | **counted as absent** |
| `student-performance` | half a day | ignored | attended | counted as absent |
| `portal/me` | attended | attended | not attended | counted as absent |
| `batch-report-cards` | attended | half a day | not attended | **counted as absent** |
| `dashboard/summary` | not attended | not attended | not attended | **counted as absent** |
| `attendance` page (today) | not attended | not attended | not attended | **counted as absent** |

The arithmetic that makes it a real defect: a student attends 80 of 100 teaching days, and the year
also holds 20 holiday rows. The register says 80%. The report says 80/120 = 67% — under the report's
own 75% deficit threshold, so the child is listed as a defaulter. A school with 15% holidays sees a
defaulter list that is mostly an artefact.

`batch-report-cards` is the worst of the seven, because its figure is **printed**. A parent held a
report card showing 67% while the promotion sheet said 80%, and the report card was the one that was
wrong.

### 11.2 The convention, and the two judgement calls it contains

`src/lib/attendance-rate.ts` — pure and DB-free, like `promotion-engine.ts`, `rollover-preflight.ts`
and `academic-year-finalisation.ts`. The whole policy is two constants:

```ts
export const ATTENDED_STATUSES: readonly string[] = ["PRESENT", "LATE"];
export const NON_TEACHING_STATUSES: readonly string[] = ["HOLIDAY"];
```

Two of those entries are judgement calls rather than facts, and both are preserved from the
promotion engine **exactly**, because changing either changes *who gets promoted*:

- **`HALF_DAY` does not count as attended.** A half day is not a full day. Three of the seven
  surfaces scored it as 0.5.
- **`EXCUSED` does not count as attended.** An excused absence is still an absence from the register,
  though many schools would rather it not count against the student. `student-performance` and
  `portal/me` both counted it as attended.

Adding `"EXCUSED"` to `ATTENDED_STATUSES` is a one-line change that will move real students across
the promotion line. It belongs in a deliberate release, not a refactor, and the module says so.

### 11.3 Null is not zero, and the comparison that makes it matter

`AttendanceRate.rate` is `number | null`, with a `tracked` flag beside it. A student with no
attendance rows on file reports `null`, never `0`: 0% is a real and very different verdict, and
rendering it turns "nobody has marked this class yet" into "this child has never attended".

This is not cosmetic, because of one JavaScript fact: **`null < 75` is `true`**. `student-performance`
gates both its counselling recommendation and its risk level on threshold comparisons, so an
untracked student was being raised to `HIGH` risk and recommended for parental counselling on the
strength of no data at all. Both comparisons are now guarded on `!== null` first.

### 11.4 `absentDays` is derived, not counted

`student-performance` used to report `absentDays` as the raw count of `ABSENT` rows, while
`totalDays` counted every row including holidays and `presentDays` counted only `PRESENT`. The three
did not reconcile — they did not even add up. `absentDays` is now `totalDays - presentDays`, which
is the one definition that makes `presentDays / totalDays` equal `attendanceRate` exactly.

`punctualityRate` also needed care: it asks a different question — of the days the child turned up,
how many were on time? — so its denominator is `PRESENT + LATE`, not `totalDays`. It returns `null`
rather than 0 when the student was never present.

### 11.5 The daily surfaces

`dayAttendanceRate` and `dayAttendanceRateFromCounts` share one `withHolidayFlag` implementation, so
a `groupBy` on the dashboard needs no second query. A register where every row is a non-teaching
status returns `tracked: false` and `isHoliday: true` — the school was closed, so there is no rate to
report. `/api/dashboard/summary` now returns `isHoliday` alongside the rate, and the dashboard and
attendance-page cards render `—` instead of `0.0%`, which previously read as a school-wide walkout on
every holiday.

### 11.6 What is deliberately *not* converged

- **`attendance-service.ts` / `computeMonthlyAttendance`.** It computes `lopDays` and `payableDays`
  for **staff payroll**. It answers "how much is this employee paid", not "did this student attend",
  and its half-day and late-penalty rules are a payroll policy rather than a promotion one.
  Converging it would be wrong, not tidy.
- **`math-utils.calculateAttendancePercentage` and `domain-math.computeAttendancePercentage`** now
  have no production caller between them. `calculateAttendancePercentage` was called only by
  `batch-report-cards`, which now uses the shared module; `domain-math`'s version already had none.
  Both remain, tested, as dead code — flagged here rather than deleted, since removal is a separate
  decision.

### 11.7 Coverage

| Suite | Tests |
|---|---|
| `attendance-rate.test.ts` | 20 — the migrated promotion-engine tests plus a block asserting the exact regression (`legacy === 67`, `newRate === 80`, and that 80 clears the 75% threshold while 67 does not) |
| `student-performance.test.ts` | 6 (was 4) — the new arithmetic, a holiday regression at 80/100 + 25 holidays, and the untracked case |
| `promotion-engine.test.ts` | 54 (was 60) — the 6 attendance tests moved to the shared module's suite rather than being deleted |

Full suite after this increment: **97 files / 955 tests, 0 failures**; `tsc` clean; eslint 0 errors
(65 pre-existing `no-explicit-any` warnings, none introduced here).

### 11.8 Verified while building this (found, not fixed — out of scope)

- **`Attendance` has no unique constraint on `(tenantId, studentProfileId, date)`.** Per-day duplicate
  rows are therefore representable, and a student marked twice on one day would count twice in every
  denominator above. Nothing writes duplicates today, but nothing prevents it either.
- **`submitBulkStudentAttendance` in `attendance-service.ts` has no production caller.** The bulk
  attendance route inlines its own loop instead, so the two can drift — and the service's version is
  the one with the tests.
- **The `student-performance` page renders the raw `status` enum** (`EXCELLENT`, `GOOD`, …) as a card
  title rather than a translated label. Pre-existing, and now at least never shown for an untracked
  student.

## 12. The closed-year write boundary, completed (Wave P1, continued)

### 12.1 The plan asked for the wrong thing

§6 asked for the guard to be "extended to library, hostel, transport, concessions, wallet". **None of
those five models has an `academicYearId` field.** There is nothing there to guard, and a guard for a
year a model does not have would be pure ceremony.

The real set is **13** year-scoped models: `FeeVoucher`, `ClassFeeStructure`, `SalaryLedger`,
`Attendance`, `Exam`, `ExamResult`, `QuestionPaper`, `PromotionRule`, `Timetable`,
`StudentAcademicSession`, `TeacherSubstitution`, `AcademicHoliday`, `AdmissionApplication`.

Auditing every write route against that list found **six unguarded routes across three models** — so a
closed year was not, in fact, read-only.

| Model | Unguarded write routes |
|---|---|
| `AcademicHoliday` | `POST /api/holidays`, `PUT` / `DELETE /api/holidays/[id]` |
| `ClassFeeStructure` | `POST /api/fees/structures`, `PUT` / `DELETE /api/fees/structures/[id]` |
| `PromotionRule` | `POST /api/promotion-rules`, `PUT` / `DELETE /api/promotion-rules/[id]` |

`PromotionRule` is the most consequential of the three: a closed year's rules are the recorded basis
on which students were retained or advanced. Editing them afterwards changes the *reason* without
changing the *outcome* — the same class of retro-edit a frozen year exists to prevent.

`QuestionPaper`, `TeacherSubstitution` and `AdmissionApplication` are year-scoped but have **no write
route** anywhere in `src/app/api`, so there is nothing to guard. They are recorded here so the next
person does not re-discover them as a gap.

### 12.2 A record can be *moved* into a frozen year

This is the subtler half of the work, and the reason the first six edits were not sufficient.

`updatePromotionRuleSchema` and `updateClassFeeStructureSchema` are both
`create…Schema.partial()`, and both PUT handlers spread the parsed body into the update. So
`academicYearId` is **writable**, and a record can be relocated into a closed year.

Guarding only the record's *current* year would have left that door open: the source year is open, the
destination is not, and the write lands in the frozen year. Both PUTs therefore check the destination
too:

```ts
if (data.academicYearId && data.academicYearId !== existingRule.academicYearId) {
  await assertAcademicYearOpen(tenantId, data.academicYearId);
}
```

### 12.3 The fee-structure year is an id *or* a code

`POST /api/fees/structures` resolves its year with `OR: [{ id }, { yearId }]` — it accepts either the
internal id or the human `yearId` code. `assertAcademicYearOpen` resolves by internal id only, so the
PUT resolves the destination the same way the create path does, guards the resolved id, and then
**writes the resolved id rather than the raw value**. Without that last step a `yearId` code sent as
`academicYearId` would land in the id column and corrupt the row's year reference — a latent defect
that predates this guard and that the guard's own resolution now makes visible.

### 12.4 Refusal order

Where a route already refused for another reason, the closed-year check runs **first**:

- **`promotion-rules/[id]`** — before the historical-promotion lock. That lock only fires when
  promotion records exist; the year being frozen holds regardless, so a rule in a closed year with no
  promotions recorded yet is still uneditable. There is a test for exactly that case.
- **`fees/structures/[id]`** — before the issued-voucher lock, for the same reason.
- **`promotion-rules` POST** — replaced the route's own `prisma.academicYear.findUnique` check, which
  verified existence but never `isClosed`. A missing year now answers **404** rather than 400; that is
  the guard's contract and is more accurate than the 400 it replaced.

### 12.5 A tenancy hole closed on the way

`POST /api/holidays` wrote `data.academicYearId` straight through with no existence or ownership
check at all. The guard resolves the year under the caller's `tenantId`, so a holiday can no longer be
attached to another tenant's year. That was a tenancy gap, not only a closed-year one.

### 12.6 Coverage

| Suite | Tests |
|---|---|
| `academic-year-write-guards.test.ts` | 26 (was 10) — the three new families, each with a refuse-on-closed case and an allow-on-open case, plus a relocate-into-a-closed-year case for both PUTs |

Full suite: **97 files / 974 tests, 0 failures**; `tsc` clean; eslint 0 errors (12 warnings, all
pre-existing `no-explicit-any` and unused-import).

The "allows" cases are deliberate. A suite that only proves refusal cannot tell a working guard from
one that refuses everything, and this guard sits on the edit path of every fee structure and promotion
rule in the product.

### 12.7 One observation, not fixed

`POST /api/fees/structures` routes a handled `ApiError` through `console.error` with a full stack
trace. A closed-year refusal is an expected outcome, not an incident, so the route logs louder than
the event. Every other route handles this through `handleApiError`, which does not. Harmless, but it
will make a legitimate 409 look like a crash in the logs.

### 12.8 The backup/restore prerequisite — a recommendation against

§6 lists an in-app backup/restore as a P1 prerequisite for rollover. **I recommend against building
it.** The database is Postgres on Neon, which already provides point-in-time restore. An in-app
restore would be a second, weaker implementation of a guarantee the platform already gives, and the
only capability it would genuinely add is the ability to destroy a year from inside the product.

The rollover surface should instead carry a documented pre-flight checklist: confirm PITR retention,
take a named snapshot before the first real rollover, and record that timestamp in the year's audit
trail. That is your call, so it is left open rather than implemented.

## 13. The attendance gate at close (Wave P1, continued)

### 13.1 What was missing

§6 recorded this as "half delivered". The figures the attendance report shows were made correct in
§11, but nothing surfaced a deficit *at close time*: `PreflightCode` had no attendance member at all,
so a year whose cohort was largely absent from the register could be frozen with nothing said about
it. The promotion engine's `minimumAttendance` rule was the only place attendance was enforced — and
only for the students actually being promoted.

### 13.2 Why a warning, and not a blocker

Every other check in `runYearClosePreflight` that describes a *silently mis-placed* student blocks.
Attendance does not: the year is over, the register is closed, and the shortfall is a fact. Refusing
the close would trap the whole year over a figure nobody can now change. So
`ATTENDANCE_BELOW_REQUIREMENT` is a **warning** — the second in the gate, alongside
`UNISSUED_EXIT_DOCUMENT`.

What it buys is the operator's last cheap look. After the close the year is read-only and a student's
outcome can only be changed through the admin repair path, so this is the final moment at which
"promote with an override" and "retain" are still ordinary actions.

### 13.3 It is not a duplicate of the promotion engine's check

`decidePromotion` already emits `LOW_ATTENDANCE`, so it is fair to ask what a second check adds. It
adds the whole year. The engine judges with whatever was on file **the moment it ran**, and registers
keep being marked for the rest of the year — so a student promoted in November on 78% can finish at
68% with a promotion record that says they crossed. Only the close sees the full year, and only the
close can still do something about it. The check therefore covers promoted students too, not just
unpromoted ones.

### 13.4 The bar comes from the class rule, and the field is required

`PreflightRule` gained `minimumAttendance: number` — **required, not optional**. A rule that arrived
without it would compare the rate against `undefined`, which is `false` for every comparison, and the
check would quietly never fire. That is the same silent-skip failure the module already guards against
for severity, so it gets the same treatment: the compiler will not let a construction site omit it,
and both roster selects now name it.

A student whose class has no active rule is skipped rather than judged against an invented default,
and a student with no class at all is skipped for the same reason.

### 13.5 The `null` guard is the load-bearing part

`null` means the school records no attendance, and **`null < 75` is `true` in JavaScript**. Without
the guard, every student in an attendance-less school would be reported as a defaulter — the same
coercion that made the seven surfaces in §11 disagree. `loadYearClosePreflight` feeds
`attendanceRateFromCounts(...).rate` straight through, and the engine tests the `!== null` case
explicitly.

Attendance is scoped by `academicYearId`, exactly as `promotion-roster.ts` scopes it for the engine,
so the close-time figure is the same one the decision was made with. `HOLIDAY` rows leave the
denominator, which is the §11 convention arriving here for free: a student attending 80 of 80
teaching days in a year with 20 holiday rows reads 100%, not 80%.

### 13.6 A bounded report that rendered as a complete one

`loadYearClosePreflight` bounds the student set at 5,000 and returns `scan.truncated` to say so. The
route returned it; `RolloverPreflightPanel` never rendered it, and the call site passed only
`scan.students`. A school over the bound therefore read "5,000 student(s) scanned" with no sign that
the findings were partial — and the panel's "All pre-flight checks passed" would render on a report
that had not looked at everybody.

The panel now takes `scanTruncated`, shows an amber notice **above** the verdict, and suppresses the
"passed" line when it is set. A partial report that renders as a clean one is worse than no report,
because the operator closes the year on it.

### 13.7 Coverage

| Suite | Tests |
|---|---|
| `rollover-preflight.test.ts` | 52 (was 45) — seven new: below-bar warns without blocking, exactly-at-the-bar does not, **untracked is never enforced**, no rule means no bar, no class means no bar, an already-promoted student is still covered, and a non-default `minimumAttendance` is honoured |
| `rollover-preflight-api.test.ts` | 14 (was 11) — three new through the loader: counts become the rate and the bar comes from the rule, `HOLIDAY` rows leave the denominator (80 of 80, not 80 of 100), and a 90% rule flags an 82% student |
| `academic-years-api.test.ts` | 30 — unchanged; the close path was already exercised, and the new probe is primed empty so an untracked school stays silent |

Full suite after this increment: **97 files / 984 tests, 0 failures**; `tsc` clean; eslint 0 errors
(29 warnings across the touched files, all pre-existing `no-explicit-any` in test fixtures and
`academic-year/page.tsx`; the two library modules and the panel are clean).

The delta reconciles exactly: 974 + 7 + 3 = 984.

### 13.8 Checked and *not* changed

`enrollmentCountByStudent` in `loadYearClosePreflight` counts only the year's session rows, which
looks like an under-count for a legacy profile. It is not. `legacyRows` are by construction students
holding no session row for this year, so their count is genuinely 0, and borrowing a count from
anywhere else would fabricate a `DUPLICATE_ENROLLMENT` blocker. The loader comment now says so,
because the next reader will have the same suspicion.

`StudentAcademicSession` carries no unique index on `(tenantId, academicYearId, studentProfileId)`,
which is what makes the close path's `DUPLICATE_ENROLLMENT` check a real check rather than
belt-and-braces. Recorded so it is not "fixed" by adding a constraint nobody asked for.

## 14. One attendance vocabulary (Wave P1, continued)

### 14.1 The arithmetic was only half the defect

§11 converged seven surfaces onto one *rate*. The status **names** were disagreeing just as badly,
and for longer — four hand-written lists, none of which imported any other:

| Surface | Statuses it knew |
|---|---|
| `attendance-rate.ts` | PRESENT, ABSENT, LATE, HALF_DAY, EXCUSED, HOLIDAY |
| `attendance-service.ts` | PRESENT, ABSENT, LATE, HALF_DAY, EXCUSED, HOLIDAY |
| `createAttendanceSchema`, `mark-attendance-modal`, `entities.ts` | PRESENT, ABSENT, LATE, **LEAVE** |
| `fast-attendance-grid` | PRESENT, ABSENT, LATE, **EXCUSED** |
| `POST /api/attendance` (fast-grid branch) | **nothing — any string was persisted** |

The last row is the worst of them: the branch read `item.status || "PRESENT"` with no validation at
all, so the client decided what the register said.

### 14.2 `LEAVE` was the damaging one

Exactly as `HOLIDAY` was in §11. Two paths write `LEAVE` — the manual attendance form and leave
approval — and it appeared in **no domain list**, so it was never *handled*. It fell through
`ATTENDED_STATUSES` and `NON_TEACHING_STATUSES` alike and landed in the denominator without landing
in the numerator. An absence the school had **authorised** was counted as an absence, by accident,
because nobody had decided otherwise.

Compounding it, `PUT /api/leaves/[id]` created those rows with **no `academicYearId`**. So an
approved leave was invisible to every year-scoped query — the promotion engine, the §13 close-time
gate, `reports/attendance` — while the identical day entered as `LEAVE` on the manual form carried a
year and counted as an absence. *One question, two answers.*

### 14.3 The vocabulary now lives in one place, and writers validate against it

`ATTENDANCE_STATUSES` in `attendance-rate.ts` is the only list (seven values, `LEAVE` included), and
`AttendanceStatus` is derived from it. `isKnownAttendanceStatus` is the predicate a writer calls;
`unknownAttendanceStatuses` reports the strays in a count map, for a reader that already holds bad
data. `AttendanceStatusType` in `attendance-service.ts` and `createAttendanceSchema.status` are now
both *derived* rather than restated — the second is `z.enum(ATTENDANCE_STATUSES)`, so the manual form
can finally express `HOLIDAY`, `EXCUSED` and `HALF_DAY`, three statuses the rest of the system
understood and that endpoint rejected.

`AUTHORISED_ABSENCE_STATUSES = ["EXCUSED", "LEAVE"]` is declared as a **named group** rather than
merging the two spellings into one value. The two screens grew independently and both spellings are
live in existing history, so a merge would be a data migration across real attendance; as a group
they are already interchangeable under every calculation in the module.

### 14.4 The write boundary refuses, and it refuses whole

`POST /api/attendance`'s fast-grid branch now validates the batch **before** opening the transaction:
a missing `studentProfileId` and an unrecognised `status` each return `400`, naming the offending
record's index and listing the allowed values. It is all-or-nothing — a half-written register is
worse than a refused one, because the operator cannot tell which half landed. Only an *omitted*
status still defaults, and only to `PRESENT`.

### 14.5 Leave approval writes year-scoped rows

`PUT /api/leaves/[id]` resolves the years overlapping the leave, resolves the covering year **per
day** (a leave can straddle a year boundary, and resolving once would put all its days in one year —
the same defect in a smaller form), and orders the lookup `startDate desc` to match
`POST /api/attendance`, so overlapping years resolve identically in both writers. A day no year
covers is skipped rather than written yearless: a null-year row would be visible to date-scoped
queries and invisible to year-scoped ones, which is the inconsistency being removed.

A day in a closed year refuses the whole approval, and the guard runs **before** the transaction —
so a refusal cannot commit an approval with none of its attendance rows. A silently dropped row is
precisely the defect this route was being fixed for.

### 14.6 Deliberate scope boundary: staff payroll is not converged

`attendance-service.ts` computes an attendance figure for staff payroll (`lopDays`, `payableDays`).
It is deliberately **not** converged onto this vocabulary's arithmetic: it answers "how much is this
employee paid", not "did this student attend", and its half-day and late-penalty rules are a payroll
policy rather than a promotion one. Only the *vocabulary* is shared. `Attendance.academicYearId`
stays nullable for the same reason — the model is shared with staff attendance, so making it required
would break staff marking and need a backfill.

### 14.7 Checked and *not* changed

- **No unique index on `(tenantId, studentProfileId, date)`.** Duplicate staff rows on one date are
  legitimate, so the constraint is unsafe on the shared model. The route's own find-then-update is
  what keeps a student's day single-valued.
- **`submitBulkStudentAttendance` left unused.** Its richer behaviour — holiday detection, `LATE`
  counting toward presence — is *not* what the route does, so wiring it in would change report
  arithmetic. It is a different policy, not a better implementation of this one.

### 14.8 Coverage

| Suite | Tests |
|---|---|
| `attendance-rate.test.ts` | 30 (was 20) — ten new: the vocabulary declares seven statuses, accepts all seven, rejects a near miss/wrong case/padded value, rejects non-strings without coercing, lists strays in a count map; and `LEAVE` counts in the denominator but not the numerator, is not a non-teaching status, scores a term on leave as 0% rather than untracked, and is interchangeable with `EXCUSED` |
| `attendance-api.test.ts` | 13 (new) — the fast grid refuses a near-miss status and names the allowed values, refuses before writing anything including the valid records, identifies the offending index, rejects a non-string status and a record with no `studentProfileId`; accepts all seven statuses verbatim, defaults only an omitted one, and keeps the year on the row; the closed-year guard still holds; and the single-record path answers `422` for a bad status while accepting the three the old enum rejected |
| `leaves-api.test.ts` | 10 (new) — the covering year is stamped on every row, a leave across a year boundary is split `[ay-2025, ay-2025, ay-2026, ay-2026]`, the overlap query is `startDate desc`, an uncovered day is skipped, an existing row is not duplicated; a closed year refuses with `409 ACADEMIC_YEAR_CLOSED` and no leave update; and rejection/already-approved/not-found write no attendance |

The tests were **mutation-checked**: suppressing the status validation and dropping the
`academicYearId` from the leave writer each produced failures in exactly the intended tests, and both
files were then restored byte-identically (`git diff --stat` unchanged at 48 and 133 lines).

Full suite after this increment: **99 files / 1017 tests, 1016 passed, 1 failed**; `tsc` clean;
eslint 0 errors. The delta reconciles exactly: 984 + 10 + 13 + 10 = 1017, and 97 + 2 = 99 files.

### 14.9 The one failure is pre-existing, and it is not mine

The failing test is `src/lib/i18n-parity-and-interpolation.test.ts` — its repository-wide key guard,
which asserts that every literal `t("...")` key in `src/` resolves in all four locales. It found
**146 distinct keys, referenced from 148 sites, missing from all four locales including `en`**.

This is not a regression from this increment, and it is not the locale corruption investigated
earlier in this session. Established by measurement:

- `promotions.calculator` holds the **same 56 keys** at `HEAD` and in the working tree, and
  `promotions.reasons` / `promotions.preflight` exist in neither.
- Against `HEAD` the working tree has **lost 0 leaves and gained exactly 3** (the
  `attendance.filters.status.*` keys added by §14.3).

So the guard has been red for longer than this increment, and a red suite was already the expected
state. One claim in `docs/I18N-GAP-REPORT.md` was **corrected** while confirming this: a missing
message does **not** throw. In the installed next-intl 4.8.3 (via `use-intl`) the default `onError`
is `console.error` and the default `getMessageFallback` returns the raw `` `namespace.key` `` — so a
missing message logs and renders the key path into the UI. That is untranslated text the user can
see, not an outage.

Not fixed here on purpose: authoring 146 keys across four locales is a product decision, not a
side effect of an attendance change. See `docs/I18N-GAP-REPORT.md` §4 for the three options.

## 15. The i18n gap, closed (Wave P1, continued)

### 15.1 What was outstanding

§14.9 left the guard test red. Reconnaissance before authoring closed off the recovery option: the
`scripts/merge-*.cjs` files carry `accounting`, `saasAdmin`, `feesExtras`, `attendanceExtras` and
`resultsExtras` blocks, but nothing for `promotions`, `systemAdmin`'s session policy, the idle-session
guard or `accounting.statements` — and no editor history or backup exists. There was nothing to
restore, so the keys had to be written.

### 15.2 What was authored

**148 keys × 4 locales = 592 entries.** The work was additive by construction:

- Each path was confirmed **absent from `en` first**, so no authored text could be replaced by a guess.
- Verified against `HEAD` leaf-by-leaf, per locale: **lost 0, changed 0, gained 151** (the 148 plus
  the three `attendance.filters.status.*` keys from §14.3).
- Locale format preserved — 2-space indent, CRLF, no BOM, no trailing newline — asserted after each
  write and round-tripped through `json.loads`.
- Interpolation variables were **extracted from the call sites**, not guessed, so `en` names exactly
  the variables the call passes; the parity test then confirms ur/hi/bn match `en` per key.

### 15.3 The trap: attribution must follow the translator binding

The first inventory attributed each key to the **shortest** candidate path among the file's declared
namespaces. `promotions/calculate/page.tsx` binds three translators, and `promotions.reasons.<key>`
is shorter than `promotions.calculator.<key>` — so 78 keys were filed under `promotions.reasons`,
which is not where the page reads them.

Worth recording because **the guard test cannot catch this**: `resolves()` accepts a key that
resolves under *any* namespace the file declares. Filing the text under the wrong one satisfies the
test and still renders a raw key path to the user. Attribution has to come from
`const t = useTranslations("...")`, so the inventory resolves the binding that actually makes each
call.

### 15.4 What still remains

**`promotions.reasons` is still empty, and it is the one known instance of this defect class left.**
It is reached only through `tReason(reason.code, reason.params)` at
`src/app/(dashboard)/promotions/calculate/page.tsx:493`, so no scanner over literals can see it —
which is exactly why §2 of the gap report had to call it out separately. Every promotion reason
therefore still renders as a raw key path.

The fix is mechanical but needs a decision: the key list is the reason-code set the engine emits
(`{ code, params, message }` from `promotion-engine.ts`), and the `params` names must match per code.
That is a smaller piece of work than this one and belongs with the promotion engine's vocabulary,
not with a translation pass.

### 15.5 Verification

| Check | Result |
|---|---|
| `i18n-parity-and-interpolation.test.ts` | 12/12 pass (was 11 pass / 1 fail) |
| Repository-wide key guard | 0 problems (was 148 sites / 146 keys) |
| Interpolation-variable parity, ur / hi / bn | pass |
| Leaf diff vs `HEAD`, per locale | lost 0, changed 0, gained 151 |
| Locale leaves | 5047 (`HEAD`) → 5198 |
| Full suite | **99 files / 1017 tests, 0 failures** — green for the first time this wave |
| `tsc --noEmit` | clean |

The suite has no known failures. The only outstanding item in this wave is §15.4.

## 16. `promotions.reasons`, and the vocabulary behind it (Wave P1, continued)

### 16.1 What was outstanding

§15.4 left the last empty namespace. `promotions/calculate/page.tsx` renders every reason through

```ts
function translateReason(reason: PromotionReason): string {
  try {
    return tReason(reason.code, reason.params as Record<string, string | number>);
  } catch {
    return reason.message;
  }
}
```

The key is a **runtime value**, so the repository-wide scanner in
`i18n-parity-and-interpolation.test.ts` is structurally unable to see it — it only walks string
literals. The namespace was absent from all four locales and nothing failed: use-intl does not throw
on a missing message, it logs `MISSING_MESSAGE` and renders the raw key path, so every promotion
reason displayed as the literal text `promotions.reasons.MEETS_CRITERIA`.

The `catch` in the snippet above is **dead code**. It was written believing a missing message throws,
which is the same wrong belief §15.2 corrected. A missing message falls back to the key path, so the
English `message` never reaches the UI through this path. That is the whole reason this had to be
fixed rather than tolerated: the fallback the code appears to have does not exist.

### 16.2 The vocabulary became a runtime list, and the union is derived from it

`promotion-engine.ts` previously declared the codes only as a string-literal union. A guard needs to
enumerate them at runtime, so the direction was inverted — the same shape the file already uses for
`PROMOTION_ACTIONS`:

```ts
export const PROMOTION_REASON_CODES = ["MEETS_CRITERIA", /* ... */ "TRANSFERRED_OUT"] as const;
export type PromotionReasonCode = (typeof PROMOTION_REASON_CODES)[number];
```

The union is derived, not written twice, so the list and the type cannot drift. The consequence is
deliberate: a code pushed at a `reasons.push(...)` site that is **not** in the list does not compile,
and a code that **is** in the list without a `promotions.reasons.<code>` message in all four locales
fails the guard. Adding a reason now requires both halves.

### 16.3 What was authored

**10 codes × 4 locales = 40 entries**, additive by the same construction as §15.2: each path confirmed
absent in `en` first; format preserved (2-space indent, CRLF, no BOM, no trailing newline) with the
untouched file round-tripped byte-for-byte before any write; verified against `HEAD` leaf-by-leaf per
locale — **lost 0, changed 0, gained 161** (151 from §15 plus these 10).

### 16.4 What each key renders — and the params that must not be interpolated

| Code | Rendered (`en`) | Vars used | Params the engine supplies |
|---|---|---|---|
| `MEETS_CRITERIA` | Met all promotion criteria with {overall}%. | `overall` | `overall` |
| `FAILED_SUBJECTS` | Failed {count} subject(s): {subjects}. | `count`, `subjects` | `count`, `allowed`, `subjects` |
| `LOW_OVERALL` | Overall {actual}% is below the required {required}%. | `actual`, `required` | `actual`, `required` |
| `LOW_ATTENDANCE` | Attendance {actual}% is below the required {required}%. | `actual`, `required` | `actual`, `required` |
| `NO_EXAM_RESULTS` | No examination results recorded for this academic year. | — | `academicYear` ⚠ |
| `CONDITIONAL_ELIGIBLE` | Eligible for conditional promotion pending a re-examination. | — | `count`, `overall` |
| `GRADUATED_FINAL_CLASS` | Final class — the student graduates. | — | `className` |
| `RETAINED_FINAL_CLASS` | Final class — criteria not met, the student repeats the year. | — | `className` |
| `MANUAL_OVERRIDE` | Manually overridden by an operator. | — | `action` ⚠ |
| `TRANSFERRED_OUT` | Transferred out of the school. | — | `studentName` |

Two of the supplied params carry a **raw machine value and must never be interpolated**:
`NO_EXAM_RESULTS`'s `academicYear` is `rule.academicYearId` — a cuid, not a label — and
`MANUAL_OVERRIDE`'s `action` is the enum member itself. A translation that used either would print a
database id or an untranslated `DEMOTED` into the UI. The guard cannot catch this, because it only
forbids the opposite error (a variable the engine does not supply); the table is the record.

Several params are deliberately left unused rather than padded into the sentence.
`CONDITIONAL_ELIGIBLE` does not print `count` because the same row already carries `FAILED_SUBJECTS`,
which names the subjects — interpolating the count would print the same number twice.
`GRADUATED_FINAL_CLASS` / `RETAINED_FINAL_CLASS` do not print `className` because the row already
shows the class, and `TRANSFERRED_OUT` does not print `studentName` because the row *is* the student.

### 16.5 The guard

`src/lib/promotion-reason-i18n.test.ts` holds a table of ten scenarios — one per code — built from
the engine's own fixtures. The table is the contract, and it is what makes the namespace
self-maintaining: a code added to the engine with no scenario fails coverage, so the vocabulary and
the translations must be extended together.

| Assertion | Catches |
|---|---|
| The scenarios reach exactly `PROMOTION_REASON_CODES` | a code with no path, or a scenario that stopped emitting one |
| Every code has a non-empty message in all four locales | a missing or blank translation |
| No key in the namespace is outside the code list | a renamed code leaving an orphan behind |
| No message uses a variable the engine never supplies | `{className}` in a message whose code has no `className` |
| Every locale uses the same variables as `en` | a translator dropping or adding a placeholder |

The first assertion is what makes the other four non-vacuous: without it, an empty scenario table
would satisfy every remaining check.

Mutation-tested rather than assumed — five deliberate breakages, each restored byte-identically:

| Mutation | Result |
|---|---|
| `en` loses a reason key | **caught** — 2 tests fail |
| `en` gains an orphan key | **caught** — 1 test fails |
| `en` interpolates an unsupplied variable | **caught** — 2 tests fail |
| `ur` drops an interpolation variable | **caught** — 1 test fails |
| `PROMOTION_REASON_CODES` loses `TRANSFERRED_OUT` | **caught at compile time** — `TS2322` at the `reasons.push` site |

### 16.6 `MANUAL_OVERRIDE` is unreachable from the UI — recorded, not changed

The override dialog collects only `action`, plus `toClassId` for a demotion. The page's own
`PromotionOverride` interface has no `reason` field, and the execute payload builds each override as
`{ studentProfileId, action, toClassId }`. So the UI never supplies a reason, `applyOverride` never
takes the `override.reason` branch from the page, and `MANUAL_OVERRIDE` is emitted only by a direct
API call that sets `overrides[].reason`.

That is why the key is a generic "manually overridden by an operator" rather than printing the
operator's justification: there is no justification to print. It is recorded rather than changed
because collecting one is a product decision, not a defect — but if a reason is ever collected it
must be passed through `params`, not through `message`, which is not a display channel (§16.2).

### 16.7 Verification

| Check | Result |
|---|---|
| `promotion-reason-i18n.test.ts` | 11/11 pass (new) |
| `i18n-parity-and-interpolation.test.ts` | 12/12 pass |
| Interpolation-variable parity, ur / hi / bn | pass |
| Leaf diff vs `HEAD`, per locale | lost 0, changed 0, gained 161 |
| Locale leaves | 5047 (`HEAD`) → 5208 |
| `git diff --numstat`, all four locales | identical — `178 13` |
| Full suite | **100 files / 1028 tests, 0 failures** (was 99 / 1017) |
| `tsc --noEmit` | clean |
| `eslint` on changed files | 0 errors |

### 16.8 One repository-level risk — RESOLVED (see §21)

Every module this wave depends on was **untracked by git**: `promotion-engine.ts`,
`rollover-preflight.ts`, `attendance-rate.ts`, `academic-year-finalisation.ts`,
`certificate-numbering.ts` and all of their test files — 32 untracked entries under `src/`. They existed
only in the working tree, so a `git clean -fd` or a lost checkout would have deleted the promotion
engine and every guard test protecting it. This was the same root cause as §15.2's finding that the 146
i18n keys were never committed: work in this repository was not being committed. It was flagged rather
than fixed silently because a commit is a decision the operator owns.

**Resolved in §21.** The working tree — by then 83 modified, 7 deleted and 59 new paths — was committed
in 21 logically grouped commits, and `.codebuddy/` was added to `.gitignore` so a machine-local
settings file is not swept in.

## 17. Working days are a set, not a subtraction (Wave P2, item 21)

### 17.1 What was outstanding

Roadmap item 21: *working-day generation for the new year's date range, with holidays configured
afterwards.* The first thing that turned up while scoping it was that the system already computed a
working-day count in one place, and computed it wrongly.

### 17.2 The arithmetic, and why it was wrong twice

`getStaffMonthlyAttendanceSummary` in `src/lib/attendance-service.ts` ended with:

```ts
// Working days (approx calendar days minus Sundays and holidays)
let sundaysCount = 0;
for (let d = 1; d <= totalCalendarDays; d++) {
  const current = new Date(year, month - 1, d);
  if (current.getDay() === 0) sundaysCount++;
}
const totalWorkingDays = Math.max(0, totalCalendarDays - sundaysCount - totalHolidays);
```

Two independent defects in one expression:

| # | Defect | Effect |
|---|---|---|
| **W1** | The weekend was a **hardcoded constant** — `getDay() === 0`. | A school whose week runs Monday–Friday got every Saturday counted as a teaching day. September 2026 has four Saturdays, so `totalWorkingDays` read **26 where the correct figure is 22**. |
| **W2** | A holiday was **subtracted twice** when it fell on the weekend, and overlapping holidays were counted twice. | A holiday spanning a Saturday–Monday was subtracted as three days when only two were teaching days. September 2026 read **23 where the correct figure is 24**. |

The comment — *"approx calendar days minus Sundays and holidays"* — shows the author knew the figure
was approximate. It was not approximate. It was wrong, in two directions at once, and the two errors
partly masked each other.

W2 is the same failure mode as the counted `absentDays` removed in §11: **subtracting overlapping
sets instead of testing membership.** Once you enumerate the dates, there is no subtraction left to
double-count.

### 17.3 The severity, stated accurately

**These were latent, not live.** `getStaffMonthlyAttendanceSummary` has no production caller — the
only references to it and to `StaffMonthlyPayrollAttendance` are its own definition and a test. The
`totalWorkingDays` figure also feeds no money: `payableDays` is computed from `totalCalendarDays`, and
`totalWorkingDays` appears only as a displayed denominator on the payslip template.

So this was not a live mis-payment. It was dead code holding two bugs that would become live the
moment anyone wired it up, and the wrong figure would have looked plausible. That is worth fixing and
worth not overstating.

### 17.4 The module

`src/lib/working-days.ts` — pure and DB-free, like the other domain modules. It enumerates the range,
tests each date against the policy and the holiday set, and returns the working dates plus three
disjoint buckets:

```
count === days.length
count === totalCalendarDays - weekendDays - holidayWorkingDays
holidayCalendarDays >= holidayWorkingDays
```

The gap between `holidayCalendarDays` and `holidayWorkingDays` **is** W2: holidays that landed on a
weekly day off. Keeping both figures means the class of error is visible in the numbers rather than
silent.

Design decisions worth recording:

- **The weekend is a policy, not a constant.** `nonWorkingWeekdays` is supplied explicitly. Nothing
  assumes Saturday or Sunday.
- **Everything is UTC.** `AcademicHoliday.startDate`/`endDate` are `@db.Date`, which Prisma returns at
  UTC midnight. The original loop read weekdays with the local `getDay()`; for a tenant west of UTC a
  holiday stored as 2026-03-01 (a Sunday) reads as Saturday. Dates are reduced to an integer day index
  in UTC, which also removes DST arithmetic entirely.
- **Holidays are clamped into the range as the set is built**, so a decade-wide holiday costs nothing.
- **Invalid input throws.** An undeclared policy is refused rather than defaulted; a policy marking
  all seven weekdays non-working is refused, because it would silently produce zero working days and
  zero is already meaningful (untracked, never 0% — see §11.3). Same convention as `applyOverride`
  refusing a demotion with no target class.

### 17.5 The convention is not read from `Tenant.firstDayOfWeek`

`Tenant.firstDayOfWeek` exists and stores a weekday name, so it is tempting to derive the weekend from
it. It is deliberately not used for arithmetic. `firstDayOfWeek` is a **calendar-display** setting —
which column a month grid starts on — and treating a display preference as an arithmetic input is how
a wrong denominator becomes invisible. `policyFromFirstDayOfWeek` exists only to *pre-fill a form*,
where a human confirms it.

For the same reason the policy belongs on the **year**, not the tenant: a working-day count is an
arithmetic input, and a count computed under one convention must not be silently reinterpreted under
another when the tenant setting later changes.

### 17.6 What was deliberately not done

- **The schema column is deferred.** `AcademicYear.nonWorkingWeekdays` is the right home for the
  policy, but nothing in this increment writes or reads it — the payroll function takes the policy as
  a **required parameter**, so the compiler refuses a call site that omits it. The column lands with
  the endpoint that persists it (the generation action, or the rollover wizard). Adding a column
  nothing writes is the same speculative move as shipping a rollover record with no writer.
- **Staff and student attendance are still not converged.** §11.6 and §14.6 stand. The two domains
  keep different denominators on purpose — the student rate counts days *in the register*, the payroll
  figure counts *calendar working days* — and only the calendar arithmetic is now shared.
- **`totalHolidays` changed meaning.** It was the sum of holiday range lengths, which double-counted
  overlaps and counted holidays that fell on a weekly day off as though they were teaching days
  removed from the month. It is now the deduplicated count of holiday dates. The function has no
  production caller, so nothing downstream needed migrating.

### 17.7 Verification

| Check | Result |
|---|---|
| `working-days.test.ts` | **42/42 pass** (new) |
| `attendance-service.test.ts` | **6/6 pass** (was 1) |
| Full suite | **101 files / 1075 tests, 0 failures** (was 100 / 1028) |
| `tsc --noEmit` | clean |
| `eslint` on changed files | 0 errors; `no-explicit-any` warnings unchanged from `HEAD` (5 → 5) |
| Fixture arithmetic | March 2026 and September 2026 weekday counts verified by hand |

Mutation-tested, with a baseline assertion first so a mutation cannot "pass" by breaking the runner:

| Mutation | Result |
|---|---|
| Weekend hardcoded to Sunday again | **caught** — 4 tests fail |
| Holiday tested before the weekly day off | **caught** — 5 tests fail |

The first mutation is caught by a test asserting a five-day week yields 22 and not 26; the second by a
test asserting 24 and not 23. Both are the original defects, re-introduced deliberately and detected
by name.

## 18. The working-day declaration endpoint (Wave P2, item 21, continued)

### 18.1 What this closes

§17 built the arithmetic and left one thing deliberately undone: *"The schema column is deferred …
Adding a column nothing writes is the same speculative move as shipping a rollover record with no
writer."* This increment is the writer. It adds the column, the endpoint that declares the policy, and
the endpoint that reports the count that follows from it.

`AcademicYear.nonWorkingWeekdays Json?`, in `src/prisma/schema.prisma`:

```prisma
/// Which weekdays this year does not teach, as a JSON array of weekday
/// numbers (0 = Sunday … 6 = Saturday).
///
/// Null means **undeclared**, and callers must handle that explicitly rather
/// than assume Saturday and Sunday.
nonWorkingWeekdays Json?
```

Applied with `npm run prisma:push` (*"Your database is now in sync"*), client regenerated.

It is on the **year** and not the tenant for the reason §17.5 gives: a working-day count is an
arithmetic input — a denominator on a payslip and on the attendance rate — and a count computed under
one convention must not be silently reinterpreted when a display setting later changes.

### 18.2 The endpoint

`src/app/api/academic-years/[id]/working-days/route.ts`, `GET` and `PUT`.

Both verbs call one function, `loadYearReport`. `PUT` validates, guards, writes, and then **re-runs
the same report** rather than returning a hand-built echo — so a save is confirmed against the state
that was actually persisted, and a `PUT` response and the `GET` that follows it are byte-identical by
construction rather than by care. That is the same discipline as preview-and-execute sharing
`loadPromotionCohort`, applied to a smaller surface.

`GET` returns:

```
{ year, policy: { declared, nonWorkingWeekdays, nonWorkingWeekdayNames, suggestion }, calendar }
```

### 18.3 Why the response carries two calendars

`AcademicHoliday` carries `affectsStaff` and `affectsStudents`, so a school's students and its staff
genuinely have different working-day counts — exam leave closes the school to students while staff
still attend. Reporting one number would be exactly the conflation §11 and §14 spent two increments
removing, so `calendar.students` and `calendar.staff` are reported side by side and the holiday set is
filtered per scope.

### 18.4 Undeclared is `null`, never `0`

An undeclared year returns `calendar: null`. Zero is a real answer — a month that is entirely holiday
— and a year with no declared policy has no answer at all. Returning `0` would put a number in front
of an operator that looks like a fact. This is the same distinction as `rate: number | null` in §11.3,
and the test asserts `"calendar" in json.data` as well as `=== null`, so the key cannot quietly
disappear and be mistaken for "not loaded yet".

The `suggestion` field is the one concession to convenience: when the year is undeclared, the tenant's
`firstDayOfWeek` is offered as `{ nonWorkingWeekdays, source, firstDayOfWeek }` — **a pre-fill for a
form a human confirms, and nothing else.** The declared path does not even read the tenant row, which
is asserted rather than assumed: a display setting has no business being fetched on a path that
computes an arithmetic input.

### 18.5 A corrupt stored policy is loud, and repairable

`readWorkingDayPolicy` throws on a stored value it cannot interpret — `[7]`, `[-1]`, `["sunday"]`,
`{ weekend: [0] }`, all seven weekdays. Left to propagate, that throw would land in
`handleApiError`'s final fallback, which **deliberately masks unclassified errors**, so the operator
would see a code-less *"Internal server error"*: loud in the server log, useless in the UI, and the
exact "wrong thing with nothing to signal it" shape this module exists to remove. The route therefore
re-throws it as an explicit `ApiError` carrying `INVALID_STORED_WORKING_DAY_POLICY`.

The status is **500, not 422**: the caller sent nothing wrong — the *stored* value is broken. The
message says how to repair it, and the test asserts that the promise is real: a valid `PUT` overwrites
the column and succeeds.

### 18.6 The closed-year boundary applies here too

`PUT` calls `await assertAcademicYearOpen(tenantId, id)` **before** the update, even though this
writes a column on the year itself rather than a year-scoped row. The working-day count is an input to
the attendance rate and to the payroll denominator, so changing it after the close would silently move
figures the close declared frozen.

Ordering is asserted, not assumed: a year that is both closed *and* corrupt returns `409
ACADEMIC_YEAR_CLOSED`, not the `500` — which proves the guard is not sitting downstream of the report
loader where a malformed column could shadow it.

### 18.7 No materialised table of working days

Deliberate. Roadmap item 21 says *"holidays configured afterwards"*, and that is the whole argument:
holidays are added to the year after it opens, so a generated list would be stale the first time
someone adds a two-week break, and a staleness that requires remembering to re-run something is the
defect class this module exists to remove. The count is derived on demand from the range, the policy
and the holiday rows, so it cannot disagree with them. There is no "regenerate" button because there
is nothing to regenerate.

### 18.8 Verification

| Check | Result |
|---|---|
| `academic-year-working-days-api.test.ts` | **43/43 pass** (new) |
| `working-days.test.ts` | 42/42 pass (unchanged) |
| Full suite | **102 files / 1118 tests, 0 failures** (was 101 / 1075) |
| `tsc --noEmit` | clean |
| `eslint` on changed files | 0 errors, 0 warnings |

The route suite covers: an undeclared year returning `null` for both `null` and `undefined`; the
suggestion offered only while undeclared, and `null` rather than a guess when `firstDayOfWeek` is not
a weekday name or the tenant row is missing; a Sunday-only week as 26 and a Sunday+Saturday week as
**22**; separate student and staff calendars; a holiday on a weekly day off counted **once**; two
overlapping holiday ranges collapsed to their union; the disjoint-bucket identity; the holiday query's
overlap predicate; seven corrupt stored shapes; nine rejected `PUT` bodies; the closed-year refusal;
and the `PUT`→`GET` equality.

Mutation-tested with the baseline asserted green first:

| Mutation | Result |
|---|---|
| **M1** `PUT` no longer checks the year is open | **caught** — 3 tests fail |
| **M2** undeclared year reports a zeroed calendar instead of `null` | **caught** — 2 fail |
| **M3** corrupt stored policy repaired with a default weekend | **caught** — 7 fail |
| **M4** weekend hardcoded to Sunday instead of read from the policy | **caught** — 3 fail |
| **M5** undeclared year omits the `calendar` key rather than reporting `null` | **caught** — 2 fail |

**The harness lied first, in a new way.** The initial run reported *"0 passed, 0 failed"* for all four
mutations — indistinguishable from a survivor. The cause was the summary parser: it matched the first
`N passed` in the output, which is the `Test Files  1 passed (1)` line, not `Tests  43 passed (43)`.
A mutation that broke the suite and a mutation that broke nothing produced identical output. This is
the same family as the `shell=True`-with-a-list trap in §17.7: **when a mutation harness reports a
uniform result across every mutation, suspect the harness before believing the suite.** Both traps are
now fixed at the source, and the parser reads the `Tests` line specifically.

### 18.9 What is still outstanding

- **Nothing calls `PUT` yet.** The endpoint is the write half of item 21 and the surface that will
  declare the policy for a new year is roadmap item 16 (the wizard) and item 24 (the pre-rollover
  checklist gate). Until then the policy is declared through the API.
- **`getStaffMonthlyAttendanceSummary` still has no production caller** (§17.3), and it now takes
  `nonWorkingWeekdays` as a required parameter. Wiring it up means deciding where the policy comes
  from at the call site — which is now answerable, because it is stored per year.
- **Items 16–20, 22–26 remain open.** Items **22** (default fee-balance policy at rollover) and **23**
  (outstanding-fee write-off sweep) are still refused rather than invented: both are money policy and
  neither is derivable from the code.
- **The untracked-files risk stood here** (§16.8) — resolved in §21. The pure modules —
  `working-days.ts` among them — and their tests existed only in the working tree.

## 19. The rollover wizard, minus its face (Wave P2, items 16–20 and 24)

### 19.1 What shipped, and what deliberately did not

Roadmap item 16 is *"source year → create-new **or** copy-into-existing target"*. This increment
builds the decision and the write: `rollover-plan.ts` (pure), `rollover-roster.ts` (load and apply),
and `POST /api/academic-years/rollover`.

**The wizard's UI is the next increment, and that ordering is the roadmap's own argument.** The gap
analysis says of this exact item: *"A rollover wizard that copies fee structures into a year students
never actually enter is worse than no wizard, because it looks finished."* The defence is to settle
what a rollover *is* somewhere testable and make the surface a rendering of it. A wizard drawn before
its semantics are decided is precisely the artefact being warned about.

Along the way this closes items **18** (upsert semantics with match keys), **19** (dry-run diff),
**20** (provenance and the rollover record), part of **17** (selective copy), and item **24**'s
enforcement — the run refuses on blockers rather than warning and proceeding.

### 19.2 What a rollover may copy, and why the timetable is not one of them

Only configuration that is both year-scoped **and** carries a unique key that makes a re-run
idempotent:

| Table | Year-scoped | Unique key | Copyable |
|---|---|---|---|
| `PromotionRule` | yes | `(tenantId, academicYearId, classId)` | **yes** |
| `ClassFeeStructure` | yes | `(tenantId, academicYearId, classId)` | **yes** |
| `Timetable` | yes | **none** | **no** |

The timetable is excluded on a structural ground, not a preference: with no unique constraint, item
18's "upsert semantics with match keys" is **unsatisfiable** for it, and a second run would duplicate
the entire grid rather than update it. That is a reason that can be checked against the schema rather
than a judgement call, and it is why item 26's "copied configuration arrives inactive" — whose stated
example is the timetable — is coherently deferred with it.

`Class` is tenant-scoped, so class ids and `nextClassId` carry across years unchanged.

### 19.3 Promotion rules are not an optional toggle, and the check is on the outcome

A year with no promotion rules cannot promote anyone: `runPromotionPreflight` reports
`NO_PROMOTION_RULE` as a blocker and `POST /api/promotions/execute` refuses. So a wizard that opens a
year and copies no rules produces a year in which the wizard's own next step is impossible — the
"looks finished" trap, made concrete.

The check is written as a **consequence**, not as an input. `planRollover` computes the rules the
target will hold *after* the run and reports `TARGET_WILL_HAVE_NO_PROMOTION_RULES` if none is active.
One blocker therefore covers three different situations that look unrelated from the request:

- the operator declined the copy (`copy.promotionRules: false`),
- the source year had no rules to copy,
- every rule carried across is inactive.

A check on the request would have needed three, and would have missed the third.

### 19.4 The published exclusion list

`NOT_COPIED_CONFIGURATION` is a first-class export, returned in every plan and recorded in the audit
entry. Nine entries — terms, holidays, students, exam sessions, fee vouchers, timetables, attendance,
certificates, and the fee-balance policy — each with a reason, because *"an entry with no reason is a
shrug, not a disclosure."* A test asserts every entry carries one, that the keys are unique, and that
the list is returned verbatim rather than rebuilt per call.

The fee-balance policy is on that list because it is a money decision (item 22), not because it was
overlooked. Copying a **fee structure** is not: a fee structure is a price list, it creates no
financial record and moves no money, whereas "what happens to what students already owe" is policy.
The distinction is deliberate and worth stating, because the two look similar at a glance.

### 19.5 The dry run and the commit share one plan

`dryRun: true` returns the plan and writes nothing. Both paths call `loadRolloverPlan`, so the preview
cannot describe one plan and the commit apply another — the same discipline that put the promotion
preview and execute on one cohort loader.

**A blocked dry run returns 200, not 409.** A dry run is a read: `canProceed: false` is a *result* the
caller needs, not a failure. Returning 409 would make a readiness check look like an error and hide
the findings. Only the committing path refuses with 409 — the split the pre-flight routes already use.

The writes mirror the diff exactly: `created` rows are inserted, `updated` rows are updated, `skipped`
rows are untouched. There is no "recompute and hope" step, so the dry run cannot lie.

### 19.6 Two asymmetries that are deliberate

**A new year inherits the source's working-day policy; an existing year keeps its own.** The target of
a create is a year nobody has configured, so carrying the week is right. The target of a roll-into may
already be in use, and silently replacing its calendar would move a denominator that figures have
already been computed against. When the two differ, `TARGET_WORKING_DAY_POLICY_KEPT` says so.

**A new year is not made the current year.** Switching the operating year changes what every other
read resolves to; it is a separate act with its own capability check. A rollover that switched it
would move the whole institute's context as a side effect of copying some rules.

### 19.7 Provenance is a pointer and a record, and they are not redundant

`AcademicYear.clonedFromId` is set **only** when the wizard opened the year. A year that already
existed was not cloned from anything, and recording a source for it would be a claim the data does not
support — so an existing target's provenance is the `AcademicYearRollover` row instead.

The record carries what the operator **asked** for (`copyPromotionRules`, `copyFeeStructures`) as well
as what was **written** (the four row counts). Recording only the counts would make "the target year
has no fee structures" and "the operator chose not to copy them" indistinguishable, and only one of
those is a problem. It is also where item 22's fee-balance policy choice will live when that decision
is made, which is why it is a table rather than a Json blob on the audit entry.

Undeclared is stored as `Prisma.DbNull`, a SQL NULL — not a JSON `null`. `readWorkingDayPolicy` reads
SQL NULL as *undeclared*, and a JSON null would be a different value wearing the same JS `null`.

### 19.8 What the rollover does not do

It does not close the source year, promote anyone, or switch the operating year. Each is a separate
act with its own capability check, and the route says so in its own documentation. It also does not
run the per-class promotion pre-flight: that check already owns the question *"can these students be
promoted"* and runs at promotion time and at year close. A second gate here would be a second home for
the same judgement, and two gates that disagree is worse than one gate.

### 19.9 Verification

| Check | Result |
|---|---|
| `rollover-plan.test.ts` | **54/54 pass** (new) |
| `academic-year-rollover-api.test.ts` | **30/30 pass** (new) |
| Full suite | **104 files / 1202 tests, 0 failures** (was 102 / 1118) |
| `tsc --noEmit` | clean |
| `eslint` on changed files | 0 errors, 0 warnings |

The plan suite includes a **coverage-first** block: a table of fourteen scenarios, one per finding
code, asserting that every code in `ROLLOVER_FINDING_CODES` is produced by at least one of them. The
vocabulary cannot rot without a test failing, and the remaining assertions cannot be vacuous.

Mutation-tested, with the baseline asserted green before each target:

| Mutation | Result |
|---|---|
| **M1** the year boundary allows a target starting the same day | **caught** — 4 fail |
| **M2** the match key stops matching, so a re-run duplicates | **caught** — 4 fail |
| **M3** the target is assumed to end up with a rule | **caught** — 5 fail |
| **M4** an unrequested configuration reports rows it will never write | **caught** — 3 fail |
| **M5** a year that already existed is claimed to have been cloned | **caught** — 1 fail |
| **M6** a differing row is reported as identical | **caught** — 3 fail |
| **R1** the caller is no longer required to state what to carry | **caught** — 2 fail |
| **R2** an undeclared policy is stored as a JSON null | **caught** — 1 fail |
| **R3** the run is no longer recorded | **caught** — 3 fail |
| **R4** the audit stops recording what the operator was told | **caught** — 1 fail |
| **A1** a blocked plan is applied anyway | **caught** — 5 fail |
| **A2** the rollover capability is no longer required | **caught** — 1 fail |
| **A3** a dry run writes for real | **caught** — 3 fail |
| **A4** a blocked dry run is reported as a failure | **caught** — 1 fail |

### 19.10 The harness lied a third time, and this one damaged files

The mutation harness was extracted into `scripts/mutation_harness.py` this increment, precisely because
it had already produced two false results (§17.7, §18.8) and two copies is two places for a third. The
third arrived immediately, and it was worse than the previous two because it **wrote to the
repository**.

`read_text`/`write_text` in Python translate newlines. On Windows `read_text` turns CRLF into LF and
`write_text` turns LF back into CRLF, so the harness's "byte-identical restore" check compared
*normalised text* while every file it touched quietly gained CRLF line endings. It reported a clean
restore on three files:

- `src/lib/rollover-plan.ts` (new, written as LF, left as CRLF),
- `src/app/api/academic-years/[id]/working-days/route.ts` (from the previous increment, which used the
  old copy of the harness),
- `src/prisma/schema.prisma` (tracked; `git diff` stayed clean only because `core.autocrlf=true`
  normalises on read).

The whole tree is otherwise LF, so this was invisible to git and visible only to a byte count. The
harness now reads and writes **bytes**, and asserts `_read(path) == original` on the raw bytes rather
than on decoded text. A byte-identical check that cannot detect a byte difference is worse than no
check, because it is believed.

Two smaller harness repairs in the same pass:

- **No more `.orig` backup files.** The original is held in memory and restored in a `finally`; the
  on-disk copy added nothing and its deletion tripped a sandbox guard mid-run.
- The per-run summary parser now reads the `Tests` line specifically, which is what §18.8 fixed in the
  old copy — carried over rather than re-learned.

### 19.11 What is still outstanding

- **The wizard's UI.** The endpoint returns a plan already shaped for display — the diff in three
  buckets, the published exclusion list, the blockers and warnings with `code` + `params` for i18n —
  so the surface is a rendering exercise, not a design one. It needs the `rollover.*` message
  namespace in four locales.
- **Items 17 and 22–26.** Fee structures and promotion rules are copyable and switchable; the timetable
  toggle cannot be built until the table has a match key (item 26's own subject). **22** (fee-balance
  policy) and **23** (outstanding-fee write-off) remain refused rather than invented — both are money
  policy and neither is derivable from the code.
- **Item 25**, the post-rollover checklist, now has a natural home: the `AcademicYearRollover` row
  records exactly what the run did, so a verification screen has something to verify against.
- **The untracked-files risk had grown again here** (§16.8) — resolved in §21. `rollover-plan.ts`,
  `rollover-roster.ts`, the two new test files and the three mutation scripts existed only in the
  working tree, alongside the 36 previously untracked entries under `src/`.

## 20. The wizard's face (Wave P2, items 16–20 and 24, continued)

### 20.1 What shipped

§19.11 named the next increment: *"The endpoint returns a plan already shaped for display … so the
surface is a rendering exercise, not a design one. It needs the `rollover.*` message namespace in four
locales."* This increment builds that surface.

| File | Lines | What it is |
|---|---|---|
| `src/components/shared/rollover-wizard.tsx` | 507 | the sheet — source year, mode, copy toggles, preview, commit |
| `src/components/shared/rollover-plan-panel.tsx` | 522 | the plan: three diff buckets, findings, the exclusion list |
| `src/hooks/use-rollover.ts` | 109 | the preview (a query) and the execute (a mutation) |
| `scripts/merge-rollover-i18n.py` | 818 | authors the `rollover.*` namespace in four locales |
| `scripts/merge-preflight-i18n.py` | 365 | authors the namespace that was missing (§20.3) |
| `src/lib/rollover-i18n.test.ts` | 499 | the `rollover.*` guard |
| `src/lib/preflight-i18n.test.ts` | 528 | the `promotions.preflight.*` guard |
| `src/components/shared/rollover-plan-panel.test.tsx` | 404 | the panel, against plans from the real planner |
| `src/components/shared/rollover-wizard.test.tsx` | 83 | `suggestDates` arithmetic |
| `src/components/shared/rollover-preflight-panel.test.tsx` | 157 | the pre-existing panel's fallback, now correct |

`academicYearsApi` gained `rollover` and `rolloverPreview` (the latter is the former with
`dryRun: true` fixed), and the academic-year page grew a header action — *"Roll over the academic
year"* — gated on the same `canManage` condition that `academic:rollover:execute` requires.

### 20.2 The recon found a P0 gate that had been speaking English

`RolloverPreflightPanel` renders every finding through `t(\`codes.${finding.code}\`)`. Grepping the four
locale files for any of the fourteen codes the module can emit — `CLASS_WITHOUT_NEXT_CLASS`,
`EMPTY_COHORT`, and the rest — returned **nothing**. The namespace `promotions.preflight.codes` did not
exist in `en`, `ur`, `hi` or `bn`, and neither did `.fixes`.

So the year-close readiness gate — the panel that stands between an operator and a 409 — had been
rendering raw key paths for every blocker and a **blank line** for every remedy, in all four locales,
since it shipped. Nothing failed, because nothing was looking: next-intl does not throw on a missing
message (§20.4), and the repository-wide scanner that does look for missing keys cannot see a
template-literal key. The one class of key it cannot check was the one class that was missing.

This is not a cosmetic bug. The remedy line is the only thing on that panel that tells an operator what
to *do*, and it was empty.

### 20.3 Two namespaces and a shared vocabulary

`promotions.preflight` — `codes` (16) and `fixes` (16). Sixteen rather than fourteen because the panel
also surfaces codes that only the promotion pre-flight emits; `DUPLICATE_ENROLLMENT` appears twice,
once per call site (§20.6).

`rollover` — 124 leaves in total:

| Group | Count | Note |
|---|---|---|
| chrome strings | 58 | labels, buttons, headings, the success line |
| `codes` | 14 | every member of `ROLLOVER_FINDING_CODES` |
| `fixes` | 14 | one remedy per code |
| `skipReasons` | 2 | every member of `ROLLOVER_SKIP_REASONS` |
| `fields` | 18 | the diffable columns of both copyable tables |
| `notCopied` | 9 × (`title` + `reason`) | the published exclusion list |

Plus a new **top-level `weekdays`** (7), shared rather than nested under `rollover`, because a working
day is a calendar concept and the next surface that renders one should not have to reach into the
rollover namespace to find the word "Tuesday".

All four files stayed byte-format-correct: **5,960 CRLF lines each, no BOM, no trailing newline**, key
order identical to `en`, zero untranslated leaves, placeholder order identical.

### 20.4 Defect class one — the invisible key path

`next-intl` does **not** throw on a missing message. It reports through `onError` and returns the raw
key path as the string. A `t("promotions.preflight.codes.EMPTY_COHORT")` for a namespace that does not
exist renders the literal text `promotions.preflight.codes.EMPTY_COHORT` to the user and exits zero.

A repository-wide literal-key scanner finds `t("...")`. It cannot find `` t(`codes.${finding.code}`) ``,
because the key is not known until runtime. So an entire namespace can be absent from every locale and
no check anywhere complains — which is exactly what §20.2 was.

The two new guard tests close the two known instances by asserting the namespace is keyed by the
module's own runtime list: `ROLLOVER_FINDING_CODES`, `ROLLOVER_SKIP_REASONS`, and for the pre-flight,
one reachable scenario per code that supplies the params that code's call site actually passes. Adding
a finding code to either module now fails to translate, and the failure is a test rather than a
screenshot.

A **general** guard — enumerate every `` t(`…${…}`) `` call site in the repository and assert its
namespace exists in `en` — was not attempted. It is the obvious next hardening step and it is not done.

### 20.5 Defect class two — `try/catch` around `t()` is dead code

Both panels had a fallback that looked like this:

```ts
try {
  return t(`codes.${finding.code}` as never, finding.params as never);
} catch {
  return finding.message; // the module's English
}
```

The `catch` can never run. `t()` returns the key path on a miss; it does not throw. So the fallback was
unreachable, and the comment above it in `rollover-preflight-panel.tsx` asserted the opposite of how the
library behaves.

Found the way these things are found: a test asserting the English fallback fired **failed**, because
the component rendered the key path instead. The correct instrument is `t.has()`:

```ts
const key = `codes.${finding.code}`;
return t.has(key as never) ? t(key as never, finding.params as never) : finding.message;
```

`t.has()` is the only way to *reach* a fallback, because it is the only way to ask the question without
already having committed to the answer. Both panels now use it, and `rollover-plan-panel.test.tsx`
asserts the degradation explicitly — an unknown code renders the module's English, and neither the key
path nor an English string leaks when the key *does* exist.

### 20.6 Defect class three — ICU straight-quote escaping, and it was in every message

Both namespaces were first authored with placeholders written `'{year}'`. In ICU MessageFormat a single
quote begins an escaped literal, so `'{year}'` is **not** interpolation — it renders the four
characters `{year}`. Every message in both new namespaces would have shipped a literal brace to an
operator.

Confirmed with a standalone probe rather than from memory:

```
quoted   => {year} cannot be rolled over into itself.
curly    => “AY2026” cannot be rolled over into itself.
```

Curly quotes `“ ”` are not metacharacters and interpolate normally. Fixed centrally, in both merge
scripts, by a `format_safe` that rewrites straight-quoted placeholders to curly-quoted ones, plus a
**refuse-to-write** guard on any surviving `'\{` or `\}`, plus a block in *both* guard tests that runs
the real formatter with real params and fails on any surviving `{[a-zA-Z0-9_]+}`. A translation that
renders its own placeholder is now a test failure, not a support ticket.

The same class of check caught a second, quieter thing: `i18n-parity-and-interpolation.test.ts` compares
extracted variable lists with `join(",")`, so **placeholder order is part of the contract**. Transcribing
into verb-final languages (Urdu, Hindi, Bengali) reorders placeholders naturally, and nine messages
failed for exactly that reason. The sentences were rewritten and the order check was added to both merge
scripts.

### 20.7 Two params the guards found missing in the modules

The "params supplied at only one of two call sites" defect — a code with two call sites that supplies
its params at one and not the other, so the translation interpolates a missing value.

- `DUPLICATE_ENROLLMENT` — the promotion-path call site now also supplies `count: 1`. It is `1` by
  construction there, and it is supplied rather than omitted on purpose, because the year-close call
  site can have several rows for one year and the param must be present at both.
- `TARGET_WORKING_DAY_POLICY_KEPT` — a **pre-existing module defect**. Its params omitted
  `sourceLabel` even though its own English `message` names `source.label`. The English fallback hid it;
  the moment the code was translated the missing value would have appeared. Added, with a comment
  recording that the fallback is what concealed it.

The guard asserts the **intersection** of supplied params across a code's call sites, not the union —
a union would pass while a translation interpolated `undefined` at one of them.

### 20.8 The wizard's design decisions

**The preview is a query, not a mutation.** It reads; it writes nothing; `dryRun: true` is the same
endpoint. It is wired as a query with `staleTime: 0, gcTime: 0, retry: false` — a preview of a plan
that depends on live configuration should not be cached, and a failed preview is a result to display
rather than a transport error to retry.

**`submitted` is deliberately separate from the form.** The panel describes the request that produced
the plan, not the request the form currently holds. Without that split, editing the target year after a
preview would leave a panel confidently describing a plan for a request nobody made.

**Commit is disabled until a clear preview.** `canCommit = canExecute && Boolean(plan?.canProceed) &&
!execute.isPending`. The server's 409 is the backstop, not the mechanism.

**The source year is never pre-selected.** The wizard opens with an empty source select. A default here
would be a guess about which year is being rolled over, and the wrong guess copies a year's
configuration into the wrong place.

**The button carries no side effects and no provenance.** "Roll over the academic year" opens a sheet;
it does not create, copy or switch anything. Everything §19.8 says a rollover does *not* do stays true
of the button that starts one.

**The year select for an existing target is interactive.** `suggestDates` is exported and tested —
including the leap-day and year-boundary cases — because the default target window is computed
arithmetic (source end + 1 day, plus one year, minus one day) and arithmetic is where this repository
has been bitten before.

### 20.9 The panel: four things the operator must read

The plan arrives already shaped, so the panel is a rendering exercise — but four of its parts are
load-bearing and are rendered as such:

1. **The three-bucket diff** — created / updated / skipped, with the changed fields named per row and
   the skip reason translated from `code`.
2. **The blockers and the warnings**, separated, because the commit refuses on the first and proceeds
   through the second.
3. **The working-day policy line** — inherited, kept, or undeclared. §19.6's asymmetry is invisible
   unless it is said out loud.
4. **The exclusion disclosure** — a `<details>` listing all nine things a rollover does *not* copy,
   each with a reason. This is the one nobody else says, and it is the difference between a wizard that
   looks finished and one that is honest about what it left behind.

Every finding is translated from `code` + `params`, never from the module's `message`. The module's
English is a log/API fallback and appears only when the key genuinely does not exist (§20.5).

### 20.10 Verification

| Check | Result |
|---|---|
| Full suite | **109 files / 1265 tests, 0 failures** (was 104 / 1202) |
| The five new test files | **63 pass** |
| `tsc --noEmit` | clean |
| `eslint` on the 12 touched files | **0 errors**, 17 warnings — all pre-existing `no-explicit-any` |
| Locale byte format | 5,960 CRLF × 4, no BOM, no trailing newline, key order identical |

The panel tests build their plans with the **real `planRollover`**, not a hand-written fixture, and
assert negatively that neither the module's English nor a raw key path appears — so a fixture cannot
drift from the planner and still pass. The per-locale block reads each locale's **own** bundle
(`localeMessages(locale)`); an earlier version passed the English bundle to every locale and failed the
right assertion for the wrong reason.

Not attempted: a component test that drives the wizard's *interaction* end to end. `@testing-library/user-event`
is not installed (only `fireEvent`), and the `TopSheet` portal plus `QueryClient` plus `useUnsavedChanges`
harness is heavy relative to the risk that remains. Recorded as a gap rather than papered over.

### 20.11 What is still outstanding

- **The general template-key guard** (§20.4). Two namespaces are guarded; the class is not.
- **Items 17 and 22–26.** The timetable toggle (17, 26) cannot be built until the table has a match
  key. **22** (fee-balance policy) and **23** (outstanding-fee write-off) remain refused rather than
  invented — both are money policy, neither is derivable from the code.
- **Item 25**, the post-rollover checklist, has its data source: the `AcademicYearRollover` row records
  exactly what the run did.
- **The untracked-files risk, fifth flag** (§16.8) — **resolved in §21**. This increment had added six
  more files that existed only in the working tree: `rollover-wizard.tsx`, `rollover-plan-panel.tsx` and
  its test, `rollover-preflight-panel.test.tsx`, `use-rollover.ts`, and both merge scripts. The working
  tree then held **49 untracked entries under `src/` and 6 under `scripts/`** — every pure module, every
  test for them, and every script that authored or mutation-tested them. One `git clean` would have lost
  the lot.

## 21. The working tree is committed (repository hygiene)

### 21.1 What was at risk

Every increment in this document had been written to the working tree and never committed. By the end
of §20 that was:

| | Count |
|---|---|
| Modified tracked paths | 83 |
| Deleted tracked paths | 7 |
| New (untracked) paths | 59 |
| **Total** | **150** |

The last commit before this work was `319a65d feat(fees): enhance bulk payment process`, which predates
the entire academic-year module. Every pure module, every guard test, both i18n merge scripts and the
shared mutation harness existed only on disk. A single `git clean -fd` would have destroyed the
promotion engine and the tests that protect it, with no way to recover any of it.

This is the same root cause as §15.2's 146 uncommitted i18n keys. It was flagged five times across five
increments and never acted on, which is its own lesson: **a risk that is only reported is a risk that is
still open.**

### 21.2 How it was split

Twenty-one commits, grouped by concern rather than by file. The ordering runs foundation → consumer, so
the schema lands before the modules that read it and the pure modules land before their routes:

| # | Commit |
|---|---|
| 1 | `chore(git)` — ignore the local agent settings directory |
| 2 | `chore(db)` — extend the schema for the academic-year module |
| 3 | `feat(promotions)` — extract one shared promotion decision engine |
| 4 | `feat(promotions)` — server-authoritative promotion routes and UI |
| 5 | `feat(certificates)` — bulk issuance, one numbering scheme, shared printing |
| 6 | `feat(attendance)` — one attendance rate across every surface |
| 7 | `feat(academic-year)` — year-close finalisation and the closed-year write boundary |
| 8 | `feat(academic-year)` — the rollover pre-flight gate |
| 9 | `feat(academic-year)` — working days are a set, not a subtraction |
| 10 | `feat(academic-year)` — the rollover plan and its commit endpoint |
| 11 | `feat(i18n)` — author the promotions, rollover and pre-flight namespaces |
| 12 | `feat(academic-year)` — one current-year resolver and a lifecycle audit trail |
| 13 | `feat(academic-year)` — the rollover wizard UI |
| 14 | `feat(session)` — session pinning, idle guard and tenant session policy |
| 15 | `feat(system-admin)` — report a measured health status, not a hardcoded one |
| 16 | `feat(accounting)` — rework the statements page |
| 17 | `refactor` — remove the legacy client-side PDF generators and unused providers |
| 18 | `feat(ui)` — require an explicit choice instead of pre-selecting one |
| 19 | `feat(ui)` — accept a digit-run date typed without separators |
| 20 | `docs` — academic-year audit, gap analysis and implementation status |
| 21 | `test(attendance)` — route-level coverage for the attendance API |

Each commit body records the invariant it protects and *why* it exists, not just what changed — the
same reasoning these sections carry, attached to the code it belongs to.

### 21.3 The honest caveat

**The commits are split by concern, not by build order, so an intermediate commit is not guaranteed to
compile or pass tests on its own.** The working tree accumulated many increments at once and several
files serve more than one of them — `src/messages/*.json` and `src/prisma/schema.prisma` in particular
were touched by nearly every increment, and splitting a single file's changes across commits is not
possible without interactive staging.

What is guaranteed is that **HEAD is exactly the verified state**: `git status` is clean, no file
content was altered by the commit (only the index was), and the full suite at HEAD is the
109 files / 1265 tests recorded in §20.10.

### 21.4 One thing that was not committed, on purpose

`.codebuddy/settings.local.json` — a machine-local MCP and permission file. `.codebuddy/` is now in
`.gitignore` alongside `.claude/`, `.cursor/` and `.workbuddy-ai/`, so a local editor's settings do not
become a repository artefact.

## 22. Completing the remainings (Wave P2, items 17, 22, 26 — and one correction)

### 22.1 The correction, which is the most important thing in this section

§19.2 said the timetable was excluded from the copy because *"the timetable table has no unique key,
so a copy cannot be made idempotent — a second run would duplicate the entire grid rather than update
it."* That claim was **false**. `Timetable` has carried

```
@@unique([tenantId, academicYearId, classId, sectionId, dayOfWeek, periodNumber])
```

since before the rollover existed — it is present verbatim in the commit the whole module postdates.
Items 17 and 26 were deferred on a schema fact that was never checked against the schema, and the false
reason was written into this document with unusual confidence: *"a reason that can be checked against
the schema rather than a judgement call."*

It did not survive being checked. `git show 319a65d:src/prisma/schema.prisma` settles it, and that is
the standard every "structural" claim in this document should have been held to.

The exclusion list said the same false thing to the operator. Both are corrected here, and
`rollover-plan.test.ts` now asserts the timetable is **not** on `NOT_COPIED_CONFIGURATION`, so the
correction cannot quietly reverse.

### 22.2 What a null section does to a match key

Checking the match key properly found a second, subtler defect. `sectionId` is nullable, and Postgres
treats NULLs as **distinct** in a unique index, so the constraint only enforces uniqueness for slots
that have a section. Two unsectioned slots for the same class, day and period are both allowed — the
key looks like a match key and is not one, for exactly the rows that have no section.

Prisma 6.19 has no `nullsNotDistinct` argument to close this at the schema level (attempted; `P1012
No such argument`), so it is handled in application code and **surfaced rather than hidden**:

- the rollover's match key coalesces the section, so a copy is still one-to-one;
- the plan raises `SOURCE_HAS_DUPLICATE_TIMETABLE_SLOTS` when the source grid already holds two slots
  the database cannot tell apart — the school's own defect, reported rather than multiplied;
- the roster writes an update through `updateMany`, because Prisma types a nullable column inside a
  compound unique as non-nullable, which makes an unsectioned slot unaddressable that way.

### 22.3 Item 17 and 26 — the timetable copy, arriving as a proposal

`copy.timetables` is a third **required** copy flag, matching the existing two: a default would carry
a grid nobody asked for. The diff reuses the one `buildDiff` implementation, generalised so each table
supplies its own match key — the module's comment previously claimed all copyable tables were
class-keyed, which was the same false premise.

Copied slots arrive `needsReview: true` (item 26). The flag is **forced in the plan, not copied** — a
source slot is `false` precisely because the source year confirmed it — and it is deliberately *not*
in the compared field list, because comparing it would break re-run idempotency: after the first copy
the target holds `true` while the source holds `false`, and a second run would report every slot as
updated forever. Force without compare means the second run finds the slots identical and skips them.
Both properties are asserted.

The plan also names each slot by class, section, day and period — a new `rowLabel` on the diff row,
because `className` alone would render twenty identical-looking rows for one class.

### 22.4 Item 22 — the fee-balance policy, stated rather than inferred

`FEE_BALANCE_POLICIES` is `CARRY_BALANCE | CARRY_UNPAID | ZERO`, required in the request, never
defaulted. The schema gains `AcademicYear.feeBalancePolicy` (operative) and
`AcademicYearRollover.feeBalancePolicy` (what was asked), for the same reason the copy flags are
recorded twice: *"the operator was never asked"* and *"the operator chose ZERO"* must stay
distinguishable.

Two deliberate limits, stated rather than hidden:

- **What ZERO does is derivable; what the two carry options do beyond "inherit" is not.** At the write
  boundary both carry options behave identically — the roadmap's distinction between a net opening
  balance and itemised unpaid dues is an accounting presentation question, and consolidating or
  re-cutting financial records is not a decision this module makes silently. What the choice does
  guarantee is that the operator saw the outstanding figure before choosing.
- **The figure is reported, not buried.** `RolloverPlan.feeBalance` carries the student count and the
  total, aggregated per *student* (a student with six unpaid months owes once, not six times), and the
  panel renders it next to the selector.

`ZERO` is enforced at the boundary that would otherwise silently undo it: the batch invoice arrears
sweep, which previously reached back over *every* prior period regardless of year, now reaches back
within the year only unless the target's stated policy says it may inherit. An **unstated** policy also
restricts — never asked is not the same as says carry.

A roll-into keeps an existing year's own policy, for the same reason it keeps its own working-day
policy: invoices already issued under one policy must not change meaning retroactively.
`TARGET_FEE_BALANCE_POLICY_KEPT` says so, and the run still records what was asked.

### 22.5 The general template-key guard (the class, not the instances)

`template-key-namespace.test.ts` walks every non-test source file, finds every `` t(`…${…}`) `` call
site, attributes it to the namespace its *variable* was bound to, and asserts that container exists in
`en`. Attribution is per variable rather than per file because a file routinely holds two translators.

It found one more live defect on its first run: `portal-view.tsx` rendered `` t(`days.${day}`) ``
against a `portal.days` namespace that exists in no locale — the student timetable's column headers
have been showing raw key paths. Fixed by reusing the shared top-level `weekdays` namespace rather
than authoring a second copy of six words.

Four call sites are listed in `KNOWN_UNRESOLVABLE`, each with the reason static analysis cannot reach
them — the first key segment is built from a value (`recurrence${…}`, `<moduleKey>.title`). The list
is a review list with reasons, not a suppression list.

### 22.6 Verification

| Check | Result |
|---|---|
| Full suite | **110 files / 1288 tests, 0 failures** (was 109 / 1265) |
| `tsc --noEmit` | clean |
| `eslint` on the 13 touched files | **0 errors**, 42 warnings — all pre-existing `no-explicit-any` |
| Locale byte format | CRLF, no BOM, no trailing newline, key order identical to `en` |

New finding codes are covered by the same coverage-first table as the originals: every code in
`ROLLOVER_FINDING_CODES` has a scenario that produces it, so the five new codes arrived with their
scenarios rather than after them. The i18n guard failed twice during this increment for exactly the
reasons it exists — a code authored without a translation, and a translation authored in the wrong
position — and both were caught before any of it reached a screen.

### 22.7 What is still outstanding

- **Item 25**, the post-rollover verification checklist — buildable, unblocked, data source in place.
- **Item 23**, the outstanding-fee write-off / waive sweep. The most invasive remaining item: it
  writes financial records, and it wants a decision on whether a sweep is a write-off (accounting) or
  a waiver (forgiveness, which `fees:waiver:approve` exists for) before the write is shaped.
- The `sectionId` null-distinctness remains a database-level gap, as described in §22.2 — application
  code compensates, the schema cannot express the fix.



## 23. The last two roadmap items (Wave P2, items 23 and 25)

### 23.1 Item 23 — the outstanding-fee sweep

`fee-write-off.ts` plans and applies the disposal of balances a school has decided it will not
collect. `POST /api/academic-years/[id]/write-off-sweep` runs it, gated on `fees:waiver:approve`
because giving up money the school billed is the same class of decision that permission already
governs.

**The shape of the entry is a waiver, and that is derivable rather than chosen.** A balance is a
financial record — it says "this was billed and not paid" — so it cannot be deleted, only disposed of
through a journal. The sweep posts the same double entry every other forgiveness in this codebase
posts: **debit an expense, credit accounts receivable**, then brings the voucher's `totalDue` and
`balance` down and re-derives its status. The voucher stays; the record of what was billed stays; only
the receivable clears.

**One decision was made rather than requested, and it is made visible instead of hidden.** The
roadmap's "write-off / waive" ambiguity resolves to: *waive* before billing is a concession (already
built); *write off* after it is an expense. So the sweep charges **`WRITE_OFF_EXPENSE` (5070)**, which
sits beside the existing `CONCESSION_EXPENSE` (5060) in the same 5-series for the same shape of entry.
The sweep **refuses until the tenant's chart of accounts carries that code** — an account code this
module invented and wrote to silently would be an accounting policy nobody chose. Refusing puts the
decision back with the school, which is where item 23 has always said it belongs.

Two guards worth stating:

- **The plan's figure is an approval, not a truth.** Each voucher's row is re-read `FOR UPDATE` at
  write time and the sweep disposes of the *smaller* of the approved amount and what is actually owed,
  so a payment that lands between preview and confirm can never over-write the debt.
- **Per voucher, not per student.** Consolidating would produce one tidy figure and lose which fee
  head and month the money was owed on. The plan reports per student — that is how an operator reads
  it — while the write stays per voucher.

Dry run and commit share one planner; a blocked dry run is 200, only the committing path refuses.
A sweep that finds nothing is **blocked rather than successful**, because reporting success over zero
rows is how a button stops meaning anything.

### 23.2 Item 25 — the post-rollover verification checklist

`rollover-verification.ts` turns what the last run *did* plus the target year's current state into
seven checks an operator walks through before treating a year as live, and
`GET /api/academic-years/[id]/rollover-verification` serves it.

**It is deliberately read-only.** A checklist that can be "completed" is a checklist that can be
completed without being read, so nothing here flips a flag or writes a row. `ready` is the absence of
`attention`, and one item — the operating-year note — is always `info` rather than a defect, because a
rollover deliberately does not switch the operating year.

Two checks are decided against the **outcome** rather than the request: the promotion-rule check reads
the active count (inactive rules promote nobody), and the fee-structure check is `info` rather than
`attention` when the operator *declined* the copy — a school that chose not to carry them should not
be told it failed.

### 23.3 One thing that is deliberately not in this increment

Neither item ships with its UI surface yet. The academic-year page is being worked on concurrently —
a close-session (archive) sheet and its `useCloseAcademicYear` hook landed in the working tree while
this increment was being built — and wiring two new surfaces into a file someone else is actively
editing is how one session's work overwrites another's. Both endpoints are complete, tested and
wired to the permissions they need; the surfaces are a rendering exercise against responses that are
already shaped for display, and the checklist in particular needs the four `rollover.verification.*`
message keys authored when it is drawn.

### 23.4 Verification

| Check | Result |
|---|---|
| Full suite | **113 files / 1325 tests, 0 failures** (was 110 / 1288) |
| `tsc --noEmit` | clean on every file in this increment |
| `eslint` on the 8 new files | **0 errors, 0 warnings** |

### 23.5 Where the roadmap stands

Every item in the gap analysis is now built: **16–26**, plus all of P0 and P1. What remains open is
not a roadmap item — it is the two UI surfaces named above, and the `sectionId` null-distinctness gap
recorded in §22.2, which application code compensates for and the schema cannot express.
