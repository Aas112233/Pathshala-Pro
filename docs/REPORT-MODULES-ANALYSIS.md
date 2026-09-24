# Report Modules — Current State, Gap Analysis & Target Architecture

**Status:** Read-only architectural assessment (no source files modified)
**Date:** 2026-09-24
**Audience:** Engineering + Product
**Verification basis:** direct source inspection — every claim below carries a file path and line reference.

---

## 1. Scope & Method

This document assesses the reporting surface of Pathshala-Pro end to end:

| Layer | Inspected |
|---|---|
| Hub | `src/app/(dashboard)/reports/page.tsx` |
| Report screens | 7 × `src/app/(dashboard)/reports/*/page.tsx` |
| Shared primitives | `src/components/reports/*` (8 files) |
| API layer | 7 × `src/app/api/reports/*/route.ts` |
| Export layer | `src/hooks/use-excel-export.ts`, `src/hooks/use-pdf-export.tsx`, `src/lib/pdf-templates/*` |
| Authorization | `src/lib/permissions.ts`, `src/lib/tenant-modules.ts`, `src/lib/constants.ts` |
| i18n | `src/messages/{en,ur,hi,bn}.json` (`reports.*` = 307 keys / 15 sub-namespaces) |

The assessment is graded against the project's own contract — `AGENTS.md` §2 (ERPDataTable + pagination), §4 (AppDropdown, no raw `<select>`), §5 (cascading selectors), §6 (server-first logic), §7 (hierarchical query keys), §1 (no hardcoded UI strings, no emoji).

---

## 2. Current State — Verified Inventory

### 2.1 The hub (`/reports`)

`reports/page.tsx` is 110 lines: a `PageHeader` plus a `grid md:grid-cols-2` of 7 `Link`-wrapped `Card`s.

- **No search.** 7 cards is already at the edge of scannability; the roadmap adds more.
- **No grouping.** Fee/Salary/Financial (money), Admissions/Attendance/Students/Exams (academic) are interleaved in a single flat grid.
- **No role-awareness.** All 7 cards render for every viewer regardless of whether that viewer's role can actually open the report (see §3.4 — most cannot).
- **No metadata.** No "last generated", no date-range hint, no description of what the report answers.
- **Dead i18n key.** `reports.overview` ("Reports Overview") exists in all 4 locales but is referenced by no source file.

### 2.2 The seven reports

| Report | Page | API route | Lines (page / route) |
|---|---|---|---|
| Fees | `reports/fees/page.tsx` | `/api/reports/fees` | 359 / 172 |
| Salary | `reports/salary/page.tsx` | `/api/reports/salary` | 447 / 137 |
| Financial | `reports/financial/page.tsx` | `/api/reports/financial` | 437 / 143 |
| Admissions | `reports/admissions/page.tsx` | `/api/reports/admissions` | 437 / 134 |
| Attendance | `reports/attendance/page.tsx` | `/api/reports/attendance` | 381 / 158 |
| Students | `reports/students/page.tsx` | `/api/reports/students` | 349 / 152 |
| Exams | `reports/exams/page.tsx` | `/api/reports/exams` | 481 / 191 |

Each page independently re-implements the same six-part layout: filters → summary bar → metric cards → charts → table → empty state.

### 2.3 Shared primitives — and where they fracture

`src/components/reports/` exports 8 components. Two of them are healthy; the rest are either thin or divergent.

| Component | Lines | Assessment |
|---|---|---|
| `report-page-shell.tsx` | 33 | Bare `space-y-6` wrapper. Accepts `filters/summary/metrics/insights/table` **or** `children` — a passthrough, not a layout contract. |
| `report-filters.tsx` | 277 | **Uses raw `<Select>`** (`report-filters.tsx:7-13`, `140`, `160`, `180`, `200`, `220`, `240`). Violates AGENTS.md §4. Not live-searchable. Cascading reset logic is correct (`:82-94`, `:108-110`) but only applies to the class→section→group chain. |
| `report-table.tsx` | 211 | **Uses raw `<Table>`, not `ERPDataTable`.** Violates AGENTS.md §2. `useReactTable` is configured with `getCoreRowModel()` only (`:116-120`) — **no pagination, no sorting**. |
| `report-charts.tsx` | 433 | Solid. `BarChart` / `PieChart` / `LineChart` on CSS chart tokens. |
| `report-summary-bar.tsx` | 98 | **Hardcoded English** at `:34` `"Report period"`, `:39` `"Generated at"`, `:45` `"Records"`, `:52` `"Applied filters"`, `:70` `"No extra filters"`. No `useTranslations` import at all. |
| `report-metric-card.tsx` | 58 | **Hardcoded English** at `:52` `"% from last period"`. |
| `report-empty-state.tsx` | — | Fine. |
| `export-dropdown.tsx` | 93 | Hand-rolled; not portal-based. |

