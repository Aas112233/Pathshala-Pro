"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TenantDateInput } from "@/components/ui/tenant-date-input";
import { Label } from "@/components/ui/label";
import { TopSheet } from "@/components/ui/top-sheet";
import { ERPMetricCard } from "@/components/ui/erp-metric-card";
import { ERPFormSection, ERPFormGrid, ERPFormField } from "@/components/ui/erp-form-layout";
import {
  CalendarRange,
  Plus,
  Pencil,
  Trash2,
  Calendar,
  CheckCircle2,
  Archive,
  Layers,
  Star,
  CalendarPlus,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  useAcademicYears,
  useCreateAcademicYear,
  useUpdateAcademicYear,
  useDeleteAcademicYear,
  useSetCurrentAcademicYear,
} from "@/hooks/use-queries";
import { useYearClosePreflight } from "@/hooks/use-exams";
import { RolloverPreflightPanel } from "@/components/shared/rollover-preflight-panel";
import { RolloverWizard } from "@/components/shared/rollover-wizard";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { useTenantFormatting } from "@/components/providers/tenant-settings-provider";
import { useAuth } from "@/components/providers/auth-provider";
import { hasPermission, getEffectivePermissions } from "@/lib/permissions";

interface AcademicYearFormData {
  yearId: string;
  label: string;
  startDate: string;
  endDate: string;
  isClosed: boolean;
}

const INITIAL_FORM: AcademicYearFormData = {
  yearId: "",
  label: "",
  startDate: "",
  endDate: "",
  isClosed: false,
};

