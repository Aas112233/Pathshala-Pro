"use client";

import { GraduationCap, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface StudentsEmptyStateProps {
  title?: string;
  description?: string;
  showIllustration?: boolean;
  onAddNew?: () => void;
  onClearFilters?: () => void;
  hasActiveFilters?: boolean;
  className?: string;
}

export function StudentsEmptyState({
  title = "No students found",
  description = "Get started by adding your first student or adjust your filters.",
  showIllustration = true,
  onAddNew,
  onClearFilters,
  hasActiveFilters = false,
  className,
}: StudentsEmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 p-12 text-center",
        className
      )}
    >
      {showIllustration && (
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
          {hasActiveFilters ? (
            <Search className="h-10 w-10 text-primary" />
          ) : (
            <GraduationCap className="h-10 w-10 text-primary" />
          )}
        </div>
      )}

      <h3 className="mb-2 text-lg font-semibold text-foreground">{title}</h3>
      <p className="mb-6 max-w-md text-sm text-muted-foreground">{description}</p>

      <div className="flex items-center gap-3">
        {hasActiveFilters && onClearFilters && (
          <Button variant="outline" onClick={onClearFilters}>
            Clear Filters
          </Button>
        )}
        {onAddNew && (
          <Button onClick={onAddNew}>
            <Plus className="mr-2 h-4 w-4" />
            Add Student
          </Button>
        )}
      </div>
    </div>
  );
}