**The critical structural finding: there are two competing filter implementations.**

- `ReportFilters` (raw `<Select>`): **fees, students, attendance, exams**
- Bespoke inline filter bars using `AppDropdown` + `TenantDateInput` (AGENTS.md-compliant): **admissions, financial, salary**

So `ReportPageShell` is consumed two incompatible ways — prop-based (`filters={...}`) for four reports, children-based (`<ReportPageShell>…`) for three. The "shared interface" the codebase appears to have is largely cosmetic.

### 2.4 API layer — filters actually read

Extracted from `searchParams.get(...)` in each route:

| Route | Parameters actually read | Permission required |
|---|---|---|
| `fees` | `fromDate`, `toDate`, `status`, `paymentMethod` | `fees:read` |
| `students` | `fromDate`, `toDate`, `classId`, `sectionId`, `status` | **none** |
| `attendance` | `fromDate`, `toDate` | `attendance:read` |
| `exams` | `fromDate`, `toDate`, `examType` | `exams:read` |
| `admissions` | `fromDate`, `toDate`, `status`, `source`, `classId` | `students:read` |
| `financial` | `fromDate`, `toDate`, `categoryId`, `paymentMethod` | `accounting:read` |
| `salary` | `year`, `month`, `department`, `status` | `payroll:read` |

### 2.5 Export layer

- `use-pdf-export.tsx` — 782 lines, ~33 bespoke export functions (one per report/screen).
- `use-excel-export.ts` — 238 lines, 7 per-report exporters + a generic `exportData`.

**27 dashboard screens** call one of these hooks. Seven are the `/reports/*` pages — meaning **20 report-capable screens live entirely outside the reports hub**:

```
accounting/profit-loss      accounting/statements       admissions
certificates                exam-results                exams
fees/bulk                   fees/collection             fees
hostel                      inventory                   library
promotions/calculate        salary/approvals            salary
staff                       students                    timetable
transactions                transport
```

### 2.6 Permissions & navigation

**RBAC.** `getModuleForPath("/reports")` (`permissions.ts:558-630`) falls through to `default: return baseRoute` → module `"reports"`. `reports: { read: true }` is granted to:

- Explicitly: `ACCOUNTANT` (`:319`), `ACADEMIC_COORDINATOR` (`:331`), `CLERK` (`:345`)
- Via `ALL_PERMISSION_MODULES` spread: `MANAGER` (`:302`), `PRINCIPAL` (`:288`)
- Via `FULL_ACCESS_PERMISSIONS`: `PLATFORM_OWNER`, `SUPER_ADMIN`, `SYSTEM_ADMIN`, `INSTITUTE_ADMIN`, `ADMIN`, `SCHOOL_ADMIN` (`:283-288`)

`TEACHER`, `PARENT`, `STUDENT` have no `reports` grant — correctly.

**Navigation.** `constants.ts:382-385` defines a single flat sidebar entry (`nav.reports` → `/reports`, `BarChart3`). There is no sub-navigation for the 7 reports; reaching one requires hub → card.

**Module licensing.** `TENANT_MODULE_KEYS` (`tenant-modules.ts:10-30`) does **not** contain `reports`, and `getModuleKeyForHref` (`:237-298`) has no `reports` case → returns `null`. Reports are therefore not tied to any licensable module.

---

## 3. Gap Analysis

### 3.1 P0 — Phantom filters: the UI claims a filter the API ignores

This is the most serious defect in the module. It is a **silent data-integrity failure**, not a cosmetic one: a user applies a filter, the summary bar echoes it back as "applied", and the returned dataset is unfiltered.

**Attendance** — `reports/attendance/page.tsx:255-256` enables:
```
showClassFilter
showSectionFilter
```
But `/api/reports/attendance/route.ts:15-25` reads **only** `fromDate` and `toDate`. The `where` clause (`:27-33`) filters on `tenantId` and `date` alone.

**Exams** — `reports/exams/page.tsx:339-341` enables:
```
showClassFilter
showSectionFilter
showExamTypeFilter
```
But `/api/reports/exams/route.ts:16-18` reads only `fromDate`, `toDate`, `examType`. Class and Section are phantom; Exam Type works.

**Why this matters in production:** a school administrator filters "Class 9, Section B" for a board-meeting attendance report and receives whole-school figures presented as class-scoped. There is no error, no warning, and the summary bar renders `Class: <uuid>` / `Section: <uuid>` badges (`ReportSummaryBar`) actively reinforcing the false belief. Worse, the badges render the raw ID, not a name.

