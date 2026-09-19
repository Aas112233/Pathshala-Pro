"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { AppDropdown } from "@/components/ui/app-dropdown";
import { TopSheet } from "@/components/ui/top-sheet";
import { ERPFormSection, ERPFormGrid, ERPFormField } from "@/components/ui/erp-form-layout";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Layers, Plus, Pencil, Trash2, CheckCircle, XCircle, X, Search, Eye } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { useAuth } from "@/components/providers/auth-provider";
import { hasPermission, getEffectivePermissions } from "@/lib/permissions";

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

interface SubjectData {
  id: string;
  subjectId: string;
  name: string;
  code: string;
  category: string;
  isActive: boolean;
}

export default function GroupsPage() {
  const t = useTranslations('groups');
  const common = useTranslations('common');
  const { user: authUser, isLoading: isAuthLoading } = useAuth();
  const perms = getEffectivePermissions(authUser?.role as string, (authUser as any)?.permissions, (authUser as any)?.accessLevel);
  const canRead = hasPermission(perms, "academic", "read");
  const canWrite = hasPermission(perms, "academic", "write");
  const canManage = hasPermission(perms, "academic", "manage");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<GroupData | null>(null);
  const [viewingGroup, setViewingGroup] = useState<GroupData | null>(null);
  const [subjectSearch, setSubjectSearch] = useState("");

  const queryClient = useQueryClient();

  const { data: classesData } = useQuery({
    queryKey: ["classes", "all"],
    queryFn: async () => {
      const res = await fetch("/api/classes?limit=100");
      if (!res.ok) throw new Error(t("fetchClassesFailed"));
      return res.json();
    },
  });

  const [formData, setFormData] = useState({
    classId: "",
    name: "",
    shortName: "",
    selectedSubjects: [] as string[],
    isActive: true,
  });
  const [formErrors, setFormErrors] = useState<{
    classId?: string;
    name?: string;
    shortName?: string;
  }>({});

  // Fetch class-specific subjects when a class is selected in the modal
  const { data: classSubjectsData, isLoading: isClassSubjectsLoading } = useQuery<SubjectData[]>({
    queryKey: ["class-subjects", "group-modal", formData.classId],
    queryFn: async () => {
      if (!formData.classId) return [];
      const res = await fetch(`/api/class-subjects?classId=${formData.classId}`);
      if (!res.ok) return [];
      const json = await res.json();
      return (json.data || []).map((cs: any) => ({
        id: cs.subject?.id || cs.subjectId,
        subjectId: cs.subject?.subjectId || cs.subjectId,
        name: cs.subject?.name || "Unknown",
        code: cs.subject?.code || "",
        category: cs.subject?.category || (cs.isCompulsory ? "COMPULSORY" : "ELECTIVE"),
        isActive: true,
      }));
    },
    enabled: !!formData.classId && isModalOpen,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["groups", { page, search }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
        ...(search && { search }),
      });
      const res = await fetch(`/api/groups?${params}`);
      if (!res.ok) throw new Error(t("fetchGroupsFailed"));
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(t("createFailed"));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      toast.success(t("createSuccess"));
      setIsModalOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast.error(err.message || t("createFailed"));
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await fetch(`/api/groups/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(t("updateFailed"));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      toast.success(t("updateSuccess"));
      setIsModalOpen(false);
      setEditingGroup(null);
      resetForm();
    },
    onError: (err: any) => {
      toast.error(err.message || t("updateFailed"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/groups/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(t("deleteFailed"));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      toast.success(t("deleteSuccess"));
    },
    onError: (err: any) => {
      toast.error(err.message || t("deleteFailed"));
    },
  });

  const resetForm = () => {
    setFormData({
      classId: "",
      name: "",
      shortName: "",
      selectedSubjects: [],
      isActive: true,
    });
    setSubjectSearch("");
    setFormErrors({});
  };

  const handleClose = () => {
    setIsModalOpen(false);
    setEditingGroup(null);
    resetForm();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: typeof formErrors = {};
    if (!formData.classId) nextErrors.classId = t("requiredField", { field: t("class") });
    if (!formData.name.trim()) nextErrors.name = t("requiredField", { field: t("groupName") });
    if (!formData.shortName.trim()) nextErrors.shortName = t("requiredField", { field: t("shortName") });
    setFormErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      toast.error(t("requiredFields"));
      return;
    }
    const data = {
      classId: formData.classId,
      name: formData.name,
      shortName: formData.shortName,
      subjects: formData.selectedSubjects,
      isActive: formData.isActive,
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
      selectedSubjects: group.subjects || [],
      isActive: group.isActive,
    });
    setSubjectSearch("");
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (!confirm(t('confirmDelete'))) return;
    deleteMutation.mutate(id);
  };

  const toggleSubject = (subjectName: string) => {
    setFormData(prev => ({
      ...prev,
      selectedSubjects: prev.selectedSubjects.includes(subjectName)
        ? prev.selectedSubjects.filter(s => s !== subjectName)
        : [...prev.selectedSubjects, subjectName],
    }));
  };

  const removeSubject = (subjectName: string) => {
    setFormData(prev => ({
      ...prev,
      selectedSubjects: prev.selectedSubjects.filter(s => s !== subjectName),
    }));
  };

  // Filter subjects based on class and search
  const availableSubjects = useMemo(() => {
    if (!formData.classId) return [];
    return classSubjectsData || [];
  }, [formData.classId, classSubjectsData]);

  const filteredSubjects = useMemo(() => {
    if (!subjectSearch.trim()) return availableSubjects;
    const q = subjectSearch.toLowerCase();
    return availableSubjects.filter((s: SubjectData) =>
      s.name.toLowerCase().includes(q) ||
      s.code.toLowerCase().includes(q)
    );
  }, [availableSubjects, subjectSearch]);

  const classes = ("data" in (classesData || {})) ? (classesData as any).data : [];
  const classOptions = classes.map((c: any) => ({
    value: c.id,
    label: `${c.name} (${t("classOption", { number: c.classNumber })})`,
  }));

  const columns: ColumnDef<GroupData>[] = [
    {
      accessorKey: "name",
      header: t('tableColumns.groupName'),
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.name}</p>
          <p className="text-xs text-muted-foreground">{row.original.groupId}</p>
        </div>
      ),
    },
    {
      accessorKey: "class",
      header: t('tableColumns.class'),
      cell: ({ row }) => (
        <span>{row.original.class?.name || t("classUnavailable")}</span>
      ),
    },
    {
      accessorKey: "shortName",
      header: t('tableColumns.shortName'),
    },
    {
      accessorKey: "subjects",
      header: t('tableColumns.subjects'),
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
              <span className="text-xs text-muted-foreground">+{subjects.length - 3} {t("more")}</span>
            )}
          </div>
        );
      },
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
      id: "stats",
      header: t('tableColumns.sections'),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original._count?.sections || 0} {t('sections').toLowerCase()}
        </span>
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
            title={t('viewDetails')}
            aria-label={t('viewDetails')}
            onClick={() => setViewingGroup(row.original)}
          >
            <Eye className="h-4 w-4" />
          </Button>
          {canWrite && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleEdit(row.original)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          {canManage && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDelete(row.original.id)}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  const groups = ("data" in (data || {})) ? (data as any).data : [];
  const pagination = ("pagination" in (data || {})) ? (data as any).pagination : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        description={t('description')}
        icon={Layers}
      >
        {canWrite && (
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t('addGroup')}
          </Button>
        )}
      </PageHeader>

      {!isAuthLoading && !canRead ? (
        <div className="rounded-lg border border-border bg-card p-6">
          <h2>{common("accessRestricted")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{common("noPermission")}</p>
        </div>
      ) : (
        <>
          <DataTable
            columns={columns}
            data={groups}
            pagination={pagination}
            onPageChange={setPage}
            onSearch={setSearch}
            isLoading={isLoading}
            searchPlaceholder={t('searchPlaceholder')}
          />
        </>
      )}

      {/* Add/Edit Form */}
      <TopSheet
        isOpen={isModalOpen}
        onClose={handleClose}
        title={editingGroup ? t('editGroup') : t('addGroup')}
        description={editingGroup ? t('update') : t('description')}
        maxWidth="2xl"
        footer={
          <div className="flex items-center justify-end gap-3 w-full">
            <Button variant="outline" type="button" onClick={handleClose}>
              {t('cancel')}
            </Button>
            <Button type="submit" form="group-form" disabled={createMutation.isPending || updateMutation.isPending}>
              {createMutation.isPending || updateMutation.isPending ? t('saving') : editingGroup ? t('update') : t('create')}
            </Button>
          </div>
        }
      >
        <form id="group-form" onSubmit={handleSubmit} className="space-y-5">
          <ERPFormSection>
            <ERPFormGrid cols={2}>
              <ERPFormField label={t('class')} required error={formErrors.classId}>
                <AppDropdown
                  value={formData.classId}
                  onChange={(val) => {
                    setFormData({ ...formData, classId: val, selectedSubjects: [] });
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

              <ERPFormField label={t('groupName')} required error={formErrors.name}>
                <Input
                  aria-invalid={Boolean(formErrors.name)}
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({ ...formData, name: e.target.value });
                    if (formErrors.name) setFormErrors((prev) => ({ ...prev, name: undefined }));
                  }}
                  placeholder={t("groupNamePlaceholder")}
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
                  placeholder={t("shortNamePlaceholder")}
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

            {/* Subject Multi-Select from API */}
            <ERPFormField
              label={t('subjects')}
              action={
                formData.selectedSubjects.length > 0 && (
                  <span className="text-xs font-normal text-muted-foreground">
                    ({t("selectedCount", { count: formData.selectedSubjects.length })})
                  </span>
                )
              }
            >
              {/* Selected subjects as chips */}
              {formData.selectedSubjects.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pb-1">
                  {formData.selectedSubjects.map((name) => (
                    <span
                      key={name}
                      className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary"
                    >
                      {name}
                      <button
                        type="button"
                        onClick={() => removeSubject(name)}
                        className="rounded-full p-0.5 hover:bg-primary/20 transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Search + subject list */}
              <div className="rounded-md border border-input overflow-hidden">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="text"
                    value={subjectSearch}
                    onChange={(e) => setSubjectSearch(e.target.value)}
                    placeholder={t('subjectsHint')}
                    className="w-full rounded-none border-0 border-b bg-muted/30 py-2 pl-8 pr-3 shadow-none placeholder:text-muted-foreground/60"
                  />
                </div>
                <div className="max-h-40 overflow-y-auto">
                  {isClassSubjectsLoading ? (
                    <p className="p-3 text-xs text-muted-foreground text-center">{t("loadingSubjects")}</p>
                  ) : filteredSubjects.length === 0 ? (
                    <p className="p-3 text-xs text-muted-foreground text-center">{t("noSubjectsFound")}</p>
                  ) : (
                    filteredSubjects.map((subject: SubjectData) => {
                      const isSelected = formData.selectedSubjects.includes(subject.name);
                      return (
                        <label
                          key={subject.id}
                          className={`flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer transition-colors hover:bg-muted/50 ${
                            isSelected ? "bg-primary/5" : ""
                          }`}
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSubject(subject.name)}
                            className="h-3.5 w-3.5"
                          />
                          <span className="flex-1 truncate">{subject.name}</span>
                          <span className="text-xs text-muted-foreground">{subject.code}</span>
                          <StatusBadge
                            status={subject.category}
                            domain="subjectType"
                            label={subject.category === "COMPULSORY" ? "C" : "E"}
                            className="text-[10px] px-1.5 py-0.5"
                          />
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            </ERPFormField>
          </ERPFormSection>
        </form>
      </TopSheet>

      {/* Read-only detail view */}
      <TopSheet
        isOpen={!!viewingGroup}
        onClose={() => setViewingGroup(null)}
        title={t('viewDetails')}
        description={viewingGroup ? `${viewingGroup.name} (${viewingGroup.groupId})` : ""}
        maxWidth="lg"
        footer={
          <div className="flex items-center justify-end gap-3 w-full">
            <Button variant="outline" type="button" onClick={() => setViewingGroup(null)}>
              {common('cancel')}
            </Button>
            {canWrite && viewingGroup && (
              <Button
                type="button"
                onClick={() => {
                  handleEdit(viewingGroup);
                  setViewingGroup(null);
                }}
              >
                <Pencil className="mr-2 h-4 w-4" />
                {t('editGroup')}
              </Button>
            )}
          </div>
        }
      >
        {viewingGroup && (
          <ERPFormSection>
            <ERPFormGrid cols={2}>
              <ERPFormField label={t('groupName')}>
                <p className="text-sm font-medium">{viewingGroup.name}</p>
              </ERPFormField>
              <ERPFormField label={t('shortName')}>
                <p className="text-sm font-medium">{viewingGroup.shortName}</p>
              </ERPFormField>
              <ERPFormField label={t('class')}>
                <p className="text-sm">{viewingGroup.class?.name || t("classUnavailable")}</p>
              </ERPFormField>
              <ERPFormField label={t('tableColumns.status')}>
                <StatusBadge
                  status={viewingGroup.isActive}
                  domain="active"
                  label={viewingGroup.isActive ? t('active') : t('inactive')}
                  icon={viewingGroup.isActive ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                />
              </ERPFormField>
            </ERPFormGrid>
            <ERPFormField
              label={t('subjects')}
              action={
                <span className="text-xs font-normal text-muted-foreground">
                  ({t("selectedCount", { count: (viewingGroup.subjects || []).length })})
                </span>
              }
            >
              {(viewingGroup.subjects || []).length === 0 ? (
                <p className="text-xs text-muted-foreground">{t("noSubjectsFound")}</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {viewingGroup.subjects.map((name) => (
                    <span
                      key={name}
                      className="inline-flex items-center rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary"
                    >
                      {name}
                    </span>
                  ))}
                </div>
              )}
            </ERPFormField>
          </ERPFormSection>
        )}
      </TopSheet>
    </div>
  );
}

