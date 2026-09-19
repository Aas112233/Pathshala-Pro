"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  History,
  Search,
  RotateCcw,
  Archive,
  Pencil,
  AlertTriangle,
  ShieldCheck,
  TrendingUp,
  FileText,
  CalendarCheck,
  Receipt,
  Layers,
  Building2,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { ERPDataTable, type ColumnDef } from "@/components/ui/erp-data-table";
import { ERPMetricCard } from "@/components/ui/erp-metric-card";
import { TopSheet } from "@/components/ui/top-sheet";
import { AppDropdown } from "@/components/ui/app-dropdown";
import { AppModal } from "@/components/ui/app-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { ERPFormSection, ERPFormGrid, ERPFormField } from "@/components/ui/erp-form-layout";
import { useAuth } from "@/components/providers/auth-provider";
import { useAcademicYears } from "@/hooks/use-queries";

export type DomainType = "promotions" | "exam-results" | "attendance" | "fee-vouchers";

export default function HistoricalDataPage() {
  const t = useTranslations("historicalData");
  const common = useTranslations("common");
  const queryClient = useQueryClient();
  const { user: authUser, isLoading: isAuthLoading } = useAuth();

  // Filters & State
  const [selectedDomain, setSelectedDomain] = useState<DomainType>("promotions");
  const [academicYearId, setAcademicYearId] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);

  // Edit Drawer State
  const [isEditOpen, setIsEditOpen] = useState<boolean>(false);
  const [activeRecord, setActiveRecord] = useState<any>(null);
  const [editFormData, setEditFormData] = useState<Record<string, any>>({});
  const [justificationReason, setJustificationReason] = useState<string>("");

  // Archive / Restore Modal State
  const [actionModal, setActionModal] = useState<{
    isOpen: boolean;
    record: any | null;
    action: "archive" | "restore";
  }>({
    isOpen: false,
    record: null,
    action: "archive",
  });
  const [actionReason, setActionReason] = useState<string>("");

  // Fetch Academic Years for selector
  const { data: academicYearsData } = useAcademicYears({ limit: 100 });
  const rawAy = academicYearsData as any;
  const academicYearsList: any[] = Array.isArray(rawAy)
    ? rawAy
    : Array.isArray(rawAy?.items)
    ? rawAy.items
    : Array.isArray(rawAy?.data?.items)
    ? rawAy.data.items
    : Array.isArray(rawAy?.data)
    ? rawAy.data
    : [];

  const yearOptions = [
    { label: t("allYears"), value: "" },
    ...academicYearsList.map((y: any) => ({
      label: `${y.label} ${y.isClosed ? "[Closed]" : "[Active]"}`,
      value: y.id,
    })),
  ];

  // Fetch Historical Records
  const queryKey = [
    "historical-data",
    {
      domain: selectedDomain,
      academicYearId,
      status: statusFilter,
      search: searchQuery,
      page,
      pageSize,
    },
  ];

  const { data: queryResponse, isLoading: isRecordsLoading, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("domain", selectedDomain);
      params.set("page", String(page));
      params.set("limit", String(pageSize));
      if (academicYearId) params.set("academicYearId", academicYearId);
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (searchQuery.trim()) params.set("search", searchQuery.trim());

      const res = await fetch(`/api/admin/historical-data?${params.toString()}`);
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.message || t("errorOccurred"));
      }
      return json;
    },
    enabled: !!authUser,
  });

  const records = queryResponse?.data || [];
  const pagination = queryResponse?.pagination || {
    totalCount: 0,
    currentPage: 1,
    pageSize: 20,
    totalPages: 1,
  };

  // Safe Historical Edit Mutation
  const editMutation = useMutation({
    mutationFn: async (payload: {
      domain: DomainType;
      recordId: string;
      reason: string;
      changes: Record<string, any>;
    }) => {
      const res = await fetch("/api/admin/historical-data", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.message || t("errorOccurred"));
      }
      return json;
    },
    onSuccess: () => {
      toast.success(t("editSuccess"));
      setIsEditOpen(false);
      setActiveRecord(null);
      setJustificationReason("");
      setEditFormData({});
      queryClient.invalidateQueries({ queryKey: ["historical-data"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || t("errorOccurred"));
    },
  });

  // Archive / Restore Mutation
  const actionMutation = useMutation({
    mutationFn: async (payload: {
      domain: DomainType;
      recordId: string;
      action: "archive" | "restore";
      reason: string;
    }) => {
      const res = await fetch("/api/admin/historical-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.message || t("errorOccurred"));
      }
      return json;
    },
    onSuccess: (_, vars) => {
      toast.success(vars.action === "archive" ? t("archiveSuccess") : t("restoreSuccess"));
      setActionModal({ isOpen: false, record: null, action: "archive" });
      setActionReason("");
      queryClient.invalidateQueries({ queryKey: ["historical-data"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || t("errorOccurred"));
    },
  });

  // Open Edit Drawer
  const handleOpenEdit = (record: any) => {
    setActiveRecord(record);
    setJustificationReason("");
    if (selectedDomain === "promotions") {
      setEditFormData({
        status: record.status || "PROMOTED",
        reason: record.reason || "",
        reExamRequired: record.reExamRequired || false,
        reExamCompleted: record.reExamCompleted || false,
        reExamPassed: record.reExamPassed,
      });
    } else if (selectedDomain === "exam-results") {
      setEditFormData({
        obtainedMarks: record.obtainedMarks ?? 0,
        remarks: record.remarks || "",
        status: record.status || "PASS",
        isLocked: record.isLocked || false,
      });
    } else if (selectedDomain === "attendance") {
      setEditFormData({
        status: record.status || "PRESENT",
        lateMinutes: record.lateMinutes || 0,
        earlyDepartureMinutes: record.earlyDepartureMinutes || 0,
        note: record.note || "",
      });
    } else if (selectedDomain === "fee-vouchers") {
      setEditFormData({
        dueDate: record.dueDate ? new Date(record.dueDate).toISOString().split("T")[0] : "",
        status: record.status || "PENDING",
      });
    }
    setIsEditOpen(true);
  };

  // Submit Edit
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!justificationReason.trim() || justificationReason.trim().length < 5) {
      toast.error(t("mandatoryReasonPlaceholder"));
      return;
    }
    editMutation.mutate({
      domain: selectedDomain,
      recordId: activeRecord.id,
      reason: justificationReason.trim(),
      changes: editFormData,
    });
  };

  // Handle Archive or Restore Modal Confirmation
  const handleConfirmAction = () => {
    if (!actionReason.trim() || actionReason.trim().length < 5) {
      toast.error(t("mandatoryReasonPlaceholder"));
      return;
    }
    actionMutation.mutate({
      domain: selectedDomain,
      recordId: actionModal.record.id,
      action: actionModal.action,
      reason: actionReason.trim(),
    });
  };

  // Check School Admin Authorization
  const isSchoolAdmin =
    authUser?.role === "SCHOOL_ADMIN" ||
    authUser?.role === "SUPER_ADMIN" ||
    authUser?.role === "SYSTEM_ADMIN" ||
    authUser?.role === "PLATFORM_OWNER" ||
    authUser?.role === "ADMIN" ||
    authUser?.role === "INSTITUTE_ADMIN";

  if (!isAuthLoading && !isSchoolAdmin) {
    return (
      <div className="flex h-96 flex-col items-center justify-center p-6 text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-3" />
        <h2 className="text-xl font-semibold tracking-tight">{common("accessRestricted")}</h2>
        <p className="mt-1 text-sm text-muted-foreground max-w-md">
          {t("accessNotice")}
        </p>
      </div>
    );
  }

  // Domain Tab Definitions
  const domainTabs: { id: DomainType; label: string; icon: any }[] = [
    { id: "promotions", label: t("domains.promotions"), icon: TrendingUp },
    { id: "exam-results", label: t("domains.examResults"), icon: FileText },
    { id: "attendance", label: t("domains.attendance"), icon: CalendarCheck },
    { id: "fee-vouchers", label: t("domains.feeVouchers"), icon: Receipt },
  ];

  // Dynamic Columns depending on Domain
  const getColumns = (): ColumnDef<any>[] => {
    switch (selectedDomain) {
      case "promotions":
        return [
          {
            key: "student",
            header: t("student"),
            cell: (row) => (
              <div>
                <div className="font-medium text-foreground">
                  {row.studentProfile ? `${row.studentProfile.firstName} ${row.studentProfile.lastName}` : "Unknown"}
                </div>
                <div className="text-xs text-muted-foreground">
                  ID: {row.studentProfile?.studentId} • Roll: {row.studentProfile?.rollNumber || "-"}
                </div>
              </div>
            ),
          },
          {
            key: "session",
            header: t("session"),
            cell: (row) => (
              <div>
                <div className="text-sm font-medium">
                  {row.fromAcademicYear?.label || "-"} → {row.toAcademicYear?.label || "-"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {row.fromClass?.name || "-"} → {row.toClass?.name || "-"}
                </div>
              </div>
            ),
          },
          {
            key: "status",
            header: t("statusLabel"),
            cell: (row) => {
              const isArch = (row.reason || "").includes("[ARCHIVED]");
              return (
                <div className="flex items-center gap-1.5">
                  <StatusBadge status={row.status} />
                  {isArch && <StatusBadge status="INACTIVE" />}
                </div>
              );
            },
          },
          {
            key: "details",
            header: t("details"),
            cell: (row) => (
              <div className="text-xs text-muted-foreground max-w-xs truncate">
                {row.reason || "-"}
              </div>
            ),
          },
          {
            key: "actions",
            header: t("actions"),
            cell: (row) => {
              const isArch = (row.reason || "").includes("[ARCHIVED]");
              return (
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs px-2"
                    onClick={() => handleOpenEdit(row)}
                  >
                    <Pencil className="h-3.5 w-3.5 mr-1" />
                    {common("edit")}
                  </Button>
                  {isArch ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs px-2 text-emerald-600 dark:text-emerald-400"
                      onClick={() => {
                        setActionModal({ isOpen: true, record: row, action: "restore" });
                        setActionReason("");
                      }}
                    >
                      <RotateCcw className="h-3.5 w-3.5 mr-1" />
                      {t("restoreRecord")}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs px-2 text-destructive hover:text-destructive"
                      onClick={() => {
                        setActionModal({ isOpen: true, record: row, action: "archive" });
                        setActionReason("");
                      }}
                    >
                      <Archive className="h-3.5 w-3.5 mr-1" />
                      {t("archiveRecord")}
                    </Button>
                  )}
                </div>
              );
            },
          },
        ];

      case "exam-results":
        return [
          {
            key: "student",
            header: t("student"),
            cell: (row) => (
              <div>
                <div className="font-medium text-foreground">
                  {row.studentProfile ? `${row.studentProfile.firstName} ${row.studentProfile.lastName}` : "Unknown"}
                </div>
                <div className="text-xs text-muted-foreground">
                  ID: {row.studentProfile?.studentId} • Class: {row.studentProfile?.class?.name || "-"}
                </div>
              </div>
            ),
          },
          {
            key: "exam",
            header: t("details"),
            cell: (row) => (
              <div>
                <div className="font-medium text-sm">{row.exam?.name || "-"}</div>
                <div className="text-xs text-muted-foreground">
                  {row.subject?.name || "-"} ({row.subject?.code || "-"})
                </div>
              </div>
            ),
          },
          {
            key: "score",
            header: t("score"),
            cell: (row) => (
              <div>
                <div className="font-semibold text-sm">
                  {row.obtainedMarks} / {row.maxMarks}
                </div>
                <div className="text-xs text-muted-foreground">
                  {row.percentage?.toFixed(1)}%
                </div>
              </div>
            ),
          },
          {
            key: "grade",
            header: t("grade"),
            cell: (row) => (
              <div>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-foreground">
                  {row.grade} ({row.gradePoint?.toFixed(2)})
                </span>
                <div className="text-[10px] text-muted-foreground mt-0.5">{row.status}</div>
              </div>
            ),
          },
          {
            key: "session",
            header: t("session"),
            cell: (row) => (
              <span className="text-xs text-muted-foreground">
                {row.academicYear?.label || "-"}
              </span>
            ),
          },
          {
            key: "actions",
            header: t("actions"),
            cell: (row) => {
              const isArch = (row.remarks || "").includes("[ARCHIVED]");
              return (
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs px-2"
                    onClick={() => handleOpenEdit(row)}
                  >
                    <Pencil className="h-3.5 w-3.5 mr-1" />
                    {common("edit")}
                  </Button>
                  {isArch ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs px-2 text-emerald-600 dark:text-emerald-400"
                      onClick={() => {
                        setActionModal({ isOpen: true, record: row, action: "restore" });
                        setActionReason("");
                      }}
                    >
                      <RotateCcw className="h-3.5 w-3.5 mr-1" />
                      {t("restoreRecord")}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs px-2 text-destructive hover:text-destructive"
                      onClick={() => {
                        setActionModal({ isOpen: true, record: row, action: "archive" });
                        setActionReason("");
                      }}
                    >
                      <Archive className="h-3.5 w-3.5 mr-1" />
                      {t("archiveRecord")}
                    </Button>
                  )}
                </div>
              );
            },
          },
        ];

      case "attendance":
        return [
          {
            key: "student",
            header: t("student"),
            cell: (row) => (
              <div>
                <div className="font-medium text-foreground">
                  {row.studentProfile ? `${row.studentProfile.firstName} ${row.studentProfile.lastName}` : "Unknown"}
                </div>
                <div className="text-xs text-muted-foreground">
                  ID: {row.studentProfile?.studentId} • Roll: {row.studentProfile?.rollNumber || "-"}
                </div>
              </div>
            ),
          },
          {
            key: "date",
            header: t("details"),
            cell: (row) => (
              <div>
                <div className="text-sm font-medium">
                  {row.date ? new Date(row.date).toLocaleDateString() : "-"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {row.academicYear?.label || "-"}
                </div>
              </div>
            ),
          },
          {
            key: "status",
            header: t("statusLabel"),
            cell: (row) => <StatusBadge status={row.status} />,
          },
          {
            key: "note",
            header: t("mandatoryReason"),
            cell: (row) => (
              <div className="text-xs text-muted-foreground max-w-xs truncate">
                {row.note || "-"}
              </div>
            ),
          },
          {
            key: "actions",
            header: t("actions"),
            cell: (row) => {
              const isArch = (row.note || "").includes("[ARCHIVED]");
              return (
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs px-2"
                    onClick={() => handleOpenEdit(row)}
                  >
                    <Pencil className="h-3.5 w-3.5 mr-1" />
                    {common("edit")}
                  </Button>
                  {isArch ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs px-2 text-emerald-600 dark:text-emerald-400"
                      onClick={() => {
                        setActionModal({ isOpen: true, record: row, action: "restore" });
                        setActionReason("");
                      }}
                    >
                      <RotateCcw className="h-3.5 w-3.5 mr-1" />
                      {t("restoreRecord")}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs px-2 text-destructive hover:text-destructive"
                      onClick={() => {
                        setActionModal({ isOpen: true, record: row, action: "archive" });
                        setActionReason("");
                      }}
                    >
                      <Archive className="h-3.5 w-3.5 mr-1" />
                      {t("archiveRecord")}
                    </Button>
                  )}
                </div>
              );
            },
          },
        ];

      case "fee-vouchers":
        return [
          {
            key: "voucher",
            header: t("details"),
            cell: (row) => (
              <div>
                <div className="font-semibold text-sm text-foreground">{row.voucherId}</div>
                <div className="text-xs text-muted-foreground">
                  {row.feeType} • {row.academicYear?.label || "-"}
                </div>
              </div>
            ),
          },
          {
            key: "student",
            header: t("student"),
            cell: (row) => (
              <div>
                <div className="font-medium text-foreground">
                  {row.studentProfile ? `${row.studentProfile.firstName} ${row.studentProfile.lastName}` : "Unknown"}
                </div>
                <div className="text-xs text-muted-foreground">
                  ID: {row.studentProfile?.studentId} • Class: {row.studentProfile?.class?.name || "-"}
                </div>
              </div>
            ),
          },
          {
            key: "amounts",
            header: t("score"),
            cell: (row) => (
              <div>
                <div className="font-medium text-sm">
                  Total: {row.totalDue?.toFixed(2)}
                </div>
                <div className="text-xs text-muted-foreground">
                  Paid: {row.amountPaid?.toFixed(2)} • Bal: {row.balance?.toFixed(2)}
                </div>
              </div>
            ),
          },
          {
            key: "status",
            header: t("statusLabel"),
            cell: (row) => (
              <div className="flex items-center gap-1.5">
                <StatusBadge status={row.status} />
                {row.voidedAt && (
                  <span className="text-[10px] uppercase font-bold text-destructive">
                    {t("archived")}
                  </span>
                )}
              </div>
            ),
          },
          {
            key: "actions",
            header: t("actions"),
            cell: (row) => {
              const isVoided = !!row.voidedAt;
              return (
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs px-2"
                    onClick={() => handleOpenEdit(row)}
                  >
                    <Pencil className="h-3.5 w-3.5 mr-1" />
                    {common("edit")}
                  </Button>
                  {isVoided ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs px-2 text-emerald-600 dark:text-emerald-400"
                      onClick={() => {
                        setActionModal({ isOpen: true, record: row, action: "restore" });
                        setActionReason("");
                      }}
                    >
                      <RotateCcw className="h-3.5 w-3.5 mr-1" />
                      {t("restoreRecord")}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs px-2 text-destructive hover:text-destructive"
                      onClick={() => {
                        setActionModal({ isOpen: true, record: row, action: "archive" });
                        setActionReason("");
                      }}
                    >
                      <Archive className="h-3.5 w-3.5 mr-1" />
                      {t("archiveRecord")}
                    </Button>
                  )}
                </div>
              );
            },
          },
        ];
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <PageHeader
        title={t("title")}
        description={t("description")}
        icon={History}
      />

      {/* KPI Metric Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <ERPMetricCard
          title={t("domains.promotions")}
          value={selectedDomain === "promotions" ? pagination.totalCount : "--"}
          icon={TrendingUp}
        />
        <ERPMetricCard
          title={t("domains.examResults")}
          value={selectedDomain === "exam-results" ? pagination.totalCount : "--"}
          icon={FileText}
        />
        <ERPMetricCard
          title={t("domains.attendance")}
          value={selectedDomain === "attendance" ? pagination.totalCount : "--"}
          icon={CalendarCheck}
        />
        <ERPMetricCard
          title={t("domains.feeVouchers")}
          value={selectedDomain === "fee-vouchers" ? pagination.totalCount : "--"}
          icon={Receipt}
        />
      </div>

      {/* Domain Navigation Tabs */}
      <div className="flex border-b border-border gap-2 overflow-x-auto pb-1">
        {domainTabs.map((tab) => {
          const TabIcon = tab.icon;
          const isActive = selectedDomain === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setSelectedDomain(tab.id);
                setPage(1);
              }}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                isActive
                  ? "border-primary text-primary font-semibold"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <TabIcon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex flex-wrap gap-3 items-center flex-1">
          <div className="w-full sm:w-72">
            <Input
              placeholder={t("searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="h-9"
            />
          </div>

          <div className="w-48">
            <AppDropdown
              options={yearOptions}
              value={academicYearId}
              onChange={(val) => {
                setAcademicYearId(val);
                setPage(1);
              }}
              placeholder={t("academicYear")}
              searchable
            />
          </div>

          {selectedDomain === "fee-vouchers" && (
            <div className="w-40">
              <AppDropdown
                options={[
                  { label: t("allStatuses"), value: "ALL" },
                  { label: t("active"), value: "ACTIVE" },
                  { label: t("archived"), value: "ARCHIVED" },
                ]}
                value={statusFilter}
                onChange={(val) => {
                  setStatusFilter(val);
                  setPage(1);
                }}
                placeholder={t("status")}
              />
            </div>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          className="h-9"
        >
          <RotateCcw className="h-3.5 w-3.5 mr-1" />
          {common("reset")}
        </Button>
      </div>

      {/* Main ERP Data Table */}
      <ERPDataTable
        data={records}
        columns={getColumns()}
        keyExtractor={(row) => row.id}
        isLoading={isRecordsLoading}
        page={page}
        pageSize={pageSize}
        totalCount={pagination.totalCount}
        onPageChange={setPage}
        onPageSizeChange={(newSize) => {
          setPageSize(newSize);
          setPage(1);
        }}
        emptyState={
          <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
            <History className="h-10 w-10 mb-2 opacity-40" />
            <p className="text-sm font-medium">{t("noRecordsFound")}</p>
          </div>
        }
      />

      {/* Safe Historical Edit TopSheet Drawer */}
      <TopSheet
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title={t("editRecord")}
        subtitle={
          activeRecord?.studentProfile
            ? `${activeRecord.studentProfile.firstName} ${activeRecord.studentProfile.lastName} (ID: ${activeRecord.studentProfile.studentId})`
            : undefined
        }
        maxWidth="3xl"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditOpen(false)}
              disabled={editMutation.isPending}
            >
              {common("cancel")}
            </Button>
            <Button
              type="submit"
              form="historical-edit-form"
              disabled={editMutation.isPending}
            >
              {editMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("saving")}
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  {t("saveChanges")}
                </>
              )}
            </Button>
          </div>
        }
      >
        <form id="historical-edit-form" onSubmit={handleSaveEdit} className="space-y-4">
          {/* Warning Banner */}
          <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-800 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{t("impactWarning")}</span>
          </div>

          {/* Domain Specific Inputs */}
          <ERPFormSection title={t("details")}>
            <ERPFormGrid cols={2}>
              {selectedDomain === "promotions" && (
                <>
                  <ERPFormField label={t("statusLabel")}>
                    <AppDropdown
                      options={[
                        { label: "PROMOTED", value: "PROMOTED" },
                        { label: "RETAINED", value: "RETAINED" },
                        { label: "CONDITIONAL_PROMOTED", value: "CONDITIONAL_PROMOTED" },
                      ]}
                      value={editFormData.status || "PROMOTED"}
                      onChange={(val) => setEditFormData({ ...editFormData, status: val })}
                    />
                  </ERPFormField>

                  <ERPFormField label="Re-Exam Required">
                    <AppDropdown
                      options={[
                        { label: common("no"), value: "false" },
                        { label: common("yes"), value: "true" },
                      ]}
                      value={String(editFormData.reExamRequired)}
                      onChange={(val) =>
                        setEditFormData({ ...editFormData, reExamRequired: val === "true" })
                      }
                    />
                  </ERPFormField>
                </>
              )}

              {selectedDomain === "exam-results" && (
                <>
                  <ERPFormField label={t("score")}>
                    <Input
                      type="number"
                      step="0.5"
                      value={editFormData.obtainedMarks ?? 0}
                      onChange={(e) =>
                        setEditFormData({ ...editFormData, obtainedMarks: parseFloat(e.target.value) || 0 })
                      }
                      required
                    />
                  </ERPFormField>

                  <ERPFormField label={t("statusLabel")}>
                    <AppDropdown
                      options={[
                        { label: "PASS", value: "PASS" },
                        { label: "FAIL", value: "FAIL" },
                        { label: "ABSENT", value: "ABSENT" },
                      ]}
                      value={editFormData.status || "PASS"}
                      onChange={(val) => setEditFormData({ ...editFormData, status: val })}
                    />
                  </ERPFormField>
                </>
              )}

              {selectedDomain === "attendance" && (
                <>
                  <ERPFormField label={t("statusLabel")}>
                    <AppDropdown
                      options={[
                        { label: "PRESENT", value: "PRESENT" },
                        { label: "ABSENT", value: "ABSENT" },
                        { label: "LATE", value: "LATE" },
                        { label: "HALF_DAY", value: "HALF_DAY" },
                        { label: "EXCUSED", value: "EXCUSED" },
                        { label: "HOLIDAY", value: "HOLIDAY" },
                      ]}
                      value={editFormData.status || "PRESENT"}
                      onChange={(val) => setEditFormData({ ...editFormData, status: val })}
                    />
                  </ERPFormField>

                  <ERPFormField label="Late Minutes">
                    <Input
                      type="number"
                      value={editFormData.lateMinutes ?? 0}
                      onChange={(e) =>
                        setEditFormData({ ...editFormData, lateMinutes: parseInt(e.target.value) || 0 })
                      }
                    />
                  </ERPFormField>
                </>
              )}

              {selectedDomain === "fee-vouchers" && (
                <>
                  <ERPFormField label="Due Date">
                    <Input
                      type="date"
                      value={editFormData.dueDate || ""}
                      onChange={(e) => setEditFormData({ ...editFormData, dueDate: e.target.value })}
                      required
                    />
                  </ERPFormField>

                  <ERPFormField label={t("statusLabel")}>
                    <AppDropdown
                      options={[
                        { label: "PENDING", value: "PENDING" },
                        { label: "PARTIAL", value: "PARTIAL" },
                        { label: "PAID", value: "PAID" },
                        { label: "VOIDED", value: "VOIDED" },
                      ]}
                      value={editFormData.status || "PENDING"}
                      onChange={(val) => setEditFormData({ ...editFormData, status: val })}
                    />
                  </ERPFormField>
                </>
              )}
            </ERPFormGrid>
          </ERPFormSection>

          {/* Mandatory Reason Note */}
          <ERPFormSection title={t("mandatoryReason")}>
            <ERPFormField label={t("mandatoryReason")} required>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[90px]"
                placeholder={t("mandatoryReasonPlaceholder")}
                value={justificationReason}
                onChange={(e) => setJustificationReason(e.target.value)}
                required
              />
            </ERPFormField>
          </ERPFormSection>
        </form>
      </TopSheet>

      {/* Archive / Restore Confirmation Modal */}
      <AppModal
        isOpen={actionModal.isOpen}
        onClose={() => setActionModal({ isOpen: false, record: null, action: "archive" })}
        title={actionModal.action === "archive" ? t("confirmArchive") : t("confirmRestore")}
      >
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            {actionModal.action === "archive"
              ? t("confirmArchiveDesc")
              : t("confirmRestoreDesc")}
          </p>

          <div>
            <label className="text-xs font-semibold text-foreground mb-1 block">
              {t("mandatoryReason")} *
            </label>
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[80px]"
              placeholder={t("mandatoryReasonPlaceholder")}
              value={actionReason}
              onChange={(e) => setActionReason(e.target.value)}
              required
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-border/60">
            <Button
              variant="outline"
              onClick={() => setActionModal({ isOpen: false, record: null, action: "archive" })}
              disabled={actionMutation.isPending}
            >
              {common("cancel")}
            </Button>
            <Button
              variant={actionModal.action === "archive" ? "destructive" : "default"}
              onClick={handleConfirmAction}
              disabled={actionMutation.isPending}
            >
              {actionMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("saving")}
                </>
              ) : actionModal.action === "archive" ? (
                t("archiveRecord")
              ) : (
                t("restoreRecord")
              )}
            </Button>
          </div>
        </div>
      </AppModal>
    </div>
  );
}