**Sharper still — the dropdowns are not even populated.** No report page passes the `classes`, `sections` or `groups` props to `ReportFilters`, and none imports `useClasses` / `useSections` / `useGroups` (verified: zero matches across `src/app/(dashboard)/reports/`). `ReportFilters` defaults those props to `[]` (`report-filters.tsx:61-63`), so each dropdown renders with **only its "All …" option**. The user-visible symptom is therefore not "a filter that silently does nothing" but "a filter control that opens to an empty list" — and the only selectable value, `"all"`, is then stripped by the page before the request is sent (`attendance/page.tsx:107-108`). The control is decorative.

The page does *send* `classId`/`sectionId` (`attendance/page.tsx:107-108`) — the route simply never reads them. So both halves are broken independently: the UI cannot produce a value, and the API would ignore it if it could.

**Also note the inverse gap:** `/api/reports/admissions` supports `classId` and `/api/reports/financial` supports `categoryId`, but neither report's UI exposes them. Capability exists and is unreachable.

### 3.2 P2 — `students` report route relies on an implicit guard (corrected)

> **Correction.** An earlier draft of this document claimed this route was unauthenticated and a PII exposure. **That was wrong.** A runtime probe (see §9) proved the route is guarded. The finding is downgraded to a hardening item, and the reasoning error is recorded here rather than quietly deleted.

`src/app/api/reports/students/route.ts:12` calls `requireApiAccess(request)` with no `permission` option — unlike every sibling route.

**But `requireApiAccess` is not permission-free by default.** It resolves a module from the request path via `getPermissionModuleForApiPath` (`api-auth.ts:44-131`) and then enforces `hasPermission(effectivePermissions, module, action)`. For `/api/reports/students`, `api-auth.ts:116` maps the `students` subresource to module `students`, so the route enforces `students:read` — just via the path map rather than an explicit option. Verified by probe: `CLERK` and `TEACHER` are correctly denied/granted per their `students` module grant, and no role reaches the endpoint without `students` module read.

**The real (smaller) issue:** this route's guard is *implicit*. If `getPermissionModuleForApiPath`'s `reports` branch is ever edited, this route silently loses its authorization with no test failure and no compiler error — the `default: return null` path only fails closed when no `permission` option is supplied, and here the module *is* supplied, so the guard is load-bearing but undeclared. Declaring it explicitly is defence-in-depth at zero behavioural cost (verified: every role that currently passes also holds `students:read`).

**Related genuine inconsistency:** `/api/reports/financial` maps to module **`fees`** (`api-auth.ts:117`) while requiring role-list permission **`accounting:read`**. The two gates describe different modules. `CLERK` passes the module gate and fails the role gate, producing a `Missing required permission: accounting:read` error on a route whose module check said `fees`. Fail-closed, so not a vulnerability — but the module/role-list split is the source of the confusion in §3.4.

### 3.3 P0 — Off-by-one date bug is systemic

| Route | `toDate` handling | Effect |
|---|---|---|
| `fees` | `new Date(\`${toDate}T23:59:59.999Z\`)` (`fees/route.ts:35`) | Correct — inclusive |
| `exams` | `new Date(toDate)` (`exams/route.ts:26`) | **Final day dropped** |
| `students` | `new Date(toDate)` (`students/route.ts:30`, `:81`) | **Final day dropped** |
| `attendance` | `new Date(toDate)` (`attendance/route.ts:24`) | **Final day dropped** |
| `admissions` | `new Date(toDate)` (`admissions/route.ts:28`) | **Final day dropped** |
| `financial` | `new Date(toDate)` (`financial/route.ts:30`) | **Final day dropped** |

`new Date("2026-09-24")` parses as `2026-09-24T00:00:00.000Z`. An `lte` comparison therefore excludes everything recorded during the selected end date.

**Consequence:** a "1–30 September" fee/attendance/financial report silently omits all of 30 September. This is exactly the class of bug that surfaces as a parent complaint about a missing payment — and it is invisible in testing because a one-day error looks like normal variance. Only one of six routes got it right, which means the pattern was copy-pasted without the fix.

### 3.4 P1 — Hub permission mismatch: 3 dead cards per non-admin role (corrected)

> **Correction.** An earlier draft claimed `ACCOUNTANT` and `CLERK` could open "zero to one" report. **That was overstated.** A runtime probe (§9) shows each non-admin hub-holder can open **4 of 7**. The defect is real but bounded: every non-admin role sees 7 cards and exactly **3 will 403**.

`/reports` is gated on `reports:read`, but each API route is gated on its *own module* plus a role-list permission. The two systems were authored independently and disagree about who owns which report.

**Verified matrix** (probe output, §9):

