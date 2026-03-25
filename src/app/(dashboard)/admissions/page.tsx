"use client";

import { useState, useMemo } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { AppDropdown } from "@/components/ui/app-dropdown";
import { FilePlus, Plus, Save, Trash2, ArrowLeft } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { StudentSelectorModal } from "@/components/admissions/student-selector-modal";

interface Student {
  id: string;
  studentId: string;
  rollNumber: string;
  firstName: string;
  lastName: string;
  guardianName: string;
  gender?: string;
  status: string;
  profilePictureUrl?: string;
}

interface AdmissionItem {
  student: Student;
  classId: string;
  groupId?: string;
  sectionId?: string;
}

export default function AdmissionsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showStudentSelector, setShowStudentSelector] = useState(false);
  const [admissionItems, setAdmissionItems] = useState<AdmissionItem[]>([]);
  const [notes, setNotes] = useState("");

  // Form state
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("");
  const [selectedSection, setSelectedSection] = useState("");
  const [selectedAcademicYear, setSelectedAcademicYear] = useState("");

  // Fetch classes
  const { data: classesData } = useQuery({
    queryKey: ["classes-all"],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      const tenantId = localStorage.getItem("tenant_id");
      const res = await fetch("/api/classes?limit=100&isActive=true", {
        headers: {
          "Authorization": `Bearer ${token}`,
          "X-Tenant-ID": tenantId || "",
        },
      });
      if (!res.ok) throw new Error("Failed to fetch classes");
      return res.json();
    },
  });

  // Fetch groups (filtered by selected class)
  const { data: groupsData } = useQuery({
    queryKey: ["groups-all", { classId: selectedClass }],
    queryFn: async () => {
      if (!selectedClass) return { data: [] };
      const token = localStorage.getItem("auth_token");
      const tenantId = localStorage.getItem("tenant_id");
      const res = await fetch(`/api/groups?limit=100&classId=${selectedClass}`, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "X-Tenant-ID": tenantId || "",
        },
      });
      if (!res.ok) throw new Error("Failed to fetch groups");
      return res.json();
    },
    enabled: !!selectedClass,
  });

  // Fetch sections (filtered by selected class and group)
  const { data: sectionsData } = useQuery({
    queryKey: ["sections-all", { classId: selectedClass, groupId: selectedGroup }],
    queryFn: async () => {
      if (!selectedClass) return { data: [] };
      const token = localStorage.getItem("auth_token");
      const tenantId = localStorage.getItem("tenant_id");
      const params = new URLSearchParams({
        limit: "100",
        classId: selectedClass,
        ...(selectedGroup && { groupId: selectedGroup }),
      });
      const res = await fetch(`/api/sections?${params}`, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "X-Tenant-ID": tenantId || "",
        },
      });
      if (!res.ok) throw new Error("Failed to fetch sections");
      return res.json();
    },
    enabled: !!selectedClass,
  });

  // Fetch academic years
  const { data: academicYearsData } = useQuery({
    queryKey: ["academic-years-all"],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      const tenantId = localStorage.getItem("tenant_id");
      const res = await fetch("/api/academic-years?limit=100", {
        headers: {
          "Authorization": `Bearer ${token}`,
          "X-Tenant-ID": tenantId || "",
        },
      });
      if (!res.ok) throw new Error("Failed to fetch academic years");
      return res.json();
    },
  });

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

  const academicYears = useMemo(
    () => ("data" in (academicYearsData || {})) ? (academicYearsData as any).data : [],
    [academicYearsData]
  );

  const classOptions = [
    { value: "", label: "Select Class *" },
    ...classes.map((c: any) => ({ value: c.id, label: c.name })),
  ];

  const groupOptions = [
    { value: "", label: "No Group (General)" },
    ...groups.map((g: any) => ({ value: g.id, label: g.name })),
  ];

  const sectionOptions = [
    { value: "", label: "Select Section" },
    ...sections.map((s: any) => ({ value: s.id, label: s.name })),
  ];

  const academicYearOptions = [
    { value: "", label: "Select Academic Year *" },
    ...academicYears.map((ay: any) => ({ value: ay.id, label: ay.label })),
  ];

  const canAddStudents = Boolean(selectedClass && selectedAcademicYear);

  const handleOpenStudentSelector = () => {
    if (!canAddStudents) {
      toast.error("Please select class and academic year first");
      return;
    }
    setShowStudentSelector(true);
  };

  const handleAddStudents = (students: Student[]) => {
    const newItems: AdmissionItem[] = students.map((student) => ({
      student,
      classId: selectedClass,
      groupId: selectedGroup || undefined,
      sectionId: selectedSection || undefined,
    }));

    setAdmissionItems([...admissionItems, ...newItems]);
    toast.success(`Added ${students.length} student(s)`);
  };

  const handleRemoveStudent = (index: number) => {
    setAdmissionItems(admissionItems.filter((_, i) => i !== index));
  };

  const createAdmissionMutation = useMutation({
    mutationFn: async (items: AdmissionItem[]) => {
      const token = localStorage.getItem("auth_token");
      const tenantId = localStorage.getItem("tenant_id");
      const updates = items.map((item) =>
        fetch(`/api/students/${item.student.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
            "X-Tenant-ID": tenantId || "",
          },
          body: JSON.stringify({
            classId: item.classId,
            groupId: item.groupId,
            sectionId: item.sectionId,
          }),
        })
      );

      const results = await Promise.all(updates);
      const errors = results.filter((r) => !r.ok);
      if (errors.length > 0) {
        throw new Error(`Failed to update ${errors.length} student(s)`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      toast.success(`Admission completed for ${admissionItems.length} student(s)!`);
      router.push("/students");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to process admissions");
    },
  });

  const handleSubmit = () => {
    if (admissionItems.length === 0) {
      toast.error("No students added");
      return;
    }
    if (!selectedClass) {
      toast.error("Please select a class");
      return;
    }

    createAdmissionMutation.mutate(admissionItems);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create Admission"
        description="Enroll students to classes"
        icon={FilePlus}
      >
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-4 space-y-6">
          {/* Academic Details Card */}
          <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-4">
              Academic Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Academic Year
                </label>
                <AppDropdown
                  value={selectedAcademicYear}
                  onChange={setSelectedAcademicYear}
                  options={academicYearOptions}
                  placeholder="Select Academic Year"
                  searchable
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Class
                </label>
                <AppDropdown
                  value={selectedClass}
                  onChange={setSelectedClass}
                  options={classOptions}
                  placeholder="Select Class"
                  searchable
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Group
                </label>
                <AppDropdown
                  value={selectedGroup}
                  onChange={setSelectedGroup}
                  options={groupOptions}
                  placeholder="Select Group"
                  searchable
                  disabled={!selectedClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Section
                </label>
                <AppDropdown
                  value={selectedSection}
                  onChange={setSelectedSection}
                  options={sectionOptions}
                  placeholder="Select Section"
                  searchable
                  disabled={!selectedClass}
                />
              </div>
            </div>
          </div>

          {/* Students Section */}
          <div className="bg-card rounded-xl border border-border p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
                  Students
                </h3>
                <p className="text-xs text-muted-foreground">
                  Add students for admission
                </p>
              </div>
              <Button
                onClick={handleOpenStudentSelector}
                disabled={!canAddStudents}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" /> Add Students
              </Button>
            </div>

            {admissionItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FilePlus className="h-12 w-12 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">
                  No students added yet
                </p>
                <p className="text-xs text-muted-foreground">
                  Click "Add Students" to select students
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {admissionItems.map((item, index) => (
                  <div
                    key={item.student.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                        <span className="text-sm font-semibold">
                          {item.student.firstName.charAt(0)}
                          {item.student.lastName.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium">
                          {item.student.firstName} {item.student.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Roll: {item.student.rollNumber} • {item.student.studentId}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveStudent(index)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
            <label className="block text-sm font-medium text-foreground mb-2">
              Additional Notes
            </label>
            <textarea
              rows={3}
              className="w-full px-4 py-2 border border-input rounded-lg focus:ring-2 focus:ring-ring focus:border-primary outline-none text-sm"
              placeholder="Add any internal remarks..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        {/* Summary Sidebar */}
        <div className="space-y-6">
          <div className="bg-card rounded-xl border border-border p-6 shadow-sm sticky top-6">
            <h2 className="text-lg font-bold text-foreground mb-6 font-mono uppercase tracking-tighter text-center">
              Summary
            </h2>
            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Students</span>
                <span className="font-bold text-2xl">{admissionItems.length}</span>
              </div>
              <div className="pt-4 border-t border-dashed">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-foreground">Class</span>
                  <span className="text-primary font-semibold">
                    {classes.find((c: any) => c.id === selectedClass)?.name || "-"}
                  </span>
                </div>
              </div>
            </div>
            <Button
              onClick={handleSubmit}
              disabled={createAdmissionMutation.isPending || admissionItems.length === 0 || !canAddStudents}
              className="w-full mt-8 flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 shadow-lg"
            >
              <Save className="h-4 w-4" />{" "}
              {createAdmissionMutation.isPending ? "Processing..." : "Complete Admission"}
            </Button>
          </div>
        </div>
      </div>

      {/* Student Selector Modal */}
      <StudentSelectorModal
        isOpen={showStudentSelector}
        onClose={() => setShowStudentSelector(false)}
        onAdd={handleAddStudents}
        selectedStudents={admissionItems.map((item) => item.student)}
        confirmLabel="Add to Admission"
        allowMultiple={true}
      />
    </div>
  );
}
