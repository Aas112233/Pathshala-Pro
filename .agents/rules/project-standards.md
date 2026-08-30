# Pathshala-Pro Unified Project Rules & Standards

This document defines the strict, non-negotiable architectural, UI/UX, and coding standards for all AI agents and developers working on **Pathshala-Pro**.

---

## 0. Production-Grade Integrity, Deep Verification & Pushback Protocol (Anti-"Vibecode")
- **NEVER BE A YES-MAN:** If the user or a proposed solution suggests a shortcut, flimsy frontend hack, unbalanceable financial math, weak security, float math, or missing database relations, **YOU MUST PUSH BACK**. Explain clearly *why* it fails in real-world production and implement the battle-tested industry standard.
- **NO RUSHED / SHALLOW ANSWERS:** Never give surface-level answers immediately. Always investigate the actual codebase, trace entity relationships in `schema.prisma`, verify foreign keys, check cascade dependencies, and run compiler/test checks before answering.
- **True Production ERP Standard:** This is an enterprise school management system handling real money, student transcripts, and multi-campus payroll. Zero tolerance for shallow "vibecoded" prototypes that break under production edge-cases.

---

## 1. Professional Non-AI Aesthetic & No Emojis
- **No Emojis:** Do **NOT** use emojis anywhere in the app UI (no emojis in titles, headings, buttons, toasts, notifications, table cells, or badges).
- **Icons:** Always use semantic Lucide-React SVG icons (e.g. `<Search />`, `<Calendar />`, `<Users />`, `<CheckCircle2 />`, `<FileText />`, `<Building2 />`, `<Download />`, `<Plus />`).
- **Visual Feel:** Clean, modern, enterprise SaaS ERP aesthetics (Cloudvira/Semper-Fi inspired). No generic/cartoony AI-generated look.

---

## 2. Universal Data Tables & Built-in Pagination (`ERPDataTable`)
- **Data Table Standard:** Always use `<ERPDataTable />` (from `@/components/ui/erp-data-table`).
- **Visuals:** Semantic column headers with uppercase muted labels, subtle row borders (`border-b border-border/50`), hover states (`hover:bg-muted/30`), alternate row shading, and `<TableSkeleton />` for loading.
- **Built-in Pagination:**
  - Tables must expose pagination controls: page counter (`startRow-endRow of totalCount`), dynamic page size picker (`[10, 20, 50, 100]`), and previous/next navigation buttons.
  - Client state must track `page` and `pageSize` and pass them into query keys and API parameters.

---

## 3. Button Hierarchy & Interactive States
- **Variants:**
  - **Primary (`default`):** For main actions ("Create Student", "Post Journal", "Save").
  - **Secondary (`outline`):** For filter resets, table exports, and print actions.
  - **Subtle / Ghost:** For table row action menus, drawer close buttons, and tab switchers.
  - **Destructive:** For delete, suspend, and cancel operations.
- **Icons & Spinners:** Prefix with Lucide icons (size `h-3.5 w-3.5` or `h-4 w-4`). During async mutations, disable the button and render `<Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />` with an active loading label.

---

## 4. Universal Searchable Dropdowns (`AppDropdown`)
- **No Raw `<select>` HTML Tags:** All select dropdowns MUST use `<AppDropdown>` or `<SelectContent>`.
- **Searchable by Default:** Any dropdown with $> 3$ options or dynamic database records must have real-time live search enabled.
- **Portal Rendering:** Must render into React portals to prevent clipping by tables, drawers, or cards.

---

## 5. Cascading & Dependent Selectors (Parent $\rightarrow$ Child Filtering)
- When a parent filter changes, dependent child filters **MUST** automatically re-filter and reset child selection:
  - **Class $\rightarrow$ Section:** Selecting a Class filters Sections to only show sections in that class.
  - **Class $\rightarrow$ Subject:** Selecting a Class filters subjects assigned to that class curriculum.
  - **Class $\rightarrow$ Fee Structure:** Selecting a Class updates fee heads and default dues.
  - **Hostel $\rightarrow$ Room $\rightarrow$ Bed:** Selecting a Hostel loads its rooms; selecting a room loads available beds.