| Report | Module gate | Role-list gate | `ACCOUNTANT` | `ACADEMIC_COORDINATOR` | `CLERK` |
|---|---|---|---|---|---|
| Fees | `fees` | `fees:read` | ALLOW | **DENY** | ALLOW |
| Students | `students` | `students:read` | ALLOW | ALLOW | ALLOW |
| Attendance | `attendance` | `attendance:read` | **DENY** | ALLOW | ALLOW |
| Exams | `exams` | `exams:read` | **DENY** | ALLOW | **DENY** |
| Admissions | `students` | `students:read` | ALLOW | ALLOW | ALLOW |
| Financial | `fees` | `accounting:read` | ALLOW | **DENY** | **DENY** |
| Salary | `salary` | `payroll:read` | ALLOW | **DENY** | **DENY** |
| | | **working / 7** | **5** | **4** | **4** |

`MANAGER`, `PRINCIPAL`, and all admin roles hold read across every module → all 7 work. So the defect affects exactly the three non-admin `reports:read` holders, and the failure mode is a `403` toast *after* a full-page navigation to a card that should never have been rendered.

> **Correction (second pass).** The first correction of this table said 4/4/4. `ACCOUNTANT` is actually **5** — fees, students, admissions, financial and salary all pass; only attendance and exams are denied. The error was caught by `report-registry.test.ts` asserting the counts, which is why that test now pins them.

**Second finding — nav is stricter than the API.** `TEACHER` holds `students`, `admissions`, `attendance` and `exams` module read, so all four of those report APIs would **ALLOW** a teacher's request. But `TEACHER` has no `reports` module grant, so the hub and sidebar entry are hidden. The nav says no and the API says yes. This is a usability/consistency defect rather than a breach (each grant is individually defensible), but it means **nav visibility is not a reliable proxy for API access in either direction** — which is precisely why card visibility must be computed from the same source the API enforces.

**Third finding — reports bypass tenant module licensing entirely.** `getModuleKeyForApiPath("/api/reports/…")` falls through to `default: return null` (`tenant-modules.ts:300-370`), and `getModuleKeyForHref("/reports")` has no `reports` case. So a tenant that has not licensed `payroll` can still pull the salary report, and one without `accounting` can pull financial statements — RBAC is the only gate. Whether that is intended is a product decision, but it is currently silent.

### 3.5 P1 — No pagination anywhere in the reports module

- `report-table.tsx:116-120` configures `getCoreRowModel()` only.
- No report page tracks `page` / `pageSize` state.
- No API route accepts `skip` / `take` except `financial`, which uses them for internal aggregation.

`attendance` is the worst case: `/api/reports/attendance/route.ts:27-53` loads **every attendance row for the tenant in the date range** with nested student/class/section includes, then aggregates in JavaScript (`:56-103`). For a mid-size school that is tens of thousands of joined rows serialized to the client on every generate.

This violates AGENTS.md §2 (built-in pagination with `startRow-endRow of totalCount` and a `[10,20,50,100]` page-size picker) and §6 (aggregation belongs on the server).

### 3.6 P1 — Two competing filter implementations, one of them non-compliant

`ReportFilters` uses raw `<Select>` in six places, directly contradicting AGENTS.md §4 ("NO RAW HTML `<select>` TAGS... use `<AppDropdown />`"). Meanwhile admissions, financial and salary hand-roll `AppDropdown` filter bars that *do* comply.

**Consequence:** the same visual control behaves differently across reports — different keyboard handling, different portal clipping behaviour, and no live search on the class/section lists in four of seven reports (directly contradicting the AGENTS.md §4 live-search requirement for dynamic dropdowns). Maintenance cost is doubled: a fix to filter behaviour must be applied in two places, and already hasn't been (§3.1 — the phantom-filter bug exists only in the `ReportFilters` branch).

### 3.7 P2 — Hardcoded English in shared primitives

`report-summary-bar.tsx` has no `useTranslations` import and hardcodes five strings; `report-metric-card.tsx:52` hardcodes `"% from last period"`.

**The fix is unusually cheap:** four of the five already exist as keys — `pdf.common.reportPeriod`, `pdf.common.generatedAt`, `pdf.common.appliedFilters`, `pdf.common.noExtraFilters`. Only `"% from last period"` needs a new key. Because these primitives are shared, this is a 2-file change that repairs all seven reports at once — and it is currently the reason the Urdu/Hindi/Bengali report experience is partially English.

### 3.8 P2 — Export catalog duplication

`use-pdf-export.tsx` is 782 lines with ~33 near-identical export functions. `ReportTable` additionally reimplements Excel column inference from TanStack column defs (`report-table.tsx:66-114`) while `ExportDropdown` (`:93`) provides a second, unrelated export trigger. Three paths to the same outcome, none sharing a code path.

### 3.9 P2 — Missing end-user affordances

No report has: saved/pinned filter presets, a scheduled email digest, drill-down from a chart segment or metric card into the underlying rows, comparison to a prior period (`ReportMetricCard` accepts a `trend` prop that no report passes), or CSV/PDF parity with the on-screen table.

---

## 4. Target Architecture

