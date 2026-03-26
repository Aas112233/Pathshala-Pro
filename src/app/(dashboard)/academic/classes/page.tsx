"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { AppDropdown } from "@/components/ui/app-dropdown";
import { AppModal } from "@/components/ui/app-modal";
import { Badge } from "@/components/ui/badge";
import {
  School, Plus, Pencil, Trash2, CheckCircle, XCircle,
  BookOpen, Eye, Layers, Save
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { cn } from "@/lib/utils";

// ──────────── Types ────────────
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
    classSubjects?: number;
  };
}

// ──────────── Helpers ────────────
function getAuthHeaders() {
  const token = localStorage.getItem("auth_token");
  const tenantId = localStorage.getItem("tenant_id");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    "X-Tenant-ID": tenantId || "",
  };
}

// ──────────── Main Page ────────────
export default function ClassesPage() {
  const t = useTranslations("classes");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassData | null>(null);
  const [activeTab, setActiveTab] = useState<"details" | "subjects">("details");

  // View-only subjects modal
  const [isViewSubjectsOpen, setIsViewSubjectsOpen] = useState(false);
  const [viewClass, setViewClass] = useState<{ id: string; name: string } | null>(null);
  const [viewOnlySubjects, setViewOnlySubjects] = useState<any[]>([]);

  // Form state
  const [formData, setFormData] = useState({ name: "", classNumber: "" as any, isActive: true });
  const [classNumberError, setClassNumberError] = useState("");
  const [pendingSubjects, setPendingSubjects] = useState<string[]>([]);
  const [subjectTypeMap, setSubjectTypeMap] = useState<Record<string, boolean>>({});

  const queryClient = useQueryClient();

  // ──── Data Fetching ────
  const { data, isLoading } = useQuery({
    queryKey: ["classes", { page, search }],
    queryFn: async () => {
      const params = new URLSearchParams({ page: page.toString(), limit: "20", ...(search && { search }) });
      const res = await fetch(`/api/classes?${params}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch classes");
      return res.json();
    },
  });

  const { data: subjectsData } = useQuery({
    queryKey: ["subjects-all"],
    queryFn: async () => {
      const res = await fetch("/api/subjects", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch subjects");
      return res.json();
    },
  });

  const allSubjects = ("data" in (subjectsData || {})) ? (subjectsData as any).data : [];

  // Fetch assigned subjects when editing
  const { data: editClassSubjects, refetch: refetchEditSubjects } = useQuery({
    queryKey: ["class-subjects", editingClass?.id],
    queryFn: async () => {
      const res = await fetch(`/api/class-subjects?classId=${editingClass!.id}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch class subjects");
      const result = await res.json();
      return result.data || [];
    },
    enabled: !!editingClass?.id && isModalOpen,
    staleTime: 0, // Always refetch fresh data
  });

  // Pre-populate subjects when editing data arrives
  useEffect(() => {
    if (editClassSubjects && editingClass && isModalOpen) {
      const subjects = Array.isArray(editClassSubjects) ? editClassSubjects : [editClassSubjects];
      const ids = subjects.map((s: any) => s.subjectId);
      setPendingSubjects(ids);
      const typeMap: Record<string, boolean> = {};
      subjects.forEach((s: any) => { typeMap[s.subjectId] = s.isCompulsory; });
      setSubjectTypeMap(typeMap);
    }
  }, [editClassSubjects, editingClass, isModalOpen]);

  // ──── Mutations ────
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/classes", { method: "POST", headers: getAuthHeaders(), body: JSON.stringify(data) });
      const json = await res.clone().json();
      if (!res.ok) {
        if (json.details?.[0]?.field === "classNumber") setClassNumberError(json.details[0].message);
        throw new Error(json.details?.[0]?.message || json.message || "Failed to create class");
      }
      return json;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["classes"] }),
    onError: (err: any) => { if (!classNumberError) toast.error(err.message); },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await fetch(`/api/classes/${id}`, { method: "PUT", headers: getAuthHeaders(), body: JSON.stringify(data) });
      const json = await res.clone().json();
      if (!res.ok) {
        if (json.details?.[0]?.field === "classNumber") setClassNumberError(json.details[0].message);
        throw new Error(json.details?.[0]?.message || json.message || "Failed to update class");
      }
      return json;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["classes"] }),
    onError: (err: any) => { if (!classNumberError) toast.error(err.message); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/classes/${id}`, { method: "DELETE", headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to delete class");
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["classes"] }); toast.success("Class deleted!"); },
    onError: (err: any) => toast.error(err.message),
  });

  // ──── Handlers ────
  const resetForm = () => {
    setFormData({ name: "", classNumber: "" as any, isActive: true });
    setClassNumberError("");
    setPendingSubjects([]);
    setSubjectTypeMap({});
    setActiveTab("details");
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingClass(null);
    resetForm();
  };

  const handleOpenNew = () => {
    resetForm();
    setEditingClass(null);
    setIsModalOpen(true);
  };

  const handleEdit = (classItem: ClassData) => {
    // Reset subjects first to avoid showing stale data from a previous edit
    setPendingSubjects([]);
    setSubjectTypeMap({});
    setClassNumberError("");
    setActiveTab("details");

    // Prefill class details
    setEditingClass(classItem);
    setFormData({
      name: classItem.name,
      classNumber: classItem.classNumber.toString() as any,
      isActive: classItem.isActive,
    });
    setIsModalOpen(true);

    // Force refetch of subjects for this class (runs via the useQuery + useEffect)
    setTimeout(() => refetchEditSubjects(), 100);
  };

  const handleDelete = (id: string) => {
    if (!confirm(t("confirmDelete"))) return;
    deleteMutation.mutate(id);
  };

  const handleViewSubjects = async (classItem: ClassData) => {
    try {
      const res = await fetch(`/api/class-subjects?classId=${classItem.id}`, { headers: getAuthHeaders() });
      const result = await res.json();
      setViewOnlySubjects(result.data || []);
      setViewClass({ id: classItem.id, name: classItem.name });
      setIsViewSubjectsOpen(true);
    } catch { /* fallback */ }
  };

  const handleToggleSubject = (subjectId: string) => {
    setPendingSubjects((prev) =>
      prev.includes(subjectId) ? prev.filter((id) => id !== subjectId) : [...prev, subjectId]
    );
  };

  const handleTypeChange = (subjectId: string) => {
    setSubjectTypeMap((prev) => ({ ...prev, [subjectId]: !(prev[subjectId] ?? true) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setClassNumberError("");

    const payload = { ...formData, classNumber: parseInt(formData.classNumber) || 0 };

    try {
      let classId: string;

      if (editingClass) {
        await updateMutation.mutateAsync({ id: editingClass.id, data: payload });
        classId = editingClass.id;
      } else {
        const result = await createMutation.mutateAsync(payload);
        classId = result.data?.id || result.id;
      }

      // Save subjects
      if (pendingSubjects.length > 0) {
        const subjects = pendingSubjects.map((subjectId, index) => ({
          subjectId,
          isCompulsory: subjectTypeMap[subjectId] ?? true,
          sortOrder: index,
        }));
        await fetch("/api/class-subjects", {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({ classId, subjects }),
        });
      }

      toast.success(editingClass ? "Class updated!" : "Class created!");
      queryClient.invalidateQueries({ queryKey: ["class-subjects"] });
      closeModal();
    } catch { /* handled by mutation */ }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // ──── Columns ────
  const columns: ColumnDef<ClassData>[] = [
    {
      accessorKey: "name",
      header: t("tableColumns.className"),
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <School className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="font-medium text-foreground">{row.original.name}</p>
            <p className="text-xs text-muted-foreground font-mono">{row.original.classId}</p>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "classNumber",
      header: t("tableColumns.classNumber"),
      cell: ({ getValue }) => (
        <Badge variant="outline" className="font-semibold text-xs">
          Class {getValue<number>()}
        </Badge>
      ),
    },
    {
      accessorKey: "isActive",
      header: t("tableColumns.status"),
      cell: ({ getValue }) => {
        const active = getValue<boolean>();
        return (
          <span className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
            active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
          )}>
            {active ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
            {active ? t("active") : t("inactive")}
          </span>
        );
      },
    },
    {
      id: "stats",
      header: t("tableColumns.statistics"),
      cell: ({ row }) => {
        const c = row.original._count;
        return (
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1" title="Students">
              <span className="font-semibold text-foreground">{c?.studentProfiles || 0}</span> {t("students")}
            </span>
            <span className="text-border">·</span>
            <span className="flex items-center gap-1" title="Subjects">
              <span className="font-semibold text-foreground">{c?.classSubjects || 0}</span> {t("subjects")}
            </span>
          </div>
        );
      },
    },
    {
      id: "actions",
      header: t("tableColumns.actions"),
      cell: ({ row }) => {
        const subjectCount = row.original._count?.classSubjects || 0;
        return (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => handleViewSubjects(row.original)} className="h-8 gap-1.5 text-xs">
              <Eye className="h-3.5 w-3.5" />
              {t("actions.subjects")}
              {subjectCount > 0 && (
                <Badge variant="secondary" className="ml-0.5 h-4 min-w-4 rounded-full px-1 text-[10px] leading-none">
                  {subjectCount}
                </Badge>
              )}
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(row.original)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(row.original.id)}>
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </div>
        );
      },
    },
  ];

  const classes = ("data" in (data || {})) ? (data as any).data : [];
  const pagination = ("pagination" in (data || {})) ? (data as any).pagination : undefined;

  // ──────────── RENDER ────────────
  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} icon={School}>
        <Button onClick={handleOpenNew}>
          <Plus className="mr-2 h-4 w-4" />
          {t("addClass")}
        </Button>
      </PageHeader>

      <DataTable
        columns={columns}
        data={classes}
        pagination={pagination}
        onPageChange={setPage}
        onSearch={setSearch}
        isLoading={isLoading}
        searchPlaceholder={t("searchPlaceholder")}
      />

      {/* ═══════════ Add/Edit Modal with Tabs ═══════════ */}
      <AppModal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingClass ? t("editClass") : t("addClass")}
        description={editingClass ? t("updateClass") : t("description")}
        maxWidth="2xl"
      >
        {/* Tab Bar */}
        <div className="flex border-b border-border -mx-1 mb-5">
          <button
            type="button"
            onClick={() => setActiveTab("details")}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
              activeTab === "details"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Layers className="h-4 w-4" />
            {t("tabDetails")}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("subjects")}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
              activeTab === "subjects"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <BookOpen className="h-4 w-4" />
            {t("tabSubjects")}
            {pendingSubjects.length > 0 && (
              <Badge variant="secondary" className="h-5 min-w-5 rounded-full px-1.5 text-[10px]">
                {pendingSubjects.length}
              </Badge>
            )}
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* ═══ Tab 1 — Class Details ═══ */}
          {activeTab === "details" && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t("className")}</label>
                <input
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Class 10"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t("classNumber")}</label>
                <input
                  type="number"
                  required
                  value={formData.classNumber}
                  onChange={(e) => {
                    setFormData({ ...formData, classNumber: e.target.value as any });
                    setClassNumberError("");
                  }}
                  placeholder="e.g., 10"
                  className={cn(
                    "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary",
                    classNumberError && "border-destructive focus:border-destructive focus:ring-destructive"
                  )}
                />
                {classNumberError && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <XCircle className="h-3 w-3" />
                    {classNumberError}
                  </p>
                )}
                {!classNumberError && (
                  <p className="text-xs text-muted-foreground">{t("enterUniqueClassNumber")}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t("status")}</label>
                <AppDropdown
                  value={formData.isActive ? "ACTIVE" : "INACTIVE"}
                  onChange={(val) => setFormData({ ...formData, isActive: val === "ACTIVE" })}
                  options={[
                    { value: "ACTIVE", label: t("active") },
                    { value: "INACTIVE", label: t("inactive") },
                  ]}
                />
              </div>
            </div>
          )}

          {/* ═══ Tab 2 — Subjects ═══ */}
          {activeTab === "subjects" && (
            <div className="space-y-4">
              {/* Available Subjects Grid */}
              <div>
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  {t("selectSubjects")} ({pendingSubjects.length} selected)
                </h4>
                <div className="grid gap-2 md:grid-cols-2 max-h-[50vh] overflow-y-auto pr-1">
                  {allSubjects.map((subject: any) => {
                    const isSelected = pendingSubjects.includes(subject.subjectId);
                    const isCompulsory = subjectTypeMap[subject.subjectId] ?? true;

                    return (
                      <div
                        key={subject.id}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer",
                          isSelected
                            ? "bg-primary/5 border-primary/30 ring-1 ring-primary/20"
                            : "bg-background hover:bg-muted/50 border-border"
                        )}
                        onClick={() => handleToggleSubject(subject.subjectId)}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary accent-primary pointer-events-none"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{subject.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-[10px] h-4 px-1.5">{subject.code}</Badge>
                            <Badge
                              variant={subject.category === "COMPULSORY" ? "default" : "secondary"}
                              className="text-[10px] h-4 px-1.5"
                            >
                              {subject.category}
                            </Badge>
                          </div>
                        </div>

                        {/* Compulsory/Elective Toggle */}
                        {isSelected && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTypeChange(subject.subjectId);
                            }}
                            className={cn(
                              "shrink-0 rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wider transition-colors",
                              isCompulsory
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-amber-100 text-amber-700"
                            )}
                          >
                            {isCompulsory ? t("compulsory") : t("elective")}
                          </button>
                        )}
                      </div>
                    );
                  })}

                  {allSubjects.length === 0 && (
                    <div className="col-span-2 text-center py-8 text-sm text-muted-foreground">
                      No subjects available. Create subjects first.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ═══ Footer ═══ */}
          <div className="flex items-center justify-between gap-3 pt-5 border-t mt-5">
            <p className="text-xs text-muted-foreground">
              {pendingSubjects.length > 0
                ? `${pendingSubjects.length} ${t("subjectsWillBeAssigned")}`
                : t("noSubjectsSelected")}
            </p>
            <div className="flex gap-3">
              <Button variant="outline" type="button" onClick={closeModal}>
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={isSaving} className="gap-2">
                <Save className="h-4 w-4" />
                {isSaving ? t("saving") : t("saveClassAndSubjects")}
              </Button>
            </div>
          </div>
        </form>
      </AppModal>

      {/* ═══════════ View Assigned Subjects Modal ═══════════ */}
      <AppModal
        isOpen={isViewSubjectsOpen}
        onClose={() => { setIsViewSubjectsOpen(false); setViewClass(null); setViewOnlySubjects([]); }}
        title={`${t("assignedSubjectsFor")} ${viewClass?.name || ""}`}
        maxWidth="lg"
      >
        <div className="pt-2">
          {viewOnlySubjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-12 w-12 rounded-xl bg-muted/50 flex items-center justify-center mb-3">
                <BookOpen className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">{t("noSubjectsAssigned")}</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Edit this class to assign subjects.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="border-b border-border text-left">
                    <th className="px-4 py-2.5 font-semibold text-foreground">{t("subjects")}</th>
                    <th className="px-4 py-2.5 font-semibold text-foreground text-center">{t("type")}</th>
                  </tr>
                </thead>
                <tbody>
                  {viewOnlySubjects.map((cs: any, i: number) => (
                    <tr key={cs.id || i} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10">
                            <BookOpen className="h-3.5 w-3.5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{cs.subject?.name || "Unknown"}</p>
                            <p className="text-xs text-muted-foreground">{cs.subject?.code || ""}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                          cs.isCompulsory
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700"
                        )}>
                          {cs.isCompulsory ? t("compulsory") : t("elective")}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </AppModal>
    </div>
  );
}
