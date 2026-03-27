"use client";

import { Button } from "@/components/ui/button";
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
  const hasActiveFilters = month !== "" || year !== "" || status !== "ALL" || department !== "";

  const departmentOptions = [
    { value: "", label: "All Departments" },
    { value: "Teaching", label: "Teaching" },
    { value: "Administration", label: "Administration" },
    { value: "Support", label: "Support" },
    { value: "Transport", label: "Transport" },
    { value: "Maintenance", label: "Maintenance" },
  ];

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-4">
        {/* Month Filter */}
        <div className="w-[150px]">
          <AppDropdown
            value={month}
            onChange={onMonthChange}
            options={MONTHS}
            placeholder="Month"
          />
        </div>

        {/* Year Filter */}
        <div className="w-[120px]">
          <AppDropdown
            value={year}
            onChange={onYearChange}
            options={YEARS}
            placeholder="Year"
          />
        </div>

        {/* Status Filter */}
        <div className="w-[150px]">
          <AppDropdown
            value={status}
            onChange={onStatusChange}
            options={STATUS_OPTIONS}
            placeholder="Status"
          />
        </div>

        {/* Department Filter */}
        <div className="flex-1 min-w-[180px]">
          <AppDropdown
            value={department}
            onChange={onDepartmentChange}
            options={departmentOptions}
            placeholder="Department"
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
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}
