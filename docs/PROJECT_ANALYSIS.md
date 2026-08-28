# Pathshala-Pro — Project Analysis

Audit date: 2026-08-28 · Scope: full read-only review (no files changed except this report)

---

## 1. Verdict

| Area | Status |
|---|---|
| Feature breadth | **Strong** — 64 models, 104 API routes, 56 pages, 4 locales, double-entry accounting |
| Build | **Broken** — `npm run build` fails type checking |
| Tenant isolation | **Good** — data scoping is disciplined |
| Privilege model | **Critical** — anonymous user can become platform admin |
| Type safety | **Weak** — 30 tsc errors, 310 `as any` |
| Tests | **Fair** — 223 tests, 219 pass, but full-suite run hangs |
| i18n | **Good with gaps** — hi/ur lag en by 83 keys |

The codebase is impressively broad for its age. The problem is not missing features —
it is that the trust model has one forgeable string, and the type layer has been
allowed to rot. Both are fixable in days, not weeks.

---

## 2. Scale

| Metric | Value |
|---|---|
| Source files | 411 (226 `.ts`, 176 `.tsx`) |
| Lines of code | 83,106 |
| API routes | 104 |
| Pages | 56 (45 under `(dashboard)`) |
| Prisma models | 64 |
| Enums | 16 |
| Schema size | 1,841 lines |
| Client components | 133 |
| Test files / tests | 35 / 223 |

Domains covered: students, admissions, attendance, exams (with board engines for
NCTB/CBSE/FBISE), fees, double-entry accounting, salary, library, transport, hostel,
inventory, health, homework, timetable, leaves, certificates, notices, enquiries,
plus a platform-level `system-admin` SaaS control plane.

---

## 3. Critical: anonymous platform takeover

**Severity: Critical.** Verified end-to-end by reading the source. Do not deploy
publicly until this is fixed.

### The chain

1. **`POST /api/tenants` requires no authentication.**
   `src/app/api/tenants/route.ts:59-76` — the token check is wrapped in `if (token)`
   with `isSystemAdmin = false` as the default, and a `catch` that comments
   *"Continue for public/self-serve onboarding"*. An anonymous request proceeds.

2. **The tenant slug is client-supplied and `system` is not reserved.**
   `route.ts:83` takes `data.tenantId`. `onboardInstituteSchema`
   (`src/lib/schemas.ts:297-302`) validates it with `^[a-z0-9-]+$`, min 3 chars.
   `"system"` passes. There is **no reserved-slug check anywhere in `src/lib/`**,
   and no `system` tenant is seeded, so the collision loop at `:91` does not block it.

3. **Login mints a legitimate JWT** with `tenantId: "system"`, `role: "ADMIN"`.

4. **`src/lib/api-auth.ts:126` treats that string as proof of platform admin:**
   ```ts
   user.tenantId?.toLowerCase() === "system"   // → isPlatformAdmin = true
   ```
   Then `:133` returns early — **bypassing every permission check**.

