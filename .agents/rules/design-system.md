# Pathshala-Pro Unified ERP Design System Rules

All UI development in Pathshala-Pro must adhere to the Unified ERP Design System (synthesized from modern high-end ERP benchmarks like Cloudvira and Semper Fi Logistics):

1. **Visual Tone & Theme:**
   - Soft, low-contrast canvas (`bg-background` / slate-50 `#F8F9FD` in light mode, deep slate in dark mode).
   - Crisp white widget cards (`bg-card`) with hairline borders (`border-border/60`) and subtle elevation (`shadow-xs` / `shadow-sm`).
   - Accent color: Primary Royal Indigo (`oklch(0.488 0.185 264)` / `#6366F1` / `#4F46E5`).
   - Semantic status indicators: Success Emerald (`#10B981`), Warning Amber (`#F59E0B`), Destructive Rose (`#EF4444`), Info Cyan (`#06B6D4`).

2. **Top-Slide-Down Drawer for Forms:**
   - ALL Add New and Update forms MUST open from the **top of the screen** using the `TopSheet` (`src/components/ui/top-sheet.tsx`) component.
   - Never use standard center dialogs or small popups for entity creation/editing; use the Top-Slide-Down Sheet with backdrop blur, sticky title header, multi-column section grid, and sticky bottom action bar.

3. **Metrics & KPI Cards:**
   - Use `ERPMetricCard` (`src/components/ui/erp-metric-card.tsx`) for dashboard stat counters.
   - Include uppercase sub-header, hero numerical stat, trend badge, breakdown progress bars, and bottom action button.

4. **Data Tables & Grids:**
   - Use `ERPDataTable` (`src/components/ui/erp-data-table.tsx`) or table tokens with:
     - Search & filter toolbar with action buttons.
     - Row selection checkbox column.
     - Rich user avatar cell (avatar image/initials, full name, role caption).
     - Color-coded shift/status pills (e.g. Night shift dark slate `#1E293B`, Day shift subtle border).
     - 3-dot context menu for row actions.
     - Responsive pagination footer with rows-per-page selector.

5. **Design Tokens & Icons:**
   - Consume tokens from `src/lib/design-tokens.ts`.
   - Use `lucide-react` for all UI icons.
