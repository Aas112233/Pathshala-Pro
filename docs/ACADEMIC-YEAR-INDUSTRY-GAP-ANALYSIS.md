# Academic Year Module — Industry Comparison & Implementation Roadmap

**Date:** 2026-09-24
**Companion to:** `docs/ACADEMIC-YEAR-MODULE-AUDIT.md` (current-state audit)
**Scope:** Side-by-side comparison against industry-grade SIS/ERP practice, gap identification, and a prioritised implementation recommendation for this academic year.

---

## 1. Method & Sources

The "industry standard" column is derived from documented product behaviour and operational guidance for established Student Information Systems, not from general impressions. Three references anchor it:

| Ref | Source | What it contributes |
|---|---|---|
| **R1** | PowerSchool SIS — *End-of-Year Process* (official admin docs) | The authoritative EOY function contract: per-student `Next Grade Level` / `Next School` indicators, promote/retain/demote, graduation via sentinel codes, exit dates, balance carry-forward policy, pre-flight validation, irreversibility + mandatory backup |
| **R2** | Schoolyi — *Academic year rollover* (platform guide) | The rollover-wizard contract: source → target, selective copy toggles, upsert match keys, `clonedFrom` provenance, "set as current" transactional switch, copied config arriving **inactive**, explicit "what it does *not* copy" |
| **R3** | Aequitas — *K-12 SIS Year-End Rollover* (district IT guide) | The five-phase operational sequence and the surrounding non-software work: hygiene, record locking, verified backup, exception handling, verification, runbook |

The "Pathshala-Pro today" column is taken from the verified current-state audit. Every claim in that column traces to a file and line cited in the companion document.

---

## 2. The Industry Reference Model

### 2.1 The five-phase lifecycle (R3)

Industry treats year-end as a **sequenced programme**, not a button:

```
Phase 1  CLEAN UP & CLOSE OUT   → data hygiene, exception reports, lock grades,
                                   archive report cards/transcripts, reconcile attendance
Phase 2  BACK UP                → verified snapshot; confirm restore actually works
Phase 3  ROLL OVER              → promote / retain / graduate / transfer
Phase 4  REBUILD                → calendars, terms, schedules, catalog, permissions
Phase 5  VERIFY                 → spot-check across sites, test logins, runbook
```

The critical structural insight: **promotion is one step inside a larger programme.** Pathshala-Pro implements step 3 partially and has no representation of phases 1, 2, 4, or 5.

### 2.2 The rollover-wizard contract (R2)

A mature rollover wizard is deliberately narrow. It does exactly three things:

1. **Create or select** the target year
2. **Copy selected configuration** into it — per-item toggles, upsert semantics
3. **Optionally activate** it as the current year

And it explicitly does **not** archive, close, or promote. Its documented copy matrix:

| Item | Carried over? | Semantics |
|---|---|---|
| Fee structures | Yes, optional | Matched by fee type + class; **updated, not duplicated** on re-run |
| Syllabus | Yes, optional | Matched by class + subject; existing target row updated |
| Teacher assignments | Yes, optional | Copied **inactive on purpose** — must be reviewed before becoming timetable input |
| Students | **No** | Promotion is a separate module, run *before* rollover |
| Terms | **No** | Added by hand; reports and fee schedules depend on them |
| Holidays / weekend rules | **No** | Working days generated for the date range; holiday flags configured after |
| Timetable, exam sessions, fee instances | **No** | Rebuilt in their own modules |
| Classes, subjects | N/A | Not year-scoped; same records serve every year |

Plus three design details worth naming: the new year **records which year it was cloned from**; a duplicate year name is **refused outright**; and "set as current" **clears the current flag from every other year in one transaction**.

### 2.3 The promotion-engine contract (R1)

PowerSchool's EOY performs a specific, ordered set of operations:

- **Validates** that every student has `Next School` set, and that a next-year term exists in every school — *before* touching anything
- Promotes, retains, or **demotes** according to each student's `Next Grade Level`
- Transfers between schools per `Next School Indicator`
- **Graduates** students whose `Next Grade Level` is the sentinel `99` and `Next School` is the graduating-school sentinel
- Sets each student's **exit date** to the last day of their school year
- **Carries forward balances with a stated policy** — the operator chooses: roll over the balance / roll over unpaid details only / zero the balance
- Copies `Courses` into a year-keyed archive
- Is preceded by a mandatory **`Perform EOY Validation`** process, a **database backup**, and a documented warning that **the process is irreversible** and must run uninterrupted

Note the shape of the contract: **per-student intent is captured as data first** (`Next Grade Level`, `Next School`), and the batch job is a deterministic executor over that data. Pathshala-Pro instead derives intent at runtime from a class-level rule, which is why exceptions have nowhere to live.

---

## 3. Side-by-Side Capability Matrix

**Verdict key:** `MISSING` — no implementation · `PARTIAL` — exists but materially incomplete · `ADEQUATE` — meets the industry baseline · `STRONG` — meets or exceeds it

### A. Year model & lifecycle

| # | Capability | Industry standard | Pathshala-Pro today | Verdict |
|---|---|---|---|---|
| A1 | Year as first-class tenant entity | Yes, per school | `AcademicYear` with `yearId`/`label`/dates/`isClosed` | ADEQUATE |
| A2 | Explicit **current-year** flag | Single flag; switch clears others transactionally (R2) | Inferred from date range + cookie; **no flag**; overlapping ranges resolve arbitrarily | **MISSING** |
| A3 | Year-to-year linkage | `clonedFrom` / previous-year pointer (R2) | None — flat list, no `previousYearId`/`nextYearId` | **MISSING** |
| A4 | Terms / semesters / grading periods as data | First-class rows per year | Constants only (`academic-periods.ts`); **no table** | **MISSING** |
| A5 | Year close (lock) | Explicit, admin-reversible | `isClosed` flag | PARTIAL |
| A6 | Year **reopen** | Supported and audited | **Impossible via API** — guard returns before payload inspection | **MISSING** |
| A7 | Working-day / calendar generation for new year | Days generated for the range; holidays configured after (R2) | `AcademicHoliday` rows per year; **nothing generated** | **MISSING** |
| A8 | Concurrent staging of next year | Supported | Supported, but "which is current" is ambiguous | PARTIAL |

### B. Rollover wizard

| # | Capability | Industry standard | Pathshala-Pro today | Verdict |
|---|---|---|---|---|
| B1 | Dedicated rollover wizard | Yes — source → target, guided (R2) | **None** | **MISSING** |
| B2 | Create-new **or** copy-into-existing target | Both modes (R2) | None | **MISSING** |
| B3 | Selective copy toggles per item type | Yes (fee structures, syllabus, assignments) (R2) | **None** | **MISSING** |
| B4 | Row-level selective migration | Common | None | **MISSING** |
| B5 | Upsert match keys (re-run safe) | Yes — update, don't duplicate (R2) | N/A | **MISSING** |
| B6 | Copied config arrives **inactive** for review | Yes, deliberately (R2) | N/A | **MISSING** |
| B7 | Duplicate target-year name refused | Yes (R2) | Yes — `@@unique([tenantId, yearId])` + explicit check | STRONG |
| B8 | Pre-rollover checklist gating | Yes (R2) | None | **MISSING** |
| B9 | Dry-run / preview before commit | Common | None | **MISSING** |
| B10 | Rollover audit record / runbook | Yes (R2, R3) | None | **MISSING** |

### C. Student progression

