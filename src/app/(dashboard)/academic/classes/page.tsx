"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { AppDropdown } from "@/components/ui/app-dropdown";
import { AppModal } from "@/components/ui/app-modal";
import { School, Plus, Pencil, Trash2, CheckCircle, XCircle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { cn } from "@/lib/utils";

interface ClassData {
  id: string;
  classId: string;
  name: string;
  classNumber: number;
  isActive: boolean;
  _count?: {
    groups: number;
    sections: number;
    studentProfiles: number;
  };
}

export default function ClassesPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassData | null>(null);

  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["classes", { page, search }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
        ...(search && { search }),
      });
      const token = localStorage.getItem("auth_token");
      const tenantId = localStorage.getItem("tenant_id");
      const res = await fetch(`/api/classes?${params}`, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "X-Tenant-ID": tenantId || "",
        },
      });
      if (!res.ok) throw new Error("Failed to fetch classes");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const token = localStorage.getItem("auth_token");
      const tenantId = localStorage.getItem("tenant_id");
      const res = await fetch("/api/classes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "X-Tenant-ID": tenantId || "",
        },
        body: JSON.stringify(data),
      });
      const errorData = await res.clone().json();
      if (!res.ok) {
        if (errorData.details && errorData.details.length > 0) {
          const errorMsg = errorData.details[0].message || "Failed to create class";
          // If it's a class number duplicate error, show it inline
          if (errorData.details[0].field === "classNumber") {
            setClassNumberError(errorMsg);
          }
          throw new Error(errorMsg);
        }
        throw new Error(errorData.message || "Failed to create class");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      toast.success("Class created successfully!");
      setIsModalOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      // Don't show toast if we're showing inline error
      if (!classNumberError) {
        toast.error(err.message || "Failed to create class");
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const token = localStorage.getItem("auth_token");
      const tenantId = localStorage.getItem("tenant_id");
      const res = await fetch(`/api/classes/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "X-Tenant-ID": tenantId || "",
        },
        body: JSON.stringify(data),
      });
      const errorData = await res.clone().json();
      if (!res.ok) {
        if (errorData.details && errorData.details.length > 0) {
          const errorMsg = errorData.details[0].message || "Failed to update class";
          // If it's a class number duplicate error, show it inline
          if (errorData.details[0].field === "classNumber") {
            setClassNumberError(errorMsg);
          }
          throw new Error(errorMsg);
        }
        throw new Error(errorData.message || "Failed to update class");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      toast.success("Class updated successfully!");
      setIsModalOpen(false);
      setEditingClass(null);
      resetForm();
    },
    onError: (err: any) => {
      // Don't show toast if we're showing inline error
      if (!classNumberError) {
        toast.error(err.message || "Failed to update class");
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = localStorage.getItem("auth_token");
      const tenantId = localStorage.getItem("tenant_id");
      const res = await fetch(`/api/classes/${id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`,
          "X-Tenant-ID": tenantId || "",
        },
      });
      if (!res.ok) throw new Error("Failed to delete class");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      toast.success("Class deleted successfully!");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete class");
    },
  });

  const [formData, setFormData] = useState({
    name: "",
    classNumber: "" as any, // Empty string for input, converted to number on submit
    isActive: true,
  });
  const [classNumberError, setClassNumberError] = useState("");

  const resetForm = () => {
    setFormData({
      name: "",
      classNumber: "" as any,
      isActive: true,
    });
    setClassNumberError("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setClassNumberError(""); // Clear previous errors

    const data = {
      ...formData,
      classNumber: parseInt(formData.classNumber) || 0,
    };
    if (editingClass) {
      updateMutation.mutate({ id: editingClass.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (classItem: ClassData) => {
    setEditingClass(classItem);
    setFormData({
      name: classItem.name,
      classNumber: classItem.classNumber.toString() as any,
      isActive: classItem.isActive,
    });
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (!confirm("Are you sure you want to delete this class?")) return;
    deleteMutation.mutate(id);
  };

  const columns: ColumnDef<ClassData>[] = [
    {
      accessorKey: "name",
      header: "Class Name",
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.name}</p>
          <p className="text-xs text-muted-foreground">{row.original.classId}</p>
        </div>
      ),
    },
    {
      accessorKey: "classNumber",
      header: "Class Number",
      cell: ({ getValue }) => (
        <span className="font-semibold">Class {getValue<number>()}</span>
      ),
    },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ getValue }) => (
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${getValue<boolean>()
            ? "bg-green-100 text-green-800"
            : "bg-gray-100 text-gray-800"
            }`}
        >
          {getValue<boolean>() ? (
            <>
              <CheckCircle className="h-3 w-3" /> Active
            </>
          ) : (
            <>
              <XCircle className="h-3 w-3" /> Inactive
            </>
          )}
        </span>
      ),
    },
    {
      id: "stats",
      header: "Statistics",
      cell: ({ row }) => (
        <div className="text-xs text-muted-foreground">
          <p>Students: {row.original._count?.studentProfiles || 0}</p>
          <p>Groups: {row.original._count?.groups || 0}</p>
          <p>Sections: {row.original._count?.sections || 0}</p>
        </div>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleEdit(row.original)}
          >
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

  const classes = ("data" in (data || {})) ? (data as any).data : [];
  const pagination = ("pagination" in (data || {})) ? (data as any).pagination : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Classes"
        description="Manage school classes and grades."
        icon={School}
      >
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Class
        </Button>
      </PageHeader>

      <DataTable
        columns={columns}
        data={classes}
        pagination={pagination}
        onPageChange={setPage}
        onSearch={setSearch}
        isLoading={isLoading}
        searchPlaceholder="Search classes..."
      />

      {/* Add/Edit Modal */}
      <AppModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingClass(null);
          resetForm();
        }}
        title={editingClass ? "Edit Class" : "Add New Class"}
        description={editingClass ? "Update class information" : "Create a new class"}
        maxWidth="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Class Name</label>
            <input
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Class 10"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Class Number</label>
            <input
              type="number"
              required
              value={formData.classNumber}
              onChange={(e) => {
                setFormData({ ...formData, classNumber: e.target.value as any });
                setClassNumberError(""); // Clear error when user types
              }}
              placeholder="e.g., 10"
              className={cn(
                "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary",
                classNumberError && "border-destructive focus:border-destructive focus:ring-destructive"
              )}
            />
            {classNumberError && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" /></svg>
                {classNumberError}
              </p>
            )}
            {!classNumberError && (
              <p className="text-xs text-muted-foreground">Enter a unique class number (e.g., 1 for Class 1, 10 for Class 10)</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Status</label>
            <AppDropdown
              value={formData.isActive ? "ACTIVE" : "INACTIVE"}
              onChange={(val) => setFormData({ ...formData, isActive: val === "ACTIVE" })}
              options={[
                { value: "ACTIVE", label: "Active" },
                { value: "INACTIVE", label: "Inactive" },
              ]}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t mt-4">
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                setIsModalOpen(false);
                setEditingClass(null);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
              {createMutation.isPending || updateMutation.isPending ? "Saving..." : editingClass ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </AppModal>
    </div>
  );
}
