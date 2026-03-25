"use client";

import { useState, useCallback } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { GraduationCap, Plus, Pencil, Trash2, Eye } from "lucide-react";
import { toast } from "sonner";
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

export default function StudentsPage() {
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

  const handleEdit = useCallback((student: any) => {
    setEditingStudent({
      id: student.id,
      rollNumber: student.rollNumber,
      firstName: student.firstName,
      lastName: student.lastName,
      guardianName: student.guardianName,
      guardianContact: student.guardianContact,
      guardianEmail: student.guardianEmail,
      gender: student.gender,
      status: student.status,
      profilePictureUrl: student.profilePictureUrl,
      driveFileId: student.driveFileId,
      dateOfBirth: student.dateOfBirth ? new Date(student.dateOfBirth).toISOString().split('T')[0] : undefined,
      address: student.address,
    });
    setIsFormOpen(true);
  }, []);

  const handleView = useCallback((student: any) => {
    setSelectedStudent(student);
    setIsDetailsOpen(true);
  }, [setSelectedStudent]);

  const handleDelete = useCallback(async (student: any) => {
    if (!confirm("Are you sure you want to delete this student?")) return;
    try {
      await deleteStudent(student.id);
    } catch (err: any) {
      // Error handled by view model
    }
  }, [deleteStudent]);

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

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: "studentId",
      header: "Student ID",
      cell: ({ getValue }) => (
        <span className="font-medium">{getValue<string>()}</span>
      ),
    },
    {
      accessorKey: "rollNumber",
      header: "Roll Number",
    },
    {
      accessorKey: "firstName",
      header: "Name",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span>{`${row.original.firstName} ${row.original.lastName}`}</span>
        </div>
      ),
    },
    {
      accessorKey: "guardianName",
      header: "Guardian",
    },
    {
      accessorKey: "guardianContact",
      header: "Contact",
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ getValue }) => (
        <StudentStatusBadge status={getValue<string>() as any} />
      ),
    },
    {
      id: "actions",
      header: "Actions",
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
        title="Students"
        description="Manage student profiles, enrollment, and records."
        icon={GraduationCap}
      >
        <div className="flex items-center gap-2">
          <StudentViewSwitcher viewMode={viewMode} onViewModeChange={setViewMode} />
          <Button onClick={() => setIsFormOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Student
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
          searchPlaceholder="Search by name, ID, or roll number..."
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
