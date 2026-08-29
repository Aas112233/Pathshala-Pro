"use client";

import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import { AppDropdown } from "@/components/ui/app-dropdown";
import { X } from "lucide-react";

interface SalaryFiltersBarProps {
  month: string;
  year: string;
  status: "ALL" | "PENDING" | "PARTIAL" | "PAID";
  department: string;
  onMonthChange: (month: string) => void;
  onYearChange: (year: string) => void;
  onStatusChange: (status: "ALL" | "PENDING" | "PARTIAL" | "PAID") => void;
  onDepartmentChange: (department: string) => void;
  onClearFilters: () => void;
}

const MONTHS = [
  { value: "", label: "All Months" },
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

const currentYear = new Date().getFullYear();
const YEARS = [
  { value: "", label: "All Years" },
  ...Array.from({ length: 10 }, (_, i) => currentYear - i).map(year => ({
    value: year.toString(),
    label: year.toString(),
  })),
];

const STATUS_OPTIONS = [
  { value: "ALL", label: "All Status" },
  { value: "PENDING", label: "Pending" },
  { value: "PARTIAL", label: "Partial" },
  { value: "PAID", label: "Paid" },
];

export function SalaryFiltersBar({
  month,
  year,
  status,
  department,
  onMonthChange,
  onYearChange,
  onStatusChange,
  onDepartmentChange,
  onClearFilters,
}: SalaryFiltersBarProps) {
  const t = useTranslations("salary");
  const hasActiveFilters = month !== "" || year !== "" || status !== "ALL" || department !== "";

  const departmentOptions = [
    { value: "", label: t("ui.filters.allDepartments") },
    { value: "Teaching", label: t("ui.filters.teaching") },
    { value: "Administration", label: t("ui.filters.administration") },
    { value: "Support", label: t("ui.filters.support") },
    { value: "Transport", label: t("ui.filters.transport") },
    { value: "Maintenance", label: t("ui.filters.maintenance") },
  ];

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-4">
        {/* Month Filter */}
        <div className="w-[150px]">
          <AppDropdown
            value={month}
            onChange={onMonthChange}
            options={MONTHS.map((option) => ({ ...option, label: option.value ? t(`ui.months.${["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"][Number(option.value) - 1]}`) : t("ui.filters.allMonths") }))}
            placeholder={t("ui.filters.month")}
          />
        </div>

        {/* Year Filter */}
        <div className="w-[120px]">
          <AppDropdown
            value={year}
            onChange={onYearChange}
            options={YEARS.map((option) => ({ ...option, label: option.value ? option.label : t("ui.filters.allYears") }))}
            placeholder={t("ui.filters.year")}
          />
        </div>

        {/* Status Filter */}
        <div className="w-[150px]">
          <AppDropdown
            value={status}
            onChange={(value) => onStatusChange(value as "ALL" | "PENDING" | "PARTIAL" | "PAID")}
            options={STATUS_OPTIONS.map((option) => ({ ...option, label: option.value === "ALL" ? t("ui.filters.allStatus") : t(`ui.filters.${option.value.toLowerCase()}`) }))}
            placeholder={t("ui.filters.status")}
          />
        </div>

        {/* Department Filter */}
        <div className="flex-1 min-w-[180px]">
          <AppDropdown
            value={department}
            onChange={onDepartmentChange}
            options={departmentOptions}
            placeholder={t("ui.filters.department")}
            searchable
          />
        </div>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="shrink-0"
          >
            <X className="h-4 w-4 mr-1" />
            {t("ui.filters.clear")}
          </Button>
        )}
      </div>
    </div>
  );
}
