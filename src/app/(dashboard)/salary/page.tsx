"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Wallet, Plus, Pencil, Trash2 } from "lucide-react";
import { useSalary, useDeleteSalary } from "@/hooks/use-queries";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { useTenantFormatting } from "@/components/providers/tenant-settings-provider";

export default function SalaryPage() {
  const t = useTranslations('salary');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const { formatCurrency } = useTenantFormatting();

  const { data, isLoading } = useSalary({
    page,
    limit: 20,
    search: search || undefined,
    ...(month && { filters: { month } }),
    ...(year && { filters: { year } }),
  });

  const deleteMutation = useDeleteSalary();

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
      accessorKey: "staff",
      header: t('tableColumns.staffMember'),
      cell: ({ row }) => {
        const staff = row.original.staffProfile;
        return staff ? (
          <span>{`${staff.firstName} ${staff.lastName}`}</span>
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
      accessorKey: "month",
      header: t('tableColumns.month'),
      cell: ({ getValue }) => {
        const monthNames = [
          "January", "February", "March", "April", "May", "June",
          "July", "August", "September", "October", "November", "December"
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
      cell: ({ getValue }) => (
        <span className="text-destructive">-{formatCurrency(getValue<number>())}</span>
      ),
    },
    {
      accessorKey: "advances",
      header: t('tableColumns.advances'),
      cell: ({ getValue }) => (
        <span className="text-destructive">-{formatCurrency(getValue<number>())}</span>
      ),
    },
    {
      accessorKey: "netPayable",
      header: t('tableColumns.netPayable'),
      cell: ({ getValue }) => (
        <span className="font-semibold">{formatCurrency(getValue<number>())}</span>
      ),
    },
    {
      accessorKey: "status",
      header: t('tableColumns.status'),
      cell: ({ getValue }) => (
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
            getValue<string>() === "PAID"
              ? "bg-green-100 text-green-800"
              : getValue<string>() === "PARTIAL"
              ? "bg-yellow-100 text-yellow-800"
              : "bg-gray-100 text-gray-800"
          }`}
        >
          {getValue<string>()}
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
        icon={Wallet}
      >
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          {t('processPayroll')}
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
