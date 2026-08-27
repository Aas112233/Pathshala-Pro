---
name: pathshala-pro-design-system
description: Complete Unified ERP Design System guide for Pathshala-Pro (inspired by Cloudvira ERP & Semper Fi Logistics ERP). Defines UI tokens, top-slide-down form drawers (TopSheet), KPI metric cards, ERP data tables, multi-column forms, status pills, and layout hierarchy.
---

# Pathshala-Pro Unified ERP Design System

This design system defines the aesthetic standards, component architecture, and interaction patterns for Pathshala-Pro ERP, synthesized from enterprise benchmarks (**Cloudvira ERP** & **Semper Fi Logistics ERP**).

---

## 1. Visual Foundation & Color Palette

### Theme & Atmosphere
- **Canvas / Background**: Clean, airy, soft cool-tinted slate (`#F8F9FD` / `oklch(0.985 0.002 260)` in light mode, `oklch(0.13 0.015 264)` in dark mode).
- **Cards & Surfaces**: Pure white (`#FFFFFF` / `bg-card`), hairline border (`border-border/60`), subtle low-blur shadow (`shadow-xs` / `shadow-[0_1px_3px_rgba(0,0,0,0.05)]`), and generous `rounded-2xl` (16px–20px) corners.
- **Primary Color**: Royal Indigo (`oklch(0.488 0.185 264)` / `#6366F1` / `#4F46E5`). Used for active navigation pills, primary CTA buttons, focus rings, and selection highlights.
- **Secondary / Semantic**:
  - **Success / Present / Active**: Emerald (`#10B981` / `#22C55E`)
  - **Warning / Late / Pending**: Amber (`#F59E0B`)
  - **Error / Absent / Destructive**: Rose / Red (`#EF4444`)
  - **Info / Logistics / Highlights**: Cyan (`#06B6D4`) & Violet (`#8B5CF6`)
  - **Dark Shift / Emphasis Badge**: Slate-800 (`#1E293B` / text white)

### Typography Scale
- **Display Stats**: `text-3xl` to `text-4xl font-bold tracking-tight text-foreground` (e.g., `236`, `1,428`)
- **Card Titles & Section Headers**: `text-lg font-semibold tracking-tight text-foreground` (e.g., `Shift Distribution`, `Overview`)
- **Sub-headers & Labels**: `text-xs font-semibold uppercase tracking-wider text-muted-foreground` (e.g., `VEHICLES ON TRACK`, `DEPARTMENTS`)
- **Body & Table Text**: `text-sm font-medium text-foreground`
- **Captions & Meta**: `text-xs text-muted-foreground`

---

## 2. Top-Slide-Down Form Architecture (`TopSheet`)

> [!IMPORTANT]
> **All "Add New", "Create", and "Update / Edit" forms in the ERP must open from the top of the screen.**

### UX Behavior & Specifications
- **Trigger**: Click "Add Student", "Add Staff", "Edit Fee Voucher", "New Admission", etc.
- **Animation**: Slides down smoothly from the top of the viewport (`-translate-y-full` to `translate-y-0` with `transition-all duration-300 ease-out`).
- **Overlay**: Backdrop blur (`bg-black/40 backdrop-blur-sm`).
- **Container**: Max width (`max-w-4xl` or `max-w-5xl`), centered horizontally, attached to the top with rounded bottom corners (`rounded-b-2xl shadow-2xl`).
- **Sticky Header**: Title, subtitle / breadcrumb, status badge, and close button (`X` and `Escape` key).
- **Scrollable Body**: Clean 2-column or 3-column responsive grid layout with grouped field cards.
- **Sticky Footer Action Bar**: Bottom toolbar with `Cancel`, `Save as Draft`, and `Submit / Update` button (with loading spinner).

### Usage Example:
```tsx
import { TopSheet } from "@/components/ui/top-sheet";
import { ERPFormSection, ERPFormGrid, ERPFormField } from "@/components/ui/erp-form-layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function AddStudentSheet({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <TopSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Add New Student"
      description="Register a new student profile and assign academic class & section."
      maxWidth="4xl"
      footer={
        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="outline">Save as Draft</Button>
          <Button>Save Student</Button>
        </div>
      }
    >
      <div className="space-y-6 py-2">
        <ERPFormSection title="Personal Information" description="Basic student biographical details">
          <ERPFormGrid cols={3}>
            <ERPFormField label="First Name" required>
              <Input placeholder="e.g. John" />
            </ERPFormField>
            <ERPFormField label="Last Name" required>
              <Input placeholder="e.g. Doe" />
            </ERPFormField>
            <ERPFormField label="Gender" required>
              <Input placeholder="Select gender" />
            </ERPFormField>
          </ERPFormGrid>
        </ERPFormSection>
      </div>
    </TopSheet>
  );
}
```