| # | Capability | Industry standard | Pathshala-Pro today | Verdict |
|---|---|---|---|---|
| C1 | **Per-student** next-placement indicator | `Next Grade Level` + `Next School` as stored data (R1) | Derived at runtime from class-level `PromotionRule.nextClassId` | PARTIAL |
| C2 | Promote / retain / **demote** | All three (R1) | Promote, retain, conditional; **no demote** | PARTIAL |
| C3 | Explicit **target year** on promotion | Yes | **Writes `to == from`** — year never advances | **MISSING** |
| C4 | Year-scoped enrollment row for target year | Yes | Not created | **MISSING** |
| C5 | Graduation | Sentinel grade/school, exit date, transcript finalize (R1) | Final class labelled `RETAINED`; `GRADUATED` **never written** despite existing in both enums | **MISSING** |
| C6 | Transfer / exit out | Exit date + leaving certificate (R1, R3) | `StudentStatus.TRANSFERRED` + TC template exist; no year-end workflow | PARTIAL |
| C7 | Bulk promote across all classes | School-wide run (R1) | Class-by-class only | **MISSING** |
| C8 | Re-exam / conditional progression workflow | Yes | Fields exist; conditional students **silently dropped** at execution | **MISSING** |
| C9 | Eligibility preview | Yes | `calculate` endpoint does this well | STRONG |
| C10 | Execution preview | Yes | None — execute is blind | PARTIAL |
| C11 | Idempotent re-run | Yes | Blocked by duplicate + live-class-mismatch checks | PARTIAL |
| C12 | Rollback a promotion run | Restore from verified backup (R1, R3) | None; historical override does not revert class or unlock marks | **MISSING** |

### D. Academic record finalization

| # | Capability | Industry standard | Pathshala-Pro today | Verdict |
|---|---|---|---|---|
| D1 | Lock final grades before promotion | Mandatory pre-step (R1, R3) | Yes — sets `ExamResult.isLocked`, enforced on the write path | STRONG |
| D2 | Publish results before close | Yes | `exam.isPublished` makes results immutable | STRONG |
| D3 | Transcript / credits / GPA finalization | Yes (R1, R3) | `finalGpa`/`finalPercentage` fields exist but are **never computed** | PARTIAL |
| D4 | Report card archival per year | Yes — archived artifact (R3) | PDF generated on demand; no stored artifact | PARTIAL |
| D5 | Attendance reconciliation before close | Yes (R3) | None | **MISSING** |
| D6 | Exception / hygiene report before rollover | Yes — "run exception reports, not eyeballs" (R3) | None | **MISSING** |

### E. Finance & balances at year end

| # | Capability | Industry standard | Pathshala-Pro today | Verdict |
|---|---|---|---|---|
| E1 | **Stated fee-balance policy** at rollover | Operator chooses carry / unpaid-only / zero (R1) | No year-end policy | **MISSING** |
| E2 | Unpaid dues carried to next year | Yes, selectable (R1) | Per-batch `carryForwardArrears` flag only, at invoice time | PARTIAL |
| E3 | Wallet / lunch balance carry-forward | Yes, with transaction wipe (R1) | `StudentWalletLedger` is year-agnostic → carries implicitly; no reconciliation | PARTIAL |
| E4 | Payroll year close | Yes | `SalaryLedger` year-scoped; no close routine | PARTIAL |
| E5 | Outstanding-fee write-off before close | Yes (R2 checklist) | Void exists via historical console; no year-end sweep | **MISSING** |

### F. Safety, validation & reversibility

| # | Capability | Industry standard | Pathshala-Pro today | Verdict |
|---|---|---|---|---|
| F1 | Mandatory pre-flight validation pass | `Perform EOY Validation` (R1) | **None** | **MISSING** |
| F2 | Transactional execution | Batch job + mandatory backup (R1) | Non-transactional loop; **partial commits returned as failures** | **MISSING** |
| F3 | Verified backup / restore path | Mandatory and *tested* (R1, R3) | DB-level (Accelerate); undocumented in-app | PARTIAL |
| F4 | Idempotency | Yes | Partial (duplicate guard only) | PARTIAL |
| F5 | Undo last rollover | Restore from pre-rollover snapshot (R1, R3) | None | **MISSING** |

### G. Governance & operations

