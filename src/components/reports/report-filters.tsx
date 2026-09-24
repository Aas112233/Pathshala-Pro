"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TenantDateInput } from "@/components/ui/tenant-date-input";
import { Label } from "@/components/ui/label";
import { AppDropdown } from "@/components/ui/app-dropdown";
import { RotateCcw, Search } from "lucide-react";
import { useTranslations } from "next-intl";

interface ReportFiltersProps {
  filters: ReportFilterState;
  onFilterChange: (filters: ReportFilterState) => void;
  onGenerate: () => void;
  onReset: () => void;
  isLoading?: boolean;
  showClassFilter?: boolean;
  showSectionFilter?: boolean;
  showGroupFilter?: boolean;
  showStatusFilter?: boolean;
  showPaymentMethodFilter?: boolean;
  showExamTypeFilter?: boolean;
  statusOptions?: { value: string; label: string }[];
  classes?: { id: string; name: string }[];
  sections?: { id: string; name: string }[];
  groups?: { id: string; name: string }[];
  exportComponent?: React.ReactNode;
}

export interface ReportFilterState {
  fromDate: string;
  toDate: string;
  classId?: string;
  sectionId?: string;
  groupId?: string;
  status?: string;
  paymentMethod?: string;
  examType?: string;
  academicYearId?: string;
}

const ALL = "all";

/**
 * Shared report filter bar.
 *
 * Uses AppDropdown rather than a raw <select> (AGENTS.md §4): dropdowns render
 * through a portal so they are never clipped by the surrounding card, and class
 * / section / group lists are live-searchable.
 *
 * Cascading rule (AGENTS.md §5): changing the class clears any previously
 * chosen section and group, and those child selectors stay disabled until a
 * specific class is picked — otherwise a stale section from the previous class
 * would silently mis-scope the report.
 */
