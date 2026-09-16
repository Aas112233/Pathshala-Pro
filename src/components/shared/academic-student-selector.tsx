"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { AppDropdown, type DropdownOption } from "@/components/ui/app-dropdown";
import { Input } from "@/components/ui/input";
import { cn, formatStudentName } from "@/lib/utils";
import { useOptionalAcademicYearContext } from "@/components/providers/academic-year-provider";

export interface AcademicHierarchyValue {
  classId: string;
  sectionId?: string;
  groupId?: string;
  studentId?: string;
}

export interface AcademicStudentSelectorProps {
  value: AcademicHierarchyValue;
  onChange: (newValue: AcademicHierarchyValue) => void;
  academicYearId?: string;
  showClass?: boolean;
  showSection?: boolean;
  showGroup?: boolean;
  showStudent?: boolean;
  showSearchInput?: boolean;
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
  includeAllOption?: boolean;
  requireSectionForStudent?: boolean;
  disabled?: boolean;
  className?: string;
  size?: "default" | "sm";
  layout?: "horizontal" | "grid";
}

export function AcademicStudentSelector({
  value,
  onChange,
  academicYearId: explicitAcademicYearId,
  showClass = true,
  showSection = true,
  showGroup = false,
  showStudent = false,
  showSearchInput = false,
  searchQuery = "",
  onSearchQueryChange,
  includeAllOption = false,
  requireSectionForStudent = true,
  disabled = false,
  className,
  layout = "horizontal",
}: AcademicStudentSelectorProps) {
  const t = useTranslations("academicSelector");
  const academicYearContext = useOptionalAcademicYearContext();
  const selectedAcademicYearId = explicitAcademicYearId ?? academicYearContext?.selectedAcademicYearId;

  // 1. Fetch Classes
  const { data: classesData, isLoading: isLoadingClasses } = useQuery({
    queryKey: ["classes", { isActive: true }],
    queryFn: async () => {
      const res = await fetch("/api/classes?limit=100&isActive=true", {
        credentials: "include",
      });
      if (!res.ok) return [];
      const json = await res.json();
      return (json.data?.items || json.data || []) as any[];
    },
    enabled: showClass,
  });

  // 2. Fetch Sections (strictly scoped to classId)
  const { data: sectionsData, isLoading: isLoadingSections } = useQuery({
    queryKey: ["sections", { classId: value.classId }],
    queryFn: async () => {
      if (!value.classId) return [];
      const res = await fetch(`/api/sections?classId=${value.classId}&limit=100`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      const json = await res.json();
      return (json.data?.items || json.data || []) as any[];
    },
    enabled: showSection && !!value.classId,
  });

  // 3. Fetch Groups (strictly scoped to classId)
  const { data: groupsData, isLoading: isLoadingGroups } = useQuery({
    queryKey: ["groups", { classId: value.classId }],
    queryFn: async () => {
      if (!value.classId) return [];
      const res = await fetch(`/api/groups?classId=${value.classId}&limit=100`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      const json = await res.json();
      return (json.data?.items || json.data || []) as any[];
    },
    enabled: showGroup && !!value.classId,
  });

  // 4. Fetch Students (scoped to Class, Section, and optional Group)
  const shouldFetchStudents =
    showStudent &&
    Boolean(value.classId) &&
    (!requireSectionForStudent || Boolean(value.sectionId) || includeAllOption);

  const { data: studentsData, isLoading: isLoadingStudents } = useQuery({
    queryKey: ["students", "hierarchy", selectedAcademicYearId, value.classId, value.sectionId, value.groupId, searchQuery],
    queryFn: async () => {
      if (!value.classId) return [];
      const params = new URLSearchParams({ limit: "150", classId: value.classId });
      if (selectedAcademicYearId) params.set("academicYearId", selectedAcademicYearId);
      if (value.sectionId) params.set("sectionId", value.sectionId);
      if (value.groupId) params.set("groupId", value.groupId);
      if (searchQuery.trim()) params.set("search", searchQuery.trim());
      const res = await fetch(`/api/students?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      const json = await res.json();
      return (json.data?.items || json.data || []) as any[];
    },
    enabled: shouldFetchStudents,
  });

  // Class Options
  const classOptions: DropdownOption[] = useMemo(() => {
    const list = (classesData || []).map((c: any) => ({
      value: c.id,
      label: c.name,
    }));
    if (includeAllOption) {
      return [{ value: "", label: t("allClasses") }, ...list];
    }
    return list;
  }, [classesData, includeAllOption, t]);

  // Section Options
  const sectionOptions: DropdownOption[] = useMemo(() => {
    const list = (sectionsData || []).map((s: any) => ({
      value: s.id,
      label: s.name,
    }));
    if (includeAllOption) {
      return [{ value: "", label: t("allSections") }, ...list];
    }
    return list;
  }, [sectionsData, includeAllOption, t]);

  // Group Options
  const groupOptions: DropdownOption[] = useMemo(() => {
    const list = (groupsData || []).map((g: any) => ({
      value: g.id,
      label: g.name,
    }));
    if (includeAllOption) {
      return [{ value: "", label: t("allGroups") }, ...list];
    }
    return list;
  }, [groupsData, includeAllOption, t]);

  // Student Options
  const studentOptions: DropdownOption[] = useMemo(() => {
    const list = (studentsData || []).map((s: any) => {
      const name = formatStudentName(s.firstName, s.lastName, s.firstNameBn, s.lastNameBn);
      const roll = s.rollNumber ? ` (${s.rollNumber})` : "";
      const idTag = s.studentId && s.studentId !== s.rollNumber ? ` • ${s.studentId}` : "";
      return {
        value: s.id,
        label: `${name}${roll}${idTag}`,
      };
    });
    if (includeAllOption) {
      return [{ value: "", label: t("allStudents") }, ...list];
    }
    return list;
  }, [studentsData, includeAllOption, t]);

  // Cascading Handlers
  const handleClassChange = (newClassId: string) => {
    onChange({
      classId: newClassId,
      sectionId: "",
      groupId: "",
      studentId: "",
    });
  };

  const handleSectionChange = (newSectionId: string) => {
    onChange({
      ...value,
      sectionId: newSectionId,
      studentId: "",
    });
  };

  const handleGroupChange = (newGroupId: string) => {
    onChange({
      ...value,
      groupId: newGroupId,
      studentId: "",
    });
  };

  const handleStudentChange = (newStudentId: string) => {
    onChange({
      ...value,
      studentId: newStudentId,
    });
  };

  const isClassSelected = Boolean(value.classId);
  const isSectionSelected = Boolean(value.sectionId);

  return (
    <div
      className={cn(
        layout === "grid"
          ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 w-full"
          : "flex flex-wrap items-center gap-2.5",
        className
      )}
    >
      {/* 1. Class Dropdown */}
      {showClass && (
        <div className="min-w-[140px] flex-1">
          <AppDropdown
            value={value.classId || ""}
            onChange={handleClassChange}
            options={classOptions}
            placeholder={isLoadingClasses ? t("loading") : t("selectClass")}
            disabled={disabled}
            searchable
            searchPlaceholder={t("searchClassPlaceholder")}
          />
        </div>
      )}

      {/* 2. Section Dropdown (Disabled until Class is selected) */}
      {showSection && (
        <div className="min-w-[140px] flex-1">
          <AppDropdown
            value={value.sectionId || ""}
            onChange={handleSectionChange}
            options={sectionOptions}
            placeholder={
              !isClassSelected
                ? t("selectClassFirst")
                : isLoadingSections
                ? t("loading")
                : t("selectSection")
            }
            disabled={disabled || !isClassSelected}
            searchable
            searchPlaceholder={t("searchSectionPlaceholder")}
          />
        </div>
      )}

      {/* 3. Group Dropdown (Optional, Disabled until Class is selected) */}
      {showGroup && (
        <div className="min-w-[140px] flex-1">
          <AppDropdown
            value={value.groupId || ""}
            onChange={handleGroupChange}
            options={groupOptions}
            placeholder={
              !isClassSelected
                ? t("selectClassFirst")
                : isLoadingGroups
                ? t("loading")
                : t("selectGroup")
            }
            disabled={disabled || !isClassSelected}
            searchable
            searchPlaceholder={t("searchGroupPlaceholder")}
          />
        </div>
      )}

      {/* 4. Student Dropdown (Disabled until prerequisite is selected) */}
      {showStudent && (
        <div className="min-w-[180px] flex-1">
          <AppDropdown
            value={value.studentId || ""}
            onChange={handleStudentChange}
            options={studentOptions}
            placeholder={
              !isClassSelected
                ? t("selectClassFirst")
                : requireSectionForStudent && !isSectionSelected && !includeAllOption
                ? t("selectSectionFirst")
                : isLoadingStudents
                ? t("loading")
                : t("selectStudent")
            }
            disabled={
              disabled ||
              !isClassSelected ||
              (requireSectionForStudent && !isSectionSelected && !includeAllOption)
            }
            searchable
            searchPlaceholder={t("searchStudentPlaceholder")}
          />
        </div>
      )}

      {/* 5. Optional Direct Search Input */}
      {showSearchInput && (
        <div className="min-w-[180px] flex-1">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder={t("searchStudentPlaceholder")}
              value={searchQuery}
              onChange={(e) => onSearchQueryChange?.(e.target.value)}
              disabled={disabled || !isClassSelected}
              className="pl-8 h-9 text-xs"
            />
          </div>
        </div>
      )}
    </div>
  );
}