| # | Capability | Industry standard | Pathshala-Pro today | Verdict |
|---|---|---|---|---|
| G1 | Role-gated promotion execution | Dedicated permission (R1) | `academic:promote:execute` capability — genuinely good | STRONG |
| G2 | Role-gated **rollover** execution | Run restricted; endpoint re-validates (R2) | No rollover concept; year CRUD uses generic perms | PARTIAL |
| G3 | Audit log on year lifecycle | Yes | **None** on create/edit/close | **MISSING** |
| G4 | Audit log on promotion decisions | Yes | `decidedBy` + `decidedAt` on `ClassPromotion` | STRONG |
| G5 | Documented runbook | Yes (R2, R3) | None | **MISSING** |
| G6 | Staff offboarding at year end | Yes (R3) | None | **MISSING** |
| G7 | Post-rollover verification checklist | Yes (R3) | None | **MISSING** |

### H. Data architecture & isolation

| # | Capability | Industry standard | Pathshala-Pro today | Verdict |
|---|---|---|---|---|
| H1 | Year-scoped FKs on operational data | Yes | Yes — 14 tables | STRONG |
| H2 | Year-resolution priority chain | Yes | 5-level chain + 60s cache | STRONG |
| H3 | Closed-year write blocking | Yes | Yes — but wired to only a subset of routes | PARTIAL |
| H4 | Strict isolation, no cross-year leakage | Yes | OR-fallback to live `StudentProfile.classId` leaks | PARTIAL |
| H5 | Year-agnostic reference data | Yes | Classes, sections, groups, subjects | STRONG |
| H6 | Explicit year context on every API call | Header/param | Cookie-based de facto transport | PARTIAL |

### Scorecard

| Domain | Missing | Partial | Adequate | Strong |
|---|---|---|---|---|
| A. Year model & lifecycle | 5 | 2 | 1 | 0 |
| B. Rollover wizard | 9 | 0 | 0 | 1 |
| C. Student progression | 7 | 4 | 0 | 1 |
| D. Academic record finalization | 2 | 2 | 0 | 2 |
| E. Finance & balances | 2 | 3 | 0 | 0 |
| F. Safety & reversibility | 3 | 2 | 0 | 0 |
| G. Governance & operations | 4 | 1 | 0 | 2 |
| H. Data architecture | 0 | 3 | 0 | 3 |
| **Total (57)** | **32** | **17** | **1** | **9** |

**Reading of the scorecard:** the *foundations* are strong — H (architecture) and D (record locking) and the promotion RBAC gate are genuinely well built, and the mark-locking mechanism is better than many production systems. The failures cluster in **B (rollover), C (progression), E (finance close), F (safety) and G (governance)** — exactly the year-*boundary* concerns. The system is strong *within* a year and weak *between* years.

---

## 4. Gap Detail — The Items That Matter

### 4.1 C3 — Promotion does not advance the year
`promotions/calculate/page.tsx:167-168` writes `toAcademicYearId: selectedYear` alongside `fromAcademicYearId: selectedYear`. `toAcademicYearId` appears in exactly one `.tsx` file repo-wide. The schema, executor, and guards all support a distinct target; no caller supplies one.

**Industry comparison:** R1 captures intent per student as `Next Grade Level` *before* the batch runs. R2 separates promotion from rollover entirely and requires promotion to be *finished* before rollover. Both assume the target year is an explicit input. Ours is the one thing the industry never does: it assumes the target is the source.

### 4.2 C4/C5 — No target-year enrollment row; no graduation
`promotions/execute/route.ts:228` upserts `StudentAcademicSession` only for the **from** year. And `promotions/calculate/route.ts:203-206` sets final-class students to `RETAINED`.

**Industry comparison:** R1 graduates on a sentinel `Next Grade Level` and sets an **exit date**; R3 names graduates as one of three "exception" categories that carry the real error risk. Pathshala-Pro already has the vocabulary — `StudentAcademicSession.promotionStatus` documents `GRADUATED`, and `StudentStatus` enumerates `GRADUATED` and `TRANSFERRED` — but the engine writes none of them. The data model anticipated this; the engine never arrived.

### 4.3 B1/B3/B5 — No rollover wizard, no selective copy
There is no rollover surface of any kind, and no endpoint accepts a carry-forward payload.

