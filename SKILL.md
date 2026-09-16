---
name: enterprise-erp-design-system
description: Universal, production-grade UI/UX Design System and engineering standards for enterprise ERP and multi-tenant SaaS applications. Defines color tokens (OKLCH), TopSheet top-slide-down form drawers, ERPDataTable with built-in pagination, searchable portal dropdowns (AppDropdown), KPI metric cards (ERPMetricCard), cascading selectors, and strict production-grade rules. Ready to copy and use across any enterprise React / Next.js / Tailwind project.
---

# Enterprise ERP UI/UX Design System & Engineering Standards

A universal, production-grade design system and engineering architecture blueprint for **Enterprise ERP and Multi-Tenant SaaS applications**, synthesized from battle-tested production benchmarks (**Cloudvira ERP**, **Semper Fi Logistics ERP**, and **Pathshala-Pro ERP**).

This guide is **100% portable**: you can copy this file, its component contracts, and rules directly into any Next.js, React, or Tailwind CSS enterprise application.

---

## 1. Visual Foundation & Design Philosophy

### The "Ink & Teal / Cool Slate" Enterprise Aesthetic
Enterprise ERPs differ fundamentally from consumer apps: users work inside them 8–10 hours a day managing payroll, inventory, billing, and sensitive records. The UI must be **calm, dense, legible, and completely distraction-free**.

- **Canvas / Background**: Soft, cool-tinted slate (`#F8F9FD` / `oklch(0.985 0.002 260)` in light mode, `oklch(0.13 0.015 264)` in dark mode).
- **Cards & Surfaces**: Pure white (`#FFFFFF` / `bg-card`), hairline micro-border (`border-border/80` or `oklch(0.915 0.008 264)`), zero or ultra-subtle low-blur shadow (`shadow-none` or `shadow-xs`).
- **Primary Color**: Deep Teal / Royal Indigo (`oklch(0.46 0.12 190)` / `#0F766E` or `oklch(0.488 0.185 264)` / `#4F46E5`). Used for primary CTAs, active navigation pills, focus rings, and selection states.
- **Semantic Accents**:
  - **Success / Active / Paid / Present**: Emerald (`#10B981` / `#22C55E`)
  - **Warning / Pending / Due / Late**: Amber (`#F59E0B`)
  - **Destructive / Error / Absent / Overdue**: Rose (`#EF4444`)
  - **Info / Logistics / Highlights**: Cyan (`#06B6D4`) & Violet (`#8B5CF6`)
  - **Dark Shift / High Contrast**: Dark Slate (`#1E293B` / text-white)

### Typography Hierarchy (Plus Jakarta Sans / Inter)
- **Display KPI Numbers**: `text-2xl` to `text-4xl font-bold tracking-tight text-foreground` (e.g., `236`, `\$1,428.50`).
- **Page Titles**: `text-xl font-semibold tracking-tight text-foreground`.
- **Card Titles & Section Headers**: `text-sm font-semibold tracking-tight text-foreground`.
- **Field Labels & Table Headers**: `text-xs font-semibold uppercase tracking-wider text-muted-foreground`.
- **Body & Table Cells**: `text-xs` to `text-sm font-medium text-foreground`.
- **Helper Text & Metadata**: `text-[11px]` to `text-xs text-muted-foreground`.

### Border Radius & Elevation Scale
- Base radius: `0.625rem` (10px).
- Small elements (pills, badges, small buttons): `rounded-md` (6px–8px).
- Standard inputs, buttons, table containers: `rounded-lg` (8px–10px).
- Large cards, dialogs, sheets: `rounded-xl` to `rounded-2xl` (12px–16px).

---

## 2. App Shell & Layout Architecture

Every enterprise ERP dashboard adheres to a consistent, 3-tier layout hierarchy:

