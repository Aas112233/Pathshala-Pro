"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { CalendarRange, Plus, Pencil, Trash2 } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { useAcademicYears, useDeleteAcademicYear } from "@/hooks/use-queries";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { useTenantFormatting } from "@/components/providers/tenant-settings-provider";

export default function AcademicYearPage() {
  const t = useTranslations('academicYear');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const { formatDate } = useTenantFormatting();

  const { data, isLoading } = useAcademicYears({
    page,
    limit: 20,
    search: search || undefined,
  });

  const deleteMutation = useDeleteAcademicYear();

  const handleDelete = (id: string) => {
    if (!confirm(t('confirmDelete'))) return;
    
    deleteMutation.mutate(id, {
      onSuccess: () => {
        toast.success(t('deleteSuccess'));
      },
      onError: (err) => {
        toast.error(err.message || t('deleteError'));
      },
    });
  };

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: "yearId",
      header: t('tableColumns.yearId'),
      cell: ({ getValue }) => (
        <span className="font-medium">{getValue<string>()}</span>
      ),
    },
    {
      accessorKey: "label",
      header: t('tableColumns.label'),
    },
    {
      accessorKey: "startDate",
      header: t('tableColumns.startDate'),
      cell: ({ getValue }) => formatDate(getValue<string>()),
    },
    {
      accessorKey: "endDate",
      header: t('tableColumns.endDate'),
      cell: ({ getValue }) => formatDate(getValue<string>()),
    },
    {
      accessorKey: "isClosed",
      header: t('tableColumns.status'),
      cell: ({ getValue }) => (
        <StatusBadge
          status={getValue<boolean>()}
          domain="academicYear"
          label={getValue<boolean>() ? t('status.closed') : t('status.active')}
        />
      ),
    },
    {
      id: "actions",
      header: t('tableColumns.actions'),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleDelete(row.original.id)}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  const pagination = "pagination" in (data || {})
    ? (data as any).pagination
    : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        description={t('description')}
        icon={CalendarRange}
      >
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          {t('addAcademicYear')}
        </Button>
      </PageHeader>

      <DataTable
        columns={columns}
        data={("data" in (data || {})) ? (data as any).data : []}
        pagination={pagination}
        onPageChange={setPage}
        onSearch={setSearch}
        isLoading={isLoading}
        searchPlaceholder={t('searchPlaceholder')}
      />
    </div>
  );
}