### 4.1 Principle: one workbench, declarative report definitions

The current design asks each report page to re-implement layout, filters, fetch, and export — 2,900 lines of page code for seven reports. The target inverts this: a report becomes a **declaration**, and a single workbench renders it.

```
ReportDefinition
  id, titleKey, descriptionKey, icon, category
  requiredPermission        ← single source of truth for both nav and API
  filterSchema[]            ← drives the filter bar AND the API contract
  fetcher(query)            → { metrics, series, rows, totalCount }
  columns[]                 ← TanStack ColumnDef, consumed by ERPDataTable + export
  exportTemplates           ← PDF/Excel template refs
```

`ReportWorkbench` then owns: the filter bar, the summary bar, metric cards, charts, `ERPDataTable` with pagination, empty/loading states, and export wiring. A report page collapses to ~40 lines.

**Why this is the right call here rather than a preference:** §3.1 and §3.3 both exist *because* the same logic is duplicated seven times. A phantom filter is structurally impossible when the filter bar is generated from the same `filterSchema` the API validates against. An off-by-one date cannot recur when date normalisation lives in one place.

### 4.2 Mandated shared components

| Concern | Required implementation |
|---|---|
| Filters | One `ReportFilterBar` built on `AppDropdown` + `TenantDateInput`, generated from `filterSchema`. Retire `report-filters.tsx`. |
| Table | `ERPDataTable` (AGENTS.md §2) with server-driven `page`/`pageSize`/`sort`. Retire `report-table.tsx`. |
| Dates | `normalizeDateRange(from, to)` returning `{ gte, lte }` with `lte` at `T23:59:59.999Z`. **One implementation, imported by all routes.** |
| Aggregation | Prisma `groupBy` / `aggregate` / `count` server-side. `skip`/`take` on every list. |
| Export | One `ReportExportBar` driving the shared PDF template renderer and `exceljs` builder. |
| Strings | All shared primitives take `useTranslations("reports")`; promote `pdf.common.*` labels into `reports.common.*`. |

### 4.3 Authorization contract

`requiredPermission` on the `ReportDefinition` becomes the single source for three things that currently disagree: the API guard, hub card visibility, and (optionally) sidebar sub-item visibility.

Two decisions to make explicitly:

1. **Declare the `students` route's guard explicitly** — add `permission: "students:read"`, matching the `admissions` route. Verified to be behaviour-preserving (every role that currently passes the `students` module gate also holds `students:read`). The point is not to close a hole but to stop a load-bearing guard from being invisible to readers and to future edits of `getPermissionModuleForApiPath`.
2. **Decide the hub's gate.** Two coherent options: (a) gate `/reports` on the *union* of member report permissions so any role with at least one accessible report sees the hub, and filter cards per-role; or (b) introduce a first-class `reports` module permission and align all seven routes to it. Option (a) is less disruptive and preserves least-privilege per report; option (b) is simpler to reason about but broadens each role's data reach. **Recommendation: (a)** — per-role card filtering, because it keeps the money/academic separation that `ACCOUNTANT` vs `ACADEMIC_COORDINATOR` encodes, and it is the smaller change.

---

## 5. Expandable Report Scopes

Four tiers, ordered by cost-to-value.

### Tier A — Free wins: expose capability that already exists

The API already accepts parameters the UI never sends. Zero backend work.

| Report | Unlock | Value |
|---|---|---|
| Admissions | Expose `classId` (API-ready, `admissions/route.ts:19`) | Class-wise admission funnel |
| Financial | Expose `categoryId` (API-ready, `financial/route.ts:17`) | Category-level income/expense drill-down |
| Students | Expose `groupId` — filter exists in `ReportFilterState`, never wired | Group-wise roster |
| Fees | Expose `classId`/`sectionId` (needs route support, trivial) | Class-wise collection efficiency |

### Tier B — Promote the 20 off-hub export screens

These already generate reports but are unreachable from `/reports`. Promoting them is mostly navigation + registration, not new logic.

- **Finance:** `accounting/profit-loss`, `accounting/statements`, `transactions`, `salary/approvals`, `fees/collection`, `fees/bulk`
- **Academic:** `exam-results`, `promotions/calculate`, `timetable`
- **People:** `staff`, `students`, `admissions`
- **Facilities:** `hostel`, `library`, `inventory`, `transport`, `certificates`

### Tier C — New reports for modules that have none

Facility modules carry real operational data and zero reporting surface. Each is a genuine new capability, and each maps to a licensable `TenantModuleKey`:

| Module | Candidate reports |
|---|---|
| `library` | Circulation & overdue register; most-borrowed titles; lost/damaged inventory valuation |
| `inventory` | Stock ledger; low-stock & reorder; asset depreciation schedule |
| `hostel` | Occupancy & bed-vacancy; mess expenditure; hostel fee collection |
| `transport` | Route utilisation; vehicle maintenance cost; driver/attendant roster; fuel efficiency |
| `health` | Sick-bay visit log; immunisation compliance; chronic-condition register |
| `certificates` | Issuance register; pending requests aging |
| `leaves` | Staff leave balance & utilisation; absenteeism trend |
| `homework` | Submission/completion rates by class |
| `timetable` | Teacher workload distribution; room utilisation |

### Tier D — Cross-cutting / executive

Where the module earns its place in a principal's daily routine:

- **Executive dashboard** — one screen, one row per domain (enrolment, collection, attendance, exam performance, payroll liability), each with a period-over-period delta. This is what `ReportMetricCard`'s unused `trend` prop was built for.
- **Collection efficiency** — billed vs collected vs outstanding, aged by 30/60/90 days.
- **Enrolment funnel** — enquiry → application → admission → enrolled, with drop-off at each stage.
- **Academic performance index** — grade distribution and pass rate across classes and exams, with trend.
- **Defaulter register** — consolidated, cross-module (fees + hostel + transport).
- **Attendance-defaulter early warning** — students below the 75% threshold, ranked by severity.
- **Staff cost analysis** — salary + benefits as a share of fee revenue.

---

## 6. Dedicated Screen vs Shared Interface

### 6.1 Decision framework

A report deserves its **own dedicated screen** when it needs any of:

1. **Entity-specific filter axes** the generic bar cannot express (month/year pickers, department, exam type, category).
2. **Non-tabular primary output** — a P&L statement, a balance sheet, a payslip register.
3. **A different mental model** — statements are read top-to-bottom and totalled; a register is scanned and filtered.
4. **Regulatory/print fidelity** — output must match a mandated format exactly.
5. **Drill-down depth** — chart → row → source document.

It should **share the common interface** when it is fundamentally *a filtered list with metrics* — i.e. tabular output, date + 2–3 categorical filters, metric cards on top, charts beside.

### 6.2 Per-report verdict

| Report | Verdict | Rationale |
|---|---|---|
| **Students** | **Shared** | Textbook filtered list: class/section/status → roster table. Currently the only report with no permission check and no charts — the simplest possible workbench case. Migrate first as the reference implementation. |
| **Attendance** | **Shared** | Same shape (class/section → per-student percentages). Its `classWise` aggregate is a chart on the same page. Migrate second; this is where the phantom-filter fix lands. |
| **Exams** | **Shared** | Date + exam type + class/section → results table. Note: class/section must become real server-side filters (§3.1). |
| **Fees** | **Shared** | Date + status + method → voucher table, with collection-rate metrics and two charts. Closest of the seven to the target shape already. |
| **Admissions** | **Shared** | Date + status + source + class → applicant table. Already uses compliant `AppDropdown`; adopt its filter bar as the basis for the shared component. |
| **Salary** | **Shared** (with a dedicated print view) | Month/year + department + status → payroll register. The *register* is a shared list; the payslip/register PDF is a dedicated print artefact. |
| **Financial** | **Dedicated screen** | This is a financial *statement*, not a list. Category × period with opening/closing balances, drilled into ledgers. It needs its own layout and must reconcile with `accounting/statements` and `accounting/profit-loss`. Forcing it into a table-plus-cards shell is how the current 437-line page became unmaintainable. |
| **Executive dashboard** (new) | **Dedicated screen** | Different purpose entirely — at-a-glance, not query-and-export. No filters beyond a period selector. |
| **Tier C facility reports** | **Shared** | All are registers (circulation, stock ledger, occupancy, route utilisation). Ideal workbench candidates — new reports should cost ~40 lines each. |

**Summary:** 6 of 7 existing reports should share one interface; `financial` should be a dedicated statement screen. All new registers join the shared interface; only the executive dashboard and financial statements are dedicated.

### 6.3 The one thing *not* to do

Do not create a dedicated screen merely because a report has unique filters. `salary`'s month/year picker is a filter-schema variant, not an architectural divergence — the workbench should support `filterSchema` entries of type `date` | `month` | `select` | `multiselect`. The moment each filter shape earns its own page, the module returns to seven copies of the same code, which is precisely the state it is in now.

---

## 7. Navigation & Layout

### 7.1 Hub

- **Group the cards** into three sections — *Finance* (Fees, Salary, Financial), *Academics* (Admissions, Attendance, Students, Exams), *Operations* (facility reports as they land). Match `MODULE_CATEGORIES` (`permissions.ts:637+`) so the hub and the permission matrix speak the same language.
- **Add a search input** filtering cards by title and description. Non-optional once Tier B/C land.
- **Render only accessible cards** — filter by the viewer's effective permissions (§3.4). A card that 403s is worse than an absent card.
- **Add "last generated"** per card, persisted per user, so a returning user can see freshness at a glance.
- **Delete the dead `reports.overview` key** or wire it in as the hub heading.

