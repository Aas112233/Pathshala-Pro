# Academic Year Module — Implementation Audit

**Date:** 2026-09-24
**Scope:** Data separation, year onboarding/rollover, carry-forward, selective migration, student promotion end-to-end
**Method:** Static read of schema, API routes, guards, providers, and dashboard pages. No runtime execution.

---

## 1. Executive Summary

The academic year is a **first-class, tenant-scoped entity** with a solid read-path design: a central resolver, an open/closed write guard, and year-scoped foreign keys on most operational tables. The isolation model is fundamentally sound.

However, the module is **an academic-year *container*, not an academic-year *lifecycle***. There is:

- **No rollover / year-onboarding workflow.** Creating the next year is plain CRUD; nothing is copied forward.
- **No selective migration UI or API.** Not a single endpoint accepts a "what to carry over" payload.
- **A critical defect in student promotion**: the UI writes `toAcademicYearId === fromAcademicYearId`, so executing a promotion **never advances the academic year**. The schema and API support a distinct target year; no caller ever supplies one.
- **No graduation path.** Final-class students are labelled `RETAINED`, and the documented `GRADUATED` status is never written.

Details, evidence, and remediation below.

---

## 2. How Academic Year Data Is Modelled and Separated

### 2.1 The year entity

`AcademicYear` (`src/prisma/schema.prisma:229`):

| Field | Notes |
|---|---|
| `tenantId` | Tenant scope |
| `yearId` | Human code, unique per tenant (`@@unique([tenantId, yearId])`) |
| `label` | Display label, e.g. "2026-2027" |
| `startDate` / `endDate` | Date range; drives "current year" detection |
| `isClosed` | Soft lock; default `false` |
| `createdAt` / `updatedAt` | Audit timestamps |

**There is no self-referencing link.** No `previousYearId` / `nextYearId`. Years are a flat list ordered by `startDate`. Traversing history is only possible indirectly through `ClassPromotion.fromAcademicYearId` / `toAcademicYearId`.

### 2.2 What is year-scoped

Tables carrying an `academicYearId` FK (14):

`FeeVoucher`, `SalaryLedger`, `ExamResult`, `Exam`, `PromotionRule`, `ClassFeeStructure`, `ClassPromotion` (twice — from/to), `Timetable`, `StudentAcademicSession`, `TeacherSubstitution`, `AcademicHoliday`, `AdmissionApplication`, `QuestionPaper`, `Attendance`.

### 2.3 The dual-placement model (important)

Placement is stored in **two places**:

1. **`StudentProfile.classId / sectionId / groupId / rollNumber`** — a *single, mutable* "current" placement. Not year-scoped.
2. **`StudentAcademicSession`** — the *year-scoped snapshot*, unique on `(tenantId, studentProfileId, academicYearId)`, with `promotionStatus`, `finalGpa`, `finalPercentage`, `snapshot` JSON.

The read path prefers the session and falls back to the profile (`src/app/api/students/route.ts:209-223`):

```ts
const session = s.academicSessions?.[0];
if (!session) return s;                      // no session -> raw profile row
return { ...s, rollNumber: session.rollNumber || s.rollNumber,
              classId: session.classId || s.classId, /* ... */ };
```

**Consequence:** a student with no session row for the selected year is returned using their *live* profile placement. The year filter is therefore **not strict** — see §6.4.

### 2.4 How the active year is resolved

`resolveRequestAcademicYearId` (`src/lib/academic-year-guards.ts:73`) resolves in strict priority:

1. `?academicYearId=` query param
2. `x-academic-year-id` header
3. `pathshala_academic_year` cookie
4. DB: open year whose `startDate <= now <= endDate`
5. DB: latest open year by `startDate`
6. DB: latest year of any status

Result is memoised per tenant for 60s (`defaultAcademicYearCache`, disabled under `NODE_ENV=test`).

Client side, `AcademicYearProvider` (`src/components/providers/academic-year-provider.tsx`) fetches `/api/academic-years?limit=100`, persists the selection to `localStorage` (`academic_year_${tenantId}`) **and** the cookie, and on switch invalidates `students`, `fees`, `exams`, `dashboard`, `timetables`, `attendance`, `class-fee-structures`.

