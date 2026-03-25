"use client";

import { LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StudentViewMode } from "@/viewmodels/students/use-student-view-model";

interface StudentViewSwitcherProps {
  viewMode: StudentViewMode;
  onViewModeChange: (mode: StudentViewMode) => void;
  className?: string;
}

export function StudentViewSwitcher({
  viewMode,
  onViewModeChange,
  className,
}: StudentViewSwitcherProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-lg border border-border bg-background p-1",
        className
      )}
    >
      <button
        onClick={() => onViewModeChange("table")}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
          viewMode === "table"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
        aria-label="Table view"
      >
        <List className="h-4 w-4" />
        <span className="hidden sm:inline">Table</span>
      </button>
      <button
        onClick={() => onViewModeChange("grid")}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
          viewMode === "grid"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
        aria-label="Grid view"
      >
        <LayoutGrid className="h-4 w-4" />
        <span className="hidden sm:inline">Grid</span>
      </button>
    </div>
  );
}