### 7.2 Sidebar

Promote `/reports` from a single flat link to a collapsible group with sub-items, mirroring the existing group pattern in `constants.ts`. This eliminates the hub round-trip for users who always open the same report. Sub-items must be permission-filtered using the same `requiredPermission` the API enforces.

### 7.3 Within a report — layout order

Keep the current vertical order, it is correct, but make it consistent and enforceable via the workbench:

1. `PageHeader` (title, description, icon)
2. Filter bar — filters left, `Reset` + `Generate` right, export beside them
3. Summary bar — period, generated-at, record count, applied-filter chips
4. Metric cards — 2–4, grid `md:grid-cols-2 lg:grid-cols-4`
5. Charts — `lg:grid-cols-2`, only when data exists
6. `ERPDataTable` — with pagination and export
7. Empty state — before generate, with a primary action button

**Three specific layout fixes:**

- **Applied-filter chips must show names, not IDs.** Today `ReportSummaryBar` renders `Class: 3f2a…`; it must resolve to `Class: Grade 9`. An unreadable confirmation badge is only marginally better than none.
- **Never render the summary bar or metric cards before a generate.** Currently guarded by `hasGenerated` in fees/students/attendance/exams but the guard is per-page — the workbench must own it.
- **Charts must not render on empty data.** The `insights` slot is already guarded per-page (`fees/page.tsx:304`); make it a workbench invariant so a new report cannot forget.

### 7.4 Accessibility & RTL

The Urdu locale is RTL and mandatory (AGENTS.md). Because `ReportSummaryBar` and `ReportMetricCard` bypass `useTranslations` entirely (§3.7), they also bypass the direction handling the provider applies — chart legends and metric deltas currently render in LTR Latin script inside an RTL document. Fixing the hardcoded strings fixes the RTL regression at the same time.

---

## 8. Remediation Roadmap — Implementation Status

**Phase 0 — Correctness (do first; small, high-severity)**

| # | Item | Status |
|---|---|---|
| 1 | Declare `permission: "students:read"` explicitly on `api/reports/students/route.ts` (hardening; behaviour-preserving) | **Done** |
| 2 | Introduce `normalizeDateRange()` and adopt it in the six affected routes (`exams`, `students`, `attendance`, `admissions`, `financial`, `fees`) | **Done** |
| 3 | Remove the phantom Class/Section filters from attendance and exams — **implemented server-side rather than removed** | **Done** |
| 4 | Replace hardcoded English in `report-summary-bar.tsx` / `report-metric-card.tsx` with `reports.common.*` keys | **Done** |

**Phase 1 — Consolidation**

| # | Item | Status |
|---|---|---|
| 5 | `ReportDefinition` registry (`src/lib/report-registry.ts`) mirroring **both** API gates | **Done** |
| 6 | Swap raw `<Select>` for `AppDropdown` in `report-filters.tsx`; swap raw `<Table>` for `ERPDataTable` in `report-table.tsx` | **Done** |
| 7 | Server-driven pagination (`skip`/`take`) + `collectAllReportRows()` so exports never silently export one page | **Done** for attendance / exams / students; fees / salary / financial / admissions remain unpaginated by design (their routes are unbounded-by-period, not unbounded-by-row) |
| 8 | Filter hub cards and sidebar by effective permission | **Done** |
| 9 | Per-report access guard so a hand-typed URL to a forbidden report explains itself instead of failing with an opaque 403 toast | **Done** (`reports/layout.tsx`) — not in the original roadmap; added while wiring item 8 |

**Phase 2 — Expansion**

| # | Item | Status |
|---|---|---|
| 10 | Tier A: expose the already-supported `classId` / `sectionId` filters | **Done** for attendance and exams (the two that had phantom filters). Remaining Tier A items not started. |
| 11 | Tier B: register the 20 off-hub report screens into the hub | **Not started** |
| 12 | Tier C: ship facility-module registers on the workbench | **Not started** |
| 13 | Tier D: executive dashboard + trend deltas (wiring the dormant `trend` prop) | **Not started** |

**Phase 3 — Depth**

| # | Item | Status |
|---|---|---|
| 14 | Saved filter presets, scheduled digests, chart-to-row drill-down, period-over-period comparison | **Not started** |

### 8.1 Verification performed