```
+-----------------------------------------------------------------------------------+
|  SIDEBAR (Expanded 260px / Collapsed 68px)  |  TOP HEADER BAR (56px Sticky)       |
|  - Brand Logo + School/Company Switcher    |  - Breadcrumb / Module Switcher     |
|  - Navigation Links + Accordions           |  - Global Search (⌘K / Ctrl+K)      |
|  - Notification Badges                     |  - Alerts / Calendar / Unread Count |
|  - User Profile / Tenant Info              |  - User Profile + Role Avatar       |
+--------------------------------------------+-------------------------------------+
|                                            |  PAGE CONTENT CONTAINER (p-6)       |
|                                            |  1. PageHeader (Icon, Title, CTAs)  |
|                                            |  2. ERPMetricCard Grid (KPIs)       |
|                                            |  3. Filter Toolbar & Search Bar     |
|                                            |  4. ERPDataTable (Data Canvas)      |
|                                            |  5. TopSheet (Slide-down Forms)     |
+-----------------------------------------------------------------------------------+
```

### 5-Step Domain Page Layout Blueprint
Every domain page (e.g. `/students`, `/employees`, `/invoices`, `/inventory`) follows this exact sequence:

1. **`PageHeader`**:
   - Crisp Lucide icon (`size-5 text-muted-foreground`)
   - Domain Title (`text-xl font-semibold`) + Subtitle description
   - Right-side Action Bar: Secondary tools (`Export PDF`, `Export Excel`, `View Switcher`) + Primary CTA (`+ Add Record`).
2. **`ERPMetricCard` Grid**:
   - 2, 3, or 4-column responsive grid displaying key operational metrics.
   - Includes hero number, delta trend badge (`↗ +4.2%`), and sub-metric breakdown progress bars.
3. **Filter Toolbar**:
   - Live search input + cascading dropdowns (`AppDropdown`) + date range picker + clear filters button.
4. **`ERPDataTable`**:
   - Unified data table with search, active filter count, row selection, custom cells, skeleton loader, and pagination.
5. **`TopSheet` Drawer**:
   - Slides down from the top of the viewport when clicking "Add" or "Edit".

---

## 3. Top-Slide-Down Form Architecture (`TopSheet`)

> [!IMPORTANT]
> **Standard Rule:** All "Add New", "Create", and "Update / Edit" forms in the ERP must open from the top of the screen (`TopSheet`), never as narrow right-hand side drawers or jarring center alert popups.

### Why Top-Slide-Down?
1. **Full Horizontal Real Estate**: ERP forms require 2, 3, or 4 columns (personal details, address, financial codes, roles). Side drawers cramp fields into a narrow vertical column.
2. **Context Retention**: Slides down to `max-h-[92vh]`, covering the top header while preserving the bottom page context.
3. **Executive Workspace Feel**: Appears like pulling down a focused document ledger.

### Component Structure & Behavior
- **Trigger**: Click `+ Add Student`, `+ Create Invoice`, or row action `Edit`.
- **Animation**: Slides down smoothly from the top of the viewport (`-translate-y-6` to `translate-y-0` with `transition-all duration-300 ease-out`).
- **Overlay**: Soft backdrop blur (`bg-black/40 backdrop-blur-sm`).
- **Container**: Max width (`max-w-4xl` or `max-w-5xl`), centered horizontally, with bottom rounded corners (`rounded-b-lg shadow-xl`).
- **Sticky Header**: Title, description, status badge, and close button (`X` and `Escape` key).
- **Scrollable Body**: Structured with `ERPFormSection`, `ERPFormGrid`, and `ERPFormField`.
- **Sticky Footer Action Bar**: Fixed at the bottom containing `Cancel`, `Save as Draft`, and `Submit / Update` (with loading spinner).
- **Unsaved Changes Guard**: Automatically tracks form dirty state. Warns user before closing if changes are unsaved.