**Industry comparison:** R2's wizard is explicitly *narrow* and *selective* — three optional item types, upsert semantics, config arriving inactive for review, provenance recorded. R2 also documents what it deliberately does **not** copy (terms, holidays, timetables, students). That "what it does not copy" table is the single most useful artefact to imitate, because it forces the decision to be explicit rather than accidental. Today, in Pathshala-Pro, everything not copied is copied by *omission*, and no one can see the list.

Corroborating evidence that this was intended: the i18n key `copyToNextYear` exists in all four locales with **zero** component references.

### 4.4 F1 — No pre-flight validation
R1 runs `Perform EOY Validation` as a hard gate before the batch. R3 calls for exception reports — "a student with no active enrollment, a staff member tied to no role, a record missing a required field."

**Why this is the highest-leverage missing item:** every downstream defect in this list is *cheaper to prevent than to repair*. A validation pass that refuses to run rollover when (a) students have no session for the source year, (b) a promotion rule is missing for a class, (c) the target year equals the source year, or (d) a class has no `nextClassId` would have caught C3, C4, and C8 before a single row was written.

### 4.5 E1 — No fee-balance policy at year end
R1 makes the operator choose explicitly: roll over the balance / roll over unpaid details / zero the balance. Pathshala-Pro has `carryForwardArrears` per batch invoice, which is a *billing-time* decision, not a *year-end* decision. The two are not substitutes: the former affects one voucher run, the latter defines what the institution carries into the new fiscal context.

### 4.6 A2/A3 — No current-year flag, no year lineage
R2's "set as current" clears the flag from every other year **in one transaction**. Pathshala-Pro infers currency from a date range, so two overlapping years resolve arbitrarily (`findFirst`), and there is no way to say "this is the operating year" as a deliberate act.

No `clonedFrom` means a rollover cannot be traced: given a year, you cannot tell what it was derived from or when.

### 4.7 A4 — No term/semester model
`academic-periods.ts` defines `STANDARD_ACADEMIC_TERMS`, `STANDARD_SEMESTERS`, `STANDARD_QUARTERS`, and `STANDARD_SESSIONS` as **constants**. There is no `AcademicTerm` table. R2 is blunt about the consequence: *"Add the terms to the new year. Nothing copies them, and reports and fee schedules depend on them."*

This is a structural gap with a long tail: term-scoped reporting, term-wise exams, and instalment fee schedules all need it. It is also the largest single schema change on this list, which drives its placement below.

---

## 5. Prioritisation

### 5.1 Scoring method

- **Impact (1–5):** consequence of leaving it unfixed — data corruption, silent wrong answers, blocked operations, or operator effort.
- **Feasibility (1–5):** effort within the existing architecture — schema churn, blast radius, test surface, and whether the required primitives already exist.
- **Score = Impact × Feasibility.** Higher means "high value, low resistance."
- **Wave:** P0 = correctness blockers, P1 = safety net, P2 = rollover capability, P3 = polish. Waves are sequenced by dependency, not only by score.

### 5.2 Scored register