**Gap:** the client fetches at most 100 years and **never passes `academicYearId` to most list hooks** — the cookie is the de-facto transport. The `useStudents` hook (`src/hooks/use-queries.ts:189`) accepts no `academicYearId` param at all. Cookie-based propagation is fragile: it breaks in any non-browser caller (server components, jobs, exports) and silently mis-scopes if the cookie is stale.

### 2.5 Which modules are actually year-aware

Only these API routes consume the resolver and/or the guard:

| Route | Resolves year | Enforces `isClosed` |
|---|---|---|
| `attendance` | yes | yes |
| `exams`, `exams/[id]` | yes | yes |
| `fees`, `fees/[id]`, `fees/batch`, `fees/collect-direct` | yes | yes |
| `salary`, `salary/bulk` | no (explicit param) | yes |
| `students`, `students/[id]` | yes | no |
| `timetables` | yes | no |
| `dashboard/summary` | yes | n/a (read) |
| `exam-results/[id]` | no | yes |

**Gap:** `students` and `timetables` resolve the year but **never call `assertAcademicYearOpen`**, so writes into a closed year are still possible through those routes. Modules with year-scoped data but no guard wiring at all include library, hostel, transport, concessions, and wallet.

---

## 3. Onboarding / Rollover Into the Next Academic Year

### 3.1 What "onboarding" means today

Onboarding exists only at the **tenant level**, not the year level. `src/lib/tenant-provisioning.ts` seeds, for a **single** academic year:

- `seedTenantPromotionRules` (`:212`) — one rule per class, chained via `nextClassId`, terminal class gets `nextClassId: null`
- `seedTenantGroups` (`:247`)
- `seedTenantClassFeeStructures` (`:296`) — fee rows bound to that one `academicYearId`

### 3.2 There is no year rollover

There is **no wizard, endpoint, or service** that takes an existing year and produces the next one. The only mechanism is manual CRUD on `/academic-year` (`src/app/(dashboard)/academic-year/page.tsx`): create a row with `yearId`, `label`, `startDate`, `endDate`.

Nothing is seeded or copied when a year is created. The `POST /api/academic-years` handler (`src/app/api/academic-years/route.ts:151`) writes exactly one row and returns.

### 3.3 Dead code evidence of an abandoned feature

The i18n key `copyToNextYear` — *"Copy to next year"* — exists in all four locales (`en/hi/ur/bn` `.json`, line 3589):

```json
"copyToNextYear": "Copy to next year",
```

A repo-wide search for `copyToNextYear` across all `.tsx` files returns **zero matches**. The string is orphaned: the copy-forward feature was planned and never built.

---

## 4. What Actually Carries Into the Next Academic Year

| Domain | Carries forward? | Mechanism |
|---|---|---|
| Classes, Sections, Groups, Subjects, ClassSubject | **Yes, implicitly** | Year-agnostic tables; one global set |
| `StudentProfile` identity (name, guardian, DOB) | **Yes** | Row persists |
| Student class placement | **Mutated in place** | `classId` overwritten on promotion |
| `StudentAcademicSession` for the new year | **No** | Only the *from* year is upserted |
| `ClassFeeStructure` | **No** | Per-year rows; must be re-entered by hand |
| `PromotionRule` | **No** | Per-year rows; must be re-created by hand |
| `Timetable` | **No** | Per-year rows |
| `AcademicHoliday` | **No** | Per-year rows |
| `TeacherSubstitution` | **No** | Per-year rows |
| Exam results, attendance, fee vouchers | **No (correct)** | Remain in the closed year |

The practical result: **every new session starts as an empty shell.** Fee structures and promotion rules — the two things that must exist before the year is usable — have to be manually re-created per class, per year.

---

## 5. Selective Migration (Choosing What to Carry Over)

**Not supported. At any layer.**

