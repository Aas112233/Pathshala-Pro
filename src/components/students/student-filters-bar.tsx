"use client";

import { Filter, X } from "lucide-react";
import { AppDropdown } from "@/components/ui/app-dropdown";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { StudentStatusFilter } from "@/viewmodels/students/use-student-view-model";

interface StudentFiltersProps {
  status: StudentStatusFilter;
  gender: "ALL" | "MALE" | "FEMALE" | "OTHER";
  onStatusChange: (status: StudentStatusFilter) => void;
  onGenderChange: (gender: "ALL" | "MALE" | "FEMALE" | "OTHER") => void;
  onClearFilters: () => void;
  className?: string;
}

export function StudentFiltersBar({
  status,
  gender,
  onStatusChange,
  onGenderChange,
  onClearFilters,
  className,
}: StudentFiltersProps) {
  const hasActiveFilters = status !== "ALL" || gender !== "ALL";

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3",
        className
      )}
    >
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Filter className="h-4 w-4" />
        <span>Filters:</span>
      </div>

      <div className="flex flex-1 flex-wrap items-center gap-3">
        <div className="min-w-[150px]">
          <AppDropdown
            value={status}
            onChange={(val) => onStatusChange(val as StudentStatusFilter)}
            options={[
              { value: "ALL", label: "All Statuses" },
              { value: "ACTIVE", label: "Active" },
              { value: "INACTIVE", label: "Inactive" },
              { value: "SUSPENDED", label: "Suspended" },
            ]}
          />
        </div>

        <div className="min-w-[150px]">
          <AppDropdown
            value={gender}
            onChange={(val) => onGenderChange(val as "ALL" | "MALE" | "FEMALE" | "OTHER")}
            options={[
              { value: "ALL", label: "All Genders" },
              { value: "MALE", label: "Male" },
              { value: "FEMALE", label: "Female" },
              { value: "OTHER", label: "Other" },
            ]}
          />
        </div>
      </div>

      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearFilters}
          className="text-muted-foreground"
        >
          <X className="mr-1 h-4 w-4" />
          Clear
        </Button>
      )}
    </div>
  );
}