export default function AcademicYearPage() {
  const t = useTranslations("academicYear");
  const tPreflight = useTranslations("promotions.preflight");
  const tRollover = useTranslations("rollover");
  const common = useTranslations("common");
  const { user: authUser, isLoading: isAuthLoading } = useAuth();
  const perms = getEffectivePermissions(authUser?.role as string, (authUser as any)?.permissions, (authUser as any)?.accessLevel);
  const canRead = hasPermission(perms, "academic-years", "read");
  const canWrite = hasPermission(perms, "academic-years", "write");
  const canManage = hasPermission(perms, "academic-years", "manage");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const { formatDate } = useTenantFormatting();

  // TopSheet Drawer State
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isRolloverOpen, setIsRolloverOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<AcademicYearFormData>(INITIAL_FORM);

  const { data, isLoading } = useAcademicYears({
    page,
    limit: 20,
    search: search || undefined,
  });

  const createMutation = useCreateAcademicYear();
  const updateMutation = useUpdateAcademicYear(editingId || "");
  const deleteMutation = useDeleteAcademicYear();
  const setCurrentMutation = useSetCurrentAcademicYear();

  // Whether the year being edited was already closed when the sheet opened.
  // Without it the readiness panel would appear for a year that is already
  // frozen, and "resolve these blockers first" would be advice nobody can take.
  const [editingWasClosed, setEditingWasClosed] = useState(false);

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  /**
   * Year-close readiness.
   *
   * Only fetched once the operator actually ticks "closed": the report is a
   * whole-year scan, and running it on every visit to the edit sheet would be
   * a lot of work for a question nobody asked.
   */
  const closingNow = Boolean(editingId) && formData.isClosed && !editingWasClosed;
  const closePreflight = useYearClosePreflight(closingNow ? editingId! : undefined);

  const handleOpenCreate = () => {
    setEditingId(null);
    setEditingWasClosed(false);
    setFormData(INITIAL_FORM);
    setIsSheetOpen(true);
  };

  const handleOpenEdit = (year: any) => {
    setEditingId(year.id);
    setEditingWasClosed(Boolean(year.isClosed));
    setFormData({
      yearId: year.yearId || "",
      label: year.label || "",
      startDate: year.startDate
        ? new Date(year.startDate).toISOString().split("T")[0]
        : "",
      endDate: year.endDate
        ? new Date(year.endDate).toISOString().split("T")[0]
        : "",
      isClosed: Boolean(year.isClosed),
    });
    setIsSheetOpen(true);
  };

  const handleCloseSheet = () => {
    setIsSheetOpen(false);
    setEditingId(null);
    setEditingWasClosed(false);
    setFormData(INITIAL_FORM);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.yearId.trim() || !formData.label.trim()) {
      toast.error(t("validationYearLabel"));
      return;
    }

    if (!formData.startDate || !formData.endDate) {
      toast.error(t("validationDates"));
      return;
    }

    if (new Date(formData.startDate) >= new Date(formData.endDate)) {
      toast.error(t("validationDateOrder"));
      return;
    }

    if (editingId) {
      updateMutation.mutate(
        {
          yearId: formData.yearId.trim(),
          label: formData.label.trim(),
          startDate: formData.startDate,
          endDate: formData.endDate,
          isClosed: formData.isClosed,
        },
        {
          onSuccess: (response) => {
            const finalisation = response?.data?.finalisation;
            if (finalisation) {
              // A close freezes the year and there is no undo, so the counts are
              // shown rather than swallowed. A student with no results is left
              // without a final percentage, and this is the office's last chance
              // to notice before the year is out of reach.
              toast.success(
                finalisation.withoutResults > 0
                  ? t("closeSuccessMissingResults", {
                      finalised: finalisation.withResults,
                      missing: finalisation.withoutResults,
                    })
                  : t("closeSuccess", { finalised: finalisation.withResults })
              );
            } else {
              toast.success(t("updateSuccess"));
            }
            handleCloseSheet();
          },
          onError: (err: any) => {
            toast.error(err.message || t("deleteError"));
          },
        }
      );
    } else {
      createMutation.mutate(
        {
          yearId: formData.yearId.trim(),
          label: formData.label.trim(),
          startDate: formData.startDate,
          endDate: formData.endDate,
        },
        {
          onSuccess: () => {
            toast.success(t("createSuccess"));
            handleCloseSheet();
          },
          onError: (err: any) => {
            toast.error(err.message || t("createError"));
          },
        }
      );
    }
  };

  const handleDelete = (id: string) => {
    if (!confirm(t("confirmDelete"))) return;

    deleteMutation.mutate(id, {
      onSuccess: () => {
        toast.success(t("deleteSuccess"));
      },
      onError: (err: any) => {
        toast.error(err.message || t("deleteError"));
      },
    });
  };

  const handleSetCurrent = (year: any) => {
    setCurrentMutation.mutate(year.id, {
      onSuccess: () => {
        toast.success(t("setCurrentSuccess", { label: year.label }));
      },
      onError: (err: any) => {
        toast.error(err.message || t("setCurrentError"));
      },
    });
  };

  const rawData: any[] = "data" in (data || {}) ? (data as any).data : [];
  const pagination = "pagination" in (data || {}) ? (data as any).pagination : undefined;

  // Calculate metrics
  const totalSessions = rawData.length;
  const closedSessions = rawData.filter((y) => y.isClosed).length;
  // The operating year is the one the institute stated, not the first
  // non-closed row — those differ as soon as a second year is opened before the
  // current one is closed, which is the normal way a school rolls over.
  const flaggedCurrent = rawData.find((y) => y.isCurrent && !y.isClosed);
  const currentActive = flaggedCurrent?.label || rawData.find((y) => !y.isClosed)?.label || "None";

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: "yearId",
      header: t("tableColumns.yearId"),
      cell: ({ getValue }) => (
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground font-mono text-xs font-medium">
            {t("yearBadge")}
          </div>
          <span className="font-semibold text-foreground font-mono">{getValue<string>()}</span>
        </div>
      ),
    },
    {
      accessorKey: "label",
      header: t("tableColumns.label"),
      cell: ({ getValue }) => (
        <span className="font-medium text-foreground">{getValue<string>()}</span>
      ),
    },
    {
      accessorKey: "startDate",
      header: t("tableColumns.startDate"),
      cell: ({ getValue }) => (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
          <span>{formatDate(getValue<string>())}</span>
        </div>
      ),
    },
    {
      accessorKey: "endDate",
      header: t("tableColumns.endDate"),
      cell: ({ getValue }) => (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
          <span>{formatDate(getValue<string>())}</span>
        </div>
      ),
    },
    {
      accessorKey: "isClosed",
      header: t("tableColumns.status"),
      cell: ({ row }) => {
        const isClosed = Boolean(row.original.isClosed);
        const isCurrent = Boolean(row.original.isCurrent) && !isClosed;
        return (
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge
              status={isClosed}
              domain="academicYear"
              label={isClosed ? t("status.closed") : t("status.active")}
            />
            {isCurrent && (
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                <Star className="h-3 w-3" />
                {t("operatingYear")}
              </span>
            )}
          </div>
        );
      },
    },
    {
      id: "actions",
      header: t("tableColumns.actions"),
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          {canWrite && !row.original.isClosed && !row.original.isCurrent && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleSetCurrent(row.original)}
              disabled={setCurrentMutation.isPending}
              className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
              title={t("setAsCurrent")}
            >
              <Star className="h-4 w-4" />
            </Button>
          )}
          {canWrite && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleOpenEdit(row.original)}
              className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
              title={t("editAcademicYear")}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          {canManage && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDelete(row.original.id)}
              className="h-8 w-8 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
              title={t("deleteSession")}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        icon={CalendarRange}
      >
        {canManage && (
          <Button variant="outline" onClick={() => setIsRolloverOpen(true)}>
            <CalendarPlus className="mr-2 h-4 w-4" />
            {tRollover("title")}
          </Button>
        )}
        {canWrite && (
          <Button onClick={handleOpenCreate}>
            <Plus className="mr-2 h-4 w-4" />
            {t("addAcademicYear")}
          </Button>
        )}
      </PageHeader>

      {!isAuthLoading && !canRead ? (
        <div className="rounded-lg border border-border bg-card p-6">
          <h2>{common("accessRestricted")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{common("noPermission")}</p>
        </div>
      ) : (
        <>
          {/* KPI Metric Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <ERPMetricCard
              title={t("metrics.totalSessions")}
              value={totalSessions}
              unit={t("sessionsUnit")}
              icon={Layers}
            />
            <ERPMetricCard
              title={t("metrics.activeSession")}
              value={currentActive}
              icon={CheckCircle2}
            />
            <ERPMetricCard
              title={t("metrics.closedSessions")}
              value={closedSessions}
              unit={t("sessionsUnit")}
              icon={Archive}
            />
          </div>

          {/* Main Data Table */}
          <DataTable
            columns={columns}
            data={rawData}
            pagination={pagination}
            onPageChange={setPage}
            onSearch={setSearch}
            isLoading={isLoading}
            searchPlaceholder={t("searchPlaceholder")}
          />
        </>
      )}

      {/* Add / Edit Academic Year TopSheet Drawer */}
      <TopSheet
        isOpen={isSheetOpen}
        onClose={handleCloseSheet}
        title={editingId ? t("editAcademicYear") : t("addAcademicYear")}
        description={editingId ? t("editDescription") : t("createDescription")}
        footer={
          <div className="flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleCloseSheet}
              disabled={isSubmitting}
            >
              {t("cancel")}
            </Button>
            <Button
              type="submit"
              form="academic-year-form"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? t("saving")
                : editingId
                ? t("editAcademicYear")
                : t("addAcademicYear")}
            </Button>
          </div>
        }
      >
        <form
          id="academic-year-form"
          onSubmit={handleSubmit}
          className="space-y-6 p-6"
        >
          <ERPFormSection
            title={t("sessionIdentification")}
            description={t("sessionIdentificationDescription")}
          >
            <ERPFormGrid cols={2}>
              <ERPFormField
                label={t("yearId")}
                required
                helperText={t("yearIdHelper")}
              >
                <Input
                  value={formData.yearId}
                  onChange={(e) =>
                    setFormData({ ...formData, yearId: e.target.value })
                  }
                  placeholder={t("yearIdPlaceholder")}
                  disabled={isSubmitting}
                  required
                  className="font-mono"
                />
              </ERPFormField>

              <ERPFormField
                label={t("label")}
                required
                helperText={t("labelHelper")}
              >
                <Input
                  value={formData.label}
                  onChange={(e) =>
                    setFormData({ ...formData, label: e.target.value })
                  }
                  placeholder={t("labelPlaceholder")}
                  disabled={isSubmitting}
                  required
                />
              </ERPFormField>
            </ERPFormGrid>
          </ERPFormSection>

          <ERPFormSection
            title={t("scheduleTitle")}
            description={t("scheduleDescription")}
          >
            <ERPFormGrid cols={2}>
              <ERPFormField
                label={t("startDate")}
                required
                helperText={t("startDateHelper")}
              >
                <TenantDateInput
                  value={formData.startDate}
                  onChange={(v) =>
                    setFormData({ ...formData, startDate: v })
                  }
                  disabled={isSubmitting}
                  required
                />
              </ERPFormField>

              <ERPFormField
                label={t("endDate")}
                required
                helperText={t("endDateHelper")}
              >
                <TenantDateInput
                  value={formData.endDate}
                  onChange={(v) =>
                    setFormData({ ...formData, endDate: v })
                  }
                  disabled={isSubmitting}
                  required
                />
              </ERPFormField>
            </ERPFormGrid>
          </ERPFormSection>

          {editingId && (
            <ERPFormSection
              title={t("lifecycleTitle")}
              description={t("lifecycleDescription")}
            >
              <div className="flex items-center gap-3 p-4 rounded-lg border border-border bg-card">
                <input
                  type="checkbox"
                  id="isClosed"
                  checked={formData.isClosed}
                  onChange={(e) =>
                    setFormData({ ...formData, isClosed: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                <Label htmlFor="isClosed" className="cursor-pointer">
                  <span className="font-semibold text-foreground block text-sm">
                    {t("isClosed")}
                  </span>
                  <span className="text-xs text-muted-foreground block">
                    {t("closedHelper")}
                  </span>
                </Label>
              </div>

              {closingNow && (
                <RolloverPreflightPanel
                  report={closePreflight.data}
                  isChecking={closePreflight.isFetching}
                  onRecheck={() => closePreflight.refetch()}
                  scope="yearClose"
                  scanTruncated={closePreflight.data?.scan.truncated}
                  contextNote={
                    closePreflight.data
                      ? tPreflight("studentsScanned", {
                          count: closePreflight.data.scan.students,
                        })
                      : null
                  }
                />
              )}
            </ERPFormSection>
          )}
        </form>
      </TopSheet>

      {/* The rollover wizard. Mounted only for an operator holding the
          capability, and never pre-selected: which year is the source is a
          decision the operator makes, not a default the page guesses. */}
      {canManage && (
        <RolloverWizard
          isOpen={isRolloverOpen}
          onClose={() => setIsRolloverOpen(false)}
          years={rawData.map((year) => ({
            id: year.id,
            yearId: year.yearId ?? "",
            label: year.label ?? "",
            startDate: year.startDate ?? "",
            endDate: year.endDate ?? "",
            isClosed: Boolean(year.isClosed),
          }))}
          canExecute={canManage}
        />
      )}
    </div>
  );
}