- No API endpoint accepts a carry-forward payload.
- No UI offers item selection for migration.
- `ClassFeeStructure` has no duplicate/copy route (`/api/fees/structures` is plain CRUD).
- `PromotionRule` has no copy route (`/api/promotion-rules` is plain CRUD); the only derived flag is `isLocked` / `historicalPromotionCount` (`src/app/api/promotion-rules/route.ts:78-101`).
- The promotions calculator's only "selection" is implicit: it filters to `eligible && action === "PROMOTED"` before submitting. Students cannot be individually excluded from that set.

---

## 6. Student Promotion End-to-End

### 6.1 The intended flow

1. **Rules** — `/promotions/rules` → `POST /api/promotion-rules`. One rule per `(classId, academicYearId)`, unique-constrained. Validates `nextClass.classNumber > class.classNumber` (`src/app/api/promotion-rules/route.ts:162`). Auto-seeded at provisioning.
2. **Calculate** — `/promotions/calculate` → `GET /api/promotions/calculate?classId&academicYearId`. Loads active students of the class, pulls their `ExamResult` for that year, takes the **latest result per subject**, and computes eligibility.
3. **Execute** — `POST /api/promotions/execute` with an array. Per student: validates the student, `fromClass` matches the student's live class, both years exist and are open, `toClass` exists, no duplicate promotion. Creates `ClassPromotion`, upserts `StudentAcademicSession` for the **from** year, locks all that student's `ExamResult` for that year, and moves `StudentProfile.classId` to `toClassId`.

### 6.2 CRITICAL — promotion never advances the academic year

`src/app/(dashboard)/promotions/calculate/page.tsx:165-168`:

```ts
return {
  studentProfileId,
  fromAcademicYearId: selectedYear,
  toAcademicYearId: selectedYear,   // <-- identical to fromAcademicYearId
  fromClassId,
  toClassId,
  status: "PROMOTED" as const,
  reason: t("promotionReason", { ... }),
};
```

`selectedYear` is assigned to **both** fields. A repo-wide search for `toAcademicYearId` across every `.tsx` returns **exactly one hit — these two lines.** No UI ever supplies a distinct target year.

**Impact:**

- Every `ClassPromotion` row records `from == to`. The "year-over-year" record is factually wrong.
- No `StudentAcademicSession` is created for the target year (`src/app/api/promotions/execute/route.ts:228` upserts only `resolvedFromAcademicYearId`).
- Students' `classId` is bumped, but they hold **no session for the new year** — they surface in the new year only via the profile fallback (§2.3), which is precisely the path that defeats year isolation.
- The `@@unique([tenantId, studentProfileId, fromAcademicYearId])` constraint means a student can be "promoted" **once per year only**, and re-running for the same year is rejected as a duplicate.

The backend is capable of the correct behaviour — `ClassPromotion` has distinct `from`/`to` FKs, the executor validates both, and `assertAcademicYearsOpen` checks both. The defect is entirely in the caller: **there is no target-year selector in the UI.**

### 6.3 CRITICAL — no graduation; final class is mislabelled

`src/app/api/promotions/calculate/route.ts:98, 203-206`:

```ts
const isFinalClass = !promotionRule.nextClassId;
// ...
if (isFinalClass) {
  action = "RETAINED";
  reasons.push("Final class - No promotion needed");
}
```

Students in the top class are reported as **RETAINED** (i.e. repeating the grade) with a contradictory reason. Meanwhile the schema documents a graduation state that is never produced:

```prisma
promotionStatus  String // PROMOTED | RETAINED | CONDITIONAL | GRADUATED
```

`GRADUATED` is never written anywhere in the codebase. Graduating cohorts therefore never leave the active roster, are never marked as alumni, and inflate "enrolled" counts.

### 6.4 Criteria that are displayed but never evaluated

The calculator UI renders four thresholds (`src/app/(dashboard)/promotions/calculate/page.tsx:512-537`): `minimumAttendance`, `minimumOverallPercentage`, `minimumPerSubject`, `maxFailedSubjects`.

Only two are enforced in `calculate`:

