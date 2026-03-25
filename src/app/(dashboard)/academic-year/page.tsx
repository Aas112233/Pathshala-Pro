"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { CalendarRange, Plus, Pencil, Trash2 } from "lucide-react";
import { useAcademicYears, useDeleteAcademicYear } from "@/hooks/use-queries";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";

export default function AcademicYearPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const { data, isLoading } = useAcademicYears({
    page,
    limit: 20,
    search: search || undefined,
  });

  const deleteMutation = useDeleteAcademicYear();

  const handleDelete = (id: string) => {
    if (!confirm("Are you sure you want to delete this academic year?")) return;
    
    deleteMutation.mutate(id, {
      onSuccess: () => {
        toast.success("Academic year deleted successfully");
      },
      onError: (err) => {
        toast.error(err.message || "Failed to delete academic year");
      },
    });
  };

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: "yearId",
      header: "Year ID",
      cell: ({ getValue }) => (
        <span className="font-medium">{getValue<string>()}</span>
      ),
    },
    {
      accessorKey: "label",
      header: "Label",
    },
    {
      accessorKey: "startDate",
      header: "Start Date",
      cell: ({ getValue }) => new Date(getValue<string>()).toLocaleDateString(),
    },
    {
      accessorKey: "endDate",
      header: "End Date",
      cell: ({ getValue }) => new Date(getValue<string>()).toLocaleDateString(),
    },
    {
      accessorKey: "isClosed",
      header: "Status",
      cell: ({ getValue }) => (
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
            getValue<boolean>()
              ? "bg-red-100 text-red-800"
              : "bg-green-100 text-green-800"
          }`}
        >
          {getValue<boolean>() ? "Closed" : "Active"}
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
        title="Academic Year"
        description="Configure academic year periods and lock completed sessions."
        icon={CalendarRange}
      >
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Academic Year
        </Button>
      </PageHeader>

      <DataTable
        columns={columns}
        data={("data" in (data || {})) ? (data as any).data : []}
        pagination={pagination}
        onPageChange={setPage}
        onSearch={setSearch}
        isLoading={isLoading}
        searchPlaceholder="Search by year ID or label..."
      />
    </div>
  );
}
