"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
} from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  useAcademicYears,
  useCreateAcademicYear,
  useUpdateAcademicYear,
  useDeleteAcademicYear,
} from "@/hooks/use-queries";
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

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

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
      isClosed: Boolean(year.isClosed),
    });
    setIsSheetOpen(true);
  };

  const handleCloseSheet = () => {
    setIsSheetOpen(false);
    setEditingId(null);
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

  const rawData: any[] = "data" in (data || {}) ? (data as any).data : [];
  const pagination = "pagination" in (data || {}) ? (data as any).pagination : undefined;

  // Calculate metrics
  const totalSessions = rawData.length;
  const activeSessions = rawData.filter((y) => !y.isClosed).length;
  const closedSessions = rawData.filter((y) => y.isClosed).length;
  const currentActive = rawData.find((y) => !y.isClosed)?.label || "None";

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: "yearId",
      header: t("tableColumns.yearId"),
      cell: ({ getValue }) => (
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground font-mono text-xs font-medium">
            AY
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
      cell: ({ getValue }) => {
        const isClosed = getValue<boolean>();
        return (
          <StatusBadge
            status={isClosed}
            domain="academicYear"
            label={isClosed ? t("status.closed") : t("status.active")}
          />
        );
      },
    },
    {
      id: "actions",
      header: t("tableColumns.actions"),
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
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
        {canWrite && (
          <Button onClick={handleOpenCreate}>
            <Plus className="mr-2 h-4 w-4" />
            {t("addAcademicYear")}
          </Button>
        )}
      </PageHeader>

      {!isAuthLoading && !canRead ? (
        <div className="rounded-lg border border-border bg-card p-6">
          <h2>Access restricted</h2>
          <p className="mt-2 text-sm text-muted-foreground">You do not have permission to view this section.</p>
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
                <Input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) =>
                    setFormData({ ...formData, startDate: e.target.value })
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
                <Input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) =>
                    setFormData({ ...formData, endDate: e.target.value })
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
            </ERPFormSection>
          )}
        </form>
      </TopSheet>
    </div>
  );
}
