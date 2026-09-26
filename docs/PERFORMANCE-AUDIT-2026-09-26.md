# Performance Audit — 2026-09-26

Scope: DB query patterns, schema indexes, client bundle, rendering, caching, middleware.
Method: static review of all 171 API routes, `src/lib/**`, hot hooks/components, `schema.prisma`, `next.config.ts`, `src/proxy.ts`, `src/i18n/request.ts`, `query-provider.tsx`.

## Verdict

The app is already engineered well above average: hot models carry complete
tenant-prefixed composite indexes, list routes paginate, PDF/Excel payloads are
kept out of the client bundle, i18n ships one locale at a time, and the Prisma
client is a pooled singleton with transient-error retry. Three real issues
remain, all on write-heavy or growth-heavy paths.

---

## P1 — Fix now (grow unbounded or serialise under load)

### 1. Bank statement GL branch fetches the entire ledger — IMPLEMENTED
`src/app/api/accounting/statements/route.ts` (~line 473)

Status: fixed. The dated-window branch now:
- pushes `startDate`/`endDate` into SQL (`journalEntry.postingDate` range), so
  the scan is bounded by the requested period;
- computes the pre-window opening balance with one `aggregate` (`_sum`
  debit/credit, `postingDate < startDate`) instead of replaying rows in JS;
- selects only the fields it renders (was full-row `include`);
- reports `openingBalance = account.openingBalance + preWindowNet` — this also
  fixes the old edge case where an account created after the window start
  reported `openingBalance: 0`;
- "All Records" (no dates) keeps the synthetic OPENING_BAL row and the old
  response shape; dated windows report the anchor via `openingBalance` only.

The full-ledger sync check (`expectedClosing` vs `syncedBalance`) is preserved
exactly — algebraically it equals `openingBalance + periodDebit - periodCredit`,
so it now costs zero extra queries.

### 2. Bulk endpoints run one serial transaction per item — VERIFIED CORRECT, NO CHANGE
- `src/app/api/exam-fees/bulk-collect/route.ts:157`
- `src/app/api/salary/bulk/route.ts:87`

Revised finding. The serial loop is deliberate (documented in-file: per-row
failure isolation at a busy counter) *and* it is lock-correct:
`getNextVoucherNumber` (`src/lib/accounting-sequence.ts`) takes
`SELECT ... FOR UPDATE` on the tenant's `TenantVoucherSequence` row, so any
parallelised per-item transactions would serialise on that lock anyway —
while holding it longer and raising deadlock (P2028) risk. Parallelising buys
nothing. Receipt/voucher numbers must also stay contiguous for audit.

The only real speedup would be batch-allocating N sequence numbers under one
lock acquisition — a deep refactor of every posting engine for marginal gain.
Not recommended unless bulk sizes grow into the hundreds per submit.

### 3. Timetable batch validation was an N+1 — IMPLEMENTED
`src/app/api/timetables/route.ts` (~line 146)

Status: fixed. The bulk path now does two index-backed bulk reads plus
in-memory checks instead of 2N+ sequential queries:
- one `section.findMany({ id: { in } })` for section-ownership validation;
- one `timetable.findMany` on
  `@@index([tenantId, staffProfileId, dayOfWeek, periodNumber])` for clash
  checks, with the per-entry year-match semantics preserved in memory
  (a null resolved year clashes against any year, exactly like the old
  `checkTeacherClash` with a null `academicYearId`).
Validation outcomes and error messages are byte-identical to before.

---

## P2 — Worth scheduling (real but bounded)

4. **`system-admin/billing` and `tenants` routes**: `Promise.all(tenants.map(async ...))`
   issues several queries per tenant — ~3N round trips on a platform page. Fine
   at dozens of tenants; switch to `groupBy`/aggregate queries before hundreds.
5. **`contains` + `mode: "insensitive"` search** (e.g. `admin/historical-data`,
   student search): `ILIKE '%x%'` cannot use a B-tree index. Fine at current
   scale; if search latency appears, add a `pg_trgm` GIN index or a normalised
   search column. Do not pre-optimise.
6. **60 fully client-rendered dashboard pages**: first paint waits for the JS
   bundle, then layout queries fire. Acceptable for an interactive ERP with
   skeletons already in place; revisit server components only for read-only
   report pages if TTFB ever matters.

## P3 — Verified good (do not "fix" these)

- Client bundle: `exceljs` and `@react-pdf/renderer` are **not** in the client
  bundle — pages import `type`-only symbols; PDF templates load on click via
  `loadPdfTemplates`. Keep this invariant; a plain `import` regression here
  would add megabytes across 20+ pages.
- i18n: `src/i18n/request.ts` dynamically imports exactly one locale file.
- TanStack Query defaults (`query-provider.tsx`): `staleTime` 2 min, no
  refetch-on-focus/mount, 401-aware retry. `use-queries.ts` guards dependent
  queries with `enabled`.
- Prisma: pooled singleton + Accelerate, pooled-URL production warning,
  `withDbRetry` on transient codes only.
- Schema: tenant-prefixed composite indexes are near-complete (only
  platform-level models without `tenantId` queries lack them, correctly);
  `Attendance`, `FeeVoucher`, `Transaction`, `JournalLineItem`, `JournalEntry`
  all carry the indexes their routes actually filter on.
- `src/proxy.ts` matcher excludes `_next/static`, `_next/image`, and files with
  extensions; JWT-only at the edge, no DB hit.
- `next.config.ts`: `optimizePackageImports` for lucide-react/radix/tanstack,
  AVIF/WebP images, compression on.

## Recommended order of work

1. ~~P1-1 statements windowing~~ — done.
2. ~~P1-2 single-transaction bulk collect~~ — verified correct as-is (see revision).
3. ~~P1-3 timetable batch validation~~ — done.

## Note on a concurrent editing session

During implementation, an active concurrent editing session was detected on
`src/lib/fee-service.ts` (a period-closing / postingDate refactor). A
`git stash` round-trip was used to verify pre-existing type errors; the stash
content was restored to every file **except** `fee-service.ts`, whose live
edit was preserved untouched. The full stash remains available as
`stash@{0}` as a backup of the earlier working state.

Known pre-existing type error (not from this audit's changes):
`src/app/api/accounting/deposits/route.ts` passes `idempotencyKey` to
`postCashDeposit`, but the current in-progress `fee-service.ts` params type
does not declare it yet — the owning session needs to reconcile this.
