"use client";

import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("salary");
  if (hasActiveFilters) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="rounded-full bg-muted p-6 mb-4">
          <Filter className="h-12 w-12 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">
          {t("ui.empty.noRecords")}
        </h3>
        <p className="text-sm text-muted-foreground max-w-md mb-4">
          {t("ui.empty.noRecordsHint")}
        </p>
        <Button variant="outline" onClick={onClearFilters}>
          {t("ui.empty.clearFilters")}
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
        {t("ui.empty.noRecordsYet")}
      </h3>
      <p className="text-sm text-muted-foreground max-w-md mb-6">
        {t("ui.empty.getStarted")}
      </p>
      <div className="flex gap-3">
        <Button onClick={onProcessPayroll}>
          <Plus className="mr-2 h-4 w-4" />
          {t("ui.empty.processSingle")}
        </Button>
        <Button variant="outline" onClick={onBulkPayroll}>
          <Wallet className="mr-2 h-4 w-4" />
          {t("ui.bulkPayroll")}
        </Button>
      </div>
    </div>
  );
}
