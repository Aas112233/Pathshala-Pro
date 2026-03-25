"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { AppDropdown } from "@/components/ui/app-dropdown";
import { AppModal } from "@/components/ui/app-modal";
import { Layers, Plus, Pencil, Trash2, CheckCircle, XCircle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";

interface GroupData {
  id: string;
  groupId: string;
  classId: string;
  name: string;
  shortName: string;
  subjects: string[];
  isActive: boolean;
  class?: {
    name: string;
  };
  _count?: {
    sections: number;
  };
}

export default function GroupsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<GroupData | null>(null);

  const queryClient = useQueryClient();

  const { data: classesData } = useQuery({
    queryKey: ["classes-all"],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      const tenantId = localStorage.getItem("tenant_id");
      const res = await fetch("/api/classes?limit=100", {
        headers: {
          "Authorization": `Bearer ${token}`,
          "X-Tenant-ID": tenantId || "",
        },
      });
      if (!res.ok) throw new Error("Failed to fetch classes");
      return res.json();
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["groups", { page, search }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
        ...(search && { search }),
      });
      const token = localStorage.getItem("auth_token");
      const tenantId = localStorage.getItem("tenant_id");
      const res = await fetch(`/api/groups?${params}`, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "X-Tenant-ID": tenantId || "",
        },
      });
      if (!res.ok) throw new Error("Failed to fetch groups");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const token = localStorage.getItem("auth_token");
      const tenantId = localStorage.getItem("tenant_id");
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "X-Tenant-ID": tenantId || "",
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create group");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      toast.success("Group created successfully!");
      setIsModalOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create group");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const token = localStorage.getItem("auth_token");
      const tenantId = localStorage.getItem("tenant_id");
      const res = await fetch(`/api/groups/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "X-Tenant-ID": tenantId || "",
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update group");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      toast.success("Group updated successfully!");
      setIsModalOpen(false);
      setEditingGroup(null);
      resetForm();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update group");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = localStorage.getItem("auth_token");
      const tenantId = localStorage.getItem("tenant_id");
      const res = await fetch(`/api/groups/${id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`,
          "X-Tenant-ID": tenantId || "",
        },
      });
      if (!res.ok) throw new Error("Failed to delete group");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      toast.success("Group deleted successfully!");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete group");
    },
  });

  const [formData, setFormData] = useState({
    classId: "",
    name: "",
    shortName: "",
    subjects: "",
    isActive: true,
  });

  const resetForm = () => {
    setFormData({
      classId: "",
      name: "",
      shortName: "",
      subjects: "",
      isActive: true,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      ...formData,
      subjects: formData.subjects.split(",").map((s) => s.trim()).filter(Boolean),
    };
    if (editingGroup) {
      updateMutation.mutate({ id: editingGroup.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (group: GroupData) => {
    setEditingGroup(group);
    setFormData({
      classId: group.classId || "",
      name: group.name,
      shortName: group.shortName,
      subjects: group.subjects?.join(", ") || "",
      isActive: group.isActive,
    });
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (!confirm("Are you sure you want to delete this group?")) return;
    deleteMutation.mutate(id);
  };

  const classes = ("data" in (classesData || {})) ? (classesData as any).data : [];
  const classOptions = classes.map((c: any) => ({
    value: c.id,
    label: `${c.name} (Class ${c.classNumber})`,
  }));

  const columns: ColumnDef<GroupData>[] = [
    {
      accessorKey: "name",
      header: "Group Name",
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.name}</p>
          <p className="text-xs text-muted-foreground">{row.original.groupId}</p>
        </div>
      ),
    },
    {
      accessorKey: "class",
      header: "Class",
      cell: ({ row }) => (
        <span>{row.original.class?.name || "N/A"}</span>
      ),
    },
    {
      accessorKey: "shortName",
      header: "Short Name",
    },
    {
      accessorKey: "subjects",
      header: "Subjects",
      cell: ({ getValue }) => {
        const subjects = getValue<string[]>() || [];
        return (
          <div className="flex flex-wrap gap-1">
            {subjects.slice(0, 3).map((subject, i) => (
              <span key={i} className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs text-primary">
                {subject}
              </span>
            ))}
            {subjects.length > 3 && (
              <span className="text-xs text-muted-foreground">+{subjects.length - 3} more</span>
            )}
          </div>
        );
      },
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
      header: "Sections",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original._count?.sections || 0} section(s)
        </span>
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

  const groups = ("data" in (data || {})) ? (data as any).data : [];
  const pagination = ("pagination" in (data || {})) ? (data as any).pagination : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Groups"
        description="Manage student groups (Science, Commerce, Arts, etc.)"
        icon={Layers}
      >
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Group
        </Button>
      </PageHeader>

      <DataTable
        columns={columns}
        data={groups}
        pagination={pagination}
        onPageChange={setPage}
        onSearch={setSearch}
        isLoading={isLoading}
        searchPlaceholder="Search groups..."
      />

      {/* Add/Edit Modal */}
      <AppModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingGroup(null);
          resetForm();
        }}
        title={editingGroup ? "Edit Group" : "Add New Group"}
        description={editingGroup ? "Update group information" : "Create a new group"}
        maxWidth="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Class</label>
            <AppDropdown
              value={formData.classId}
              onChange={(val) => setFormData({ ...formData, classId: val })}
              options={[
                { value: "", label: "Select Class" },
                ...classOptions,
              ]}
              placeholder="Select Class"
              searchable
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Group Name</label>
            <input
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Science"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Short Name</label>
            <input
              required
              value={formData.shortName}
              onChange={(e) => setFormData({ ...formData, shortName: e.target.value })}
              placeholder="e.g., SCI"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Subjects (comma separated)</label>
            <input
              value={formData.subjects}
              onChange={(e) => setFormData({ ...formData, subjects: e.target.value })}
              placeholder="e.g., Physics, Chemistry, Biology"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary"
            />
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
                setEditingGroup(null);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
              {createMutation.isPending || updateMutation.isPending ? "Saving..." : editingGroup ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </AppModal>
    </div>
  );
}