### Standard TopSheet Form Implementation Pattern:
```tsx
import { useState } from "react";
import { TopSheet } from "@/components/ui/top-sheet";
import { ERPFormSection, ERPFormGrid, ERPFormField } from "@/components/ui/erp-form-layout";
import { AppDropdown } from "@/components/ui/app-dropdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface RecordFormProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: any;
}

export function RecordFormSheet({ isOpen, onClose, initialData }: RecordFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: initialData?.title || "",
    category: initialData?.category || "",
    amount: initialData?.amount || "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      // API call
      toast.success("Record saved successfully");
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save record");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <TopSheet
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? "Edit Record" : "Create New Record"}
      description="Fill in the details below. All required fields are marked with an asterisk."
      maxWidth="4xl"
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <Button variant="outline" type="button" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" form="record-form" loading={isLoading}>
            {initialData ? "Update Record" : "Save Record"}
          </Button>
        </div>
      }
    >
      <form id="record-form" onSubmit={handleSubmit} className="space-y-5">
        <ERPFormSection title="Basic Information" description="Primary identification and categorization">
          <ERPFormGrid cols={2}>
            <ERPFormField label="Title" required>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g. Annual Subscription"
                required
              />
            </ERPFormField>

            <ERPFormField label="Category" required>
              <AppDropdown
                value={formData.category}
                onChange={(val) => setFormData({ ...formData, category: val })}
                options={[
                  { value: "ACADEMIC", label: "Academic" },
                  { value: "ADMINISTRATIVE", label: "Administrative" },
                  { value: "FACILITY", label: "Facility" },
                ]}
              />
            </ERPFormField>
          </ERPFormGrid>
        </ERPFormSection>
      </form>
    </TopSheet>
  );
}
```

---

## 4. Universal Form Layout Primitives (`ERPFormLayout`)

To guarantee unified form spacing, multi-column alignments, and error messaging across all forms:

| Component | Responsibility | Props / Capabilities |
|---|---|---|
| `ERPFormSection` | Grouped card surface with subtle border, title, description, and optional header action slot. | `title`, `description`, `headerAction`, `children` |
| `ERPFormGrid` | Responsive multi-column layout. Adapts cleanly from mobile (`cols=1`) to desktop. | `cols?: 1 \| 2 \| 3 \| 4`, `children` |
| `ERPFormField` | Complete field container: label, red required asterisk, action slot, input slot, helper text, and animated error message. | `label`, `required`, `error`, `helperText`, `htmlFor`, `action` |
| `ERPFormActions` | Bottom toolbar for form actions. Supports `sticky` backdrop blur mode. | `sticky?: boolean`, `children` |

### Field Validation Error Rule
- Field errors must render directly beneath the input using:
  ```tsx
  {error && (
    <span className="text-[11px] font-medium text-rose-500 animate-fadeIn">
      {error}
    </span>
  )}
  ```
- Inputs with errors must receive `aria-invalid="true"` to apply red borders and focus rings.

---

## 5. Universal Searchable Dropdowns (`AppDropdown`)

> [!CAUTION]
> **Strict Rule:** NEVER use raw HTML `<select><option>` tags. Always use `<AppDropdown />` or Radix-based `<Select />`.

### Dropdown Architecture & UX Requirements
1. **Portal-Rendered**: Dropdown menus must render via React Portal (`createPortal(..., document.body)`) so they are never clipped by `overflow-hidden` containers, modals, or table cells.
2. **Auto-Search**: Automatically enables live fuzzy-search whenever options exceed 5 items (or when `searchable={true}` is set).
3. **Smart Viewport Flipping**: Calculates viewport bounds. Flips upward if screen space below is less than `280px`.
4. **Visual Indicator**: Clean checkmark (`Check` icon) beside the currently selected item.
5. **Full Keyboard Support**: Supports `Tab`, `Escape`, `Enter`, and auto-focuses search input on open.

### Usage Example:
```tsx
import { AppDropdown } from "@/components/ui/app-dropdown";

<AppDropdown
  value={selectedClassId}
  onChange={(val) => {
    setSelectedClassId(val);
    setSelectedSectionId(""); // Rule: Reset dependent child selector!
  }}
  options={classes.map((c) => ({ value: c.id, label: c.name }))}
  placeholder="Select Class"
  searchPlaceholder="Search classes..."
/>
```

---

## 6. Cascading & Dependent Selectors Pattern

When selecting organizational hierarchies (e.g. Class $\rightarrow$ Section, Department $\rightarrow$ Employee, Hostel $\rightarrow$ Room $\rightarrow$ Bed):

### Engineering Rules:
1. **Parent-Driven Query Fetch**: Dependent child queries must be enabled only when the parent value is present:
   ```ts
   const { data: sections } = useQuery({
     queryKey: ["sections", { classId: selectedClassId }],
     queryFn: () => fetchSections(selectedClassId),
     enabled: !!selectedClassId,
   });
   ```