- Always reset child state (`setSectionId("")`, `setSubjectId("")`) when the parent filter changes.

---

## 6. Server-First Logic Architecture & Data Integrity
- **Core Business Logic Lives on the Server:**
  - Fee calculation, concession stacking, payroll deduction capping, double-entry accounting, and grading formulas MUST be executed in server modules (`src/lib/*`) and validated in API route handlers.
  - Client ViewModels only orchestrate UI state, form bindings, and mutation triggers. Never rely on client-side math alone for financial or academic operations.
- **Strict Data Relationships:**
  - Every Prisma model must enforce foreign key relations and cascade rules.
  - Every database query MUST be scoped by the current tenant (`where: { tenantId }`).

---

## 7. Proper Data Fetching & Cache Management (TanStack Query v5)
- **Deterministic Query Keys:** Include all active filters and pagination states in query keys:
  `queryKey: ["students", { tenantId, page, pageSize, search, classId, sectionId, status }]`
- **Cache Invalidation:** Every mutation (`useMutation`) must automatically invalidate relevant query keys on success:
  `onSuccess: () => qc.invalidateQueries({ queryKey: ["students"] })`

---

## 8. Date, Month & Year Selectors
- Standardize all date and period selectors across Attendance, Fees, Payroll, Accounting, and Reports:
  - **Month Picker:** `<AppDropdown>` with `MONTH_NAMES` or `MONTHS`.
  - **Fiscal Year Picker:** `<AppDropdown>` with dynamic year lists.
  - **Date Picker:** Input with localized tenant date formatting (`DD/MM/YYYY`, `MM/DD/YYYY`, `YYYY-MM-DD`).

---

## 9. Zero Hardcoded Strings (100% 4-Locale Parity)
- Every user-visible string MUST exist in all 4 language files:
  - `src/messages/en.json` (English)
  - `src/messages/ur.json` (Urdu - RTL)
  - `src/messages/hi.json` (Hindi)
  - `src/messages/bn.json` (Bengali)
- All `{var}` interpolation placeholders must match identically across all 4 locales.
- No static text can be rendered without `useTranslations()`.

---

## 10. Exported Documents (PDF & Excel) Multi-Language Support
- **PDF Documents (`@react-pdf/renderer`):**
  - All fee vouchers, report cards, mark sheets, and salary slips must support all 4 app locales.
  - Support UTF-8 glyphs for Bengali, Hindi, and Urdu fonts.
  - Display tenant currency symbol, localized date formatting, and RTL alignment when Urdu locale is active.
- **Excel Daybooks & Reports (`exceljs`):**
  - Exported spreadsheets must use localized column headers, formatted numbers, and proper UTF-8 sheet names.

---

## 11. Universal Error Unmasking
- Error responses must follow the format: `[Field '<field>', Code: <code>] <message>`.
- Client ViewModels must pass `toast.error(e?.message)` so real server messages are visible to the user.

---

## 12. Mathematical & Ledger Invariants
- **Integer Cents:** Use `toCents`, `addCurrency`, and `roundCurrencyStrict` for all money logic.
- **Double Entry:** All journals must enforce non-negative line amounts and `SUM(Debit) === SUM(Credit)`.
- **Payroll Capping:** Deductions are capped sequentially (`LOP -> PF -> Tax -> Loan`) against gross salary.
- **Fee Overpayment:** Excess payments route into Student Advance Wallet (`Account 2050`).

---

## 13. Ponytail Engineering Protocol
- Keep solutions minimal, clean, and concise.
- Avoid over-engineering, unnecessary boilerplate, or speculative abstractions.
- Standard library / native TypeScript first.

---

## 14. Pre-Flight Verification
Always run and pass before declaring any task done:
```bash
npm run test:all
```
*(Executes strict TypeScript check `tsc --noEmit` and all 47 Vitest test suites).*