---

## 3. KPI Metric Cards (`ERPMetricCard`)

As seen in Cloudvira and Semper Fi dashboards, KPI cards provide instant operational visibility.

### Features
1. **Header Row**: Left title or uppercase category, right-aligned `...` context menu or `DETAILS` link.
2. **Hero Number**: Large bold metric with optional unit (e.g. `236 Employees`, `9,158.3 miles`).
3. **Trend Badge**: Delta pill with arrow icon (`↗ +2.4%` green or `↘ -7.6%` red).
4. **Sub-metric Breakdown Bars**: Mini progress indicators with label, count, and colored status line (In-time, Late, Absent, Vacation).
5. **Card Footer Action**: Full-width outline button (`View Employees`, `View Departments`) or sync timestamp (`↻ Last Updated 10 min ago`).

### Usage Example:
```tsx
import { ERPMetricCard } from "@/components/ui/erp-metric-card";

<ERPMetricCard
  title="Employees"
  subtitle="HUMAN RESOURCES"
  value="236"
  trend={{ value: "+4.2%", isPositive: true }}
  breakdowns={[
    { label: "In-time", count: 60, color: "emerald" },
    { label: "Late", count: 15, color: "amber" },
    { label: "Absents", count: 4, color: "rose" },
    { label: "On Vacation", count: 1, color: "cyan" },
  ]}
  actionLabel="View Employees"
  onAction={() => router.push("/staff")}
/>
```

---

## 4. ERP Data Table (`ERPDataTable`)

Data tables are the core operational workspace for school administrators, teachers, and finance teams.

### Features
1. **Toolbar Header**:
   - Filter button with filter icon and active badge count.
   - Search input with clear button.
   - Secondary / Primary action buttons (`Export`, `View Report`, `Add Record`).
2. **Row Checkboxes**: Master select-all checkbox and individual row select state for batch actions.
3. **Rich Entity Avatar Cell**: Circular avatar image / initials + bold primary title + muted role/department subtitle.
4. **Shift & Status Pills**:
   - **Night Shift / High Contrast**: Dark slate pill (`bg-slate-800 text-white font-medium`).
   - **Day Shift / Subtle**: Outlined soft slate pill (`border border-slate-200 bg-slate-50 text-slate-700`).
   - **Success / Active**: Emerald pill (`bg-emerald-50 text-emerald-700 border border-emerald-200`).
5. **Row Context Menu**: 3-dot vertical menu (`MoreVertical`) for Quick Edit, Delete, View Profile, Download Slip.
6. **Pagination Footer**: Rows-per-page selector (`Rows per page: 5 / 10 / 25 / 50`), count label (`1-5 of 276`), and previous/next page navigation buttons.

---

## 5. Header & Navigation Structure

- **Top Header**:
  - Module switcher / current domain indicator.
  - Global search (`⌘K`).
  - Quick action toolbar: Bookmark, Calendar, Chat, Notification Bell with unread counter pill (`12`), User Profile avatar with presence indicator (`Available`).
- **Sidebar**:
  - Logo with clean rounded icon.
  - Active navigation pill: Solid soft indigo highlight with bold text and active icon tint.
  - Expandable nested accordion items with chevron indicators.
  - Notification count badges on Messages, Tasks, Circulars.

---

## 6. Component Checklist for Every Page

When building or updating a domain page in Pathshala-Pro:
- [ ] Metric cards use `ERPMetricCard` with sub-stat progress bars or trend badges.
- [ ] Tables use `ERPDataTable` with search bar, filter triggers, status pills, and pagination.
- [ ] All Add / Edit forms use `TopSheet` sliding smoothly from the top of the viewport.
- [ ] Form layouts use `ERPFormSection` and `ERPFormGrid` for structured multi-column arrangement.
- [ ] Colors and spacing strictly use tokens from `src/lib/design-tokens.ts`.
- [ ] Code navigation and symbol lookups use **CodeGraph**.