export function ReportFilters({
  filters,
  onFilterChange,
  onGenerate,
  onReset,
  isLoading = false,
  showClassFilter = false,
  showSectionFilter = false,
  showGroupFilter = false,
  showStatusFilter = false,
  showPaymentMethodFilter = false,
  showExamTypeFilter = false,
  statusOptions,
  classes = [],
  sections = [],
  groups = [],
  exportComponent,
}: ReportFiltersProps) {
  const t = useTranslations("reports");
  const tCommon = useTranslations("reports.common");

  const searchPlaceholder = tCommon("searchPlaceholder");
  const noOptionsText = tCommon("noRecordsTitle");

  const resolvedStatusOptions = statusOptions ?? [
    { value: "PENDING", label: t("filters.pending") },
    { value: "PAID", label: t("filters.paid") },
    { value: "PARTIAL", label: t("filters.partial") },
    { value: "OVERDUE", label: t("filters.overdue") },
  ];

  const handleFromDateChange = (iso: string) => {
    onFilterChange({ ...filters, fromDate: iso });
  };

  const handleToDateChange = (iso: string) => {
    onFilterChange({ ...filters, toDate: iso });
  };

  const handleClassChange = (value: string) => {
    // Parent changed: drop stale child selections (a section/group from the
    // previous class would silently mis-scope the generated report).
    onFilterChange({ ...filters, classId: value, sectionId: undefined, groupId: undefined });
  };

  const handleSectionChange = (value: string) => {
    onFilterChange({ ...filters, sectionId: value });
  };

  const handleGroupChange = (value: string) => {
    onFilterChange({ ...filters, groupId: value });
  };

  const handleStatusChange = (value: string) => {
    onFilterChange({ ...filters, status: value });
  };

  const handlePaymentMethodChange = (value: string) => {
    onFilterChange({ ...filters, paymentMethod: value });
  };

  const handleExamTypeChange = (value: string) => {
    onFilterChange({ ...filters, examType: value });
  };

  // Child filters are only meaningful for one specific class. "all"/empty
  // means unscoped, so keep them disabled until a class is picked.
  const hasSpecificClass = Boolean(filters.classId) && filters.classId !== ALL;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* From Date */}
          <div className="space-y-2">
            <Label htmlFor="fromDate">{t("filters.fromDate")}</Label>
            <TenantDateInput
              id="fromDate"
              value={filters.fromDate}
              onChange={handleFromDateChange}
            />
          </div>

          {/* To Date */}
          <div className="space-y-2">
            <Label htmlFor="toDate">{t("filters.toDate")}</Label>
            <TenantDateInput
              id="toDate"
              value={filters.toDate}
              onChange={handleToDateChange}
            />
          </div>

          {/* Class Filter */}
          {showClassFilter && (
            <div className="space-y-2">
              <Label>{t("filters.class")}</Label>
              <AppDropdown
                value={filters.classId || ALL}
                onChange={handleClassChange}
                placeholder={t("filters.selectClass")}
                searchable
                searchPlaceholder={searchPlaceholder}
                noOptionsText={noOptionsText}
                options={[
                  { value: ALL, label: t("filters.allClasses") },
                  ...classes.map((cls) => ({ value: cls.id, label: cls.name })),
                ]}
              />
            </div>
          )}

          {/* Section Filter */}
          {showSectionFilter && (
            <div className="space-y-2">
              <Label>{t("filters.section")}</Label>
              <AppDropdown
                value={filters.sectionId || ALL}
                onChange={handleSectionChange}
                disabled={!hasSpecificClass}
                placeholder={
                  hasSpecificClass ? t("filters.selectSection") : t("filters.selectClassFirst")
                }
                searchable
                searchPlaceholder={searchPlaceholder}
                noOptionsText={noOptionsText}
                options={[
                  { value: ALL, label: t("filters.allSections") },
                  ...sections.map((section) => ({ value: section.id, label: section.name })),
                ]}
              />
            </div>
          )}

          {/* Group Filter */}
          {showGroupFilter && (
            <div className="space-y-2">
              <Label>{t("filters.group")}</Label>
              <AppDropdown
                value={filters.groupId || ALL}
                onChange={handleGroupChange}
                disabled={!hasSpecificClass}
                placeholder={
                  hasSpecificClass ? t("filters.selectGroup") : t("filters.selectClassFirst")
                }
                searchable
                searchPlaceholder={searchPlaceholder}
                noOptionsText={noOptionsText}
                options={[
                  { value: ALL, label: t("filters.allGroups") },
                  ...groups.map((group) => ({ value: group.id, label: group.name })),
                ]}
              />
            </div>
          )}

          {/* Status Filter */}
          {showStatusFilter && (
            <div className="space-y-2">
              <Label>{t("filters.status")}</Label>
              <AppDropdown
                value={filters.status || ALL}
                onChange={handleStatusChange}
                placeholder={t("filters.selectStatus")}
                searchable
                searchPlaceholder={searchPlaceholder}
                noOptionsText={noOptionsText}
                options={[
                  { value: ALL, label: t("filters.allStatus") },
                  ...resolvedStatusOptions,
                ]}
              />
            </div>
          )}

          {/* Payment Method Filter */}
          {showPaymentMethodFilter && (
            <div className="space-y-2">
              <Label>{t("filters.paymentMethod")}</Label>
              <AppDropdown
                value={filters.paymentMethod || ALL}
                onChange={handlePaymentMethodChange}
                placeholder={t("filters.selectPaymentMethod")}
                searchable
                searchPlaceholder={searchPlaceholder}
                noOptionsText={noOptionsText}
                options={[
                  { value: ALL, label: t("filters.allMethods") },
                  { value: "CASH", label: t("filters.cash") },
                  { value: "DIGITAL", label: t("filters.digital") },
                ]}
              />
            </div>
          )}

          {/* Exam Type Filter */}
          {showExamTypeFilter && (
            <div className="space-y-2">
              <Label>{t("filters.examType")}</Label>
              <AppDropdown
                value={filters.examType || ALL}
                onChange={handleExamTypeChange}
                placeholder={t("filters.selectExamType")}
                searchable
                searchPlaceholder={searchPlaceholder}
                noOptionsText={noOptionsText}
                options={[
                  { value: ALL, label: t("filters.allExamTypes") },
                  { value: "MID_TERM", label: t("filters.midTerm") },
                  { value: "FINAL", label: t("filters.final") },
                  { value: "UNIT_TEST", label: t("filters.unitTest") },
                  { value: "QUARTERLY", label: t("filters.quarterly") },
                  { value: "HALF_YEARLY", label: t("filters.halfYearly") },
                  { value: "ANNUAL", label: t("filters.annual") },
                ]}
              />
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-4 flex items-center justify-between">
          {/* Export Section */}
          {exportComponent && <div>{exportComponent}</div>}

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onReset}>
              <RotateCcw className="mr-2 h-4 w-4" />
              {t("actions.reset")}
            </Button>
            <Button onClick={onGenerate} disabled={isLoading}>
              <Search className="mr-2 h-4 w-4" />
              {isLoading ? t("common.generating") : t("actions.generate")}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
