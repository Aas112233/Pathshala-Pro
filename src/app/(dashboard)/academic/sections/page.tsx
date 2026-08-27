"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { AppDropdown } from "@/components/ui/app-dropdown";
import { TopSheet } from "@/components/ui/top-sheet";
import { ERPFormSection, ERPFormGrid, ERPFormField } from "@/components/ui/erp-form-layout";
import { Input } from "@/components/ui/input";
import { ClipboardList, Plus, Pencil, Trash2, CheckCircle, XCircle } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
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
  const t = useTranslations('sections');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<SectionData | null>(null);

  const queryClient = useQueryClient();

  const { data: classesData } = useQuery({
    queryKey: ["classes-all"],
    queryFn: async () => {
      const res = await fetch("/api/classes?limit=100");
      if (!res.ok) throw new Error("Failed to fetch classes");
      return res.json();
    },
  });

  const { data: groupsData } = useQuery({
    queryKey: ["groups-all"],
    queryFn: async () => {
      const res = await fetch("/api/groups?limit=100");
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
      const res = await fetch(`/api/sections?${params}`);
      if (!res.ok) throw new Error("Failed to fetch sections");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/sections", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
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
      const res = await fetch(`/api/sections/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
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
      const res = await fetch(`/api/sections/${id}`, { method: "DELETE" });
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
  const [formErrors, setFormErrors] = useState<{
    classId?: string;
    name?: string;
    shortName?: string;
  }>({});

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
    setFormErrors({});
  };

  const handleClose = () => {
    setIsModalOpen(false);
    setEditingSection(null);
    resetForm();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const nextErrors: typeof formErrors = {};
    if (!formData.classId) nextErrors.classId = `${t('class')} is required`;
    if (!formData.name.trim()) nextErrors.name = `${t('sectionName')} is required`;
    if (!formData.shortName.trim()) nextErrors.shortName = `${t('shortName')} is required`;
    setFormErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      toast.error("Please fill in all required fields.");
      return;
    }
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
    if (!confirm(t('confirmDelete'))) return;
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
      header: t('tableColumns.sectionName'),
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.name}</p>
          <p className="text-xs text-muted-foreground">{row.original.sectionId}</p>
        </div>
      ),
    },
    {
      accessorKey: "class",
      header: t('tableColumns.class'),
      cell: ({ row }) => (
        <span>{row.original.class?.name || "N/A"}</span>
      ),
    },
    {
      accessorKey: "group",
      header: t('tableColumns.group'),
      cell: ({ row }) => (
        <span>{row.original.group?.name || t('general')}</span>
      ),
    },
    {
      accessorKey: "shortName",
      header: t('tableColumns.shortName'),
    },
    {
      accessorKey: "roomNumber",
      header: t('tableColumns.room'),
      cell: ({ getValue }) => (
        <span>{getValue<string>() || "-"}</span>
      ),
    },
    {
      accessorKey: "capacity",
      header: t('tableColumns.capacity'),
      cell: ({ getValue }) => (
        <span>{getValue<number>() || t('infinite')}</span>
      ),
    },
    {
      accessorKey: "isActive",
      header: t('tableColumns.status'),
      cell: ({ getValue }) => (
        <StatusBadge
          status={getValue<boolean>()}
          domain="active"
          label={getValue<boolean>() ? t('active') : t('inactive')}
          icon={getValue<boolean>() ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
        />
      ),
    },
    {
      id: "actions",
      header: t('tableColumns.actions'),
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
        title={t('title')}
        description={t('description')}
        icon={ClipboardList}
      >
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t('addSection')}
        </Button>
      </PageHeader>

      <DataTable
        columns={columns}
        data={sections}
        pagination={pagination}
        onPageChange={setPage}
        onSearch={setSearch}
        isLoading={isLoading}
        searchPlaceholder={t('searchPlaceholder')}
      />

      {/* Add/Edit Form */}
      <TopSheet
        isOpen={isModalOpen}
        onClose={handleClose}
        title={editingSection ? t('editSection') : t('addSection')}
        description={editingSection ? t('update') : t('description')}
        maxWidth="2xl"
        footer={
          <div className="flex items-center justify-end gap-3 w-full">
            <Button variant="outline" type="button" onClick={handleClose}>
              {t('cancel')}
            </Button>
            <Button type="submit" form="section-form" disabled={createMutation.isPending || updateMutation.isPending}>
              {createMutation.isPending || updateMutation.isPending ? t('saving') : editingSection ? t('update') : t('create')}
            </Button>
          </div>
        }
      >
        <form id="section-form" onSubmit={handleSubmit} className="space-y-5">
          <ERPFormSection>
            <ERPFormGrid cols={2}>
              <ERPFormField label={t('class')} required error={formErrors.classId}>
                <AppDropdown
                  value={formData.classId}
                  onChange={(val) => {
                    setFormData({ ...formData, classId: val });
                    if (formErrors.classId) setFormErrors((prev) => ({ ...prev, classId: undefined }));
                  }}
                  invalid={Boolean(formErrors.classId)}
                  triggerClassName={formErrors.classId ? "border-destructive ring-1 ring-destructive" : ""}
                  options={[
                    { value: "", label: t('selectClass') },
                    ...classOptions,
                  ]}
                  placeholder={t('selectClass')}
                  searchable
                />
              </ERPFormField>

              <ERPFormField label={`${t('group')} (${t('noGroupGeneral').split('(')[0].trim()})`}>
                <AppDropdown
                  value={formData.groupId}
                  onChange={(val) => setFormData({ ...formData, groupId: val })}
                  options={[
                    { value: "", label: t('noGroupGeneral') },
                    ...groupOptions,
                  ]}
                  placeholder={t('selectGroup')}
                  searchable
                />
              </ERPFormField>

              <ERPFormField label={t('sectionName')} required error={formErrors.name}>
                <Input
                  aria-invalid={Boolean(formErrors.name)}
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({ ...formData, name: e.target.value });
                    if (formErrors.name) setFormErrors((prev) => ({ ...prev, name: undefined }));
                  }}
                  placeholder={t('sectionName')}
                />
              </ERPFormField>

              <ERPFormField label={t('shortName')} required error={formErrors.shortName}>
                <Input
                  aria-invalid={Boolean(formErrors.shortName)}
                  value={formData.shortName}
                  onChange={(e) => {
                    setFormData({ ...formData, shortName: e.target.value });
                    if (formErrors.shortName) setFormErrors((prev) => ({ ...prev, shortName: undefined }));
                  }}
                  placeholder={t('shortName')}
                />
              </ERPFormField>

              <ERPFormField label={t('capacity')} helperText={t('capacityHint')}>
                <Input
                  type="number"
                  value={formData.capacity}
                  onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                />
              </ERPFormField>

              <ERPFormField label={t('roomNumber')} helperText={t('roomHint')}>
                <Input
                  value={formData.roomNumber}
                  onChange={(e) => setFormData({ ...formData, roomNumber: e.target.value })}
                />
              </ERPFormField>

              <ERPFormField label={t('status')}>
                <AppDropdown
                  value={formData.isActive ? "ACTIVE" : "INACTIVE"}
                  onChange={(val) => setFormData({ ...formData, isActive: val === "ACTIVE" })}
                  options={[
                    { value: "ACTIVE", label: t('active') },
                    { value: "INACTIVE", label: t('inactive') },
                  ]}
                />
              </ERPFormField>
            </ERPFormGrid>
          </ERPFormSection>
        </form>
      </TopSheet>
    </div>
  );
}