| Ref | Gap | I | F | Score | Wave |
|---|---|---|---|---|---|
| C3 | Promotion writes `to == from`; year never advances | 5 | 5 | **25** | P0 |
| C4 | No target-year `StudentAcademicSession` | 5 | 4 | **20** | P0 |
| C5 | No graduation; final class marked `RETAINED` | 5 | 4 | **20** | P0 |
| C6 | No exit/transfer workflow at year end | 4 | 4 | **16** | P0 |
| C8 | Conditional promotion silently dropped; no re-exam flow | 4 | 4 | **16** | P0 |
| C2 | No demote path | 3 | 4 | **12** | P0 |
| F2 | Non-transactional execute; partial commits reported as failure | 5 | 4 | **20** | P1 |
| F1 | No pre-flight validation pass | 5 | 4 | **20** | P1 |
| G2 | No rollover RBAC gate; year CRUD uses generic perms | 4 | 5 | **20** | P1 |
| A2 | No explicit current-year flag | 4 | 5 | **20** | P1 |
| G3 | No audit log on year lifecycle | 3 | 5 | **15** | P1 |
| H3 | Guard not wired to `students` / `timetables` | 3 | 5 | **15** | P1 |
| D3 | `finalGpa` / `finalPercentage` never computed | 3 | 4 | **12** | P1 |
| D5 | No attendance reconciliation before close | 3 | 4 | **12** | P1 |
| D6 | No exception / hygiene report before rollover | 4 | 4 | **16** | P1 |
| B1 | No rollover wizard | 5 | 3 | **15** | P2 |
| B3 | No selective copy toggles | 5 | 3 | **15** | P2 |
| B5 | No upsert semantics for copied config | 4 | 4 | **16** | P2 |
| B9 | No dry-run / preview | 4 | 4 | **16** | P2 |
| A3 | No `clonedFrom` provenance | 2 | 5 | **10** | P2 |
| A7 | No working-day generation for new year | 3 | 4 | **12** | P2 |
| E1 | No fee-balance policy at rollover | 4 | 4 | **16** | P2 |
| E5 | No outstanding-fee write-off sweep | 3 | 4 | **12** | P2 |
| B8 | No pre-rollover checklist gating | 3 | 5 | **15** | P2 |
| B10/G5 | No rollover audit record / runbook | 2 | 5 | **10** | P2 |
| A6 | Closed years unreopenable | 3 | 4 | **12** | P3 |
| C7 | No bulk promote-all-classes | 4 | 4 | **16** | P3 |
| C12 | No rollback of a promotion run | 5 | 2 | **10** | P3 |
| E2/E3 | No year-end dues/wallet reconciliation | 3 | 3 | **9** | P3 |
| E4 | No payroll year close | 3 | 3 | **9** | P3 |
| A4 | No term/semester model | 4 | 3 | **12** | P3 |
| H4 | Year isolation leaks via profile fallback | 4 | 3 | **12** | P3 |
| H6 | Cookie-based year transport | 3 | 3 | **9** | P3 |
| G6 | No staff offboarding at year end | 2 | 3 | **6** | P3 |
| B6 | Copied config not arriving inactive | 2 | 3 | **6** | P3 |
| A8 | Ambiguous current-year resolution | 3 | 5 | **15** | P1 (folded into A2) |
| B4 | No row-level selective migration | 3 | 3 | **9** | P3 |
| G7 | No post-rollover verification checklist | 2 | 5 | **10** | P2 |
| F3 | Backup/restore path undocumented in-app | 3 | 4 | **12** | P1 |
| C10 | No execution preview | 2 | 4 | **8** | P3 |
| C11 | Re-run blocked rather than idempotent | 3 | 4 | **12** | P1 |
| C1 | Class-level rather than student-level intent | 3 | 2 | **6** | P3 |
| F5 | No undo of last rollover | 5 | 2 | **10** | P3 |
| B2 | No copy-into-existing-target mode | 3 | 4 | **12** | P2 |
| B7 | *(already compliant)* | — | — | — | — |

---

## 6. Recommended Scope for This Academic Year

**Recommendation: build Waves P0, P1, and P2 this academic year. Defer P3 entirely.**

The rationale is that P0–P2 constitute one coherent deliverable — *a safe, auditable, selective year-end* — and splitting them produces a system that can run a rollover it cannot validate, or validate a rollover it cannot execute. P3 items are either large schema changes (A4), performance work (C7), or compensating controls for risk that P0–P2 removes (C12, F5).

### Wave P0 — Progression correctness (must ship first)
*Nothing else is trustworthy until the promotion write is correct.*

1. **Explicit target-year selector** on the promotions surface; default to the next year by `startDate`; **refuse execution when target equals source**. (C3)
2. **Write the target-year `StudentAcademicSession`** — carry section/group policy, assign new roll numbers, `promotionStatus: "ENROLLED"`. (C4)
3. **Implement graduation** — introduce `GRADUATED` as a first-class action for `isFinalClass`; write both `StudentAcademicSession.promotionStatus` and `StudentProfile.status = GRADUATED`; set an exit date. (C5)
4. **Exit / transfer workflow** — `StudentStatus.TRANSFERRED` plus the existing TC template, driven from the same year-end surface. (C6)
5. **Conditional-promotion handling** — either include conditional students in the execution set or report the excluded count explicitly; surface the existing `reExam*` fields. (C8)
6. **Demote path** — extend the action enum and the rule evaluation. (C2)

