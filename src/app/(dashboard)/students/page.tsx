"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { ERPMetricCard } from "@/components/ui/erp-metric-card";
import { ERPDataTable, ERPUserCell, ERPStatusPill } from "@/components/ui/erp-data-table";
import { Button } from "@/components/ui/button";
import { CardGridSkeleton } from "@/components/ui/skeleton";
import { GraduationCap, Plus, Users, UserCheck } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { useAuth } from "@/components/providers/auth-provider";
import { hasPermission, getEffectivePermissions } from "@/lib/permissions";

// View Model
import { useStudentViewModel, type CreateStudentDTO } from "@/viewmodels/students/use-student-view-model";

// Components
import { StudentCard } from "@/components/students/student-card";
import { StudentFormModal } from "@/components/students/student-form-modal";
import { StudentDetailsModal } from "@/components/students/student-details-modal";
import { StudentViewSwitcher } from "@/components/students/student-view-switcher";
import { StudentFiltersBar } from "@/components/students/student-filters-bar";
import { StudentsEmptyState } from "@/components/students/students-empty-state";
import { StudentStatusBadge } from "@/components/students/student-status-badge";
import { StudentActionsDropdown } from "@/components/students/student-actions-dropdown";
import type { StudentProfile, StudentStatus } from "@/types/entities";
import { formatStudentName } from "@/lib/utils";

type StudentRow = StudentProfile & {
  class?: {
    id: string;
    name: string;
  } | null;
};

