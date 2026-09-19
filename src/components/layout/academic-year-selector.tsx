"use client";

import { CalendarRange } from "lucide-react";
import { useTranslations } from "next-intl";
import { AppDropdown } from "@/components/ui/app-dropdown";
import { useAcademicYearContext } from "@/components/providers/academic-year-provider";

export function AcademicYearSelector() {
  const t = useTranslations("header.academicYear");
  const { academicYears, selectedAcademicYearId, setSelectedAcademicYearId } =
    useAcademicYearContext();

  if (academicYears.length === 0) {
    return <div className="hidden md:block h-9 w-[180px] shrink-0" aria-hidden="true" />;
  }

  return (
    <div className="hidden md:flex items-center gap-1.5 h-9 rounded-xl border border-border/60 bg-card px-2">
      <CalendarRange className="h-3.5 w-3.5 shrink-0 text-primary" />
      <AppDropdown
        value={selectedAcademicYearId}
        onChange={setSelectedAcademicYearId}
        options={academicYears.map((year) => ({
          value: year.id,
          label: `${year.label}${year.isClosed ? ` ${t("closedSuffix")}` : ""}`,
        }))}
        searchable
        searchPlaceholder={t("searchPlaceholder")}
        className="w-[140px]"
        triggerClassName="h-7 text-xs border-0 shadow-none px-1 bg-transparent"
      />
    </div>
  );
}
