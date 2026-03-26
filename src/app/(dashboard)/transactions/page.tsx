"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { ArrowLeftRight, Trash2 } from "lucide-react";
import { useTransactions, useDeleteTransaction } from "@/hooks/use-queries";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { useTenantFormatting } from "@/components/providers/tenant-settings-provider";
import { formatStudentName } from "@/lib/utils";

export default function TransactionsPage() {
  const t = useTranslations('transactions');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const { formatCurrency, formatDate } = useTenantFormatting();

  const { data, isLoading } = useTransactions({
    page,
    limit: 20,
    search: search || undefined,
    ...(paymentMethod && { filters: { paymentMethod } }),
  });

  const deleteMutation = useDeleteTransaction();

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
      accessorKey: "transactionId",
      header: t('tableColumns.transactionId'),
      cell: ({ getValue }) => (
        <span className="font-medium">{getValue<string>()}</span>
      ),
    },
    {
      accessorKey: "receiptNumber",
      header: t('tableColumns.receiptNumber'),
    },
    {
      accessorKey: "student",
      header: t('tableColumns.student'),
      cell: ({ row }) => {
        const voucher = row.original.feeVoucher;
        const student = voucher?.studentProfile;
        return student ? (
          <span>{formatStudentName(student.firstName, student.lastName, student.firstNameBn, student.lastNameBn)}</span>
        ) : (
          <span>-</span>
        );
      },
    },
    {
      accessorKey: "feeType",
      header: t('tableColumns.feeType'),
      cell: ({ row }) => row.original.feeVoucher?.feeType || "-",
    },
    {
      accessorKey: "amountPaid",
      header: t('tableColumns.amount'),
      cell: ({ getValue }) => (
        <span className="font-medium">{formatCurrency(getValue<number>())}</span>
      ),
    },
    {
      accessorKey: "paymentMethod",
      header: t('tableColumns.paymentMethod'),
      cell: ({ getValue }) => (
        <span className="capitalize">{getValue<string>().toLowerCase()}</span>
      ),
    },
    {
      accessorKey: "collectedBy",
      header: t('tableColumns.collectedBy'),
      cell: ({ row }) => row.original.collectedBy?.name || "-",
    },
    {
      accessorKey: "timestamp",
      header: t('tableColumns.date'),
      cell: ({ getValue }) => formatDate(getValue<string>()),
    },
    {
      id: "actions",
      header: t('tableColumns.actions'),
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => handleDelete(row.original.id)}
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
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
        icon={ArrowLeftRight}
      />

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
