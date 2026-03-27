"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Users, Plus } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";

// View Model
import { useStaffViewModel } from "@/viewmodels/staff/use-staff-view-model";

// Components
import { StaffCard } from "@/components/staff/staff-card";
import { StaffFormModal } from "@/components/staff/staff-form-modal";
import { StaffDetailsModal } from "@/components/staff/staff-details-modal";
import { StaffFiltersBar } from "@/components/staff/staff-filters-bar";
import { StaffEmptyState } from "@/components/staff/staff-empty-state";
import { StaffActionsDropdown } from "@/components/staff/staff-actions-dropdown";
import { StatusBadge } from "@/components/ui/status-badge";
import type { StaffProfile } from "@/types/entities";
import type { CreateStaffDTO } from "@/types/entities";

export default function StaffPage() {
  const t = useTranslations('staff');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<CreateStaffDTO & { id?: string } | null>(null);

  const {
    staff,
    isLoading,
    pagination,
    filters,
    viewMode,
    selectedStaff,
    setFilters,
    setViewMode,
    setPage,
    setSelectedStaff,
    createStaff,
    updateStaff,
    deleteStaff,
    toggleStaffStatus,
  } = useStaffViewModel();

  const handleEdit = useCallback((staffMember: StaffProfile) => {
    setEditingStaff({
      id: staffMember.id,
      staffId: staffMember.staffId,
      firstName: staffMember.firstName,
      lastName: staffMember.lastName,
      firstNameBn: staffMember.firstNameBn,
      lastNameBn: staffMember.lastNameBn,
      department: staffMember.department,
      designation: staffMember.designation,
      email: staffMember.email || "",
      phone: staffMember.phone || "",
      baseSalary: staffMember.baseSalary,
      hireDate: staffMember.hireDate ? new Date(staffMember.hireDate).toISOString().split('T')[0] : "",
      joiningDate: staffMember.joiningDate ? new Date(staffMember.joiningDate).toISOString().split('T')[0] : undefined,
      qualification: staffMember.qualification || "",
      gender: staffMember.gender,
      dateOfBirth: staffMember.dateOfBirth ? new Date(staffMember.dateOfBirth).toISOString().split('T')[0] : undefined,
      address: staffMember.address || "",
      profilePictureUrl: staffMember.profilePictureUrl,
      driveFileId: staffMember.driveFileId,
      isActive: staffMember.isActive,
    });
    setIsFormOpen(true);
  }, []);

  const handleView = useCallback((staffMember: StaffProfile) => {
    setSelectedStaff(staffMember);
    setIsDetailsOpen(true);
  }, [setSelectedStaff]);

  const handleDelete = useCallback(async (staffMember: StaffProfile) => {
    if (!confirm(t('confirmDelete'))) return;
    try {
      await deleteStaff(staffMember.id);
    } catch {
      // Error handled by view model
    }
  }, [deleteStaff, t]);

  const handleToggleStatus = useCallback(async (staffMember: StaffProfile) => {
    try {
      await toggleStaffStatus(staffMember.id, !staffMember.isActive);
    } catch {
      // Error handled by view model
    }
  }, [toggleStaffStatus]);

  const handleSubmit = useCallback(async (data: CreateStaffDTO) => {
    if (editingStaff?.id) {
      await updateStaff(editingStaff.id, data);
    } else {
      await createStaff(data);
    }
    setEditingStaff(null);
  }, [createStaff, updateStaff, editingStaff]);

  const handleCloseForm = useCallback(async () => {
    setIsFormOpen(false);
    setEditingStaff(null);
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters({
      search: "",
      status: "ALL",
      department: "",
      gender: "ALL",
    });
  }, [setFilters]);

  const hasActiveFilters = !!filters.search || filters.status !== "ALL" || filters.department !== "" || filters.gender !== "ALL";

  const columns: ColumnDef<StaffProfile>[] = [
    {
      accessorKey: "staffId",
      header: t('tableColumns.staffId'),
      cell: ({ getValue }) => (
        <span className="font-medium">{getValue<string>()}</span>
      ),
    },
    {
      accessorKey: "name",
      header: t('tableColumns.name'),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span>{`${row.original.firstName} ${row.original.lastName}`}</span>
          {row.original.firstNameBn || row.original.lastNameBn ? (
            <span className="text-xs text-muted-foreground">
              ({row.original.firstNameBn} {row.original.lastNameBn})
            </span>
          ) : null}
        </div>
      ),
    },
    {
      accessorKey: "department",
      header: t('tableColumns.department'),
    },
    {
      accessorKey: "designation",
      header: t('tableColumns.designation'),
    },
    {
      accessorKey: "email",
      header: t('tableColumns.email'),
    },
    {
      accessorKey: "phone",
      header: t('tableColumns.phone'),
    },
    {
      accessorKey: "isActive",
      header: t('tableColumns.status'),
      cell: ({ getValue, row }) => (
        <StatusBadge
          status={getValue<boolean>()}
          domain="active"
          label={getValue<boolean>() ? t('status.active') : t('status.inactive')}
        />
      ),
    },
    {
      id: "actions",
      header: t('tableColumns.actions'),
      cell: ({ row }) => (
        <StaffActionsDropdown
          staff={row.original}
          onView={() => handleView(row.original)}
          onEdit={() => handleEdit(row.original)}
          onDelete={() => handleDelete(row.original)}
          onToggleStatus={() => handleToggleStatus(row.original)}
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
        icon={Users}
      >
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            onClick={() => setViewMode(viewMode === "table" ? "grid" : "table")}
            size="sm"
          >
            {viewMode === "table" ? "Grid View" : "Table View"}
          </Button>
          <Button onClick={() => setIsFormOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t('addStaff')}
          </Button>
        </div>
      </PageHeader>

      {/* Filters */}
      <StaffFiltersBar
        department={filters.department}
        status={filters.status}
        gender={filters.gender}
        onDepartmentChange={(department) => setFilters({ department })}
        onStatusChange={(status) => setFilters({ status })}
        onGenderChange={(gender) => setFilters({ gender })}
        onClearFilters={handleClearFilters}
      />

      {/* Content */}
      {!isLoading && staff.length === 0 ? (
        <StaffEmptyState
          hasActiveFilters={hasActiveFilters}
          onClearFilters={handleClearFilters}
          onAddNew={() => setIsFormOpen(true)}
        />
      ) : viewMode === "table" ? (
        <DataTable
          columns={columns}
          data={staff}
          pagination={pagination || undefined}
          onPageChange={setPage}
          onSearch={(search) => setFilters({ search })}
          isLoading={isLoading}
          searchPlaceholder={t('searchPlaceholder')}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {staff.map((staffMember) => (
            <StaffCard
              key={staffMember.id}
              staff={staffMember}
              onView={() => handleView(staffMember)}
              onEdit={() => handleEdit(staffMember)}
              onDelete={() => handleDelete(staffMember)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <StaffFormModal
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        onSubmit={handleSubmit}
        initialData={editingStaff || undefined}
        isEditing={!!editingStaff?.id}
      />

      <StaffDetailsModal
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        staff={selectedStaff}
        onEdit={(staff) => {
          setIsDetailsOpen(false);
          handleEdit(staff);
        }}
      />
    </div>
  );
}
