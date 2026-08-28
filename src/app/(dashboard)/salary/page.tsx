"use client";

import { useState, useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Wallet,
  Plus,
  Users,
  Printer,
  CheckCircle2,
  Clock,
} from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";

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
import { usePDFExport, type SalaryPayslipPDFData } from "@/hooks/use-pdf-export";
import { useSubmitGuard } from "@/hooks/use-submit-guard";
import type { SalaryLedger, SalaryLedgerWithDetails, CreateSalaryLedgerDTO, PaymentDTO } from "@/types/entities";

// Data fetching for dropdowns
import { useQuery } from "@tanstack/react-query";
import { staffApi, academicYearsApi } from "@/lib/api-client";

export default function SalaryPage() {
  const t = useTranslations("salary");
  const { formatCurrency, formatDate } = useTenantFormatting();
  const { exportSalaryPayslipPDF, exportBatchPayslipsPDF } = usePDFExport();

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
    selectedSalary,
    setFilters,
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

  const handleEdit = useCallback(
    (salaryItem: SalaryLedger) => {
      setSelectedSalary(salaryItem as SalaryLedgerWithDetails);
      setEditingSalary(salaryItem as SalaryLedgerWithDetails);
      setIsFormOpen(true);
    },
    [setSelectedSalary]
  );

  const handleView = useCallback(
    (salaryItem: SalaryLedger) => {
      setSelectedSalary(salaryItem as SalaryLedgerWithDetails);
      setIsDetailsOpen(true);
    },
    [setSelectedSalary]
  );

  const handleDelete = useCallback(
    async (salaryItem: SalaryLedger) => {
      if (!confirm(t("confirmDelete"))) return;
      try {
        await deleteSalary(salaryItem.id);
        toast.success("Salary record deleted successfully");
      } catch {}
    },
    [deleteSalary, t]
  );

  const handlePayment = useCallback(
    (salaryItem: SalaryLedger) => {
      setSelectedSalary(salaryItem as SalaryLedgerWithDetails);
      setIsPaymentOpen(true);
    },
    [setSelectedSalary]
  );

  const handleDownloadPayslip = useCallback(
    (item: SalaryLedger) => {
      const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December",
      ];
      const monthStr = monthNames[(item.month || 1) - 1] || "Month";

      const staff = item.staffProfile;
      const pdfData: SalaryPayslipPDFData = {
        schoolName: "Pathshala Pro Academy",
        currencySymbol: "$",
        payslipId: `PS-${item.year}-${String(item.month).padStart(2, "0")}-${item.id.slice(0, 6)}`,
        staffId: staff?.staffId || "STAFF-01",
        staffName: `${staff?.firstName || ""} ${staff?.lastName || ""}`.trim() || "Staff Member",
        designation: staff?.designation || "Faculty Member",
        department: staff?.department || "Academic",
        bankName: "National Commercial Bank",
        bankAccountNo: "XXXX-XXXX-XXXX",
        month: monthStr,
        year: item.year,
        paymentDate: item.paidAt ? formatDate(item.paidAt) : "Pending",
        paymentMethod: "Bank Transfer",
        status: item.status,
        baseSalary: item.baseSalary || 0,
        allowances: [],
        totalEarnings: item.baseSalary || 0,
        deductions: item.deductions
          ? [{ title: "Deductions", amount: item.deductions }]
          : [],
        advances: item.advances || 0,
        totalDeductions: (item.deductions || 0) + (item.advances || 0),
        netSalary: item.netPayable || 0,
        paidAmount: item.paidAmount || 0,
      };

      exportSalaryPayslipPDF(pdfData);
      toast.success(`Downloaded Payslip for ${pdfData.staffName}`);
    },
    [exportSalaryPayslipPDF, formatDate]
  );

  const handleDownloadBatchPayslips = useCallback(() => {
    if (!salary.length) {
      toast.error("No salary records available for export");
      return;
    }

    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ];

    const payslips: SalaryPayslipPDFData[] = salary.map((item: any) => {
      const monthStr = monthNames[(item.month || 1) - 1] || "Month";
      const staff = item.staffProfile;
      return {
        schoolName: "Pathshala Pro Academy",
        currencySymbol: "$",
        payslipId: `PS-${item.year}-${String(item.month).padStart(2, "0")}-${item.id.slice(0, 6)}`,
        staffId: staff?.staffId || "STAFF-01",
        staffName: `${staff?.firstName || ""} ${staff?.lastName || ""}`.trim() || "Staff Member",
        designation: staff?.designation || "Faculty Member",
        department: staff?.department || "Academic",
        bankName: "National Commercial Bank",
        bankAccountNo: "XXXX-XXXX-XXXX",
        month: monthStr,
        year: item.year,
        paymentDate: item.paidAt ? formatDate(item.paidAt) : "Pending",
        paymentMethod: "Bank Transfer",
        status: item.status,
        baseSalary: item.baseSalary || 0,
        allowances: [],
        totalEarnings: item.baseSalary || 0,
        deductions: item.deductions
          ? [{ title: "Deductions", amount: item.deductions }]
          : [],
        advances: item.advances || 0,
        totalDeductions: (item.deductions || 0) + (item.advances || 0),
        netSalary: item.netPayable || 0,
        paidAmount: item.paidAmount || 0,
      };
    });

    exportBatchPayslipsPDF(payslips, `Monthly_Payslips_Batch_${Date.now()}.pdf`);
    toast.success(`Exporting ${payslips.length} Staff Payslips (PDF)...`);
  }, [salary, exportBatchPayslipsPDF, formatDate]);

  const { run: runSalarySubmit } = useSubmitGuard();

  const handleSubmit = useCallback(
    async (data: CreateSalaryLedgerDTO) => {
      await runSalarySubmit(async () => {
        if (editingSalary?.id) {
          await updateSalary(editingSalary.id, data);
          toast.success("Salary updated successfully");
        } else {
          await createSalary(data);
          toast.success("Payroll record created");
        }
        setEditingSalary(null);
      });
    },
    [createSalary, updateSalary, editingSalary, runSalarySubmit]
  );

  const handlePaymentSubmit = useCallback(
    async (salaryId: string, data: PaymentDTO) => {
      await runSalarySubmit(async () => {
        await recordPayment(salaryId, data);
        toast.success("Payment recorded successfully");
      });
    },
    [recordPayment, runSalarySubmit]
  );

  const handleBulkPayrollSubmit = useCallback(
    async (data: any) => {
      await runSalarySubmit(async () => {
        await processBulkPayroll(data);
        toast.success("Bulk payroll processed");
      });
    },
    [processBulkPayroll, runSalarySubmit]
  );

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

  const hasActiveFilters =
    !!filters.search ||
    !!filters.month ||
    !!filters.year ||
    filters.status !== "ALL" ||
    !!filters.department;

  // KPI Calculations
  const totalPayroll = salary.reduce((sum, s) => sum + (s.netPayable || 0), 0);
  const totalPaid = salary.reduce((sum, s) => sum + (s.paidAmount || 0), 0);
  const totalPending = totalPayroll - totalPaid;

  const columns: ColumnDef<SalaryLedger>[] = [
    {
      accessorKey: "staff",
      header: t("tableColumns.staffMember"),
      cell: ({ row }) => {
        const staff = row.original.staffProfile;
        return staff ? (
          <div>
            <div className="font-bold text-xs text-foreground">{`${staff.firstName} ${staff.lastName}`}</div>
            <div className="text-[11px] font-mono text-muted-foreground">{staff.staffId}</div>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        );
      },
    },
    {
      accessorKey: "designation",
      header: t("tableColumns.designation"),
      cell: ({ row }) => (
        <span className="text-xs">{row.original.staffProfile?.designation || "-"}</span>
      ),
    },
    {
      accessorKey: "department",
      header: t("tableColumns.department"),
      cell: ({ row }) => (
        <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-muted text-foreground">
          {row.original.staffProfile?.department || "-"}
        </span>
      ),
    },
    {
      accessorKey: "month",
      header: t("tableColumns.month"),
      cell: ({ getValue }) => {
        const monthNames = [
          "Jan", "Feb", "Mar", "Apr", "May", "Jun",
          "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
        ];
        return <span className="text-xs font-medium">{monthNames[getValue<number>() - 1]}</span>;
      },
    },
    {
      accessorKey: "year",
      header: t("tableColumns.year"),
      cell: ({ getValue }) => <span className="text-xs font-mono">{getValue<number>()}</span>,
    },
    {
      accessorKey: "baseSalary",
      header: t("tableColumns.baseSalary"),
      cell: ({ getValue }) => (
        <span className="font-mono text-xs">{formatCurrency(getValue<number>())}</span>
      ),
    },
    {
      accessorKey: "deductions",
      header: t("tableColumns.deductions"),
      cell: ({ getValue }) => {
        const value = getValue<number>();
        return value > 0 ? (
          <span className="font-mono text-xs text-amber-600">-{formatCurrency(value)}</span>
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        );
      },
    },
    {
      accessorKey: "advances",
      header: t("tableColumns.advances"),
      cell: ({ getValue }) => {
        const value = getValue<number>();
        return value > 0 ? (
          <span className="font-mono text-xs text-amber-600">-{formatCurrency(value)}</span>
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        );
      },
    },
    {
      accessorKey: "netPayable",
      header: t("tableColumns.netPayable"),
      cell: ({ getValue }) => (
        <span className="font-mono font-bold text-xs text-foreground">
          {formatCurrency(getValue<number>())}
        </span>
      ),
    },
    {
      accessorKey: "paidAmount",
      header: t("tableColumns.paid"),
      cell: ({ row }) => {
        const paid = row.original.paidAmount;
        return paid > 0 ? (
          <span className="font-mono font-semibold text-xs text-emerald-600">
            {formatCurrency(paid)}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        );
      },
    },
    {
      accessorKey: "status",
      header: t("tableColumns.status"),
      cell: ({ getValue }) => <StatusBadge status={getValue<string>()} domain="salary" />,
    },
    {
      id: "actions",
      header: t("tableColumns.actions"),
      cell: ({ row }) => (
        <SalaryActionsDropdown
          salary={row.original}
          onView={() => handleView(row.original)}
          onEdit={() => handleEdit(row.original)}
          onDelete={() => handleDelete(row.original)}
          onPayment={() => handlePayment(row.original)}
          onGenerateSlip={() => handleDownloadPayslip(row.original)}
        />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={t("title")}
        description={t("description")}
        icon={Wallet}
      >
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            onClick={handleDownloadBatchPayslips}
            size="sm"
            className="gap-2"
          >
            <Printer className="h-4 w-4" />
            Batch Payslips (PDF)
          </Button>
          <Button
            variant="outline"
            onClick={() => setIsBulkPayrollOpen(true)}
            size="sm"
            className="gap-2"
          >
            <Users className="h-4 w-4" />
            Bulk Payroll
          </Button>
          <Button onClick={() => setIsFormOpen(true)} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            {t("processPayroll")}
          </Button>
        </div>
      </PageHeader>

      {/* KPI Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border">
          <CardContent className="pt-5 pb-5 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-muted text-muted-foreground">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold font-mono text-foreground">
                {formatCurrency(totalPayroll)}
              </p>
              <p className="text-xs text-muted-foreground font-medium">{t("netPay")}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="pt-5 pb-5 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-muted text-muted-foreground">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold font-mono text-foreground">
                {formatCurrency(totalPaid)}
              </p>
              <p className="text-xs text-muted-foreground font-medium">{t("disbursed")}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="pt-5 pb-5 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-muted text-muted-foreground">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold font-mono text-foreground">
                {formatCurrency(Math.max(0, totalPending))}
              </p>
              <p className="text-xs text-muted-foreground font-medium">{t("pendingPayroll")}</p>
            </div>
          </CardContent>
        </Card>
      </div>

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
          searchPlaceholder={t("searchPlaceholder")}
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
        onEdit={(salaryItem) => {
          setIsDetailsOpen(false);
          handleEdit(salaryItem);
        }}
        onPayment={(salaryItem) => {
          setIsDetailsOpen(false);
          handlePayment(salaryItem);
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
