"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Filter, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { AppDropdown } from "@/components/ui/app-dropdown";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { StudentStatusFilter } from "@/viewmodels/students/use-student-view-model";

interface StudentFiltersProps {
  status: StudentStatusFilter;
  gender: "ALL" | "MALE" | "FEMALE" | "OTHER";
  classId: string;
  sectionId: string;
  groupId: string;
  onStatusChange: (status: StudentStatusFilter) => void;
  onGenderChange: (gender: "ALL" | "MALE" | "FEMALE" | "OTHER") => void;
  onClassChange: (classId: string) => void;
  onSectionChange: (sectionId: string) => void;
  onGroupChange: (groupId: string) => void;
  onClearFilters: () => void;
  className?: string;
}

export function StudentFiltersBar({
  status,
  gender,
  classId,
  sectionId,
  groupId,
  onStatusChange,
  onGenderChange,
  onClassChange,
  onSectionChange,
  onGroupChange,
  onClearFilters,
  className,
}: StudentFiltersProps) {
  const t = useTranslations("students");
  const hasActiveFilters = status !== "ALL" || gender !== "ALL" || !!classId || !!sectionId || !!groupId;

  const { data: classesData } = useQuery({
    queryKey: ["classes-filter"],
    queryFn: async () => {
      const res = await fetch("/api/classes?limit=100&isActive=true");
      if (!res.ok) return { data: [] };
      return res.json();
    },
  });

  const { data: groupsData } = useQuery({
    queryKey: ["groups-filter", classId],
    queryFn: async () => {
      if (!classId) return { data: [] };
      const res = await fetch(`/api/groups?limit=100&classId=${classId}`);
      if (!res.ok) return { data: [] };
      return res.json();
    },
    enabled: !!classId,
  });

  const { data: sectionsData } = useQuery({
    queryKey: ["sections-filter", classId, groupId],
    queryFn: async () => {
      if (!classId) return { data: [] };
      const params = new URLSearchParams({ limit: "100", classId, ...(groupId && { groupId }) });
      const res = await fetch(`/api/sections?${params}`);
      if (!res.ok) return { data: [] };
      return res.json();
    },
    enabled: !!classId,
  });

  const classOptions = useMemo(() => {
    const list = (classesData as any)?.data || [];
    return [
      { value: "", label: t("filters.class.all") || "All Classes" },
      ...list.map((c: any) => ({ value: c.id, label: c.name })),
    ];
  }, [classesData, t]);

  const groupOptions = useMemo(() => {
    const list = (groupsData as any)?.data || [];
    return [
      { value: "", label: t("filters.group.all") || "All Groups" },
      ...list.map((g: any) => ({ value: g.id, label: g.name })),
    ];
  }, [groupsData, t]);

  const sectionOptions = useMemo(() => {
    const list = (sectionsData as any)?.data || [];
    return [
      { value: "", label: t("filters.section.all") || "All Sections" },
      ...list.map((s: any) => ({ value: s.id, label: s.name })),
    ];
  }, [sectionsData, t]);

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3",
        className
      )}
    >
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Filter className="h-4 w-4" />
        <span>{t("filters.title")}:</span>
      </div>

      <div className="flex flex-1 flex-wrap items-center gap-3">
        <div className="min-w-[150px]">
          <AppDropdown value={classId} onChange={onClassChange} options={classOptions} placeholder={t("filters.class.all") || "All Classes"} searchable />
        </div>

        <div className="min-w-[140px]">
          <AppDropdown value={groupId} onChange={onGroupChange} options={groupOptions} placeholder={t("filters.group.all") || "All Groups"} searchable disabled={!classId} />
        </div>

        <div className="min-w-[150px]">
          <AppDropdown value={sectionId} onChange={onSectionChange} options={sectionOptions} placeholder={t("filters.section.all") || "All Sections"} searchable disabled={!classId} />
        </div>

        <div className="min-w-[130px]">
          <AppDropdown
            value={status}
            onChange={(val) => onStatusChange(val as StudentStatusFilter)}
            options={[
              { value: "ALL", label: t("filters.status.all") },
              { value: "ACTIVE", label: t("filters.status.active") },
              { value: "INACTIVE", label: t("filters.status.inactive") },
              { value: "SUSPENDED", label: t("filters.status.suspended") },
            ]}
          />
        </div>

        <div className="min-w-[130px]">
          <AppDropdown
            value={gender}
            onChange={(val) => onGenderChange(val as "ALL" | "MALE" | "FEMALE" | "OTHER")}
            options={[
              { value: "ALL", label: t("filters.gender.all") },
              { value: "MALE", label: t("filters.gender.male") },
              { value: "FEMALE", label: t("filters.gender.female") },
              { value: "OTHER", label: t("filters.gender.other") },
            ]}
          />
        </div>
      </div>

      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearFilters}
          className="text-muted-foreground"
        >
          <X className="mr-1 h-4 w-4" />
          {t("filters.clear")}
        </Button>
      )}
    </div>
  );
}
