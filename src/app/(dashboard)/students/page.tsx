"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { GraduationCap, Plus } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";

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

  const handleEdit = useCallback((student: StudentRow) => {
    setEditingStudent({
      id: student.id,
      rollNumber: student.rollNumber,
      firstName: student.firstName,
      lastName: student.lastName,
      guardianName: student.guardianName,
      guardianContact: student.guardianContact,
      guardianEmail: student.guardianEmail,
      gender: student.gender || "",
      status: student.status,
      profilePictureUrl: student.profilePictureUrl,
      driveFileId: student.driveFileId,
      dateOfBirth: student.dateOfBirth ? new Date(student.dateOfBirth).toISOString().split('T')[0] : undefined,
      address: student.address,
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
    });
  }, [setFilters]);

  const hasActiveFilters = !!filters.search || filters.status !== "ALL" || filters.gender !== "ALL";

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
          <span>{`${row.original.firstName} ${row.original.lastName}`}</span>
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
      cell: ({ row }) => row.original.class?.name || "N/A",
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
          onEdit={() => handleEdit(row.original)}
          onDelete={() => handleDelete(row.original)}
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
          <Button onClick={() => setIsFormOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t('addStudent')}
          </Button>
        </div>
      </PageHeader>

      {/* Filters */}
      <StudentFiltersBar
        status={filters.status}
        gender={filters.gender}
        onStatusChange={(status) => setFilters({ status })}
        onGenderChange={(gender) => setFilters({ gender })}
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
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {students.map((student) => (
            <StudentCard
              key={student.id}
              student={student}
              onView={() => handleView(student)}
              onEdit={() => handleEdit(student)}
              onDelete={() => handleDelete(student)}
            />
          ))}
        </div>
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