2. **Automatic Child State Reset**: Whenever the parent selector changes, immediately reset all child and grandchild selections (`setSectionId("")`, `setSubjectId("")`) to prevent cross-entity data contamination.
3. **Disabled State When Empty**: If parent is unselected, child dropdown must display disabled state with descriptive placeholder (e.g., `"Select Class first"`).

---

## 7. Universal Data Table Architecture (`ERPDataTable`)

Data tables are the core workhorse of any ERP. Rather than writing raw HTML tables or custom wrappers on every page, all tables must use the unified `<ERPDataTable />`.

### Standard Visuals & Interaction Features
1. **Top Section Toolbar**:
   - Title and subtitle
   - Live search input with leading `<Search />` icon and instant filtering
   - Filter trigger button with active filter counter pill (`<Filter className="h-3.5 w-3.5" /> Filter (2)`)
   - Secondary actions slot (e.g., `Export CSV`, `Print Daybook`)
   - Primary action CTA button (e.g., `+ Add Employee`)
2. **Row Checkboxes & Bulk Operations**:
   - Master checkbox in header to toggle all rows.
   - Individual row selection checkboxes.
   - Selection triggers bulk action toolbar (e.g., `Delete Selected`, `Print ID Cards`).
3. **Column Definitions (`ColumnDef<T>`)**:
   - Strongly typed column renderers.
   - Clean alignment (`left`, `center`, `right` for monetary values).
4. **Rich Entity Cells (`ERPUserCell`)**:
   - Circular avatar image or fallback initials badge.
   - Bold primary text (Name / Code).
   - Muted secondary text (Department / Role / ID).
5. **Status & Shift Pills (`ERPStatusPill` & `StatusBadge`)**:
   - Standardized status colors across all modules:
     - `emerald`: Active, Paid, Completed, Present
     - `amber`: Pending, Partial, Warning, Late
     - `rose`: Inactive, Overdue, Failed, Absent, Destructive
     - `indigo` / `cyan`: Compulsory, Info, Scheduled
     - `dark`: Night Shift, Closed, High Priority
6. **Built-in Pagination**:
   - Page size selector (`Rows per page: 5, 10, 20, 50`).
   - Row counter (`startRow-endRow of totalCount`).
   - Chevron page navigation buttons with disabled boundary states.
7. **Skeleton Loading & Empty States**:
   - Renders `<TableSkeleton rows={5} />` while query is pending.
   - Renders descriptive empty state with call-to-action button when query returns 0 rows.

### Usage Example:
```tsx
import { ERPDataTable, ERPUserCell, ERPStatusPill, type ColumnDef } from "@/components/ui/erp-data-table";

interface Employee {
  id: string;
  name: string;
  email: string;
  department: string;
  status: "ACTIVE" | "INACTIVE";
}

const columns: ColumnDef<Employee>[] = [
  {
    key: "name",
    header: "EMPLOYEE",
    cell: (row) => (
      <ERPUserCell
        name={row.name}
        subtitle={row.email}
        initials={row.name.slice(0, 2).toUpperCase()}
      />
    ),
  },
  {
    key: "department",
    header: "DEPARTMENT",
    cell: (row) => <span className="font-medium">{row.department}</span>,
  },
  {
    key: "status",
    header: "STATUS",
    cell: (row) => (
      <ERPStatusPill
        status={row.status}
        variant={row.status === "ACTIVE" ? "emerald" : "subtle"}
      />
    ),
  },
];

export function EmployeeListTable({ data, isLoading }: { data: Employee[]; isLoading: boolean }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedIds, setSelectedIds] = useState<(string | number)[]>([]);

  return (
    <ERPDataTable
      title="Staff Directory"
      subtitle="Manage all active faculty and administrative personnel"
      data={data}
      columns={columns}
      keyExtractor={(row) => row.id}
      searchValue={search}
      onSearchChange={setSearch}
      selectedIds={selectedIds}
      onSelectionChange={setSelectedIds}
      page={page}
      pageSize={pageSize}
      totalCount={data.length}
      onPageChange={setPage}
      onPageSizeChange={setPageSize}
      isLoading={isLoading}
      actionLabel="Add Employee"
      onActionClick={() => openAddSheet()}
    />
  );
}
```