| Threshold | Configured | Enforced in `calculate` | Notes |
|---|---|---|---|
| `maxFailedSubjects` | yes | **yes** (`:177`) | |
| `minimumOverallPercentage` | yes | **yes** (`:194`) | |
| `minimumPerSubject` | yes | **no** | Returned in the payload, never compared |
| `minimumAttendance` | yes | **no** | Returned in the payload, never compared; no `Attendance` query is issued |
| `autoPromote` | yes | **no** | Field exists on the model; unused in calculate and execute |

An institute that sets "minimum 75% attendance" gets a UI that displays it and a calculation that ignores it. This is a silent correctness failure, not a cosmetic one.

### 6.5 Conditional promotion is a dead end

`calculate` can return `action: "CONDITIONAL_PROMOTED"` with `reExamAllowed: true`. The execute handler only submits students passing this filter (`page.tsx:137-139`):

```ts
const eligibleStudents = calcData.students.filter(
  (s: any) => s.eligible && s.action === "PROMOTED"
);
```

`CONDITIONAL_PROMOTED` students are **silently dropped** — they are not promoted, not retained, not flagged, and no toast reports the omission. The `reExamRequired` / `reExamCompleted` / `reExamPassed` columns exist on `ClassPromotion` with no UI or API to drive them.

### 6.6 Execute is non-transactional and non-atomic

`src/app/api/promotions/execute/route.ts:39-287` loops over the batch performing, per student, six-plus independent `prisma` calls with **no `$transaction`**: 5 lookups, `classPromotion.create`, `studentAcademicSession.upsert`, `examResult.updateMany`, `studentProfile.update`.

Two concrete failure modes:

1. **Partial commit with failure response.** Errors are accumulated; if any exist, the handler returns `validationError(errors)` (`:289-291`) — but every prior student in the loop is **already committed**. The client sees a failure while the database holds partial promotions.
2. **No rollback on mid-loop crash.** A failure between `classPromotion.create` and `studentProfile.update` leaves the promotion recorded but the student still in the old class.

Additionally, `assertAcademicYearsOpen` is called **inside** the loop (`:145`) — once per student — rather than once for the batch.

Performance: for a 300-student class this is roughly 1,800 sequential round-trips. There is no bulk path.

### 6.7 Promotion is effectively irreversible

- The `isLocked` flag is written to `ExamResult` (`:264-273`) and independently enforced on the exam-result write path (`src/app/api/exam-results/[id]/route.ts:116, 120-136`), which self-heals the flag even for legacy rows. Good.
- **But there is no undo for the promotion itself.** The historical-data console (`src/app/api/admin/historical-data/route.ts`) can PATCH a `ClassPromotion`'s `status` — yet that handler (`:325-346`) updates only the promotion row. It does **not** revert `StudentProfile.classId`, and it does **not** unlock `ExamResult.isLocked`. Reverting a promotion leaves the student physically in the advanced class with locked marks: a deeper inconsistency than before the "fix".

### 6.8 Retained and re-run behaviour

- Retained students get a `StudentAcademicSession` upsert for the **from** year with `promotionStatus: "RETAINED"` — but since the UI sets `from == to`, they never receive a session for the following year.
- The class-match guard compares against the student's **live** `StudentProfile.classId` (`:97`). After a successful run the profile class has already advanced, so any second attempt for the same year fails the mismatch check *and* the duplicate check.

---

## 7. Year Lifecycle — Closing and Reopening

### 7.1 Closing is a one-way door

`PUT /api/academic-years/[id]` (`src/app/api/academic-years/[id]/route.ts:135-147`):

```ts
if (existingYear.isClosed) {
  return integrityViolation(
    lockedUpdateMessage("Academic year", "it has already been closed"), ...);
}
```

This check runs **before** the payload is inspected. Because `isClosed` can only be set via this same endpoint, **a closed year can never be reopened through the API.** The code comment acknowledges this: *"Reopen support should be a separate controlled workflow if needed"* — that workflow does not exist. Reopening requires direct database access.

Note also that `isClosed` is deliberately excluded from the frozen-field list (`:151`), so it *can* be toggled while open — the asymmetry is that closing is permanent.

### 7.2 Closing performs no archival work