export default function StudentsPage() {
  const t = useTranslations('students');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<CreateStudentDTO & { id?: string } | null>(null);

  const {
    students,
    isLoading,
    pagination,
    filters,
    viewMode,
    selectedStudent,
    setFilters,
    setViewMode,
    setPage,
    setSelectedStudent,
    createStudent,
    updateStudent,
    deleteStudent,
  } = useStudentViewModel();
  const { user: authUser, isLoading: isAuthLoading } = useAuth();
  const perms = getEffectivePermissions(authUser?.role as string, (authUser as any)?.permissions, (authUser as any)?.accessLevel);
  const canReadStudents = hasPermission(perms, "students", "read");
  const canWriteStudents = hasPermission(perms, "students", "write");
  const canManageStudents = hasPermission(perms, "students", "manage");

  const handleEdit = useCallback((student: StudentRow) => {
    setEditingStudent({
      id: student.id,
      rollNumber: student.rollNumber,
      firstName: student.firstName,
      lastName: student.lastName,
      firstNameBn: student.firstNameBn,
      lastNameBn: student.lastNameBn,
      guardianName: student.guardianName,
      guardianContact: student.guardianContact,
      guardianEmail: student.guardianEmail,
      gender: student.gender || "",
      status: student.status,
      profilePictureUrl: student.profilePictureUrl,
      driveFileId: student.driveFileId,
      dateOfBirth: student.dateOfBirth ? new Date(student.dateOfBirth).toISOString().split('T')[0] : undefined,
      address: student.address,
      classId: student.classId || (student.class ? student.class.id : undefined),
      groupId: student.groupId,
      sectionId: student.sectionId,
    });
    setIsFormOpen(true);
  }, []);

  const handleView = useCallback((student: StudentRow) => {
    setSelectedStudent(student);
    setIsDetailsOpen(true);
  }, [setSelectedStudent]);

  const handleDelete = useCallback(async (student: StudentRow) => {
    if (!confirm(t('actions.confirmDelete'))) return;
    try {
      await deleteStudent(student.id);
    } catch {
      // Error handled by view model
    }
  }, [deleteStudent, t]);

  const handleSubmit = useCallback(async (data: CreateStudentDTO) => {
    if (editingStudent?.id) {
      await updateStudent(editingStudent.id, data as any);
    } else {
      await createStudent(data);
    }
    setEditingStudent(null);
  }, [createStudent, updateStudent, editingStudent]);

  const handleCloseForm = useCallback(async () => {
    // Cleanup will be handled by the modal component
    setIsFormOpen(false);
    setEditingStudent(null);
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters({
      search: "",
      status: "ALL",
      gender: "ALL",
      classId: "",
      sectionId: "",
      groupId: "",
    });
  }, [setFilters]);

  const hasActiveFilters = !!filters.search || filters.status !== "ALL" || filters.gender !== "ALL" || !!filters.classId || !!filters.sectionId || !!filters.groupId;

  const columns: ColumnDef<StudentRow>[] = [
    {
      accessorKey: "studentId",
      header: t('tableColumns.studentId'),
      cell: ({ getValue }) => (
        <span className="font-medium">{getValue<string>()}</span>
      ),
    },
    {
      accessorKey: "rollNumber",
      header: t('tableColumns.rollNumber'),
    },
    {
      accessorKey: "firstName",
      header: t('tableColumns.name'),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span>{formatStudentName(row.original.firstName, row.original.lastName, row.original.firstNameBn, row.original.lastNameBn)}</span>
        </div>
      ),
    },
    {
      accessorKey: "guardianName",
      header: t('tableColumns.guardian'),
    },
    {
      accessorKey: "guardianContact",
      header: t('tableColumns.contact'),
    },
    {
      id: "currentClass",
      header: t('tableColumns.class'),
      cell: ({ row }) => row.original.class?.name || t("classUnavailable"),
    },
    {
      accessorKey: "status",
      header: t('tableColumns.status'),
      cell: ({ getValue }) => (
        <StudentStatusBadge status={getValue<StudentStatus>()} />
      ),
    },
    {
      id: "actions",
      header: t('tableColumns.actions'),
      cell: ({ row }) => (
        <StudentActionsDropdown
          student={row.original}
          onView={() => handleView(row.original)}
          onEdit={canWriteStudents ? () => handleEdit(row.original) : undefined}
          onDelete={canManageStudents ? () => handleDelete(row.original) : undefined}
        />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={t('title')}
        description={t('description')}
        icon={GraduationCap}
      >
        <div className="flex items-center gap-2">
          <StudentViewSwitcher viewMode={viewMode} onViewModeChange={setViewMode} />
          {canWriteStudents && (
            <Button onClick={() => setIsFormOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {t('addStudent')}
            </Button>
          )}
        </div>
      </PageHeader>

      {!isAuthLoading && !canReadStudents ? (
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground">Access restricted</h2>
          <p className="mt-2 text-sm text-muted-foreground">You do not have permission to view students.</p>
        </div>
      ) : (
        <>
      {/* ERP Metric Cards — per design system */}
      <div className="grid gap-4 md:grid-cols-2">
        <ERPMetricCard
          subtitle={t("metrics.students")}
          title={t("metrics.totalEnrolled")}
          value={pagination?.totalCount ?? students.length}
          isLoading={isLoading}
          icon={Users}
          breakdowns={[
            { label: t("metrics.active"), count: students.filter((s) => s.status === "ACTIVE").length, color: "emerald", percentage: students.length ? (students.filter((s) => s.status === "ACTIVE").length / students.length) * 100 : 0 },
            { label: t("metrics.inactive"), count: students.filter((s) => s.status !== "ACTIVE").length, color: "amber", percentage: students.length ? (students.filter((s) => s.status !== "ACTIVE").length / students.length) * 100 : 0 },
          ]}
          actionLabel={t("metrics.viewAll")}
          onAction={() => setFilters({ search: "", status: "ALL", gender: "ALL", classId: "", sectionId: "", groupId: "" } as any)}
        />
        <ERPMetricCard
          subtitle={t("metrics.gender")}
          title={t("metrics.distribution")}
          value={students.length}
          isLoading={isLoading}
          icon={UserCheck}
          breakdowns={[
            { label: t("metrics.male"), count: students.filter((s: any) => s.gender === "MALE").length, color: "indigo", percentage: students.length ? (students.filter((s: any) => s.gender === "MALE").length / students.length) * 100 : 0 },
            { label: t("metrics.female"), count: students.filter((s: any) => s.gender === "FEMALE").length, color: "rose", percentage: students.length ? (students.filter((s: any) => s.gender === "FEMALE").length / students.length) * 100 : 0 },
          ]}
        />
      </div>

      {/* Filters */}
      <StudentFiltersBar
        status={filters.status}
        gender={filters.gender}
        classId={filters.classId}
        sectionId={filters.sectionId}
        groupId={filters.groupId}
        onStatusChange={(status) => setFilters({ status })}
        onGenderChange={(gender) => setFilters({ gender })}
        onClassChange={(classId) => setFilters({ classId, groupId: "", sectionId: "" })}
        onGroupChange={(groupId) => setFilters({ groupId, sectionId: "" })}
        onSectionChange={(sectionId) => setFilters({ sectionId })}
        onClearFilters={handleClearFilters}
      />

      {/* Content */}
      {!isLoading && students.length === 0 ? (
        <StudentsEmptyState
          hasActiveFilters={hasActiveFilters}
          onClearFilters={handleClearFilters}
          onAddNew={() => setIsFormOpen(true)}
        />
      ) : viewMode === "table" ? (
        <DataTable
          columns={columns}
          data={students}
          pagination={pagination || undefined}
          onPageChange={setPage}
          onSearch={(search) => setFilters({ search })}
          isLoading={isLoading}
          searchPlaceholder={t('searchPlaceholder')}
        />
      ) : isLoading ? (
        <CardGridSkeleton count={6} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {students.map((student) => (
            <StudentCard
              key={student.id}
              student={student}
              onView={() => handleView(student)}
              onEdit={canWriteStudents ? () => handleEdit(student) : undefined}
              onDelete={canManageStudents ? () => handleDelete(student) : undefined}
            />
          ))}
        </div>
      )}
        </>
      )}

      {/* Modals */}
      <StudentFormModal
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        onSubmit={handleSubmit}
        initialData={editingStudent || undefined}
        isEditing={!!editingStudent?.id}
      />

      <StudentDetailsModal
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        student={selectedStudent}
        onEdit={selectedStudent ? () => {
          setIsDetailsOpen(false);
          handleEdit(selectedStudent);
        } : undefined}
      />
    </div>
  );
}
