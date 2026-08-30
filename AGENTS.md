# Pathshala-Pro — School Management ERP (Multi-Tenant SaaS)

## Stack

- **Framework:** Next.js 15.4 (App Router) + React 18 + TypeScript
- **Database:** Prisma 6 + Accelerate — schema: `src/prisma/schema.prisma`
- **Auth:** NextAuth v4, JWT sessions (`jose`, `bcryptjs`), guards in `src/middleware.ts` + `src/lib/api-auth.ts`
- **UI:** Tailwind CSS v4, shadcn/ui + Radix (`src/components/ui`), lucide-react icons, sonner toasts
- **Data:** TanStack Query 5 + TanStack Table 8, react-hook-form + Zod (`src/lib/schemas`)
- **i18n:** next-intl — 4 mandatory locales: `en`, `ur` (RTL), `hi`, `bn` in `src/messages/`
- **Files:** Cloudflare R2 via AWS S3 SDK (`src/lib/r2-storage.ts`)
- **Docs/PDF:** `@react-pdf/renderer` templates in `src/lib/pdf-templates/*.tsx`; Excel via `exceljs`
- **Tests:** Vitest + Testing Library; **Deploy:** Vercel

## Commands

```bash
npm run dev          # dev server (Next.js Turbopack)
npm run build        # production build
npm run lint         # eslint
npm run test:run     # vitest (CI mode)
npm run test:all     # pre-flight: strict tsc check + vitest full suite
npm run prisma:push  # sync schema → db
npm run prisma:seed  # seed data
```

---

## 🏛️ Core Architectural & Engineering Rules (MANDATORY FOR ALL AGENTS)

### 0. 🛡️ Production-Grade Integrity, Deep Verification & Pushback Protocol (Anti-"Vibecode")
- **NEVER BE A YES-MAN:** If the user or a proposed solution suggests a shortcut, flimsy frontend hack, unbalanceable financial math, weak security, float math, or missing database relations, **YOU MUST PUSH BACK**. Explain clearly *why* it fails in real-world production and implement the battle-tested industry standard.
- **NO RUSHED / SHALLOW ANSWERS:** Never give surface-level answers immediately. Always investigate the actual codebase, trace entity relationships in `schema.prisma`, verify foreign keys, check cascade dependencies, and run compiler/test checks before answering.
- **True Production ERP Standard:** This is an enterprise school management system handling real money, student transcripts, and multi-campus payroll. Zero tolerance for shallow "vibecoded" prototypes that break under production edge-cases.

---

### 1. No Emojis & Enterprise Professional Aesthetic (Never Look AI-Generated)
- **STRICT PROHIBITION:** Do **NOT** use emojis anywhere in the user interface (no emojis in headings, labels, buttons, toast messages, modals, dropdowns, table cells, or badges).
- Use crisp, semantic **Lucide-React SVG icons** (`<Search />`, `<Calendar />`, `<Users />`, `<CheckCircle2 />`, `<Layers />`, `<Building2 />`, `<FileText />`, `<Download />`, `<Plus />`, etc.).
- Maintain clean, enterprise ERP aesthetics: curated color tokens, proper contrast, subtle borders (`border-border/80`), and polished status pills.

---

### 2. Universal Data Tables & Built-in Pagination (`ERPDataTable`)
- **Data Table Standard:** Always use `<ERPDataTable />` (from `@/components/ui/erp-data-table`).
- **Table Visuals:**
  - Semantic column headers with sort indicators and uppercase muted labels.
  - Subtle row borders (`border-b border-border/50`), hover states (`hover:bg-muted/30`), and alternate row shading.
  - Skeleton loading states via `<TableSkeleton />` during query loading.
  - Informative empty states with an action button when query returns zero records.
- **Built-in Pagination:**
  - Tables must expose pagination controls: page counter (`startRow-endRow of totalCount`), dynamic page size picker (`[10, 20, 50, 100]`), and previous/next navigation buttons.
  - Client state must track `page` and `pageSize` and pass them directly into TanStack Query key and API parameters.

---

### 3. Button Hierarchy & Interactive States
- **Button Variants:**
  - **Primary (`default`):** For main actions (e.g. "Create Student", "Post Journal", "Save").
  - **Secondary (`outline`):** For filter resets, table exports, and print actions.
  - **Subtle / Ghost:** For table row action menus, drawer close buttons, and tab switchers.
  - **Destructive:** For delete, suspend, and cancel operations.