Setting `isClosed = true` does not lock anything, snapshot anything, or compute final GPAs. It is purely a flag consulted by `assertAcademicYearOpen`. Any write path that does not call that guard (§2.5) continues to write into the "closed" year.

### 7.3 Deletion is effectively impossible after first use

`DELETE` blocks on any of 13 dependency counters (`src/lib/data-integrity.ts:103-137`), including `studentAcademicSession`, `holidays`, and `admissions`. In practice a year becomes undeletable the moment a single record exists. There is **no archive/hide concept** — only `isClosed`, which is permanent. A mis-created year is therefore permanent clutter.

### 7.4 Frozen-field editing is inconsistent with the UI

Once usage exists, `yearId`, `label`, `startDate`, `endDate` are frozen (`:149-166`). The UI still renders an editable form for every field and surfaces the rejection only as a toast (`page.tsx:142-144`) after submission. There is no disabled state, no lock indicator, and no explanation before the user invests effort in an edit.

### 7.5 No audit trail on year lifecycle

Creating, editing, or closing an academic year writes **no** `AuditLog` row. Contrast the historical-data override path, which logs `previous` and `updated` payloads with a mandatory justification. Closing a year — the single most consequential lifecycle action — is unattributed.

---

## 8. Gap Register

| # | Severity | Finding | Location |
|---|---|---|---|
| G1 | **Critical** | Promotion writes `toAcademicYearId === fromAcademicYearId`; the year never advances | `promotions/calculate/page.tsx:167-168` |
| G2 | **Critical** | No target-academic-year selector anywhere in the promotions UI | repo-wide (`toAcademicYearId` in `.tsx`) |
| G3 | **Critical** | No `StudentAcademicSession` created for the target year on promotion | `promotions/execute/route.ts:228` |
| G4 | **High** | Final-class students marked `RETAINED`, never `GRADUATED` | `promotions/calculate/route.ts:203-206` |
| G5 | **High** | `minimumAttendance` and `minimumPerSubject` displayed but never evaluated | `promotions/calculate/route.ts:177-200` |
| G6 | **High** | Execute is non-transactional; partial commits returned as failures | `promotions/execute/route.ts:39-291` |
| G7 | **High** | Closed years cannot be reopened via API; closing is permanent | `academic-years/[id]/route.ts:135-147` |
| G8 | **High** | No rollover/onboarding for a new year; nothing copied forward | module-wide |
| G9 | **High** | No selective migration capability at any layer | module-wide |
| G10 | **Medium** | Year isolation leaks: students GET falls back to live `StudentProfile.classId` | `students/route.ts:95-113, 209-223` |
| G11 | **Medium** | `students` and `timetables` resolve the year but skip `assertAcademicYearOpen` | route files |
| G12 | **Medium** | `CONDITIONAL_PROMOTED` students silently dropped at execution | `promotions/calculate/page.tsx:137-139` |
| G13 | **Medium** | Historical-data override of a promotion does not revert class or unlock marks | `admin/historical-data/route.ts:325-346` |
| G14 | **Medium** | Orphaned `copyToNextYear` i18n key — planned feature never built | `messages/*.json:3589` |
| G15 | **Medium** | Year create/edit/close writes no audit log | `academic-years/**` |
| G16 | **Low** | `autoPromote` model field is unused | `schema.prisma:783` |
| G17 | **Low** | Year selection transported by cookie; `useStudents` cannot accept an explicit year | `academic-year-provider.tsx:89`, `use-queries.ts:189` |
| G18 | **Low** | Provider caps at 100 years and has no pagination | `academic-year-provider.tsx:62` |
| G19 | **Low** | N+1 query pattern in promotion execute (~6 round-trips per student) | `promotions/execute/route.ts:39-287` |
| G20 | **Low** | No bulk "promote all classes" operation; strictly class-by-class | `promotions/calculate` |
| G21 | **Low** | Frozen-field violations surface only post-submit; no pre-emptive UI lock | `academic-year/page.tsx:142-144` |

---

## 9. Recommended Remediation Order

