"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  const resolvedStatusOptions = statusOptions ?? [
    { value: "PENDING", label: t("filters.pending") },
    { value: "PAID", label: t("filters.paid") },
    { value: "PARTIAL", label: t("filters.partial") },
    { value: "OVERDUE", label: t("filters.overdue") },
  ];

  const handleFromDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({ ...filters, fromDate: e.target.value });
  };

  const handleToDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({ ...filters, toDate: e.target.value });
  };

  const handleClassChange = (value: string) => {
    onFilterChange({ ...filters, classId: value });
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

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* From Date */}
          <div className="space-y-2">
            <Label htmlFor="fromDate">{t("filters.fromDate")}</Label>
            <Input
              id="fromDate"
              type="date"
              value={filters.fromDate}
              onChange={handleFromDateChange}
            />
          </div>

          {/* To Date */}
          <div className="space-y-2">
            <Label htmlFor="toDate">{t("filters.toDate")}</Label>
            <Input
              id="toDate"
              type="date"
              value={filters.toDate}
              onChange={handleToDateChange}
            />
          </div>

          {/* Class Filter */}
          {showClassFilter && (
            <div className="space-y-2">
              <Label>{t("filters.class")}</Label>
              <Select value={filters.classId || ""} onValueChange={handleClassChange}>
                <SelectTrigger>
                  <SelectValue placeholder={t("filters.selectClass")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("filters.allClasses")}</SelectItem>
                  {classes.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Section Filter */}
          {showSectionFilter && (
            <div className="space-y-2">
              <Label>{t("filters.section")}</Label>
              <Select value={filters.sectionId || ""} onValueChange={handleSectionChange}>
                <SelectTrigger>
                  <SelectValue placeholder={t("filters.selectSection")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("filters.allSections")}</SelectItem>
                  {sections.map((section) => (
                    <SelectItem key={section.id} value={section.id}>
                      {section.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Group Filter */}
          {showGroupFilter && (
            <div className="space-y-2">
              <Label>{t("filters.group")}</Label>
              <Select value={filters.groupId || ""} onValueChange={handleGroupChange}>
                <SelectTrigger>
                  <SelectValue placeholder={t("filters.selectGroup")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("filters.allGroups")}</SelectItem>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Status Filter */}
          {showStatusFilter && (
            <div className="space-y-2">
              <Label>{t("filters.status")}</Label>
              <Select value={filters.status || ""} onValueChange={handleStatusChange}>
                <SelectTrigger>
                  <SelectValue placeholder={t("filters.selectStatus")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("filters.allStatus")}</SelectItem>
                  {resolvedStatusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Payment Method Filter */}
          {showPaymentMethodFilter && (
            <div className="space-y-2">
              <Label>{t("filters.paymentMethod")}</Label>
              <Select
                value={filters.paymentMethod || ""}
                onValueChange={handlePaymentMethodChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("filters.selectPaymentMethod")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("filters.allMethods")}</SelectItem>
                  <SelectItem value="CASH">{t("filters.cash")}</SelectItem>
                  <SelectItem value="DIGITAL">{t("filters.digital")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Exam Type Filter */}
          {showExamTypeFilter && (
            <div className="space-y-2">
              <Label>{t("filters.examType")}</Label>
              <Select value={filters.examType || ""} onValueChange={handleExamTypeChange}>
                <SelectTrigger>
                  <SelectValue placeholder={t("filters.selectExamType")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("filters.allExamTypes")}</SelectItem>
                  <SelectItem value="MID_TERM">{t("filters.midTerm")}</SelectItem>
                  <SelectItem value="FINAL">{t("filters.final")}</SelectItem>
                  <SelectItem value="UNIT_TEST">{t("filters.unitTest")}</SelectItem>
                  <SelectItem value="QUARTERLY">{t("filters.quarterly")}</SelectItem>
                  <SelectItem value="HALF_YEARLY">{t("filters.halfYearly")}</SelectItem>
                  <SelectItem value="ANNUAL">{t("filters.annual")}</SelectItem>
                </SelectContent>
              </Select>
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
