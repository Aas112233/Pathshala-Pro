"use client";

import { useState, useMemo, useEffect } from "react";
import { useTranslations } from "next-intl";
import { TopSheet } from "@/components/ui/top-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppDropdown } from "@/components/ui/app-dropdown";
import { Search, UserCheck, X, Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn, formatStudentName } from "@/lib/utils";

interface Student {
  id: string;
  studentId: string;
  rollNumber: string;
  firstName: string;
  lastName: string;
  firstNameBn?: string;
  lastNameBn?: string;
  guardianName: string;
  gender?: string;
  status: string;
  profilePictureUrl?: string;
  classId?: string;
  class?: {
    id: string;
    name: string;
  } | null;
  group?: {
    id: string;
    name: string;
  } | null;
  section?: {
    id: string;
    name: string;
  } | null;
}

interface StudentSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (students: Student[]) => void;
  selectedStudents?: Student[];
  confirmLabel?: string;
  allowMultiple?: boolean;
}

export function StudentSelectorModal({
  isOpen,
  onClose,
  onAdd,
  selectedStudents = [],
  confirmLabel,
  allowMultiple = true,
}: StudentSelectorModalProps) {
  const t = useTranslations("academicSelector");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("");
  const [selectedSection, setSelectedSection] = useState("");
  const [tempSelected, setTempSelected] = useState<Student[]>(selectedStudents);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: studentsData, isLoading } = useQuery({
    queryKey: ["students", "all", { search: debouncedSearch, selectedClass, selectedGroup, selectedSection }],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: "100",
        ...(debouncedSearch && { search: debouncedSearch }),
        ...(selectedClass && { classId: selectedClass }),
        ...(selectedGroup && { groupId: selectedGroup }),
        ...(selectedSection && { sectionId: selectedSection }),
      });
      const res = await fetch(`/api/students?${params}`);
      if (!res.ok) throw new Error("Failed to fetch students");
      return res.json();
    },
  });

  const { data: classesData } = useQuery({
    queryKey: ["classes", "all"],
    queryFn: async () => {
      const res = await fetch("/api/classes?limit=100");
      if (!res.ok) throw new Error("Failed to fetch classes");
      return res.json();
    },
  });

  const { data: groupsData } = useQuery({
    queryKey: ["groups", "all", { classId: selectedClass }],
    queryFn: async () => {
      if (!selectedClass) return { data: [] };
      const res = await fetch(`/api/groups?limit=100&classId=${selectedClass}`);
      if (!res.ok) throw new Error("Failed to fetch groups");
      return res.json();
    },
    enabled: !!selectedClass,
  });

  const { data: sectionsData } = useQuery({
    queryKey: ["sections", "all", { classId: selectedClass, groupId: selectedGroup }],
    queryFn: async () => {
      if (!selectedClass) return { data: [] };
      const params = new URLSearchParams({
        limit: "100",
        classId: selectedClass,
        ...(selectedGroup && { groupId: selectedGroup }),
      });
      const res = await fetch(`/api/sections?${params}`);
      if (!res.ok) throw new Error("Failed to fetch sections");
      return res.json();
    },
    enabled: !!selectedClass,
  });

  const students = useMemo(
    () => ("data" in (studentsData || {})) ? (studentsData as any).data : [],
    [studentsData]
  );

  const classes = useMemo(
    () => ("data" in (classesData || {})) ? (classesData as any).data : [],
    [classesData]
  );

  const groups = useMemo(
    () => ("data" in (groupsData || {})) ? (groupsData as any).data : [],
    [groupsData]
  );

  const sections = useMemo(
    () => ("data" in (sectionsData || {})) ? (sectionsData as any).data : [],
    [sectionsData]
  );

  const classOptions = [
    { value: "", label: t("allClasses") },
    ...classes.map((c: any) => ({ value: c.id, label: c.name })),
  ];

  const groupOptions = [
    { value: "", label: t("allGroups") },
    ...groups.map((g: any) => ({ value: g.id, label: g.name })),
  ];

  const sectionOptions = [
    { value: "", label: t("allSections") },
    ...sections.map((s: any) => ({ value: s.id, label: s.name })),
  ];

  const isSelected = (student: Student) => {
    return tempSelected.some((s) => s.id === student.id);
  };

  // Only students already assigned to a class cannot be admitted through this flow.
  // Students without an assigned class (even if created with ACTIVE status) can be admitted/assigned to a class.
  const getUnavailableReason = (student: Student): string | null => {
    const assignedClass = student.class?.name;
    if (student.classId || assignedClass) {
      return t("assignedToClass", { className: assignedClass || student.classId || "" });
    }
    return null;
  };

  const toggleSelect = (student: Student) => {
    if (isSelected(student)) {
      setTempSelected(tempSelected.filter((s) => s.id !== student.id));
    } else {
      if (!allowMultiple) {
        setTempSelected([student]);
      } else {
        setTempSelected([...tempSelected, student]);
      }
    }
  };

  const handleConfirm = () => {
    onAdd(tempSelected);
    onClose();
  };

  const handleReset = () => {
    setTempSelected(selectedStudents);
    onClose();
  };

  return (
    <TopSheet
      isOpen={isOpen}
      onClose={handleReset}
      title={t("selectStudentsModalTitle")}
      description={t("selectStudentsModalDesc")}
      maxWidth="4xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <Button variant="outline" type="button" onClick={handleReset}>
            {t("cancel")}
          </Button>
          <div className="flex items-center gap-3">
            {tempSelected.length > 0 && (
              <span className="text-sm text-muted-foreground">
                {t("studentsSelected", { count: tempSelected.length })}
              </span>
            )}
            <Button type="button" onClick={handleConfirm} disabled={tempSelected.length === 0}>
              {confirmLabel || t("addSelectedStudents")}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder={t("searchStudentPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 pr-10"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
          <div>
            <AppDropdown
              value={selectedClass}
              onChange={(val) => {
                setSelectedClass(val);
                setSelectedGroup("");
                setSelectedSection("");
              }}
              options={classOptions}
              placeholder={t("filterByClass")}
              searchable
              searchPlaceholder={t("searchClassPlaceholder")}
            />
          </div>
          <div>
            <AppDropdown
              value={selectedGroup}
              onChange={setSelectedGroup}
              options={groupOptions}
              placeholder={!selectedClass ? t("selectClassFirst") : t("filterByGroup")}
              searchable
              searchPlaceholder={t("searchGroupPlaceholder")}
              disabled={!selectedClass}
            />
          </div>
          <div>
            <AppDropdown
              value={selectedSection}
              onChange={setSelectedSection}
              options={sectionOptions}
              placeholder={!selectedClass ? t("selectClassFirst") : t("filterBySection")}
              searchable
              searchPlaceholder={t("searchSectionPlaceholder")}
              disabled={!selectedClass}
            />
          </div>
        </div>

        {/* Selected Count */}
        {tempSelected.length > 0 && (
          <div className="flex items-center gap-2 rounded-lg bg-primary/10 p-3">
            <UserCheck className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium text-primary">
              {t("studentsSelected", { count: tempSelected.length })}
            </span>
          </div>
        )}

        {/* Students List */}
        <div className="max-h-[50vh] overflow-y-auto rounded-lg border border-border">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <p className="text-sm text-muted-foreground">{t("loading")}</p>
            </div>
          ) : students.length === 0 ? (
            <div className="flex items-center justify-center p-8">
              <p className="text-sm text-muted-foreground">{t("noStudentsFound")}</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {students.map((student: Student) => {
                const selected = isSelected(student);
                // Already-picked rows stay interactive so they can be deselected.
                const unavailableReason = selected ? null : getUnavailableReason(student);
                const fullName = formatStudentName(student.firstName, student.lastName, student.firstNameBn, student.lastNameBn);
                const initials = `${student.firstName.charAt(0)}${student.lastName.charAt(0)}`;

                return (
                  <div
                    key={student.id}
                    className={cn(
                      "flex items-center gap-3 p-3 transition-colors hover:bg-muted/50",
                      selected && "bg-primary/5",
                      unavailableReason && "opacity-60"
                    )}
                  >
                    {/* Avatar */}
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      {student.profilePictureUrl ? (
                        <img
                          src={student.profilePictureUrl}
                          alt={fullName}
                          className="h-full w-full rounded-full object-cover"
                        />
                      ) : (
                        <span className="text-sm font-semibold">{initials}</span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{fullName}</p>
                      <p className="text-xs text-muted-foreground">
                        Roll: {student.rollNumber} • {student.studentId}
                      </p>
                      {student.class && (
                        <p className="text-xs text-primary font-medium mt-1">
                          Class: {student.class.name}
                          {student.group && ` • ${student.group.name}`}
                          {student.section && ` • ${student.section.name}`}
                        </p>
                      )}
                    </div>

                    {/* Guardian */}
                    <div className="hidden md:block text-sm text-muted-foreground w-40 truncate">
                      {student.guardianName}
                    </div>

                    {/* Status */}
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                        student.status === "ACTIVE"
                          ? "bg-green-100 text-green-800"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {student.status}
                    </span>

                    {/* Select Button */}
                    <span className="group/tip relative shrink-0">
                      <button
                        onClick={() => toggleSelect(student)}
                        disabled={!!unavailableReason}
                        aria-disabled={!!unavailableReason}
                        title={unavailableReason || undefined}
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-full transition-colors",
                          selected
                            ? "bg-primary text-primary-foreground"
                            : unavailableReason
                              ? "cursor-not-allowed border border-input text-muted-foreground/40"
                              : "border border-input text-muted-foreground hover:bg-muted"
                        )}
                      >
                        {selected ? (
                          <UserCheck className="h-4 w-4" />
                        ) : (
                          <Plus className="h-4 w-4" />
                        )}
                      </button>
                      {unavailableReason && (
                        <span className="pointer-events-none absolute right-full top-1/2 z-50 mr-2 hidden w-max max-w-56 -translate-y-1/2 rounded-lg border border-border/80 bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-xl group-hover/tip:block">
                          {unavailableReason}
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </TopSheet>
  );
}
