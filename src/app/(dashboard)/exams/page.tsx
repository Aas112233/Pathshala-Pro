"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { BookOpen, Plus, Pencil, Trash2 } from "lucide-react";
import { useExams, useDeleteExamResult } from "@/hooks/use-queries";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";

export default function ExamsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [examName, setExamName] = useState("");
  const [subject, setSubject] = useState("");

  const { data, isLoading } = useExams({
    page,
    limit: 20,
    search: search || undefined,
    ...(examName && { filters: { examName } }),
    ...(subject && { filters: { subject } }),
  });

  const deleteMutation = useDeleteExamResult();

  const handleDelete = (id: string) => {
    if (!confirm("Are you sure you want to delete this exam result?")) return;
    
    deleteMutation.mutate(id, {
      onSuccess: () => {
        toast.success("Exam result deleted successfully");
      },
      onError: (err) => {
        toast.error(err.message || "Failed to delete exam result");
      },
    });
  };

  const columns: ColumnDef<any>[] = [
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
      accessorKey: "studentId",
      header: "Student ID",
      cell: ({ row }) => row.original.studentProfile?.studentId || "-",
    },
    {
      accessorKey: "examName",
      header: "Exam",
    },
    {
      accessorKey: "subject",
      header: "Subject",
    },
    {
      accessorKey: "maxMarks",
      header: "Max Marks",
    },
    {
      accessorKey: "obtainedMarks",
      header: "Obtained",
    },
    {
      accessorKey: "percentage",
      header: "%",
      cell: ({ row }) => {
        const percentage = (row.original.obtainedMarks / row.original.maxMarks) * 100;
        return `${percentage.toFixed(1)}%`;
      },
    },
    {
      accessorKey: "grade",
      header: "Grade",
      cell: ({ getValue }) => (
        <span className="font-semibold">{getValue<string>() || "-"}</span>
      ),
    },
    {
      accessorKey: "remarks",
      header: "Remarks",
      cell: ({ getValue }) => getValue<string>() || "-",
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
        title="Exams"
        description="Manage exam schedules, enter marks, and view results."
        icon={BookOpen}
      >
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Enter Marks
        </Button>
      </PageHeader>

      <DataTable
        columns={columns}
        data={("data" in (data || {})) ? (data as any).data : []}
        pagination={pagination}
        onPageChange={setPage}
        onSearch={setSearch}
        isLoading={isLoading}
        searchPlaceholder="Search by student name, exam, or subject..."
      />
    </div>
  );
}
