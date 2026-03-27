"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Receipt, Plus, Pencil, Trash2 } from "lucide-react";
import { useFees, useDeleteFee } from "@/hooks/use-queries";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { useTenantFormatting } from "@/components/providers/tenant-settings-provider";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatStudentName } from "@/lib/utils";

export default function FeesPage() {
  const t = useTranslations('fees');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const { formatCurrency, formatDate } = useTenantFormatting();

  const { data, isLoading } = useFees({
    page,
    limit: 20,
    search: search || undefined,
    ...(status && { filters: { status } }),
  });

  const deleteMutation = useDeleteFee();

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
      accessorKey: "voucherId",
      header: t('tableColumns.voucherId'),
      cell: ({ getValue }) => (
        <span className="font-medium">{getValue<string>()}</span>
      ),
    },
    {
      accessorKey: "student",
      header: t('tableColumns.student'),
      cell: ({ row }) => {
        const student = row.original.studentProfile;
        return student ? (
          <span>{formatStudentName(student.firstName, student.lastName, student.firstNameBn, student.lastNameBn)}</span>
        ) : (
          <span>-</span>
        );
      },
    },
    {
      accessorKey: "academicYear",
      header: t('tableColumns.academicYear'),
      cell: ({ row }) => {
        const year = row.original.academicYear;
        return year?.label || "-";
      },
    },
    {
      accessorKey: "feeType",
      header: t('tableColumns.feeType'),
    },
    {
      accessorKey: "totalDue",
      header: t('tableColumns.totalDue'),
      cell: ({ getValue }) => formatCurrency(getValue<number>()),
    },
    {
      accessorKey: "amountPaid",
      header: t('tableColumns.paid'),
      cell: ({ getValue }) => formatCurrency(getValue<number>()),
    },
    {
      accessorKey: "balance",
      header: t('tableColumns.balance'),
      cell: ({ row }) => {
        const balance = row.original.balance;
        return (
          <span className={balance > 0 ? "text-destructive" : "text-green-600"}>
            {formatCurrency(balance)}
          </span>
        );
      },
    },
    {
      accessorKey: "status",
      header: t('tableColumns.status'),
      cell: ({ getValue }) => (
        <StatusBadge
          status={getValue<string>()}
          domain="fee"
        />
      ),
    },
    {
      accessorKey: "dueDate",
      header: t('tableColumns.dueDate'),
      cell: ({ getValue }) => formatDate(getValue<string>()),
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
        icon={Receipt}
      >
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          {t('createVoucher')}
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
