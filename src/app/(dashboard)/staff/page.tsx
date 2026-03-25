"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Users, Plus, Pencil, Trash2 } from "lucide-react";
import { useStaff, useDeleteStaff } from "@/hooks/use-queries";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";

export default function StaffPage() {
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
    if (!confirm("Are you sure you want to delete this staff member?")) return;
    
    deleteMutation.mutate(id, {
      onSuccess: () => {
        toast.success("Staff member deleted successfully");
      },
      onError: (err) => {
        toast.error(err.message || "Failed to delete staff member");
      },
    });
  };

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: "staffId",
      header: "Staff ID",
      cell: ({ getValue }) => (
        <span className="font-medium">{getValue<string>()}</span>
      ),
    },
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <span>{`${row.original.firstName} ${row.original.lastName}`}</span>
      ),
    },
    {
      accessorKey: "department",
      header: "Department",
    },
    {
      accessorKey: "designation",
      header: "Designation",
    },
    {
      accessorKey: "email",
      header: "Email",
    },
    {
      accessorKey: "phone",
      header: "Phone",
    },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ getValue }) => (
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
            getValue<boolean>()
              ? "bg-green-100 text-green-800"
              : "bg-gray-100 text-gray-800"
          }`}
        >
          {getValue<boolean>() ? "Active" : "Inactive"}
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
        title="Staff"
        description="Manage staff profiles, departments, and records."
        icon={Users}
      >
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Staff
        </Button>
      </PageHeader>

      <DataTable
        columns={columns}
        data={("data" in (data || {})) ? (data as any).data : []}
        pagination={pagination}
        onPageChange={setPage}
        onSearch={setSearch}
        isLoading={isLoading}
        searchPlaceholder="Search by name, ID, or department..."
      />
    </div>
  );
}
