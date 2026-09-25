"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TenantDateInput } from "@/components/ui/tenant-date-input";
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
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  useAcademicYears,
  useCreateAcademicYear,
  useUpdateAcademicYear,
  useDeleteAcademicYear,
  useSetCurrentAcademicYear,
  useCloseAcademicYear,
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
}

const INITIAL_FORM: AcademicYearFormData = {
  yearId: "",
  label: "",
  startDate: "",
  endDate: "",
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

  // Separate Close Session (Archive) flow: explicit target + explicit confirm.
  // Never pre-selected: the operator picks a row, then ticks the confirm box.
  const [closeTarget, setCloseTarget] = useState<any | null>(null);
  const [closeConfirmed, setCloseConfirmed] = useState(false);
  const isCloseSheetOpen = Boolean(closeTarget);

  const { data, isLoading } = useAcademicYears({
    page,
    limit: 20,
    search: search || undefined,
  });

  const createMutation = useCreateAcademicYear();
  const updateMutation = useUpdateAcademicYear(editingId || "");
  const deleteMutation = useDeleteAcademicYear();
  const setCurrentMutation = useSetCurrentAcademicYear();
  const closeMutation = useCloseAcademicYear();

  const isSubmitting = createMutation.isPending || updateMutation.isPending;
  const isClosing = closeMutation.isPending;

  /**
   * Year-close readiness for the dedicated Close Session sheet.
   *
   * Only fetched while the close sheet is open: the report is a whole-year
   * scan, and running it on every page visit would be work for a question
   * nobody asked.
   */
  const closePreflight = useYearClosePreflight(isCloseSheetOpen ? closeTarget!.id : undefined);

  const handleOpenCreate = () => {
    setEditingId(null);
    setFormData(INITIAL_FORM);
    setIsSheetOpen(true);
  };

  const handleOpenEdit = (year: any) => {
    setEditingId(year.id);
    setFormData({
      yearId: year.yearId || "",
      label: year.label || "",
      startDate: year.startDate
        ? new Date(year.startDate).toISOString().split("T")[0]
        : "",
      endDate: year.endDate
        ? new Date(year.endDate).toISOString().split("T")[0]
        : "",
    });
    setIsSheetOpen(true);
  };

  const handleCloseSheet = () => {
    setIsSheetOpen(false);
    setEditingId(null);
    setFormData(INITIAL_FORM);
  };

  const handleOpenClose = (year: any) => {
    setCloseTarget(year);
    setCloseConfirmed(false);
  };

  const handleCloseCloseSheet = () => {
    if (isClosing) return;
    setCloseTarget(null);
    setCloseConfirmed(false);
  };

  const handleConfirmClose = () => {
    if (!closeTarget || !closeConfirmed || isClosing) return;
    closeMutation.mutate(closeTarget.id, {
      onSuccess: (response) => {
        const finalisation = (response as any)?.data?.finalisation;
        if (finalisation) {
          // A close freezes the year and there is no undo, so the counts are
          // shown rather than swallowed.
          toast.success(
            finalisation.withoutResults > 0
              ? t("closeSuccessMissingResults", {
                  finalised: finalisation.withResults,
                  missing: finalisation.withoutResults,
                })
              : t("closeSuccess", { finalised: finalisation.withResults })
          );
        } else {
          toast.success(t("closeSuccess", { finalised: 0 }));
        }
        handleCloseCloseSheet();
      },
      onError: (err: any) => {
        toast.error(err.message || t("closeSession.closeError"));
      },
    });
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
        },
        {
          onSuccess: () => {
            toast.success(t("updateSuccess"));
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
          {canManage && !row.original.isClosed && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleOpenClose(row.original)}
              className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
              title={t("closeSession.rowAction")}
            >
              <Archive className="h-4 w-4" />
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
        </form>
      </TopSheet>

      {/* Separate Close Session (Archive) TopSheet. Metadata editing stays in
          the sheet above; freezing a year lives here with its own readiness
          report and explicit confirm. */}
      <TopSheet
        isOpen={isCloseSheetOpen}
        onClose={handleCloseCloseSheet}
        title={t("closeSession.title")}
        description={t("closeSession.description")}
        maxWidth="2xl"
        badge={
          closeTarget ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 font-mono text-[11px] font-medium text-muted-foreground">
              {closeTarget.yearId || closeTarget.label}
            </span>
          ) : undefined
        }
        footer={
          <div className="flex w-full items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleCloseCloseSheet}
              disabled={isClosing}
            >
              {t("cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmClose}
              disabled={
                isClosing ||
                !closeConfirmed ||
                (closePreflight.data ? !closePreflight.data.canProceed : false)
              }
            >
              {isClosing ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Archive className="mr-2 h-3.5 w-3.5" />
              )}
              {isClosing ? t("closeSession.closingButton") : t("closeSession.confirmButton")}
            </Button>
          </div>
        }
      >
        {closeTarget && (
          <div className="space-y-6">
            <ERPFormSection
              title={t("closeSession.summaryTitle")}
              description={closeTarget.label || closeTarget.yearId}
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-border/80 bg-card p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("tableColumns.label")}
                  </p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {closeTarget.label}
                  </p>
                </div>
                <div className="rounded-lg border border-border/80 bg-card p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("tableColumns.startDate")}
                  </p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {closeTarget.startDate ? formatDate(closeTarget.startDate) : "-"}
                  </p>
                </div>
                <div className="rounded-lg border border-border/80 bg-card p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("tableColumns.endDate")}
                  </p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {closeTarget.endDate ? formatDate(closeTarget.endDate) : "-"}
                  </p>
                </div>
              </div>
            </ERPFormSection>

            <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  {t("closeSession.warningTitle")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("closeSession.warningBody")}
                </p>
              </div>
            </div>

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

            {closePreflight.data && !closePreflight.data.canProceed && (
              <p className="text-xs font-medium text-rose-700 dark:text-rose-400">
                {t("closeSession.blockedNote")}
              </p>
            )}

            <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
              <input
                type="checkbox"
                id="close-session-confirm"
                checked={closeConfirmed}
                onChange={(e) => setCloseConfirmed(e.target.checked)}
                disabled={isClosing}
                className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary"
              />
              <label
                htmlFor="close-session-confirm"
                className="cursor-pointer text-sm font-medium text-foreground"
              >
                {t("closeSession.confirmLabel")}
              </label>
            </div>
          </div>
        )}
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