### Wave P1 — Safety, validation & governance
*The net that stops P0 from being run wrongly.*

7. **Pre-flight validation pass** — a hard gate that blocks rollover when: target equals source; a class lacks a promotion rule; students have no session for the source year; a class has no `nextClassId`; duplicate/orphan enrollments exist; required demographics are missing. (F1, D6)
8. **Transactional, bulk, idempotent execute** — one `prisma.$transaction` per batch, all lookups pre-resolved in bulk (removes the N+1), `assertAcademicYearsOpen` hoisted out of the loop, and a re-runnable execution keyed on the target year. (F2, C11)
9. **Explicit `isCurrent` flag** on `AcademicYear`, switched transactionally (clears all others in one statement), with the existing date-range inference retained only as a fallback. (A2, A8)
10. **Rollover RBAC** — a dedicated `academic:rollover:execute` capability, re-validated server-side rather than hidden in the UI. (G2)
11. **Audit log on year lifecycle** — create / update / close / rollover, reusing the `AuditLog` shape already written by the historical-data console. (G3)
12. **Wire `assertAcademicYearOpen`** into `students` and `timetables`; extend to library, hostel, transport, concessions, wallet. (H3)
13. **Finalize GPA/percentage** into `StudentAcademicSession` at close, so transcripts stop being computed on demand. (D3)
14. **Attendance reconciliation report** before close. (D5)
15. **Document the backup/restore prerequisite** in-app on the rollover surface, mirroring R1's hard requirement. (F3)

### Wave P2 — The rollover wizard
*The capability the user is actually asking for, now safe to build on P0+P1.*

16. **Rollover wizard** — source year → create-new **or** copy-into-existing target. (B1, B2)
17. **Selective copy toggles** for: fee structures, promotion rules, and timetable skeleton — each independently optional. Include R2's discipline of publishing an explicit **"what will not be copied"** list (terms, holidays, students, exam sessions, fee instances). (B3)
18. **Upsert semantics with match keys** — fee structures matched on class + fee head, rules on class; re-running updates rather than duplicates. (B5)
19. **Dry-run preview** — show the exact row counts and the diff before commit. (B9)
20. **`clonedFrom` provenance** on `AcademicYear`, plus a rollover audit record. (A3, B10)
21. **Working-day generation** for the new year's date range, with holidays configured afterwards. (A7)
22. **Fee-balance policy choice at rollover** — carry balance / carry unpaid dues only / zero — recorded on the rollover record. (E1)
23. **Outstanding-fee write-off / waive sweep** as a pre-close step. (E5)
24. **Pre-rollover checklist gating** — the R2 "before you run it" list enforced as a wizard gate. (B8)
25. **Post-rollover verification checklist** — spot-check promoted records, confirm rosters, test a student and staff login. (G7)
26. **Copied configuration arrives inactive** where review is warranted, so last year's allocation cannot silently become next year's timetable input. (B6)

### 6.1 Sequencing and dependencies

```
P0  progression correctness            (no dependencies — start here)
      │
      ├──> P1  validation gate  ──┐
      │        transactional exec │   P1 depends on P0's target-year
      │        isCurrent flag     │   model being settled first
      │        RBAC + audit       │
      │        guard wiring       │
      │                           ▼
      └────────────────────> P2  rollover wizard
                                 (consumes P0's progression engine
                                  and P1's validation + audit + RBAC)
```

The one hard ordering constraint: **P0 before P2.** A rollover wizard that copies fee structures into a year students never actually enter is worse than no wizard, because it looks finished.

### 6.2 Deferred (P3) — with reasons