---

## 8. KPI Metric Cards (`ERPMetricCard`)

KPI cards provide immediate operational insight at the top of every domain page.

### Features
1. **Header Row**: Category / Subtitle (`text-[10px] font-medium tracking-wide uppercase text-muted-foreground`), Card Title (`text-sm font-semibold`), and optional Lucide Icon.
2. **Hero Number & Unit**: Large bold stat (`text-2xl font-semibold`) with optional unit (`Employees`, `USD`).
3. **Trend Delta Badge**: Pill with arrow icon (`↗ +4.2%` green or `↘ -2.1%` red).
4. **Sub-metric Breakdown Bars**: Colored progress bars showing distribution (e.g., Active vs Inactive, In-Time vs Late vs Absent).
5. **Card Footer Action**: Full-width link or button (`View All ->`) or sync timestamp (`↻ Last updated 5 min ago`).

### Usage Example:
```tsx
import { ERPMetricCard } from "@/components/ui/erp-metric-card";
import { Users } from "lucide-react";

<ERPMetricCard
  subtitle="HUMAN RESOURCES"
  title="Total Employees"
  value={236}
  icon={Users}
  trend={{ value: "+3.8%", isPositive: true }}
  breakdowns={[
    { label: "Active", count: 215, color: "emerald", percentage: 91 },
    { label: "On Leave", count: 15, color: "amber", percentage: 6 },
    { label: "Terminated", count: 6, color: "rose", percentage: 3 },
  ]}
  actionLabel="Manage Personnel"
  onAction={() => router.push("/staff")}
/>
```

---

## 9. Button Hierarchy & Interactive States

Enterprise buttons must strictly follow visual hierarchy:

| Variant | Use Case | Visual Treatment |
|---|---|---|
| **Primary (`default`)** | Main call-to-action (Save, Post Journal, Create Student) | Solid primary background (`bg-primary text-primary-foreground hover:bg-primary/90`) |
| **Secondary / Outline (`outline`)** | Resets, filters, exports, prints, modal cancel buttons | Bordered, soft muted hover (`border-border bg-background hover:bg-muted`) |
| **Ghost (`ghost`)** | Table row menus, drawer close `X`, tab switches | No border, transparent background, subtle hover |
| **Destructive (`destructive`)** | Delete, terminate, reverse transaction, revoke access | Soft red background with red text (`bg-destructive/10 text-destructive hover:bg-destructive/20`) |

### Async Loading Button Rule
Every async button MUST expose loading state:
- Automatically disable `disabled={loading}`
- Display `<Loader2 className="mr-1.5 size-3.5 animate-spin shrink-0" />`
- Optionally display `loadingText` (e.g. `"Saving..."` instead of `"Save"`)

---

## 10. Strict Design System & Engineering Rules (MANDATORY)

These 10 rules must be followed across all pages and modules without exception:

### 1. Zero Emojis in Enterprise UI
- **Strict Prohibition:** NEVER use emojis anywhere in the interface (no emojis in headings, buttons, toasts, modals, badges, or table headers).
- Use crisp, semantic **Lucide-React SVG icons** (`<Search />`, `<Plus />`, `<Filter />`, `<Users />`, `<CheckCircle2 />`, `<Calendar />`, `<ArrowRight />`, etc.).

### 2. Universal Top-Slide-Down Form Drawers
- All "Add", "Create", and "Edit" workflows MUST use `<TopSheet />` sliding from the top of the viewport. Never use right-side sheets or center alert popups for complex entity records.

### 3. No Raw HTML `<select>` Tags
- All dropdowns must use `<AppDropdown />` (or Radix `<Select />`), rendered via React Portal with auto-search enabled for $>5$ items.

### 4. Cascading Selectors with Auto-Reset
- When a parent filter changes, child states must immediately reset (`setSectionId("")`, `setSubjectId("")`) to eliminate stale or invalid cross-entity selections.

