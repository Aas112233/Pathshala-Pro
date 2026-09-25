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
    return <div className="hidden md:block h-10 w-[264px] shrink-0" aria-hidden="true" />;
  }

  return (
    <div className="hidden md:flex items-center gap-2 h-10 rounded-xl border border-border/60 bg-card px-3">
      <CalendarRange className="h-4 w-4 shrink-0 text-primary" />
      <AppDropdown
        value={selectedAcademicYearId}
        onChange={setSelectedAcademicYearId}
        options={academicYears.map((year) => ({
          value: year.id,
          // The operating year is marked so an operator can tell "the year I am
          // looking at" apart from "the year the institute is in" — these are
          // different things as soon as they switch the selector to browse.
          label: `${year.label}${
            year.isCurrent && !year.isClosed ? ` ${t("currentSuffix")}` : ""
          }${year.isClosed ? ` ${t("closedSuffix")}` : ""}`,
        }))}
        searchable
        searchPlaceholder={t("searchPlaceholder")}
        className="w-[220px]"
        triggerClassName="h-8 text-sm border-0 shadow-none px-1 bg-transparent"
      />
    </div>
  );
}