| Deferred item | Why it waits |
|---|---|
| A4 — Term/semester model | Largest schema change on the list; touches exams, fees, reporting, and every year-scoped query. Needs its own design cycle. Note R2's own finding that *nothing copies terms* — so the wizard can ship without it. |
| C7 — Bulk promote-all-classes | Genuine value, but a scaling feature. Class-by-class is workable for the first cycle and the N+1 fix in P1 makes it tolerable. |
| C12 / F5 — Rollback / undo | High impact, low feasibility. Correctly mitigated by P1's pre-flight gate plus the documented backup step; a true undo is a backup-restore concern, not application logic. |
| H4 — Strict isolation | Requires backfilling `StudentAcademicSession` for legacy rows first, which is a data migration, not a code change. |
| A6 — Reopen closed years | Deliberately deferred rather than half-built: R1 warns that reopening a prior year to amend grades "is a headache worth avoiding." A controlled, audited reopen belongs with the audit work — but it is not a year-end blocker. |
| E2/E3/E4 — Dues, wallet, payroll close | Real gaps, but the wallet already carries forward implicitly (year-agnostic table) and payroll close is a finance-module concern with its own owner. |
| G6 — Staff offboarding | Operationally real, low application impact. |
| B4 — Row-level selective migration | Item-type granularity (P2) covers the dominant case; per-row selection is a refinement. |
| C1 — Student-level intent | The deeper fix — storing `Next Grade Level` per student rather than deriving it from a class rule — is architecturally correct and matches R1. It is deferred only because P0's explicit target year delivers most of the benefit at a fraction of the blast radius. Flag it as the likely P3 headline item. |

### 6.3 What we should deliberately NOT copy from industry

Per the standing rule against adopting production patterns uncritically:

- **PowerSchool's irreversible multi-hour batch job (R1).** Documented as taking "up to 4 hours" and requiring a server shutdown. Correct for a district-scale install; wrong here. Our P1 design is transactional and re-runnable precisely so we do not need that escape hatch.
- **Inter-school transfer via `Next School` (R1).** Pathshala-Pro is single-institution per tenant with no multi-school model. Exit/transfer *out* (C6) is in scope; intra-district transfer is not.
- **State reporting deadlines (R3, CALPADS).** Not applicable to this market. The functional analogue is board reporting — and `board-engines/{fbise,nctb,cbse}` already exist, so board-result finalisation should hook into the P1 close sequence rather than a new subsystem.
- **Lunch-balance transaction wipe (R1).** No lunch module. `StudentWalletLedger` is already year-agnostic and carries forward correctly by construction — the correct action is to *document* that behaviour, not to rebuild it.

---

## 7. Bottom Line

The system is **strong inside a year and weak between years**. Data architecture, mark locking, and the promotion permission gate are better than the industry baseline. But the year *boundary* — which is where industry SIS products invest most of their operational design — is almost entirely unimplemented: 32 of 57 assessed capabilities are missing, and they cluster in rollover, progression, finance close, safety, and governance.

The single highest-value change is not the rollover wizard. It is **fixing the promotion write so the target year is real** (C3/C4), because every other year-boundary feature — rollover, graduation, carry-forward, validation — is meaningless while promotion writes `to == from`. The wizard is wave P2 for exactly that reason.

---

## 8. Traceability to the Current-State Audit

| This document | Prior audit |
|---|---|
| C3, C4 | G1, G2, G3 |
| C5, C6 | G4 |
| C8 | G12 |
| F1 | *(new — industry-only)* |
| F2 | G6, G19 |
| A2, A8 | *(new — industry-only)* |
| A3 | *(new — industry-only)* |
| A4 | *(new — industry-only)* |
| A6 | G7 |
| B1, B3, B8, B9, B10 | G8, G9, G14 |
| G2 | *(new — industry-only)* |
| G3 | G15 |
| H3 | G11 |
| H4 | G10 |
| C12 | G13 |
| E1, E5 | *(new — industry-only)* |
| D3, D5, D6 | *(new — industry-only)* |
| C7, C10, C11 | G20, G16, G21 |
| H6 | G17, G18 |
