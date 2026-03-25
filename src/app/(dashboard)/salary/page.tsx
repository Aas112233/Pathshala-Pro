"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Wallet, Plus, Pencil, Trash2 } from "lucide-react";
import { useSalary, useDeleteSalary } from "@/hooks/use-queries";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";

export default function SalaryPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");

  const { data, isLoading } = useSalary({
    page,
    limit: 20,
    search: search || undefined,
    ...(month && { filters: { month } }),
    ...(year && { filters: { year } }),
  });

  const deleteMutation = useDeleteSalary();

  const handleDelete = (id: string) => {
    if (!confirm("Are you sure you want to delete this salary ledger?")) return;
    
    deleteMutation.mutate(id, {
      onSuccess: () => {
        toast.success("Salary ledger deleted successfully");
      },
      onError: (err) => {
        toast.error(err.message || "Failed to delete salary ledger");
      },
    });
  };

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: "staff",
      header: "Staff Member",
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
      header: "Designation",
      cell: ({ row }) => row.original.staffProfile?.designation || "-",
    },
    {
      accessorKey: "month",
      header: "Month",
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
      header: "Year",
    },
    {
      accessorKey: "baseSalary",
      header: "Base Salary",
      cell: ({ getValue }) => `৳${getValue<number>().toLocaleString()}`,
    },
    {
      accessorKey: "deductions",
      header: "Deductions",
      cell: ({ getValue }) => (
        <span className="text-destructive">-৳{getValue<number>().toLocaleString()}</span>
      ),
    },
    {
      accessorKey: "advances",
      header: "Advances",
      cell: ({ getValue }) => (
        <span className="text-destructive">-৳{getValue<number>().toLocaleString()}</span>
      ),
    },
    {
      accessorKey: "netPayable",
      header: "Net Payable",
      cell: ({ getValue }) => (
        <span className="font-semibold">৳{getValue<number>().toLocaleString()}</span>
      ),
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
              : "bg-gray-100 text-gray-800"
          }`}
        >
          {getValue<string>()}
        </span>
      ),
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
        title="Salary / Payroll"
        description="Manage salary disbursements, advances, and payroll records."
        icon={Wallet}
      >
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Process Payroll
        </Button>
      </PageHeader>

      <DataTable
        columns={columns}
        data={("data" in (data || {})) ? (data as any).data : []}
        pagination={pagination}
        onPageChange={setPage}
        onSearch={setSearch}
        isLoading={isLoading}
        searchPlaceholder="Search by staff name..."
      />
    </div>
  );
}
