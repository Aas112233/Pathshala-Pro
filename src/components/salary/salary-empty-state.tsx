"use client";

import { Button } from "@/components/ui/button";
import { Wallet, Plus, Search, Filter } from "lucide-react";

interface SalaryEmptyStateProps {
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  onProcessPayroll: () => void;
  onBulkPayroll: () => void;
}

export function SalaryEmptyState({
  hasActiveFilters,
  onClearFilters,
  onProcessPayroll,
  onBulkPayroll,
}: SalaryEmptyStateProps) {
  if (hasActiveFilters) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="rounded-full bg-muted p-6 mb-4">
          <Filter className="h-12 w-12 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">
          No salary records found
        </h3>
        <p className="text-sm text-muted-foreground max-w-md mb-4">
          We couldn&apos;t find any salary records matching your current filters. Try adjusting your search or filter criteria.
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
        <Wallet className="h-12 w-12 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">
        No salary records yet
      </h3>
      <p className="text-sm text-muted-foreground max-w-md mb-6">
        Get started by processing payroll for your staff. You can process individual salary records or handle multiple staff at once.
      </p>
      <div className="flex gap-3">
        <Button onClick={onProcessPayroll}>
          <Plus className="mr-2 h-4 w-4" />
          Process Single Salary
        </Button>
        <Button variant="outline" onClick={onBulkPayroll}>
          <Wallet className="mr-2 h-4 w-4" />
          Bulk Payroll
        </Button>
      </div>
    </div>
  );
}
