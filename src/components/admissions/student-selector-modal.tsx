"use client";

import { useState, useMemo } from "react";
import { AppModal } from "@/components/ui/app-modal";
import { Button } from "@/components/ui/button";
import { AppDropdown } from "@/components/ui/app-dropdown";
import { Search, UserCheck, X } from "lucide-react";
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
  confirmLabel = "Add Student",
  allowMultiple = true,
}: StudentSelectorModalProps) {
  const [search, setSearch] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("");
  const [selectedSection, setSelectedSection] = useState("");
  const [tempSelected, setTempSelected] = useState<Student[]>(selectedStudents);

  const { data: studentsData, isLoading } = useQuery({
    queryKey: ["students-all", { search, selectedClass, selectedGroup, selectedSection }],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: "100",
        ...(search && { search }),
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
    queryKey: ["classes-all"],
    queryFn: async () => {
      const res = await fetch("/api/classes?limit=100");
      if (!res.ok) throw new Error("Failed to fetch classes");
      return res.json();
    },
  });

  const { data: groupsData } = useQuery({
    queryKey: ["groups-all", { classId: selectedClass }],
    queryFn: async () => {
      if (!selectedClass) return { data: [] };
      const res = await fetch(`/api/groups?limit=100&classId=${selectedClass}`);
      if (!res.ok) throw new Error("Failed to fetch groups");
      return res.json();
    },
    enabled: !!selectedClass,
  });

  const { data: sectionsData } = useQuery({
    queryKey: ["sections-all", { classId: selectedClass, groupId: selectedGroup }],
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
    { value: "", label: "All Classes" },
    ...classes.map((c: any) => ({ value: c.id, label: c.name })),
  ];

  const groupOptions = [
    { value: "", label: "All Groups" },
    ...groups.map((g: any) => ({ value: g.id, label: g.name })),
  ];

  const sectionOptions = [
    { value: "", label: "All Sections" },
    ...sections.map((s: any) => ({ value: s.id, label: s.name })),
  ];

  const isSelected = (student: Student) => {
    return tempSelected.some((s) => s.id === student.id);
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
    <AppModal
      isOpen={isOpen}
      onClose={handleReset}
      title="Select Students"
      description="Search and select existing students for admission. Their current class information is shown below their name."
      maxWidth="4xl"
      className="max-h-[90vh]"
    >
      <div className="space-y-4 pt-2">
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by name, roll number, or student ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-md border border-input bg-background pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary"
              />
            </div>
          </div>
          <div>
            <AppDropdown
              value={selectedClass}
              onChange={setSelectedClass}
              options={classOptions}
              placeholder="Filter by Class"
              searchable
            />
          </div>
          <div>
            <AppDropdown
              value={selectedGroup}
              onChange={setSelectedGroup}
              options={groupOptions}
              placeholder="Filter by Group"
              searchable
              disabled={!selectedClass}
            />
          </div>
          <div>
            <AppDropdown
              value={selectedSection}
              onChange={setSelectedSection}
              options={sectionOptions}
              placeholder="Filter by Section"
              searchable
              disabled={!selectedClass}
            />
          </div>
        </div>

        {/* Selected Count */}
        {tempSelected.length > 0 && (
          <div className="flex items-center gap-2 rounded-lg bg-primary/10 p-3">
            <UserCheck className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium text-primary">
              {tempSelected.length} student(s) selected
            </span>
          </div>
        )}

        {/* Students List */}
        <div className="max-h-[50vh] overflow-y-auto rounded-lg border border-border">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <p className="text-sm text-muted-foreground">Loading students...</p>
            </div>
          ) : students.length === 0 ? (
            <div className="flex items-center justify-center p-8">
              <p className="text-sm text-muted-foreground">No students found</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {students.map((student: Student) => {
                const selected = isSelected(student);
                const fullName = formatStudentName(student.firstName, student.lastName, student.firstNameBn, student.lastNameBn);
                const initials = `${student.firstName.charAt(0)}${student.lastName.charAt(0)}`;

                return (
                  <div
                    key={student.id}
                    className={cn(
                      "flex items-center gap-3 p-3 transition-colors hover:bg-muted/50",
                      selected && "bg-primary/5"
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
                          : "bg-gray-100 text-gray-800"
                      )}
                    >
                      {student.status}
                    </span>

                    {/* Select Button */}
                    <button
                      onClick={() => toggleSelect(student)}
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full transition-colors",
                        selected
                          ? "bg-primary text-primary-foreground"
                          : "border border-input text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {selected ? (
                        <UserCheck className="h-4 w-4" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-between items-center pt-4 border-t">
          <Button variant="outline" onClick={handleReset}>
            Cancel
          </Button>
          <div className="flex items-center gap-3">
            {tempSelected.length > 0 && (
              <span className="text-sm text-muted-foreground">
                {tempSelected.length} selected
              </span>
            )}
            <Button onClick={handleConfirm} disabled={tempSelected.length === 0}>
              {confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </AppModal>
  );
}

// Simple Plus icon component
function Plus({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}