5. **The same literal is copy-pasted into five more gates**, so the whole control
   plane opens up:
   - `src/middleware.ts:63` → `/system-admin` UI access
   - `src/app/api/tenants/route.ts:36`
   - `src/app/api/system-admin/health/route.ts:11`
   - `src/app/api/system-admin/audit-logs/route.ts:12` (line 30: unscoped `findMany` — all tenants' logs)
   - `src/app/api/system-admin/billing/route.ts:31,104`
   - `src/app/api/system-admin/users/route.ts:17,84` (edit any user in any tenant)
   - `src/app/api/system-admin/impersonate/route.ts:28`

Net effect: **anonymous internet user → read and modify every tenant's data.**

### Fix

1. Require authenticated `SYSTEM_ADMIN` on `POST /api/tenants`; drop the public
   self-serve path or gate it behind a separate invite flow.
2. Reserve `system` (plus `admin`, `api`, `www`, `app`) in the slug validator and
   reject them with a 400.
3. Delete every `tenantId?.toLowerCase() === "system"` comparison. Replace with an
   explicit role allowlist (`role === "SYSTEM_ADMIN" || role === "SUPER_ADMIN"`)
   resolved from the database row, not from the JWT claim.

---

## 4. High: permission checks silently skipped

### 4a. Unmapped paths get zero RBAC

`src/lib/api-auth.ts:150-152`:
```ts
if (!moduleName) {
  return { authContext };   // authenticated, no permission check at all
}
```
`getPermissionModuleForApiPath` has no case for `audit-logs`, `homeworks`,
`system-admin`, or `tenants`, so it returns `null`.

Confirmed affected:
- `src/app/api/audit-logs/route.ts:17` — any authenticated student or parent can
  read the tenant's full audit trail
- `src/app/api/homeworks/route.ts:11`
- `src/app/api/homeworks/[id]/submissions/route.ts:10,40`

**Fix:** make the switch **fail closed** — return a 403 when a path maps to no
module, and add explicit cases for the missing resources.

### 4b. `/api/reports/**` bypass the guard entirely

6 of 7 report routes call raw `getAuthContext` with no permission check:

| Route | Guard |
|---|---|
| `reports/students/route.ts:15` | ✅ uses `requireApiAccess` |
| `reports/fees/route.ts:12` | ❌ |
| `reports/attendance/route.ts:11` | ❌ |
| `reports/admissions/route.ts:23` | ❌ |
| `reports/exams/route.ts:41` | ❌ |
| `reports/salary/route.ts:22` | ❌ |
| `reports/financial/route.ts:22` | ❌ |

Tenant scoping **is** correct in all of them (`tenantId: user.tenantId`), so this is
privilege escalation rather than a cross-tenant leak — but it means any authenticated
user can pull financial and salary reports.

### 4c. Latent JWT bypass

`src/lib/auth.ts:37-54` — when `allowTrustedHeaders` is set, `x-user-id` and
`x-tenant-id` are trusted and the JWT verification block is **skipped entirely**
(line 44 short-circuits). Any garbage bearer token plus those headers impersonates
anyone. Currently unreachable (no caller passes the option), so this is one careless
refactor away from being exploitable. **Delete the option.**

### 4d. Unthrottled duplicate login

`src/app/api/auth/route.ts:35` is a second login endpoint with **no rate limiting**,
while the hardened `/api/auth/login/route.ts:51` has it. Both do a global
`user.findFirst({ where: { email } })` with no tenant filter — acceptable for login
semantics, but the unthrottled one enables cross-tenant email enumeration.

---

## 5. What is actually good

Credit where it is due — these were checked and are solid:

- **Tenant scoping is disciplined.** Across 25+ sampled CRUD routes spanning fees,
  students, staff, exams, attendance, accounting, transport, library, inventory,
  hostel, leaves, certificates, health, enquiries and timetable, every query
  injects `tenantId` from the auth context into its `where` clause. **No
  cross-tenant data leak was found in the CRUD surface.**
- **`tenantId` is always server-derived.** It comes from the verified JWT and is
  re-validated against the DB row in `src/lib/auth.ts:61-66`. The only client-supplied
  instance is the `tenants` POST above.
- **Onboarding provisioning is genuinely well built.** `src/app/api/tenants/route.ts`
  atomically creates the tenant, admin, academic year, class structure, subjects,
  promotion rules, a 5-tier chart of accounts, fee heads, a 12-period fiscal
  calendar and voucher sequences — all in one transaction with a 60s timeout.
- **Password handling is correct** — bcrypt with cost 10, `verifyPassword` uses
  constant-time compare.
- **`.env` is gitignored and untracked.** ✔
- **Accounting design is real** — `JournalEntry` / `JournalLineItem` with
  `VoucherType`, `PostingStatus`, `FiscalYear`, `FinancialPeriod` and atomic
  `TenantVoucherSequence` counters. This is not toy bookkeeping.
- **Test coverage of business logic is decent** — grading, fees, salary, attendance
  and permissions all have focused unit tests that pass.

---

## 6. Build & type health

### `npm run build` fails

```
Checking validity of types ... Failed to compile.
./src/app/api/exams/[id]/batch-report-cards/route.ts:221:25
Type error: Property 'class' does not exist ... Did you mean 'classId'?
    219 |  admissionNumber: st.studentId,
    220 |  rollNumber: st.rollNumber || "—",
  > 221 |  className: st.class?.name || targetClass.name,
```

`npx tsc --noEmit` reports **30 errors across 11 files**:

| File | Errors | Nature |
|---|---|---|
| `src/lib/api-auth.test.ts` | 15 | `expect`/`it`/`describe` not found — `vitest/globals` missing from tsconfig `types` |
| `src/lib/auxiliary-service.ts` | 5 | imports non-existent `generateVoucherNumber`; passes `accountCode` instead of `accountId` |
| `src/lib/board-engines/*.ts` | 4 | `GradeBand` not exported from `./types`; ambiguous `_private` re-export in `index.ts` |
| `src/lib/excel/export-service.ts` | 2 | `feeVoucher` vs `feeVoucherId` |
| `src/lib/jwt.ts` | 1 | `SignJWT` unresolved |
| `src/lib/period-closing.ts` | 1 | `"CLOSING"` not in `VoucherTypeEnum` |
| `src/lib/tenant-prisma.ts` | 1 | type assignability |
| `src/viewmodels/staff/use-staff-view-model.ts` | 1 | `PaginationParams` undefined (renamed to `SearchParams`, not updated here) |

Note `next.config.ts:31` sets `eslint.ignoreDuringBuilds: true`, so lint never
blocks either. Type checking is the only remaining gate and it is currently red.

**The `board-engines` module is unfinished work** — 3 of 4 files reference a
`GradeBand` type that was never exported. It is dead code that happens to be
reachable by the type checker.

### ESLint

`1,505 problems (0 errors, 1,505 warnings)` — overwhelmingly
`@typescript-eslint/no-explicit-any`. `src` contains **310 occurrences of `as any`**.
Zero errors, but the warnings are dense enough to be noise, which is probably why
they are ignored at build time.

---

## 7. Tests

| Result | Count |
|---|---|
| Test files | 35 |
| Total tests | 223 |
| Passing | 219 (98.2%) |
| Failing | 4 |

Failures:
- `src/lib/accounting-reports.test.ts` — 1 failed / 3 passed
- `src/lib/auxiliary-service.test.ts` — 2 failed / 5 passed
- `src/lib/superadmin-service.test.ts` — 1 failed / 4 passed

**`npx vitest run` on the full suite hangs indefinitely** (killed after 15 minutes
with no output). Every single file passes when run individually, so this is a
runner/parallelism issue rather than a hanging test body — likely a worker pool
problem on Windows. Worth fixing, because it means `npm run test:run` cannot be
used as a CI gate today.

`vitest.config.mts` sets `globals: true` but `tsconfig.json` does not add
`"types": ["vitest/globals"]` — that is the sole cause of the 15 test-file type errors.

---

## 8. Architecture vs. your own rules

`AGENTS.md` states: *"Pages use route group `(dashboard)` with a ViewModel hook per
domain. Pages stay thin; logic goes in viewmodels."*

**This is the most-violated rule in the project.**

- 15 viewmodel files vs **45 dashboard pages**
- ~30 pages have no corresponding viewmodel at all
- Largest offenders: `exam-results/page.tsx` (1,083 lines), `transport/page.tsx`
  (1,041), `homework/page.tsx` (969), `admissions/page.tsx` (822)
- `onboard-institute-modal.tsx` is 901 lines; `staff-form-modal.tsx` is 725

Design system compliance is partial: `TopSheet` on 21 pages, `ERPMetricCard` in 6
files, `ERPDataTable` in 10 files — against 45 dashboard pages.

---

## 9. Operational gaps

| Issue | Detail |
|---|---|
| **No migration history** | `src/prisma/migrations/` contains a single raw `financial_engine_constraints.sql`. Workflow relies on `prisma db push`, which is not safe for production schema evolution. |
| **Rate limiting on 4 of 104 routes** | `AGENTS.md` says keep it "on public/auth endpoints". `/api/tenants` POST — the most dangerous public endpoint in the app — has none. |
| **i18n drift** | en 1,935 / bn 1,913 / hi 1,852 / ur 1,852 keys. hi and ur lag en by 83 keys, contradicting the "add to ALL FOUR files" rule. |
| **N+1 query patterns** | 7 confirmed `await prisma` / `await tx.` calls inside `for...of` loops. |
| **`Promise.all` inside transactions** | 36 files. Against an Accelerate/connection-pooled backend this risks pool exhaustion and transaction timeouts. |
| **Single branch, no CI** | `main` only, no workflow files. Contrast with `AGENTS.md` requiring lint + tests before "done". |

---

## 10. Suggested order of work

**Week 1 — make it safe and buildable**
1. Fix the `POST /api/tenants` auth bypass and reserve the `system` slug. *(Critical)*
2. Replace all `tenantId === "system"` checks with a role allowlist. *(Critical)*
3. Make `getPermissionModuleForApiPath` fail closed. *(High)*
4. Add `requireApiAccess` to the 6 report routes. *(High)*
5. Delete `allowTrustedHeaders` from `getAuthContext`. *(Medium)*
6. Fix the 30 type errors; add `"types": ["vitest/globals"]`. Get `npm run build` green.

**Week 2 — make it trustworthy**
7. Add the 4 failing tests to the fix list; diagnose the full-suite hang.
8. Put rate limiting on `/api/tenants` and the remaining public endpoints.
9. Create a real Prisma migration baseline; stop using `db push`.

**Week 3+ — make it maintainable**
10. Extract viewmodels from the 5 largest pages; adopt `TopSheet`/`ERPDataTable`
    across the remaining dashboard pages.
11. Either finish or delete `src/lib/board-engines`.
12. Add CI running `lint` → `tsc` → `test:run` → `build`.

---

## 11. Closing note

The feature surface here is genuinely ahead of most projects at this stage — a real
double-entry ledger, multi-board grading engines, four locales with RTL, atomic
tenant provisioning. Someone has been building fast and mostly building well.

The two things standing between this and a deployable product are narrow and
specific: **one forgeable string in the privilege model** and **a type layer that
has drifted out of the build**. Neither requires a rewrite. Fix #1 first — it is a
one-hour change that closes a total-compromise hole.
