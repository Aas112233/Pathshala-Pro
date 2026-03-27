"use client";

import { useState, useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Wallet, Plus, Users } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";

// View Model
import { useSalaryViewModel } from "@/viewmodels/salary/use-salary-view-model";

// Components
import {
  SalaryFormModal,
  SalaryActionsDropdown,
  SalaryDetailsModal,
  PaymentModal,
  BulkPayrollModal,
  SalaryFiltersBar,
  SalaryEmptyState,
} from "@/components/salary";
import { StatusBadge } from "@/components/ui/status-badge";
import { useTenantFormatting } from "@/components/providers/tenant-settings-provider";
import type { SalaryLedger, SalaryLedgerWithDetails, CreateSalaryLedgerDTO, PaymentDTO } from "@/types/entities";

// Data fetching for dropdowns
import { useQuery } from "@tanstack/react-query";
import { staffApi, academicYearsApi } from "@/lib/api-client";

export default function SalaryPage() {
  const t = useTranslations('salary');
  const { formatCurrency } = useTenantFormatting();
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isBulkPayrollOpen, setIsBulkPayrollOpen] = useState(false);
  const [editingSalary, setEditingSalary] = useState<SalaryLedgerWithDetails | null>(null);

  const {
    salary,
    isLoading,
    pagination,
    filters,
    viewMode,
    selectedSalary,
    setFilters,
    setViewMode,
    setPage,
    setSelectedSalary,
    createSalary,
    updateSalary,
    deleteSalary,
    recordPayment,
    processBulkPayroll,
  } = useSalaryViewModel();

  // Fetch staff list for dropdowns
  const { data: staffData } = useQuery({
    queryKey: ["staff-all-salary"],
    queryFn: () => staffApi.list({ limit: 100, filters: { isActive: true } }),
  });

  // Fetch academic years for dropdowns
  const { data: academicYearsData } = useQuery({
    queryKey: ["academic-years-all-salary"],
    queryFn: () => academicYearsApi.list({ limit: 100 }),
  });

  const staffList = useMemo(() => {
    const data = staffData as any;
    return (data?.data || []).map((s: any) => ({
      id: s.id,
      staffId: s.staffId,
      firstName: s.firstName,
      lastName: s.lastName,
      designation: s.designation,
      department: s.department,
      baseSalary: s.baseSalary,
      isActive: s.isActive,
    }));
  }, [staffData]);

  const academicYears = useMemo(() => {
    const data = academicYearsData as any;
    return (data?.data || []).map((ay: any) => ({
      id: ay.id,
      yearId: ay.yearId,
      label: ay.label,
      isClosed: ay.isClosed,
    }));
  }, [academicYearsData]);

  const handleEdit = useCallback((salaryItem: SalaryLedger) => {
    // Fetch full details for editing
    setSelectedSalary(salaryItem as SalaryLedgerWithDetails);
    setEditingSalary(salaryItem as SalaryLedgerWithDetails);
    setIsFormOpen(true);
  }, [setSelectedSalary]);

  const handleView = useCallback((salaryItem: SalaryLedger) => {
    setSelectedSalary(salaryItem as SalaryLedgerWithDetails);
    setIsDetailsOpen(true);
  }, [setSelectedSalary]);

  const handleDelete = useCallback(async (salaryItem: SalaryLedger) => {
    if (!confirm(t('confirmDelete'))) return;
    try {
      await deleteSalary(salaryItem.id);
    } catch {
      // Error handled by view model
    }
  }, [deleteSalary, t]);

  const handlePayment = useCallback((salaryItem: SalaryLedger) => {
    setSelectedSalary(salaryItem as SalaryLedgerWithDetails);
    setIsPaymentOpen(true);
  }, [setSelectedSalary]);

  const handleSubmit = useCallback(async (data: CreateSalaryLedgerDTO) => {
    if (editingSalary?.id) {
      await updateSalary(editingSalary.id, data);
    } else {
      await createSalary(data);
    }
    setEditingSalary(null);
  }, [createSalary, updateSalary, editingSalary]);

  const handlePaymentSubmit = useCallback(async (salaryId: string, data: PaymentDTO) => {
    await recordPayment(salaryId, data);
  }, [recordPayment]);

  const handleBulkPayrollSubmit = useCallback(async (data: any) => {
    await processBulkPayroll(data);
  }, [processBulkPayroll]);

  const handleCloseForm = useCallback(async () => {
    setIsFormOpen(false);
    setEditingSalary(null);
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters({
      search: "",
      month: "",
      year: "",
      status: "ALL",
      department: "",
    });
  }, [setFilters]);

  const hasActiveFilters = !!filters.search || !!filters.month || !!filters.year || filters.status !== "ALL" || !!filters.department;

  const columns: ColumnDef<SalaryLedger>[] = [
    {
      accessorKey: "staff",
      header: t('tableColumns.staffMember'),
      cell: ({ row }) => {
        const staff = row.original.staffProfile;
        return staff ? (
          <div>
            <div className="font-medium">{`${staff.firstName} ${staff.lastName}`}</div>
            <div className="text-xs text-muted-foreground">{staff.staffId}</div>
          </div>
        ) : (
          <span>-</span>
        );
      },
    },
    {
      accessorKey: "designation",
      header: t('tableColumns.designation'),
      cell: ({ row }) => row.original.staffProfile?.designation || "-",
    },
    {
      accessorKey: "department",
      header: t('tableColumns.department'),
      cell: ({ row }) => row.original.staffProfile?.department || "-",
    },
    {
      accessorKey: "month",
      header: t('tableColumns.month'),
      cell: ({ getValue }) => {
        const monthNames = [
          "Jan", "Feb", "Mar", "Apr", "May", "Jun",
          "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
        ];
        return monthNames[getValue<number>() - 1];
      },
    },
    {
      accessorKey: "year",
      header: t('tableColumns.year'),
    },
    {
      accessorKey: "baseSalary",
      header: t('tableColumns.baseSalary'),
      cell: ({ getValue }) => formatCurrency(getValue<number>()),
    },
    {
      accessorKey: "deductions",
      header: t('tableColumns.deductions'),
      cell: ({ getValue }) => {
        const value = getValue<number>();
        return value > 0 ? <span className="text-amber-600">-{formatCurrency(value)}</span> : "-";
      },
    },
    {
      accessorKey: "advances",
      header: t('tableColumns.advances'),
      cell: ({ getValue }) => {
        const value = getValue<number>();
        return value > 0 ? <span className="text-amber-600">-{formatCurrency(value)}</span> : "-";
      },
    },
    {
      accessorKey: "netPayable",
      header: t('tableColumns.netPayable'),
      cell: ({ getValue }) => (
        <span className="font-semibold">{formatCurrency(getValue<number>())}</span>
      ),
    },
    {
      accessorKey: "paidAmount",
      header: t('tableColumns.paid'),
      cell: ({ row }) => {
        const paid = row.original.paidAmount;
        return paid > 0 ? (
          <span className="text-green-600">{formatCurrency(paid)}</span>
        ) : (
          <span className="text-muted-foreground">-</span>
        );
      },
    },
    {
      accessorKey: "status",
      header: t('tableColumns.status'),
      cell: ({ getValue }) => (
        <StatusBadge
          status={getValue<string>()}
          domain="salary"
        />
      ),
    },
    {
      id: "actions",
      header: t('tableColumns.actions'),
      cell: ({ row }) => (
        <SalaryActionsDropdown
          salary={row.original}
          onView={() => handleView(row.original)}
          onEdit={() => handleEdit(row.original)}
          onDelete={() => handleDelete(row.original)}
          onPayment={() => handlePayment(row.original)}
          onGenerateSlip={() => toast.info("Slip generation coming soon")}
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
        icon={Wallet}
      >
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            onClick={() => setIsBulkPayrollOpen(true)}
            size="sm"
          >
            <Users className="mr-2 h-4 w-4" />
            Bulk Payroll
          </Button>
          <Button onClick={() => setIsFormOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t('processPayroll')}
          </Button>
        </div>
      </PageHeader>

      {/* Filters */}
      <SalaryFiltersBar
        month={filters.month}
        year={filters.year}
        status={filters.status}
        department={filters.department}
        onMonthChange={(month) => setFilters({ month })}
        onYearChange={(year) => setFilters({ year })}
        onStatusChange={(status) => setFilters({ status })}
        onDepartmentChange={(department) => setFilters({ department })}
        onClearFilters={handleClearFilters}
      />

      {/* Content */}
      {!isLoading && salary.length === 0 ? (
        <SalaryEmptyState
          hasActiveFilters={hasActiveFilters}
          onClearFilters={handleClearFilters}
          onProcessPayroll={() => setIsFormOpen(true)}
          onBulkPayroll={() => setIsBulkPayrollOpen(true)}
        />
      ) : (
        <DataTable
          columns={columns}
          data={salary}
          pagination={pagination || undefined}
          onPageChange={setPage}
          onSearch={(search) => setFilters({ search })}
          isLoading={isLoading}
          searchPlaceholder={t('searchPlaceholder')}
        />
      )}

      {/* Modals */}
      <SalaryFormModal
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        onSubmit={handleSubmit}
        initialData={editingSalary}
        isEditing={!!editingSalary?.id}
        staffList={staffList}
        academicYears={academicYears}
      />

      <SalaryDetailsModal
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        salary={selectedSalary}
        onEdit={(salary) => {
          setIsDetailsOpen(false);
          handleEdit(salary);
        }}
        onPayment={(salary) => {
          setIsDetailsOpen(false);
          handlePayment(salary);
        }}
      />

      <PaymentModal
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
        onSubmit={handlePaymentSubmit}
        salary={selectedSalary}
      />

      <BulkPayrollModal
        isOpen={isBulkPayrollOpen}
        onClose={() => setIsBulkPayrollOpen(false)}
        onSubmit={handleBulkPayrollSubmit}
        staffList={staffList}
        academicYears={academicYears}
      />
    </div>
  );
}

// Simple toast placeholder - replace with actual sonner toast
const toast = {
  info: (msg: string) => console.info(msg),
  success: (msg: string) => console.log(msg),
  error: (msg: string) => console.error(msg),
};
