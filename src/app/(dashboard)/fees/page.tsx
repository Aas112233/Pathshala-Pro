"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Receipt, Plus, Pencil, Trash2 } from "lucide-react";
import { useFees, useDeleteFee } from "@/hooks/use-queries";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";

export default function FeesPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const { data, isLoading } = useFees({
    page,
    limit: 20,
    search: search || undefined,
    ...(status && { filters: { status } }),
  });

  const deleteMutation = useDeleteFee();

  const handleDelete = (id: string) => {
    if (!confirm("Are you sure you want to delete this fee voucher?")) return;
    
    deleteMutation.mutate(id, {
      onSuccess: () => {
        toast.success("Fee voucher deleted successfully");
      },
      onError: (err) => {
        toast.error(err.message || "Failed to delete fee voucher");
      },
    });
  };

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: "voucherId",
      header: "Voucher ID",
      cell: ({ getValue }) => (
        <span className="font-medium">{getValue<string>()}</span>
      ),
    },
    {
      accessorKey: "student",
      header: "Student",
      cell: ({ row }) => {
        const student = row.original.studentProfile;
        return student ? (
          <span>{`${student.firstName} ${student.lastName}`}</span>
        ) : (
          <span>-</span>
        );
      },
    },
    {
      accessorKey: "academicYear",
      header: "Academic Year",
      cell: ({ row }) => {
        const year = row.original.academicYear;
        return year?.label || "-";
      },
    },
    {
      accessorKey: "feeType",
      header: "Fee Type",
    },
    {
      accessorKey: "totalDue",
      header: "Total Due",
      cell: ({ getValue }) => `৳${getValue<number>().toLocaleString()}`,
    },
    {
      accessorKey: "amountPaid",
      header: "Paid",
      cell: ({ getValue }) => `৳${getValue<number>().toLocaleString()}`,
    },
    {
      accessorKey: "balance",
      header: "Balance",
      cell: ({ row }) => {
        const balance = row.original.balance;
        return (
          <span className={balance > 0 ? "text-destructive" : "text-green-600"}>
            ৳{balance.toLocaleString()}
          </span>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ getValue }) => (
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
            getValue<string>() === "PAID"
              ? "bg-green-100 text-green-800"
              : getValue<string>() === "PARTIAL"
              ? "bg-yellow-100 text-yellow-800"
              : getValue<string>() === "OVERDUE"
              ? "bg-red-100 text-red-800"
              : "bg-gray-100 text-gray-800"
          }`}
        >
          {getValue<string>()}
        </span>
      ),
    },
    {
      accessorKey: "dueDate",
      header: "Due Date",
      cell: ({ getValue }) => new Date(getValue<string>()).toLocaleDateString(),
    },
    {
      id: "actions",
      header: "Actions",
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
        title="Fee Vouchers"
        description="Create, manage, and track fee vouchers for students."
        icon={Receipt}
      >
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Create Voucher
        </Button>
      </PageHeader>

      <DataTable
        columns={columns}
        data={("data" in (data || {})) ? (data as any).data : []}
        pagination={pagination}
        onPageChange={setPage}
        onSearch={setSearch}
        isLoading={isLoading}
        searchPlaceholder="Search by voucher ID, student name..."
      />
    </div>
  );
}