**Phase 1 — correctness of the promotion write (G1, G2, G3, G4, G5, G6, G12)**
1. Add an explicit **target academic year** selector to the promotions calculator; default to the next year by `startDate`, and refuse execution when target equals source.
2. On execute, create the `StudentAcademicSession` for the **target** year (carrying section/group policy, new roll number, `promotionStatus: "ENROLLED"`), in addition to snapshotting the source year.
3. Introduce a `GRADUATED` action for `isFinalClass`; write `promotionStatus: "GRADUATED"` and transition the student out of the active roster.
4. Evaluate `minimumAttendance` (join `Attendance`) and `minimumPerSubject`; or remove them from the UI until implemented.
5. Wrap the batch in a single `prisma.$transaction`, hoist `assertAcademicYearsOpen` out of the loop, and pre-resolve all lookups in bulk.
6. Surface `CONDITIONAL_PROMOTED` in the execution set (or explicitly report the excluded count).

**Phase 2 — year lifecycle (G7, G8, G15, G21)**
7. Build a **Year Rollover** workflow: select source year, target year, and the items to carry (`ClassFeeStructure`, `PromotionRule`, `Timetable`, `AcademicHoliday`), with per-item selection. This closes G8, G9, and G14 together.
8. Add a controlled, permissioned, audited **reopen** path for closed years.
9. Write `AuditLog` entries for year create / update / close.
10. Reflect frozen-field state in the UI before submit.

**Phase 3 — isolation hardening (G10, G11, G13, G16, G17)**
11. Make the students list year-strict: drop the profile-class fallback for year-scoped queries, or backfill `StudentAcademicSession` for legacy rows and then remove it.
12. Wire `assertAcademicYearOpen` into `students` and `timetables`; extend to library, hostel, transport, concessions, wallet.
13. Make historical-data promotion overrides reversible end-to-end (revert class, unlock marks) or explicitly block status changes that would desync.
14. Either implement or remove `autoPromote`.
15. Pass `academicYearId` explicitly from hooks instead of relying on the cookie.

---

## 10. Files Reviewed

| Path | Role |
|---|---|
| `src/prisma/schema.prisma` | `AcademicYear`, `StudentAcademicSession`, `ClassPromotion`, `PromotionRule`, `ClassFeeStructure`, `Class`, `StudentProfile` |
| `src/lib/academic-year-guards.ts` | Resolver, open/closed guards, session upsert |
| `src/lib/academic-periods.ts` | Label generation, current-year detection, term constants |
| `src/lib/data-integrity.ts` | Usage counters, locked-field helpers |
| `src/lib/tenant-provisioning.ts` | Tenant onboarding seeders (promotion rules, fee structures) |
| `src/app/api/academic-years/route.ts` | Year list / create |
| `src/app/api/academic-years/[id]/route.ts` | Year read / update / delete, frozen fields |
| `src/app/api/promotions/calculate/route.ts` | Eligibility engine |
| `src/app/api/promotions/execute/route.ts` | Promotion write path |
| `src/app/api/promotion-rules/route.ts` | Rule CRUD + historical lock |
| `src/app/api/admin/historical-data/route.ts` | Historical override console |
| `src/app/api/students/route.ts`, `students/[id]/route.ts` | Year-scoped roster + session writes |
| `src/app/api/exam-results/[id]/route.ts` | Mark lock enforcement |
| `src/components/providers/academic-year-provider.tsx` | Client year context |
| `src/components/layout/academic-year-selector.tsx` | Header switcher |
| `src/app/(dashboard)/academic-year/page.tsx` | Year CRUD UI |
| `src/app/(dashboard)/promotions/calculate/page.tsx` | Promotion calculator UI |
| `src/lib/academic-year-isolation.test.ts`, `src/lib/promotion-exam-lock.test.ts` | Existing coverage |
| `src/messages/{en,hi,ur,bn}.json` | Orphaned `copyToNextYear` key |

**Test coverage note:** the two existing suites test the resolver priority chain, the open/closed guards, session upsert semantics, and mark locking. **No test covers `toAcademicYearId !== fromAcademicYearId`** — which is why G1 survived. Any remediation should add that case first.
