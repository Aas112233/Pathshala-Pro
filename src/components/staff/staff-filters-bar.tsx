"use client";

import { Button } from "@/components/ui/button";
import { AppDropdown } from "@/components/ui/app-dropdown";
import { X } from "lucide-react";

interface StaffFiltersBarProps {
  department: string;
  status: "ALL" | "ACTIVE" | "INACTIVE";
  gender: "ALL" | "MALE" | "FEMALE" | "OTHER";
  onDepartmentChange: (department: string) => void;
  onStatusChange: (status: "ALL" | "ACTIVE" | "INACTIVE") => void;
  onGenderChange: (gender: "ALL" | "MALE" | "FEMALE" | "OTHER") => void;
  onClearFilters: () => void;
}

export function StaffFiltersBar({
  department,
  status,
  gender,
  onDepartmentChange,
  onStatusChange,
  onGenderChange,
  onClearFilters,
}: StaffFiltersBarProps) {
  const hasActiveFilters = department !== "" || status !== "ALL" || gender !== "ALL";

  const departmentOptions = [
    { value: "", label: "All Departments" },
    { value: "Teaching", label: "Teaching" },
    { value: "Administration", label: "Administration" },
    { value: "Support", label: "Support" },
    { value: "Transport", label: "Transport" },
    { value: "Maintenance", label: "Maintenance" },
  ];

  const statusOptions = [
    { value: "ALL", label: "All Status" },
    { value: "ACTIVE", label: "Active" },
    { value: "INACTIVE", label: "Inactive" },
  ];

  const genderOptions = [
    { value: "ALL", label: "All Genders" },
    { value: "MALE", label: "Male" },
    { value: "FEMALE", label: "Female" },
    { value: "OTHER", label: "Other" },
  ];

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-4">
        {/* Department Filter */}
        <div className="flex-1 min-w-[180px]">
          <AppDropdown
            value={department}
            onChange={onDepartmentChange}
            options={departmentOptions}
            placeholder="Filter by Department"
            searchable
          />
        </div>

        {/* Status Filter */}
        <div className="w-[150px]">
          <AppDropdown
            value={status}
            onChange={(val) => onStatusChange(val as any)}
            options={statusOptions}
            placeholder="Status"
          />
        </div>

        {/* Gender Filter */}
        <div className="w-[150px]">
          <AppDropdown
            value={gender}
            onChange={(val) => onGenderChange(val as any)}
            options={genderOptions}
            placeholder="Gender"
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
            Clear Filters
          </Button>
        )}
      </div>
    </div>
  );
}
