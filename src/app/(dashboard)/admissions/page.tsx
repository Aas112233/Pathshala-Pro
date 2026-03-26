"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { AppDropdown } from "@/components/ui/app-dropdown";
import { FilePlus, Plus, Save, Trash2, ArrowLeft } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { StudentSelectorModal } from "@/components/admissions/student-selector-modal";
import { DataTable } from "@/components/shared/data-table";
import type { ColumnDef } from "@tanstack/react-table";
import { useStudentViewModel } from "@/viewmodels/students/use-student-view-model";
import { StudentStatusBadge } from "@/components/students/student-status-badge";
import { useTenantFormatting } from "@/components/providers/tenant-settings-provider";

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
  const t = useTranslations();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [showStudentSelector, setShowStudentSelector] = useState(false);
  const [admissionItems, setAdmissionItems] = useState<AdmissionItem[]>([]);
  const [notes, setNotes] = useState("");
  const { formatDate } = useTenantFormatting();

  const {
    students,
    isLoading: isStudentsLoading,
    pagination,
    filters,
    setFilters,
    setPage,
  } = useStudentViewModel();

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
    { value: "", label: t('admissions.selectClass') },
    ...classes.map((c: any) => ({ value: c.id, label: c.name })),
  ];

  const groupOptions = [
    { value: "", label: t('admissions.noGroupGeneral') },
    ...groups.map((g: any) => ({ value: g.id, label: g.name })),
  ];

  const sectionOptions = [
    { value: "", label: t('admissions.selectSection') },
    ...sections.map((s: any) => ({ value: s.id, label: s.name })),
  ];

  const academicYearOptions = [
    { value: "", label: t('admissions.selectAcademicYear') },
    ...academicYears.map((ay: any) => ({ value: ay.id, label: ay.label })),
  ];

  const canAddStudents = Boolean(selectedClass && selectedAcademicYear);

  const handleOpenStudentSelector = () => {
    if (!canAddStudents) {
      toast.error(t('admissions.pleaseSelectClassAndYear'));
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
    toast.success(t('admissions.addStudentsSuccess').replace('{count}', students.length.toString()));
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
      toast.success(t('admissions.admissionCompleted').replace('{count}', admissionItems.length.toString()));
      setIsFormOpen(false);
      setAdmissionItems([]);
    },
    onError: (err: any) => {
      toast.error(t('admissions.failedToProcess'));
    },
  });

  const handleSubmit = () => {
    if (admissionItems.length === 0) {
      toast.error(t('admissions.noStudentsAddedError'));
      return;
    }
    if (!selectedClass) {
      toast.error(t('admissions.pleaseSelectClass'));
      return;
    }

    createAdmissionMutation.mutate(admissionItems);
  };

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: "studentId",
      header: t('admissions.studentId'),
      cell: ({ getValue }) => (
        <span className="font-medium">{getValue<string>()}</span>
      ),
    },
    {
      accessorKey: "rollNumber",
      header: t('admissions.rollNumber'),
    },
    {
      accessorKey: "firstName",
      header: t('admissions.name'),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span>{`${row.original.firstName} ${row.original.lastName}`}</span>
        </div>
      ),
    },
    {
      accessorKey: "class",
      header: t('admissions.class'),
      cell: ({ row }) => <span>{row.original.class?.name || "-"}</span>,
    },
    {
      accessorKey: "section",
      header: t('admissions.section'),
      cell: ({ row }) => <span>{row.original.section?.name || "-"}</span>,
    },
    {
      accessorKey: "admissionDate",
      header: t('admissions.admissionDate'),
      cell: ({ getValue }) => {
        const date = getValue<string>();
        return <span>{date ? formatDate(date) : "-"}</span>;
      },
    },
    {
      accessorKey: "status",
      header: t('admissions.status'),
      cell: ({ getValue }) => (
        <StudentStatusBadge status={getValue<string>() as any} />
      ),
    },
  ];

  if (!isFormOpen) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={t('admissions.title')}
          description={t('admissions.description')}
          icon={FilePlus}
        >
          <Button onClick={() => setIsFormOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t('admissions.addAdmission')}
          </Button>
        </PageHeader>

        <DataTable
          columns={columns}
          data={students}
          pagination={pagination || undefined}
          onPageChange={setPage}
          onSearch={(search) => setFilters({ search })}
          isLoading={isStudentsLoading}
          searchPlaceholder={t('admissions.searchPlaceholder')}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admissions.createTitle')}
        description={t('admissions.createDescription')}
        icon={FilePlus}
      >
        <Button variant="outline" onClick={() => setIsFormOpen(false)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('admissions.back')}
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-4 space-y-6">
          {/* Academic Details Card */}
          <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-4">
              {t('admissions.academicDetails')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  {t('admissions.academicYear')}
                </label>
                <AppDropdown
                  value={selectedAcademicYear}
                  onChange={setSelectedAcademicYear}
                  options={academicYearOptions}
                  placeholder={t('admissions.selectAcademicYear')}
                  searchable
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  {t('admissions.class')}
                </label>
                <AppDropdown
                  value={selectedClass}
                  onChange={setSelectedClass}
                  options={classOptions}
                  placeholder={t('admissions.selectClass')}
                  searchable
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  {t('admissions.group')}
                </label>
                <AppDropdown
                  value={selectedGroup}
                  onChange={setSelectedGroup}
                  options={groupOptions}
                  placeholder={t('admissions.selectGroup')}
                  searchable
                  disabled={!selectedClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  {t('admissions.section')}
                </label>
                <AppDropdown
                  value={selectedSection}
                  onChange={setSelectedSection}
                  options={sectionOptions}
                  placeholder={t('admissions.selectSection')}
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
                  {t('admissions.students')}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {t('admissions.addStudentsForAdmission')}
                </p>
              </div>
              <Button
                onClick={handleOpenStudentSelector}
                disabled={!canAddStudents}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" /> {t('admissions.addStudents')}
              </Button>
            </div>

            {admissionItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FilePlus className="h-12 w-12 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">
                  {t('admissions.noStudentsAdded')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('admissions.clickToAddStudents')}
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
              {t('admissions.additionalNotes')}
            </label>
            <textarea
              rows={3}
              className="w-full px-4 py-2 border border-input rounded-lg focus:ring-2 focus:ring-ring focus:border-primary outline-none text-sm"
              placeholder={t('admissions.internalRemarks')}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        {/* Summary Sidebar */}
        <div className="space-y-6">
          <div className="bg-card rounded-xl border border-border p-6 shadow-sm sticky top-6">
            <h2 className="text-lg font-bold text-foreground mb-6 font-mono uppercase tracking-tighter text-center">
              {t('admissions.summary')}
            </h2>
            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('admissions.totalStudents')}</span>
                <span className="font-bold text-2xl">{admissionItems.length}</span>
              </div>
              <div className="pt-4 border-t border-dashed">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-foreground">{t('admissions.class')}</span>
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
              {createAdmissionMutation.isPending ? t('admissions.processing') : t('admissions.completeAdmission')}
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
