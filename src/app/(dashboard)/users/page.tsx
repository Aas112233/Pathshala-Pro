"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { UserCheck, Plus, Pencil, Trash2 } from "lucide-react";
import { useUsers, useDeleteUser } from "@/hooks/use-queries";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";

export default function UsersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const { data, isLoading } = useUsers({
    page,
    limit: 20,
    search: search || undefined,
  });

  const deleteMutation = useDeleteUser();

  const handleDelete = (id: string) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    
    deleteMutation.mutate(id, {
      onSuccess: () => {
        toast.success("User deleted successfully");
      },
      onError: (err) => {
        toast.error(err.message || "Failed to delete user");
      },
    });
  };

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: "email",
      header: "Email",
      cell: ({ getValue }) => (
        <span className="font-medium">{getValue<string>()}</span>
      ),
    },
    {
      accessorKey: "name",
      header: "Name",
    },
    {
      accessorKey: "role",
      header: "Role",
      cell: ({ getValue }) => (
        <span className="capitalize">{getValue<string>().toLowerCase()}</span>
      ),
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
      accessorKey: "lastLoginAt",
      header: "Last Login",
      cell: ({ getValue }) =>
        getValue<string>() ? new Date(getValue<string>()).toLocaleDateString() : "Never",
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
        title="Users"
        description="Manage user accounts, roles, and permissions."
        icon={UserCheck}
      >
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add User
        </Button>
      </PageHeader>

      <DataTable
        columns={columns}
        data={("data" in (data || {})) ? (data as any).data : []}
        pagination={pagination}
        onPageChange={setPage}
        onSearch={setSearch}
        isLoading={isLoading}
        searchPlaceholder="Search by name or email..."
      />
    </div>
  );
}
