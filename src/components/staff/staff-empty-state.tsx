"use client";

import { Button } from "@/components/ui/button";
import { Users, Plus, Search, Filter } from "lucide-react";

interface StaffEmptyStateProps {
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  onAddNew: () => void;
}

export function StaffEmptyState({
  hasActiveFilters,
  onClearFilters,
  onAddNew,
}: StaffEmptyStateProps) {
  if (hasActiveFilters) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="rounded-full bg-muted p-6 mb-4">
          <Filter className="h-12 w-12 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">
          No staff members found
        </h3>
        <p className="text-sm text-muted-foreground max-w-md mb-4">
          We couldn&apos;t find any staff members matching your current filters. Try adjusting your search or filter criteria.
        </p>
        <Button variant="outline" onClick={onClearFilters}>
          Clear Filters
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-full bg-muted p-6 mb-4">
        <Users className="h-12 w-12 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">
        No staff members yet
      </h3>
      <p className="text-sm text-muted-foreground max-w-md mb-4">
        Get started by adding your first staff member to the system. You can add teaching staff, administrative staff, and support staff.
      </p>
      <Button onClick={onAddNew}>
        <Plus className="mr-2 h-4 w-4" />
        Add First Staff Member
      </Button>
    </div>
  );
}