- **Icons & Loading Spinners:**
  - Prefix with Lucide icons (size `h-3.5 w-3.5` or `h-4 w-4`).
  - During async mutations, always disable the button and render `<Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />` with an active loading label.

---

### 4. Universal Searchable Dropdowns (`AppDropdown`)
- **NO RAW HTML `<select>` TAGS:** Never write `<select><option>...</option></select>`.
- Use `<AppDropdown />` (from `@/components/ui/app-dropdown`) or `<Select />` (from `@/components/ui/select`).
- **Live Search Requirement:** Every dynamic dropdown (students, staff, books, items, vehicles, accounts, classes, dates, months) MUST have live search enabled (automatic for $> 3$ options or via `searchable={true}`).
- Dropdowns must render via portals so they are never clipped by parent containers, tables, or modals.

---

### 5. Cascading & Dependent Selectors (Parent $\rightarrow$ Child Filtering)
- When a parent filter changes, dependent child filters **MUST** automatically re-filter and reset their child selection:
  - **Class $\rightarrow$ Section:** Selecting a Class filters the Section dropdown to only show sections belonging to that class.
  - **Class $\rightarrow$ Subject:** Selecting a Class fetches/filters subjects assigned to that class curriculum.
  - **Class $\rightarrow$ Fee Structure:** Selecting a Class updates the fee heads and default dues.
  - **Hostel $\rightarrow$ Room $\rightarrow$ Bed:** Selecting a Hostel loads its rooms; selecting a room loads available beds.
- Whenever the parent filter changes, reset the child state (`setSectionId("")`, `setSubjectId("")`) to prevent invalid cross-entity selections.

---

### 6. Server-First Logic Architecture & Data Integrity
- **Core Business Logic Lives on the Server:**
  - Fee calculation, concession stacking, payroll deduction capping, double-entry accounting, and grading formulas MUST be executed in server modules (`src/lib/*`) and validated in API route handlers.
  - Client ViewModels only orchestrate UI state, form bindings, and mutation triggers. Never rely on client-side math alone for financial or academic operations.
- **Strict Data Relationships:**
  - Every Prisma model must enforce foreign key relations and cascade rules.
  - Every database query MUST be scoped by the current tenant (`where: { tenantId }`).

---

### 7. Proper Data Fetching & Cache Management (TanStack Query v5)
- **Deterministic Query Keys:** Include all active filters and pagination states in query keys:
  `queryKey: ["students", { tenantId, page, pageSize, search, classId, sectionId, status }]`
- **Cache Invalidation:** Every mutation (`useMutation`) must automatically invalidate relevant query keys on success:
  `onSuccess: () => qc.invalidateQueries({ queryKey: ["students"] })`

---

### 8. Date, Month, and Fiscal Year Selectors
- Standardize all date / month / year pickers using unified reusable components:
  - **Month Picker:** `AppDropdown` with localized months (`MONTH_NAMES` or `MONTHS`).
  - **Year Picker:** `AppDropdown` with dynamic fiscal year arrays.
  - **Date Picker:** Input with tenant date formatting (`DD/MM/YYYY`, `MM/DD/YYYY`, `YYYY-MM-DD`).

---

### 9. Zero Hardcoded Strings (100% 4-Locale i18n Rule)
- Every single user-facing string must be translated in **ALL FOUR locale files**:
  - `src/messages/en.json` (English)
  - `src/messages/ur.json` (Urdu - RTL)
  - `src/messages/hi.json` (Hindi)
  - `src/messages/bn.json` (Bengali)
- **Interpolation Variable Invariant:** Any `{variable}` placeholder must match across all 4 locales.
- Static keys must not be mixed with dynamic `{var}` keys under the same key name.
- Always run `npm run test:all` to ensure `i18n-parity-and-interpolation.test.ts` passes.

---

### 10. Exported Documents (PDF & Excel) Multi-Language Support
- **PDF Documents (`@react-pdf/renderer`):**
  - All fee vouchers, report cards, mark sheets, and salary slips must support all 4 app locales.
  - Support UTF-8 glyphs for Bengali, Hindi, and Urdu fonts.
  - Display tenant currency symbol, localized date formatting, and RTL alignment when Urdu locale is active.
- **Excel Daybooks & Reports (`exceljs`):**
  - Exported spreadsheets must use localized column headers, formatted numbers, and proper UTF-8 sheet names.