| Check | Result |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npx vitest run` | 85 files / 686 tests pass. Two DB-backed files (`fee-structures`, `pdf-excel-analytics`) intermittently time out at 15 s under full parallel load against the remote Prisma Accelerate endpoint; both pass in isolation and are unrelated to these changes. |
| `npx eslint` on the report module | 0 errors (72 pre-existing `no-explicit-any` warnings) |
| i18n parity across `en`/`ur`/`hi`/`bn` | 0 missing, 0 extra; `reports.common` = 21 keys in all four; CRLF and no-trailing-newline preserved |

### 8.2 New regression tests (permanent)

| File | Locks |
|---|---|
| `src/lib/report-access-matrix.test.ts` | The allow/deny matrix per role × report route, including proof that the `students` route's path-map entry is load-bearing, and the TEACHER nav-vs-API asymmetry |
| `src/lib/report-registry.test.ts` | That each registry `module` equals `getPermissionModuleForApiPath("/api" + href)` — i.e. the UI's prediction can never drift from the API's decision |
| `src/lib/date-range-filter.test.ts` | The inclusive end-of-day bound, with an explicit regression case for the old off-by-one |

### 8.3 Two implementation notes worth carrying forward

1. **`getModuleKeyForApiPath("/api/reports/…")` returns `null`**, so reports bypass tenant module licensing entirely. The hub therefore deliberately does *not* filter on module access — doing so would hide cards the API happily serves. If reports are ever brought under licensing, both the API and `canAccessReport` must change together.
2. **`AGENTS.md` is stale on auth.** It states guards live in `src/middleware.ts`; there is no `middleware.ts` anywhere in the repo, and locale resolution happens by cookie/`Accept-Language` header rather than a URL prefix (`src/i18n/index.ts`). This matters for any code that inspects `usePathname()` — the value has no locale prefix.

---

## 9. Methodology — how the permission claims were verified

The permission analysis in §3.2 and §3.4 is **not** derived from reading source alone. An earlier draft *was*, and it produced two wrong conclusions (an "unauthenticated route" that is actually guarded, and a "zero-to-one working cards" claim that is actually four). Both are corrected above.

The corrected matrix comes from a runtime probe that imports the real authorization functions and evaluates them:

```ts
getPermissionModuleForApiPath("/api/reports/students")  // -> "students"
getEffectivePermissions("CLERK", null, null)            // -> 12 granted modules
hasPermission(effectivePermissions, module, "read")
hasRolePermission("CLERK", "fees:read")
```

This matters because `requireApiAccess` has **two independent gates** that read from different sources:

| Gate | Source | Fails when |
|---|---|---|
| Module gate | `getPermissionModuleForApiPath(pathname)` → `hasPermission(effective, module, action)` | route path isn't in the switch, or role lacks the module |
| Role-list gate | the `permission:` option → `hasRolePermission(role, perm)` | role's flat `ROLE_PERMISSIONS` list lacks the string |

Reading a route file only reveals the *second* gate. The first is inferred from the URL and is therefore invisible at the call site — which is exactly how the original error was made, and exactly why §3.2's implicit-guard finding matters.

The probe is retained as a permanent regression test (`src/lib/report-access-matrix.test.ts`) so the matrix cannot drift silently.

---

## Appendix — Evidence Index

| Claim | Location |
|---|---|
| Phantom class/section filters (attendance) | `reports/attendance/page.tsx:255-256` vs `api/reports/attendance/route.ts:15-25` |
| Phantom class/section filters (exams) | `reports/exams/page.tsx:339-341` vs `api/reports/exams/route.ts:16-18` |
| Implicit (undeclared) route guard | `api/reports/students/route.ts:12` — guarded via `api-auth.ts:116` path map, not an explicit option |
| Off-by-one date (correct case) | `api/reports/fees/route.ts:35` |
| Off-by-one date (buggy) | `exams:26`, `students:30,81`, `attendance:24`, `admissions:28`, `financial:30` |
| No pagination in table | `components/reports/report-table.tsx:116-120` |
| Raw `<Select>` in filters | `components/reports/report-filters.tsx:7-13,140,160,180,200,220,240` |
| Hardcoded English | `report-summary-bar.tsx:34,39,45,52,70`; `report-metric-card.tsx:52` |
| Shell is a passthrough | `components/reports/report-page-shell.tsx:20-32` |
| Two filter implementations | prop-based: fees/students/attendance/exams; children+`AppDropdown`: admissions/financial/salary |
| `reports:read` grants | `lib/permissions.ts:319,331,345` (+ spread at `:288,302`) |
| `getModuleForPath("/reports")` → `"reports"` | `lib/permissions.ts:558-630` (default branch) |
| No `reports` in tenant modules | `lib/tenant-modules.ts:10-30, 237-298` |
| Single flat sidebar entry | `lib/constants.ts:382-385` |
| Dead i18n key | `reports.overview` — present in all 4 locales, zero references |
| Reusable existing keys | `pdf.common.reportPeriod`, `.generatedAt`, `.appliedFilters`, `.noExtraFilters` |
| 20 off-hub export screens | `grep usePDFExport\|useExcelExport` across `src/app/(dashboard)` |
