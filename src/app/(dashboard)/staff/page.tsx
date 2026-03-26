"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Users, Plus, Pencil, Trash2 } from "lucide-react";
import { useStaff, useDeleteStaff } from "@/hooks/use-queries";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";

export default function StaffPage() {
  const t = useTranslations('staff');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");

  const { data, isLoading } = useStaff({
    page,
    limit: 20,
    search: search || undefined,
    ...(department && { filters: { department } }),
  });

  const deleteMutation = useDeleteStaff();

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
        <span>{`${row.original.firstName} ${row.original.lastName}`}</span>
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
      cell: ({ getValue }) => (
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
            getValue<boolean>()
              ? "bg-green-100 text-green-800"
              : "bg-gray-100 text-gray-800"
          }`}
        >
          {getValue<boolean>() ? t('status.active') : t('status.inactive')}
        </span>
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
        icon={Users}
      >
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          {t('addStaff')}
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