### 5. Deterministic Tables & Built-in Pagination
- Every data table must use `<ERPDataTable />` with page size selector (`[5, 10, 20, 50]`), item range counter, and skeleton loading states.

### 6. Currency & Double-Entry Math Invariant
- Never use JavaScript floating-point arithmetic (`0.1 + 0.2 !== 0.3`) for financial or ledger calculations.
- Store and calculate monetary amounts in integer units/cents (`toCents()`, `addCurrency()`).
- Double-entry journals must balance strictly: `SUM(debits) === SUM(credits)` and all amounts $> 0$.

### 7. Zero Hardcoded Strings (100% i18n Parity)
- All user-facing strings must be localized via i18n translation keys.
- Interpolation placeholders (`{name}`, `{count}`) must match across all application locale files.

### 8. Unmasked API Error Toasts
- API errors must never be masked as generic "An error occurred".
- Surface specific field-level validation errors to the user:
  `[Field '<field>', Code: <code>] <message>`
- ViewModels and mutation callbacks must pass `toast.error(e?.message)`.

### 9. Visual Feedback on All Mutations
- Every mutation must display an active loading state on the button and trigger Sonner toasts (`toast.success(...)` or `toast.error(...)`).
- On successful mutation, automatically invalidate TanStack Query keys.

### 10. Multi-Tenant Scoping & Server-First Business Logic
- Core business logic (fee calculation, payroll deductions, grading formulas, double-entry ledgers) lives strictly on the server.
- Every database query and mutation MUST be scoped by the current tenant ID (`where: { tenantId }`).

---

## 11. Portability Guide: How to Apply to Another Project

To adopt this complete design system in another React / Next.js project:

### Step 1: Install Required Dependencies
```bash
npm install lucide-react clsx tailwind-merge class-variance-authority radix-ui @tanstack/react-table @tanstack/react-query sonner
```

### Step 2: Component Architecture Blueprint
Copy the following core primitives from this design system into your project's `components/ui/` folder:

```
src/
├── components/
│   ├── ui/
│   │   ├── top-sheet.tsx          # Top-slide-down form drawer with backdrop blur
│   │   ├── erp-data-table.tsx     # Unified data table with search, pagination, pills
│   │   ├── erp-form-layout.tsx    # ERPFormSection, ERPFormGrid, ERPFormField
│   │   ├── erp-metric-card.tsx    # KPI card with hero number, trend, breakdown bars
│   │   ├── app-dropdown.tsx       # Searchable portal dropdown
│   │   ├── status-badge.tsx       # Domain-mapped status badge pills
│   │   ├── button.tsx             # Button with built-in Loader2 loading state
│   │   ├── input.tsx              # Clean input with focus rings & error styling
│   │   ├── skeleton.tsx           # TableSkeleton and CardGridSkeleton
│   │   └── checkbox.tsx           # Accessible checkbox for table row selection
│   └── shared/
│       └── page-header.tsx        # Standardized page header with icon & CTA slot
├── lib/
│   ├── utils.ts                   # cn() helper (clsx + tailwind-merge)
│   └── design-tokens.ts          # Central source of truth for colors & spacing
```

### Step 3: Configure Tailwind CSS Tokens (OKLCH)
Add the OKLCH semantic tokens to your `globals.css` or Tailwind configuration:
```css
:root {
  --background: oklch(0.985 0.002 260);
  --foreground: oklch(0.175 0.015 260);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.175 0.015 260);
  --primary: oklch(0.46 0.12 190);
  --primary-foreground: oklch(0.985 0.005 190);
  --muted: oklch(0.955 0.008 250);
  --muted-foreground: oklch(0.49 0.02 250);
  --border: oklch(0.915 0.008 264);
  --radius: 0.625rem;
}
.dark {
  --background: oklch(0.13 0.015 264);
  --foreground: oklch(0.94 0.008 264);
  --card: oklch(0.175 0.018 264);
  --card-foreground: oklch(0.94 0.008 264);
  --border: oklch(0.28 0.02 250);
}
```

With these files in place, every new screen you build will automatically achieve enterprise-grade consistency, polished responsiveness, and battle-tested usability.
