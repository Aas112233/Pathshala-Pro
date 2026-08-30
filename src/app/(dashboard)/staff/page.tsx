"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { CardGridSkeleton } from "@/components/ui/skeleton";
import { Users, Plus, IdCard, FileText } from "lucide-react";
import { useTenantSettings } from "@/components/providers/tenant-settings-provider";
import { usePDFExport } from "@/hooks/use-pdf-export";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { useAuth } from "@/components/providers/auth-provider";
import { hasPermission, getEffectivePermissions } from "@/lib/permissions";

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
  const tCommon = useTranslations("common");
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

  const { user: authUser, isLoading: isAuthLoading } = useAuth();
  const perms = getEffectivePermissions(authUser?.role as string, (authUser as any)?.permissions, (authUser as any)?.accessLevel);
  const canReadStaff = hasPermission(perms, "staff", "read");
  const canWriteStaff = hasPermission(perms, "staff", "write");
  const canManageStaff = hasPermission(perms, "staff", "manage");
  const { settings } = useTenantSettings();
  const { exportStaffIDCardsPDF, exportAdmissionFormPDF } = usePDFExport();

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
          onEdit={canWriteStaff ? () => handleEdit(row.original) : undefined}
          onDelete={canManageStaff ? () => handleDelete(row.original) : undefined}
          onToggleStatus={() => handleToggleStatus(row.original)}
        />
      ),
    },
  ];

  const handleStaffIDs = useCallback(async () => {
    if (staff.length === 0) { toast.error(t("noStaffToPrint")); return; }
    const school = { name: settings.name || "Pathshala Pro School", address: settings.address || "", phone: settings.phone || "", email: settings.email || "", logoUrl: settings.logoUrl };
    const data = staff.slice(0,12).map((s:any)=>({
      staffId: s.staffId || s.id.slice(0,8),
      name: `${s.firstName||""} ${s.lastName||""}`.trim()||"Staff",
      designation: s.designation||"-",
      department: s.department||"-",
      phone: s.phone, email: s.email, bloodGroup: s.bloodGroup,
      joiningDate: s.hireDate ? new Date(s.hireDate).toLocaleDateString() : undefined,
      photoUrl: s.profilePictureUrl,
      validUntil: new Date(new Date().setFullYear(new Date().getFullYear()+1)).toLocaleDateString(),
    }));
    const res = await exportStaffIDCardsPDF(school, data, new Date().getFullYear().toString(), typeof window!=="undefined"? window.location.origin: undefined);
    if(res.success) toast.success(t("staffIdCardsDownloaded", { count: data.length }));
    else toast.error(t("pdfFailed"));
  },[staff, settings, exportStaffIDCardsPDF]);

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
            {viewMode === "table" ? "Grid view" : "Table view"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleStaffIDs} disabled={staff.length===0} title="Printable PVC 8-up Staff ID cards with QR">
            <IdCard className="mr-2 h-4 w-4" />Staff IDs
          </Button>
          {canWriteStaff && (
            <Button onClick={() => setIsFormOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {t('addStaff')}
            </Button>
          )}
        </div>
      </PageHeader>

      {!isAuthLoading && !canReadStaff ? (
        <div className="rounded-lg border border-border bg-card p-6"><h2 className="text-lg font-semibold">{tCommon("accessRestricted")}</h2><p className="mt-2 text-sm text-muted-foreground">{tCommon("noPermission")}</p></div>
      ) : (
        <>
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
      ) : isLoading ? (
        <CardGridSkeleton count={6} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {staff.map((staffMember) => (
            <StaffCard
              key={staffMember.id}
              staff={staffMember}
              onView={() => handleView(staffMember)}
              onEdit={canWriteStaff ? () => handleEdit(staffMember) : undefined}
              onDelete={canManageStaff ? () => handleDelete(staffMember) : undefined}
            />
          ))}
        </div>
      )}
        </>
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
