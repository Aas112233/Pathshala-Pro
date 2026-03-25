"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { CalendarCheck, Plus, Pencil, Trash2 } from "lucide-react";
import { useAttendance, useDeleteAttendance } from "@/hooks/use-queries";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";

export default function AttendancePage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [date, setDate] = useState("");
  const [status, setStatus] = useState("");

  const { data, isLoading } = useAttendance({
    page,
    limit: 20,
    search: search || undefined,
    ...(date && { filters: { date } }),
    ...(status && { filters: { status } }),
  });

  const deleteMutation = useDeleteAttendance();

  const handleDelete = (id: string) => {
    if (!confirm("Are you sure you want to delete this attendance record?")) return;
    
    deleteMutation.mutate(id, {
      onSuccess: () => {
        toast.success("Attendance record deleted successfully");
      },
      onError: (err) => {
        toast.error(err.message || "Failed to delete attendance record");
      },
    });
  };

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: "date",
      header: "Date",
      cell: ({ getValue }) => new Date(getValue<string>()).toLocaleDateString(),
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => (
        <span className="capitalize">
          {row.original.studentProfile ? "Student" : "Staff"}
        </span>
      ),
    },
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => {
        const student = row.original.studentProfile;
        const staff = row.original.staffProfile;
        const name = student
          ? `${student.firstName} ${student.lastName}`
          : staff
          ? `${staff.firstName} ${staff.lastName}`
          : "-";
        return <span>{name}</span>;
      },
    },
    {
      accessorKey: "id",
      header: "ID",
      cell: ({ row }) => (
        <span>{row.original.studentProfile?.studentId || row.original.staffProfile?.staffId || "-"}</span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ getValue }) => (
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
            getValue<string>() === "PRESENT"
              ? "bg-green-100 text-green-800"
              : getValue<string>() === "ABSENT"
              ? "bg-red-100 text-red-800"
              : getValue<string>() === "LATE"
              ? "bg-yellow-100 text-yellow-800"
              : "bg-blue-100 text-blue-800"
          }`}
        >
          {getValue<string>()}
        </span>
      ),
    },
    {
      accessorKey: "note",
      header: "Note",
      cell: ({ getValue }) => getValue<string>() || "-",
    },
    {
      accessorKey: "markedBy",
      header: "Marked By",
      cell: ({ row }) => row.original.markedBy?.name || "-",
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
        title="Attendance"
        description="Mark and review daily attendance for students and staff."
        icon={CalendarCheck}
      >
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Mark Attendance
        </Button>
      </PageHeader>

      <DataTable
        columns={columns}
        data={("data" in (data || {})) ? (data as any).data : []}
        pagination={pagination}
        onPageChange={setPage}
        onSearch={setSearch}
        isLoading={isLoading}
        searchPlaceholder="Search by name or ID..."
      />
    </div>
  );
}
