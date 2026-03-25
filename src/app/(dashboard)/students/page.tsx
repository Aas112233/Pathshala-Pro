"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { GraduationCap, Plus, Pencil, Trash2 } from "lucide-react";
import { useStudents, useDeleteStudent } from "@/hooks/use-queries";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";

export default function StudentsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const { data, isLoading, error } = useStudents({
    page,
    limit: 20,
    search: search || undefined,
    ...(status && { filters: { status } }),
  });

  const deleteMutation = useDeleteStudent();

  const handleDelete = (id: string) => {
    if (!confirm("Are you sure you want to delete this student?")) return;
    
    deleteMutation.mutate(id, {
      onSuccess: () => {
        toast.success("Student deleted successfully");
      },
      onError: (err) => {
        toast.error(err.message || "Failed to delete student");
      },
    });
  };

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: "studentId",
      header: "Student ID",
      cell: ({ getValue }) => (
        <span className="font-medium">{getValue<string>()}</span>
      ),
    },
    {
      accessorKey: "rollNumber",
      header: "Roll Number",
    },
    {
      accessorKey: "firstName",
      header: "Name",
      cell: ({ row }) => (
        <span>{`${row.original.firstName} ${row.original.lastName}`}</span>
      ),
    },
    {
      accessorKey: "guardianName",
      header: "Guardian",
    },
    {
      accessorKey: "guardianContact",
      header: "Contact",
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ getValue }) => (
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
            getValue<string>() === "ACTIVE"
              ? "bg-green-100 text-green-800"
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
        title="Students"
        description="Manage student profiles, enrollment, and records."
        icon={GraduationCap}
      >
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Student
        </Button>
      </PageHeader>

      <DataTable
        columns={columns}
        data={("data" in (data || {})) ? (data as any).data : []}
        pagination={pagination}
        onPageChange={setPage}
        onSearch={setSearch}
        isLoading={isLoading}
        searchPlaceholder="Search by name, ID, or roll number..."
      />
    </div>
  );
}