---

### 11. Universal API Error Formatting & Unmasked Toasts
- Errors must never be masked with generic "An error occurred".
- API responses must format field-level validation errors as:
  `[Field '<field>', Code: <code>] <message>`
- All 14 ViewModel hooks (`src/viewmodels/*`) and mutation callbacks must pass `toast.error(e?.message)`.

---

### 12. Mathematical & Double-Entry Financial Invariants (`math-utils.ts`)
- **No Float Arithmetic for Money:** Always use `toCents()`, `addCurrency()`, and `roundCurrencyStrict()`.
- **Double-Entry Balance:** Every journal entry (`postDoubleEntryJournal`) must enforce `amount > 0` (no negative contra lines) and `SUM(debits) === SUM(credits)`.
- **Cascading Payroll Deductions:** Deductions are capped sequentially (`LOP -> PF -> Tax -> Loan`) against remaining gross headroom so `netPayable` is never negative and journals always balance.
- **Fee Payment Allocation:** Excess payments above invoice balance must route into Student Advance Wallet (`Account 2050`).

---

### 13. Ponytail Engineering Discipline (Simplest, Shortest, Cleanest Solution)
- Question whether code needs to exist (YAGNI).
- Prefer native platform and standard library features over bloated custom abstractions.
- Keep viewmodels and components modular, concise, and focused. Avoid over-engineering.

---

### 14. Local-Only Execution & Git Protocol
- **Make modifications in the local workspace only.**
- Do **NOT** push updates to Vercel or run remote deployment commands unless explicitly instructed by the user.

---

## 🎨 Design System & Reusable Components Reference

| UI Element | Component | Import Path |
|---|---|---|
| **Add / Edit Drawers** | `TopSheet` | `@/components/ui/top-sheet` |
| **Searchable Dropdowns** | `AppDropdown` | `@/components/ui/app-dropdown` |
| **KPI Metric Cards** | `ERPMetricCard` | `@/components/ui/erp-metric-card` |
| **Data Tables & Pagination** | `ERPDataTable` | `@/components/ui/erp-data-table` |
| **Form Layouts** | `ERPFormSection`, `ERPFormGrid`, `ERPFormField` | `@/components/ui/erp-form-layout` |
| **Status Pills** | `StatusBadge`, `ERPStatusPill` | `@/components/ui/status-badge` |
| **Buttons** | `Button` | `@/components/ui/button` |
| **Inputs** | `Input` | `@/components/ui/input` |

---

## Skill Routing (Load when task matches)

| Task | Skill |
|---|---|
| ERP UI / Design system / Forms / Cards | `pathshala-pro-design-system` |
| Codebase navigation & intelligence | CodeGraph (`codegraph explore / node`) |
| Minimalist, clean, non-bloated implementation | `ponytail` |
| New page / component / route | `nextjs-app-router-patterns` |
| Schema / query / migration changes | `prisma-expert` |
| Forms or validation | `zod-validation-expert` |
| UI components / styling | `shadcn`, `tailwind-patterns` |
| Multi-tenant isolation work | `saas-multi-tenant` |
| Auth / session changes | `auth-implementation-patterns`, `backend-security-coder` |
| Tests failing / pre-flight check | `test-fixing`, `verification-before-completion` |

---

## 🧪 Pre-Flight Verification Workflow
Before declaring any task completed:
1. Run `npx tsc --noEmit` to verify 100% type safety.
2. Run `npm run test:all` (executing all 47 test suites / 342+ tests).
3. Ensure zero missing translation keys, zero floating point inaccuracies, and zero unhandled errors.

<!-- CODEGRAPH_START -->
## CodeGraph

In repositories indexed by CodeGraph (a `.codegraph/` directory exists at the repo root), reach for it BEFORE grep/find or reading files when you need to understand or locate code:

- **MCP tools** (when available): `codegraph_explore` answers most code questions in one call — the relevant symbols' verbatim source plus the call paths between them. `codegraph_node` returns one symbol's source + callers, or reads a whole file with line numbers. If the tools are listed but deferred, load them by name via tool search.
- **Shell** (always works): `codegraph explore "<symbol names or question>"` and `codegraph node <symbol-or-file>` print the same output.

If there is no `.codegraph/` directory, skip CodeGraph entirely — indexing is the user's decision.
<!-- CODEGRAPH_END -->
