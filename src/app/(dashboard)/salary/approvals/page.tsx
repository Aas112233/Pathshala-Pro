"use client";

import { useState, useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/shared/page-header";
import { ERPDataTable, type ColumnDef } from "@/components/ui/erp-data-table";
import { ERPMetricCard } from "@/components/ui/erp-metric-card";
import { Button } from "@/components/ui/button";
import { AppDropdown } from "@/components/ui/app-dropdown";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  CheckCircle2,
  Clock,
  Wallet,
  AlertCircle,
  FileCheck2,
  Filter,
  RotateCcw,
  CheckCheck,
  Building2,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { useTenantFormatting } from "@/components/providers/tenant-settings-provider";
import { useAuth } from "@/components/providers/auth-provider";
import { hasPermission, getEffectivePermissions } from "@/lib/permissions";
import { useQuery } from "@tanstack/react-query";
import { staffApi } from "@/lib/api-client";
import { usePDFExport, type SalaryPayslipPDFData } from "@/hooks/use-pdf-export";

// View Model & Components
import { useSalaryApprovalsViewModel } from "@/viewmodels/salary/use-salary-approvals-view-model";
import {
  SalaryActionsDropdown,
  SalaryDetailsModal,
  PaymentModal,
  RejectionDialog,
} from "@/components/salary";
import type { SalaryLedger, SalaryLedgerWithDetails, PaymentDTO } from "@/types/entities";

const MONTHS = [
  { value: "all", label: "All Months" },
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

export default function SalaryApprovalsPage() {
  const t = useTranslations("salary");
  const tCommon = useTranslations("common");
  const { formatCurrency, formatDate } = useTenantFormatting();
  const { exportSalaryPayslipPDF } = usePDFExport();
  const { user: authUser, isLoading: isAuthLoading } = useAuth();

  const perms = getEffectivePermissions(
    authUser?.role as string,
    (authUser as any)?.permissions,
    (authUser as any)?.accessLevel
  );
  const canReadSalary = hasPermission(perms, "salary", "read");
  const canManageSalary = hasPermission(perms, "salary", "manage");

  const [selectedIds, setSelectedIds] = useState<(string | number)[]>([]);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [activeSalaryItem, setActiveSalaryItem] = useState<SalaryLedger | null>(null);

  const {
    salaryList,
    isLoading,
    pagination,
    metrics,
    filters,
    setFilters,
    setPage,
    setSelectedSalary,
    refresh,
    approveSalary,
    rejectSalary,
    bulkApprove,
    recordPayment,
    isApproving,
    isRejecting,
  } = useSalaryApprovalsViewModel();

  // Fetch departments for filter dropdown
  const { data: staffData } = useQuery({
    queryKey: ["staff", "departments"],
    queryFn: () => staffApi.list({ limit: 100 }),
  });

  const departmentOptions = useMemo(() => {
    const rawStaff = (staffData as any)?.data || [];
    const depts = new Set<string>();
    rawStaff.forEach((s: any) => {
      if (s.department) depts.add(s.department);
    });
    return [
      { value: "all", label: "All Departments" },
      ...Array.from(depts).map((d) => ({ value: d, label: d })),
    ];
  }, [staffData]);

  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    return [
      { value: "all", label: "All Years" },
      { value: String(current - 1), label: String(current - 1) },
      { value: String(current), label: String(current) },
      { value: String(current + 1), label: String(current + 1) },
    ];
  }, []);

  const statusOptions = useMemo(
    () => [
      { value: "ALL", label: t("approvals.filters.allStatuses") },
      { value: "PENDING_APPROVAL", label: t("approvals.filters.pending") },
      { value: "APPROVED", label: t("approvals.filters.approved") },
      { value: "REJECTED", label: t("approvals.filters.rejected") },
      { value: "PAID", label: t("approvals.filters.paid") },
    ],
    [t]
  );

  const handleApproveSingle = useCallback(
    async (item: SalaryLedger) => {
      try {
        await approveSalary(item.id);
      } catch {}
    },
    [approveSalary]
  );

  const handleOpenReject = useCallback((item: SalaryLedger) => {
    setActiveSalaryItem(item);
    setIsRejectOpen(true);
  }, []);

  const handleConfirmReject = useCallback(
    async (reason: string) => {
      if (!activeSalaryItem) return;
      try {
        await rejectSalary(activeSalaryItem.id, reason);
      } catch {}
    },
    [activeSalaryItem, rejectSalary]
  );

  const handleBulkApproveSelected = useCallback(async () => {
    const eligibleIds = selectedIds.filter((id) => {
      const item = salaryList.find((s) => s.id === String(id));
      return item && (item.status === "PENDING" || item.status === "PENDING_APPROVAL");
    }) as string[];

    if (!eligibleIds.length) {
      toast.error(t("approvals.noPendingSelected"));
      return;
    }

    try {
      await bulkApprove(eligibleIds);
      setSelectedIds([]);
    } catch {}
  }, [selectedIds, salaryList, bulkApprove, t]);

  const handleApproveAllPendingInView = useCallback(async () => {
    const pendingIds = salaryList
      .filter((s) => s.status === "PENDING" || s.status === "PENDING_APPROVAL")
      .map((s) => s.id);

    if (!pendingIds.length) {
      toast.info(t("approvals.noPendingInView"));
      return;
    }

    try {
      await bulkApprove(pendingIds);
      setSelectedIds([]);
    } catch {}
  }, [salaryList, bulkApprove, t]);

  const handleView = useCallback(
    (item: SalaryLedger) => {
      setSelectedSalary(item as SalaryLedgerWithDetails);
      setIsDetailsOpen(true);
    },
    [setSelectedSalary]
  );

  const handlePayment = useCallback(
    (item: SalaryLedger) => {
      setSelectedSalary(item as SalaryLedgerWithDetails);
      setIsPaymentOpen(true);
    },
    [setSelectedSalary]
  );

  const handlePaymentSubmit = useCallback(
    async (salaryId: string, data: PaymentDTO) => {
      try {
        await recordPayment(salaryId, data);
      } catch {}
    },
    [recordPayment]
  );

  const handleDownloadPayslip = useCallback(
    (item: SalaryLedger) => {
      const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December",
      ];
      const monthStr = monthNames[(item.month || 1) - 1] || "January";
      const staff = item.staffProfile;

      const pdfData: SalaryPayslipPDFData = {
        schoolName: "Pathshala Pro Academy",
        currencySymbol: "$",
        payslipId: `PS-${item.year}-${String(item.month).padStart(2, "0")}-${item.id.slice(0, 6)}`,
        staffId: staff?.staffId || "-",
        staffName: `${staff?.firstName || ""} ${staff?.lastName || ""}`.trim() || "Staff Member",
        designation: staff?.designation || "-",
        department: staff?.department || "-",
        bankName: "Institutional Bank",
        bankAccountNo: "XXXX-XXXX-XXXX",
        month: monthStr,
        year: item.year,
        paymentDate: item.paidAt ? formatDate(item.paidAt) : t("pendingPayroll"),
        paymentMethod: "Bank Transfer",
        status: item.status,
        baseSalary: item.baseSalary || 0,
        allowances: [],
        totalEarnings: item.baseSalary || 0,
        deductions: item.deductions ? [{ title: "Deductions", amount: item.deductions }] : [],
        advances: item.advances || 0,
        totalDeductions: (item.deductions || 0) + (item.advances || 0),
        netSalary: item.netPayable || 0,
        paidAmount: item.paidAmount || 0,
      };

      exportSalaryPayslipPDF(pdfData);
      toast.success(t("ui.downloadedPayslip", { name: pdfData.staffName }));
    },
    [exportSalaryPayslipPDF, formatDate, t]
  );

  const columns: ColumnDef<SalaryLedger>[] = useMemo(
    () => [
      {
        key: "staff",
        header: t("tableColumns.staffMember"),
        cell: (row) => {
          const staff = row.staffProfile;
          return staff ? (
            <div>
              <div className="font-semibold text-xs text-foreground">
                {`${staff.firstName} ${staff.lastName}`}
              </div>
              <div className="text-[11px] font-mono text-muted-foreground">{staff.staffId}</div>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">-</span>
          );
        },
      },
      {
        key: "department",
        header: t("tableColumns.department"),
        cell: (row) => (
          <span className="text-xs font-medium px-2 py-0.5 rounded bg-muted text-foreground">
            {row.staffProfile?.department || "-"}
          </span>
        ),
      },
      {
        key: "designation",
        header: t("tableColumns.designation"),
        cell: (row) => (
          <span className="text-xs text-muted-foreground">
            {row.staffProfile?.designation || "-"}
          </span>
        ),
      },
      {
        key: "period",
        header: t("approvals.table.period"),
        cell: (row) => {
          const monthNames = [
            "Jan", "Feb", "Mar", "Apr", "May", "Jun",
            "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
          ];
          return (
            <span className="text-xs font-mono">
              {monthNames[(row.month || 1) - 1]} {row.year}
            </span>
          );
        },
      },
      {
        key: "baseSalary",
        header: t("tableColumns.baseSalary"),
        cell: (row) => (
          <span className="font-mono text-xs">{formatCurrency(row.baseSalary || 0)}</span>
        ),
      },
      {
        key: "deductions",
        header: t("tableColumns.deductions"),
        cell: (row) => {
          const totalDed = (row.deductions || 0) + (row.advances || 0);
          return totalDed > 0 ? (
            <span className="font-mono text-xs text-amber-600">-{formatCurrency(totalDed)}</span>
          ) : (
            <span className="text-xs text-muted-foreground">-</span>
          );
        },
      },
      {
        key: "netPayable",
        header: t("tableColumns.netPayable"),
        cell: (row) => (
          <span className="font-mono font-bold text-xs text-foreground">
            {formatCurrency(row.netPayable || 0)}
          </span>
        ),
      },
      {
        key: "status",
        header: t("tableColumns.status"),
        cell: (row) => <StatusBadge domain="salary" status={row.status} />,
      },
      {
        key: "approvalAudit",
        header: t("approvals.table.audit"),
        cell: (row) => {
          if (row.status === "APPROVED" && row.approvedBy) {
            return (
              <div className="text-[11px] leading-tight">
                <span className="font-medium text-emerald-600 dark:text-emerald-400">
                  {row.approvedBy.name}
                </span>
                {row.approvedAt && (
                  <div className="text-muted-foreground text-[10px]">{formatDate(row.approvedAt)}</div>
                )}
              </div>
            );
          }
          if (row.status === "REJECTED" && row.rejectionReason) {
            return (
              <div className="text-[11px] text-destructive max-w-[160px] truncate" title={row.rejectionReason}>
                {row.rejectionReason}
              </div>
            );
          }
          if (row.status === "PENDING" || row.status === "PENDING_APPROVAL") {
            return (
              <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                {t("approvals.awaitingAudit")}
              </span>
            );
          }
          return <span className="text-xs text-muted-foreground">-</span>;
        },
      },
      {
        key: "actions",
        header: t("tableColumns.actions"),
        cell: (row) => (
          <SalaryActionsDropdown
            salary={row}
            onView={() => handleView(row)}
            onApprove={canManageSalary ? () => handleApproveSingle(row) : undefined}
            onReject={canManageSalary ? () => handleOpenReject(row) : undefined}
            onPayment={canManageSalary ? () => handlePayment(row) : undefined}
            onGenerateSlip={() => handleDownloadPayslip(row)}
          />
        ),
      },
    ],
    [
      t,
      formatCurrency,
      formatDate,
      canManageSalary,
      handleView,
      handleApproveSingle,
      handleOpenReject,
      handlePayment,
      handleDownloadPayslip,
    ]
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title={t("approvals.title")}
        description={t("approvals.description")}
        icon={CheckCircle2}
      >
        <div className="flex flex-wrap items-center gap-2.5">
          {canManageSalary && (
            <>
              {selectedIds.length > 0 && (
                <Button
                  size="sm"
                  onClick={handleBulkApproveSelected}
                  disabled={isApproving}
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <CheckCheck className="h-4 w-4" />
                  {t("approvals.approveSelected", { count: selectedIds.length })}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleApproveAllPendingInView}
                disabled={isApproving || metrics.pendingCount === 0}
                className="gap-2 border-emerald-600 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
              >
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                {t("approvals.approveAllPending")}
              </Button>
            </>
          )}
        </div>
      </PageHeader>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ERPMetricCard
          title={t("approvals.kpi.pendingTitle")}
          subtitle={t("approvals.kpi.pendingSubtitle")}
          value={metrics.pendingCount}
          unit={t("approvals.kpi.staffUnit")}
          lastUpdated={formatCurrency(metrics.pendingAmount)}
          icon={Clock}
          isLoading={isLoading}
        />
        <ERPMetricCard
          title={t("approvals.kpi.approvedTitle")}
          subtitle={t("approvals.kpi.approvedSubtitle")}
          value={metrics.approvedCount}
          unit={t("approvals.kpi.staffUnit")}
          lastUpdated={formatCurrency(metrics.approvedAmount)}
          icon={CheckCircle2}
          isLoading={isLoading}
        />
        <ERPMetricCard
          title={t("approvals.kpi.disbursedTitle")}
          subtitle={t("approvals.kpi.disbursedSubtitle")}
          value={formatCurrency(metrics.disbursedAmount)}
          unit={`${metrics.disbursedCount} ${t("approvals.kpi.staffUnit")}`}
          icon={Wallet}
          isLoading={isLoading}
        />
        <ERPMetricCard
          title={t("approvals.kpi.rejectedTitle")}
          subtitle={t("approvals.kpi.rejectedSubtitle")}
          value={metrics.rejectedCount}
          unit={t("approvals.kpi.staffUnit")}
          icon={AlertCircle}
          isLoading={isLoading}
        />
      </div>

      {/* Filter Toolbar */}
      <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-40">
            <AppDropdown
              id="filter-month"
              value={filters.month}
              onChange={(val) => setFilters({ month: val })}
              options={MONTHS}
              placeholder={t("approvals.filters.selectMonth")}
            />
          </div>
          <div className="w-36">
            <AppDropdown
              id="filter-year"
              value={filters.year}
              onChange={(val) => setFilters({ year: val })}
              options={yearOptions}
              placeholder={t("approvals.filters.selectYear")}
            />
          </div>
          <div className="w-48">
            <AppDropdown
              id="filter-dept"
              value={filters.department || "all"}
              onChange={(val) => setFilters({ department: val })}
              options={departmentOptions}
              placeholder={t("approvals.filters.selectDept")}
              searchable
            />
          </div>
          <div className="w-44">
            <AppDropdown
              id="filter-status"
              value={filters.status}
              onChange={(val) => setFilters({ status: val })}
              options={statusOptions}
              placeholder={t("approvals.filters.selectStatus")}
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setFilters({
                search: "",
                month: "all",
                year: "all",
                status: "ALL",
                department: "all",
              })
            }
            className="gap-1.5 text-muted-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {tCommon("reset")}
          </Button>
        </div>
      </div>

      {/* Approval Queue Data Table */}
      <ERPDataTable<SalaryLedger>
        data={salaryList}
        columns={columns}
        keyExtractor={(row) => row.id}
        isLoading={isLoading}
        searchPlaceholder={t("approvals.searchPlaceholder")}
        searchValue={filters.search}
        onSearchChange={(val) => setFilters({ search: val })}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        isRowSelectable={(row) => row.status === "PENDING" || row.status === "PENDING_APPROVAL"}
        page={pagination?.currentPage || 1}
        pageSize={pagination?.pageSize || 20}
        totalCount={pagination?.totalCount || 0}
        onPageChange={setPage}
        emptyState={
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Clock className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-foreground">{t("approvals.emptyTitle")}</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              {t("approvals.emptyDescription")}
            </p>
          </div>
        }
      />

      {/* Modals */}
      <SalaryDetailsModal
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        salary={salaryList.find((s) => s.id === (activeSalaryItem?.id || "")) as any || null}
        onPayment={canManageSalary ? (salary) => handlePayment(salary) : undefined}
      />

      <RejectionDialog
        isOpen={isRejectOpen}
        onClose={() => {
          setIsRejectOpen(false);
          setActiveSalaryItem(null);
        }}
        onConfirm={handleConfirmReject}
        staffName={
          activeSalaryItem?.staffProfile
            ? `${activeSalaryItem.staffProfile.firstName} ${activeSalaryItem.staffProfile.lastName}`
            : undefined
        }
        isSubmitting={isRejecting}
      />

      {isPaymentOpen && (
        <PaymentModal
          isOpen={isPaymentOpen}
          onClose={() => setIsPaymentOpen(false)}
          onSubmit={handlePaymentSubmit}
          salary={salaryList.find((s) => s.id === (activeSalaryItem?.id || "")) as any || null}
        />
      )}
    </div>
  );
}
