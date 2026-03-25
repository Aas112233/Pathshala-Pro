"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { AppDropdown } from "@/components/ui/app-dropdown";
import { AppModal } from "@/components/ui/app-modal";
import { ClipboardList, Plus, Pencil, Trash2, CheckCircle, XCircle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";

interface SectionData {
  id: string;
  sectionId: string;
  classId: string;
  groupId?: string;
  name: string;
  shortName: string;
  capacity?: number;
  roomNumber?: string;
  isActive: boolean;
  class?: {
    name: string;
  };
  group?: {
    name: string;
    shortName: string;
  };
}

export default function SectionsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<SectionData | null>(null);

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

  const { data: groupsData } = useQuery({
    queryKey: ["groups-all"],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      const tenantId = localStorage.getItem("tenant_id");
      const res = await fetch("/api/groups?limit=100", {
        headers: {
          "Authorization": `Bearer ${token}`,
          "X-Tenant-ID": tenantId || "",
        },
      });
      if (!res.ok) throw new Error("Failed to fetch groups");
      return res.json();
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["sections", { page, search }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
        ...(search && { search }),
      });
      const token = localStorage.getItem("auth_token");
      const tenantId = localStorage.getItem("tenant_id");
      const res = await fetch(`/api/sections?${params}`, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "X-Tenant-ID": tenantId || "",
        },
      });
      if (!res.ok) throw new Error("Failed to fetch sections");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const token = localStorage.getItem("auth_token");
      const tenantId = localStorage.getItem("tenant_id");
      const res = await fetch("/api/sections", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "X-Tenant-ID": tenantId || "",
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create section");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sections"] });
      toast.success("Section created successfully!");
      setIsModalOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create section");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const token = localStorage.getItem("auth_token");
      const tenantId = localStorage.getItem("tenant_id");
      const res = await fetch(`/api/sections/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "X-Tenant-ID": tenantId || "",
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update section");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sections"] });
      toast.success("Section updated successfully!");
      setIsModalOpen(false);
      setEditingSection(null);
      resetForm();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update section");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = localStorage.getItem("auth_token");
      const tenantId = localStorage.getItem("tenant_id");
      const res = await fetch(`/api/sections/${id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`,
          "X-Tenant-ID": tenantId || "",
        },
      });
      if (!res.ok) throw new Error("Failed to delete section");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sections"] });
      toast.success("Section deleted successfully!");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete section");
    },
  });

  const [formData, setFormData] = useState({
    classId: "",
    groupId: "",
    name: "",
    shortName: "",
    capacity: "",
    roomNumber: "",
    isActive: true,
  });

  const resetForm = () => {
    setFormData({
      classId: "",
      groupId: "",
      name: "",
      shortName: "",
      capacity: "",
      roomNumber: "",
      isActive: true,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: any = {
      ...formData,
      capacity: formData.capacity ? parseInt(formData.capacity) : undefined,
    };
    if (!data.groupId) delete data.groupId;
    if (editingSection) {
      updateMutation.mutate({ id: editingSection.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (section: SectionData) => {
    setEditingSection(section);
    setFormData({
      classId: section.classId || "",
      groupId: section.groupId || "",
      name: section.name,
      shortName: section.shortName,
      capacity: section.capacity?.toString() || "",
      roomNumber: section.roomNumber || "",
      isActive: section.isActive,
    });
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (!confirm("Are you sure you want to delete this section?")) return;
    deleteMutation.mutate(id);
  };

  const classes = ("data" in (classesData || {})) ? (classesData as any).data : [];
  const classOptions = classes.map((c: any) => ({
    value: c.id,
    label: `${c.name} (Class ${c.classNumber})`,
  }));

  const groups = ("data" in (groupsData || {})) ? (groupsData as any).data : [];
  const groupOptions = groups.map((g: any) => ({
    value: g.id,
    label: `${g.name} (${g.shortName})`,
  }));

  const columns: ColumnDef<SectionData>[] = [
    {
      accessorKey: "name",
      header: "Section Name",
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.name}</p>
          <p className="text-xs text-muted-foreground">{row.original.sectionId}</p>
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
      accessorKey: "group",
      header: "Group",
      cell: ({ row }) => (
        <span>{row.original.group?.name || "General"}</span>
      ),
    },
    {
      accessorKey: "shortName",
      header: "Short Name",
    },
    {
      accessorKey: "roomNumber",
      header: "Room",
      cell: ({ getValue }) => (
        <span>{getValue<string>() || "-"}</span>
      ),
    },
    {
      accessorKey: "capacity",
      header: "Capacity",
      cell: ({ getValue }) => (
        <span>{getValue<number>() || "∞"}</span>
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

  const sections = ("data" in (data || {})) ? (data as any).data : [];
  const pagination = ("pagination" in (data || {})) ? (data as any).pagination : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sections"
        description="Manage class sections (A, B, C, etc.)"
        icon={ClipboardList}
      >
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Section
        </Button>
      </PageHeader>

      <DataTable
        columns={columns}
        data={sections}
        pagination={pagination}
        onPageChange={setPage}
        onSearch={setSearch}
        isLoading={isLoading}
        searchPlaceholder="Search sections..."
      />

      {/* Add/Edit Modal */}
      <AppModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingSection(null);
          resetForm();
        }}
        title={editingSection ? "Edit Section" : "Add New Section"}
        description={editingSection ? "Update section information" : "Create a new section"}
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
            <label className="text-sm font-medium">Group (Optional)</label>
            <AppDropdown
              value={formData.groupId}
              onChange={(val) => setFormData({ ...formData, groupId: val })}
              options={[
                { value: "", label: "No Group (General)" },
                ...groupOptions,
              ]}
              placeholder="Select Group"
              searchable
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Section Name</label>
              <input
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Section A"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Short Name</label>
              <input
                required
                value={formData.shortName}
                onChange={(e) => setFormData({ ...formData, shortName: e.target.value })}
                placeholder="e.g., A"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Capacity</label>
              <input
                type="number"
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                placeholder="e.g., 50"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Room Number</label>
              <input
                value={formData.roomNumber}
                onChange={(e) => setFormData({ ...formData, roomNumber: e.target.value })}
                placeholder="e.g., Room 101"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary"
              />
            </div>
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
                setEditingSection(null);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
              {createMutation.isPending || updateMutation.isPending ? "Saving..." : editingSection ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </AppModal>
    </div>
  );
}
