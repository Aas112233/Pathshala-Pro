"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { ArrowLeftRight, Trash2 } from "lucide-react";
import { useTransactions, useDeleteTransaction } from "@/hooks/use-queries";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";

export default function TransactionsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");

  const { data, isLoading } = useTransactions({
    page,
    limit: 20,
    search: search || undefined,
    ...(paymentMethod && { filters: { paymentMethod } }),
  });

  const deleteMutation = useDeleteTransaction();

  const handleDelete = (id: string) => {
    if (!confirm("Are you sure you want to delete this transaction? This will rollback the payment.")) return;
    
    deleteMutation.mutate(id, {
      onSuccess: () => {
        toast.success("Transaction deleted and balance rolled back");
      },
      onError: (err) => {
        toast.error(err.message || "Failed to delete transaction");
      },
    });
  };

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: "transactionId",
      header: "Transaction ID",
      cell: ({ getValue }) => (
        <span className="font-medium">{getValue<string>()}</span>
      ),
    },
    {
      accessorKey: "receiptNumber",
      header: "Receipt #",
    },
    {
      accessorKey: "student",
      header: "Student",
      cell: ({ row }) => {
        const voucher = row.original.feeVoucher;
        const student = voucher?.studentProfile;
        return student ? (
          <span>{`${student.firstName} ${student.lastName}`}</span>
        ) : (
          <span>-</span>
        );
      },
    },
    {
      accessorKey: "feeType",
      header: "Fee Type",
      cell: ({ row }) => row.original.feeVoucher?.feeType || "-",
    },
    {
      accessorKey: "amountPaid",
      header: "Amount",
      cell: ({ getValue }) => (
        <span className="font-medium">৳{getValue<number>().toLocaleString()}</span>
      ),
    },
    {
      accessorKey: "paymentMethod",
      header: "Payment Method",
      cell: ({ getValue }) => (
        <span className="capitalize">{getValue<string>().toLowerCase()}</span>
      ),
    },
    {
      accessorKey: "collectedBy",
      header: "Collected By",
      cell: ({ row }) => row.original.collectedBy?.name || "-",
    },
    {
      accessorKey: "timestamp",
      header: "Date",
      cell: ({ getValue }) => new Date(getValue<string>()).toLocaleDateString(),
    },
    {
      id: "actions",
      header: "Actions",
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
        title="Transactions"
        description="View and manage all payment transactions."
        icon={ArrowLeftRight}
      />

      <DataTable
        columns={columns}
        data={("data" in (data || {})) ? (data as any).data : []}
        pagination={pagination}
        onPageChange={setPage}
        onSearch={setSearch}
        isLoading={isLoading}
        searchPlaceholder="Search by transaction ID or receipt..."
      />
    </div>
  );
}
