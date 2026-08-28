"use client";

import { useState, useRef } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AppDropdown } from "@/components/ui/app-dropdown";
import { TopSheet } from "@/components/ui/top-sheet";
import { ERPFormSection, ERPFormGrid, ERPFormField } from "@/components/ui/erp-form-layout";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable } from "@/components/shared/data-table";
import { useHomeworkViewModel } from "@/viewmodels/homework/use-homework-view-model";
import { useAuth } from "@/components/providers/auth-provider";
import { hasPermission } from "@/lib/permissions";
import { useSubmitGuard } from "@/hooks/use-submit-guard";
import type { ColumnDef } from "@tanstack/react-table";
import {
  ClipboardPen,
  Plus,
  Pencil,
  Trash2,
  Search,
  Calendar,
  Clock,
  CheckCircle,
  Eye,
  Upload,
  FileText,
  Paperclip,
  AlertTriangle,
  Megaphone,
  ExternalLink,
  X,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

export default function HomeworkPage() {
  const t = useTranslations("homework");
  const { user } = useAuth();
  const canManage =
    user?.role === "ADMIN" ||
    user?.role === "SUPER_ADMIN" ||
    (!!user && hasPermission(user.permissions, "homework", "write"));

  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [page, setPage] = useState(1);

  // Form states
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [formData, setFormData] = useState({
    classId: "",
    sectionId: "",
    subjectId: "",
    title: "",
    description: "",
    dueDate: "",
    attachmentUrl: "",
    broadcastNotice: true,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Submissions state
  const [viewSubmissions, setViewSubmissions] = useState<any | null>(null);
  const [submissionFilter, setSubmissionFilter] = useState<"ALL" | "PENDING" | "GRADED">("ALL");
  const [gradeData, setGradeData] = useState({ grade: "", remarks: "" });
  const [gradingId, setGradingId] = useState<string | null>(null);

  const { run: runHomeworkSubmit, isPending: isGuardedHw } = useSubmitGuard();
  const { run: runGradeSubmit, isPending: isGuardedGrade } = useSubmitGuard();

  const {
    homeworks,
    pagination,
    isLoading,
    createHomework,
    updateHomework,
    deleteHomework,
    isMutating,
  } = useHomeworkViewModel({ classId: classFilter, search, page });

  const { data: classesData } = useQuery({
    queryKey: ["classes-homework"],
    queryFn: async () => {
      const r = await fetch("/api/classes?limit=100", { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });

  const { data: subjectsData } = useQuery({
    queryKey: ["subjects-homework"],
    queryFn: async () => {
      const r = await fetch("/api/subjects", { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });

  const classes = (classesData as any)?.data ?? [];
  const subjects = (subjectsData as any)?.data ?? [];

  // Fetch submissions for active homework
  const {
    data: submissionsData,
    isLoading: isSubLoading,
    refetch: refetchSubs,
  } = useQuery({
    queryKey: ["homework-submissions", viewSubmissions?.id],
    queryFn: async () => {
      if (!viewSubmissions) return { data: [] };
      const r = await fetch(`/api/homeworks/${viewSubmissions.id}/submissions`, {
        credentials: "include",
      });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    enabled: !!viewSubmissions,
  });
  const rawSubmissions = (submissionsData as any)?.data ?? [];

  const openAdd = () => {
    setEditing(null);
    setFormData({
      classId: "",
      sectionId: "",
      subjectId: "",
      title: "",
      description: "",
      dueDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      attachmentUrl: "",
      broadcastNotice: true,
    });
    setUploadedFileName("");
    setFormErrors({});
    setIsSheetOpen(true);
  };

  const openEdit = (hw: any) => {
    setEditing(hw);
    setFormData({
      classId: hw.classId || "",
      sectionId: hw.sectionId || "",
      subjectId: hw.subjectId || "",
      title: hw.title || "",
      description: hw.description || "",
      dueDate: hw.dueDate ? new Date(hw.dueDate).toISOString().slice(0, 10) : "",
      attachmentUrl: hw.attachmentUrl || "",
      broadcastNotice: false,
    });
    setUploadedFileName(hw.attachmentUrl ? "Attached Worksheet" : "");
    setFormErrors({});
    setIsSheetOpen(true);
  };

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    const toastId = toast.loading("Uploading worksheet to Cloudflare R2...");
    try {
      const data = new FormData();
      data.append("file", file);
      data.append("fileType", "homework");

      const res = await fetch("/api/upload", {
        method: "POST",
        body: data,
        credentials: "include",
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Upload failed");
      }

      const fileUrl = json.data?.webViewLink || json.data?.fileId;
      setFormData((prev) => ({ ...prev, attachmentUrl: fileUrl }));
      setUploadedFileName(file.name);
      toast.success("Worksheet uploaded successfully!", { id: toastId });
    } catch (err: any) {
      console.error("Upload error:", err);
      toast.error(err.message || "Failed to upload worksheet", { id: toastId });
    } finally {
      setIsUploading(false);
    }
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!formData.classId) e.classId = "Class is required";
    if (!formData.title.trim()) e.title = "Title is required";
    if (!formData.description.trim()) e.description = "Instructions are required";
    if (!formData.dueDate) e.dueDate = "Due date is required";
    setFormErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const payload: any = {
      classId: formData.classId,
      sectionId: formData.sectionId || null,
      subjectId: formData.subjectId || null,
      title: formData.title.trim(),
      description: formData.description.trim(),
      dueDate: new Date(formData.dueDate).toISOString(),
      attachmentUrl: formData.attachmentUrl.trim() || null,
    };

    void runHomeworkSubmit(async () => {
      try {
        if (editing) {
          await updateHomework(editing.id, payload);
        } else {
          await createHomework(payload);

          // Auto-broadcast notice to noticeboard if checked
          if (formData.broadcastNotice) {
            try {
              const targetClass = classes.find((c: any) => c.id === formData.classId);
              const targetSubject = subjects.find((s: any) => s.id === formData.subjectId);

              await fetch("/api/notices", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                  title: `📝 New Assignment: ${formData.title.trim()}`,
                  content: `New homework assigned for ${targetClass?.name || "Class"} ${
                    targetSubject ? `(${targetSubject.name})` : ""
                  }.\n\nInstructions: ${formData.description.trim()}\nDue Date: ${new Date(
                    formData.dueDate
                  ).toLocaleDateString()}`,
                  category: "ACADEMIC",
                  targetAudience: "STUDENTS",
                  isPinned: false,
                  publishDate: new Date().toISOString(),
                }),
              });
            } catch {
              // Non-blocking notice creation
            }
          }
        }
        setIsSheetOpen(false);
      } catch {}
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("confirmDelete"))) return;
    try {
      await deleteHomework(id);
    } catch {}
  };

  const handleGrade = (submissionId: string, customGrade?: string, customRemarks?: string) => {
    const finalGrade = customGrade || gradeData.grade;
    const finalRemarks = customRemarks || gradeData.remarks;

    if (!finalGrade.trim()) {
      toast.error("Please enter or select a grade");
      return;
    }

    setGradingId(submissionId);
    void runGradeSubmit(async () => {
      try {
        const r = await fetch(`/api/homework-submissions/${submissionId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            grade: finalGrade,
            remarks: finalRemarks,
            status: "GRADED",
          }),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j.message);

        toast.success("Submission graded!");
        setGradeData({ grade: "", remarks: "" });
        setGradingId(null);
        refetchSubs();
      } catch (err: any) {
        toast.error(err.message || "Failed to grade submission");
        setGradingId(null);
      }
    });
  };

  const getUrgencyBadge = (dueDateString: string) => {
    const due = new Date(dueDateString);
    const now = new Date();
    const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return (
        <Badge variant="destructive" className="text-[10px] gap-1 font-mono">
          <AlertTriangle className="h-3 w-3" />
          Overdue ({Math.abs(diffDays)}d ago)
        </Badge>
      );
    }
    if (diffDays === 0) {
      return (
        <Badge className="bg-amber-500 hover:bg-amber-600 text-white text-[10px] gap-1 font-mono">
          <Clock className="h-3 w-3" />
          Due Today
        </Badge>
      );
    }
    if (diffDays <= 3) {
      return (
        <Badge className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] gap-1 font-mono">
          <Calendar className="h-3 w-3" />
          Due in {diffDays}d
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="text-[10px] gap-1 font-mono">
        <Calendar className="h-3 w-3" />
        Due in {diffDays}d
      </Badge>
    );
  };

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: "title",
      header: t("titleLabel"),
      cell: ({ row }) => (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-sm text-foreground">{row.original.title}</p>
            {row.original.attachmentUrl && (
              <a
                href={row.original.attachmentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:text-primary/80"
                title="View attached worksheet"
              >
                <Paperclip className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate max-w-[320px]">
            {row.original.description}
          </p>
        </div>
      ),
    },
    {
      accessorKey: "class",
      header: t("classLabel"),
      cell: ({ row }) => (
        <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-muted text-foreground">
          {row.original.class?.name || "—"}
        </span>
      ),
    },
    {
      accessorKey: "subject",
      header: t("subjectLabel"),
      cell: ({ row }) => (
        <span className="text-xs font-medium text-muted-foreground">
          {row.original.subject?.name || "—"}
        </span>
      ),
    },
    {
      accessorKey: "dueDate",
      header: t("dueDate"),
      cell: ({ row }) => (
        <div className="space-y-1">
          <div className="text-xs font-mono">{new Date(row.original.dueDate).toLocaleDateString()}</div>
          {getUrgencyBadge(row.original.dueDate)}
        </div>
      ),
    },
    {
      accessorKey: "_count",
      header: t("submissions"),
      cell: ({ row }) => {
        const count = row.original._count?.submissions ?? 0;
        return (
          <Badge variant="outline" className="text-xs font-mono gap-1">
            <CheckCircle className="h-3 w-3 text-emerald-600" />
            {count} Submissions
          </Badge>
        );
      },
    },
    {
      id: "actions",
      header: t("actions"),
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-primary hover:bg-primary/10"
            onClick={() => setViewSubmissions(row.original)}
            title="Review & Grade Submissions"
          >
            <Eye className="h-4 w-4" />
          </Button>
          {canManage && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => openEdit(row.original)}
                title="Edit Homework"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:bg-destructive/10"
                onClick={() => handleDelete(row.original.id)}
                title="Delete Homework"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  const overdueCount = homeworks.filter((h: any) => new Date(h.dueDate) < new Date()).length;
  const activeCount = homeworks.length - overdueCount;

  // Filtered submissions
  const filteredSubmissions = rawSubmissions.filter((s: any) => {
    if (submissionFilter === "PENDING") return s.status !== "GRADED";
    if (submissionFilter === "GRADED") return s.status === "GRADED";
    return true;
  });

  const gradedCount = rawSubmissions.filter((s: any) => s.status === "GRADED").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        icon={ClipboardPen}
      >
        {canManage && (
          <Button onClick={openAdd} className="gap-2">
            <Plus className="h-4 w-4" />
            {t("addHomework")}
          </Button>
        )}
      </PageHeader>

      {/* KPI Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="shadow-xs border-border">
          <CardContent className="pt-5 pb-5 flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-xl">
              <ClipboardPen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {(pagination as any)?.totalCount ?? homeworks.length}
              </p>
              <p className="text-xs text-muted-foreground font-medium">{t("totalHomework")}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-border">
          <CardContent className="pt-5 pb-5 flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 rounded-xl">
              <CheckCircle className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-600">{activeCount}</p>
              <p className="text-xs text-muted-foreground font-medium">Active Assignments</p>
            </div>
          </CardContent>
        </Card>

        <Card
          className={`shadow-xs ${
            overdueCount > 0
              ? "border-amber-200 bg-amber-50/40 dark:bg-amber-950/20"
              : "border-border"
          }`}
        >
          <CardContent className="pt-5 pb-5 flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 rounded-xl">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-600">{overdueCount}</p>
              <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                {t("overdue")}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card className="shadow-xs border-border">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && (setSearch(searchInput), setPage(1))
                }
                placeholder={t("searchPlaceholder")}
                className="pl-9 text-xs"
              />
            </div>
            <div className="w-56">
              <AppDropdown
                value={classFilter}
                onChange={(v) => {
                  setClassFilter(v);
                  setPage(1);
                }}
                options={[
                  { value: "", label: "All Classes" },
                  ...classes.map((c: any) => ({ value: c.id, label: c.name })),
                ]}
                placeholder={t("classLabel")}
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearch(searchInput);
                setPage(1);
              }}
              className="h-10 text-xs gap-1.5"
            >
              <Search className="h-3.5 w-3.5" />
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Homework Table */}
      <DataTable
        columns={columns as any}
        data={homeworks}
        pagination={pagination}
        onPageChange={setPage}
        onSearch={(v) => {
          setSearch(v);
          setPage(1);
        }}
        isLoading={isLoading}
        searchPlaceholder={t("searchPlaceholder")}
      />

      {/* Homework Form Sheet */}
      <TopSheet
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        title={editing ? t("editHomework") : t("addHomework")}
        description={t("description")}
        maxWidth="2xl"
        footer={
          <div className="flex justify-end gap-3 w-full">
            <Button
              variant="outline"
              type="button"
              onClick={() => setIsSheetOpen(false)}
            >
              {t("cancel")}
            </Button>
            <Button
              type="submit"
              form="homework-form"
              disabled={isMutating || isGuardedHw || isUploading}
              aria-busy={isMutating || isGuardedHw || undefined}
            >
              {isMutating || isGuardedHw ? "Publishing..." : t("save")}
            </Button>
          </div>
        }
      >
        <form id="homework-form" onSubmit={handleSubmit} className="space-y-6">
          <ERPFormSection>
            <ERPFormGrid cols={2}>
              <ERPFormField label={t("classLabel")} required error={formErrors.classId}>
                <AppDropdown
                  value={formData.classId}
                  onChange={(v) => setFormData((p) => ({ ...p, classId: v }))}
                  options={classes.map((c: any) => ({ value: c.id, label: c.name }))}
                  placeholder={t("selectClass")}
                  searchable
                />
              </ERPFormField>

              <ERPFormField label={t("subjectLabel")}>
                <AppDropdown
                  value={formData.subjectId}
                  onChange={(v) => setFormData((p) => ({ ...p, subjectId: v }))}
                  options={subjects.map((s: any) => ({
                    value: s.id,
                    label: `${s.name} (${s.code})`,
                  }))}
                  placeholder={t("selectSubject")}
                  searchable
                />
              </ERPFormField>

              <div className="col-span-2">
                <ERPFormField label={t("titleLabel")} required error={formErrors.title}>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
                    placeholder="e.g. Chapter 4: Photosynthesis & Cell Structure Questions"
                  />
                </ERPFormField>
              </div>

              <div className="col-span-2">
                <ERPFormField
                  label={t("descriptionLabel")}
                  required
                  error={formErrors.description}
                >
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, description: e.target.value }))
                    }
                    placeholder="Detailed instructions, reading page ranges, or specific assignment criteria..."
                    rows={4}
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary"
                  />
                </ERPFormField>
              </div>

              <ERPFormField label={t("dueDate")} required error={formErrors.dueDate}>
                <Input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData((p) => ({ ...p, dueDate: e.target.value }))}
                />
              </ERPFormField>

              {/* Direct R2 File Dropper */}
              <div className="col-span-2 space-y-2">
                <label className="text-xs font-semibold text-foreground">
                  Worksheet Attachment (PDF, Image, or DOCX)
                </label>

                {formData.attachmentUrl ? (
                  <div className="flex items-center justify-between p-3 rounded-xl border border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <FileText className="h-5 w-5 text-emerald-600 shrink-0" />
                      <span className="text-xs font-medium text-foreground truncate">
                        {uploadedFileName || formData.attachmentUrl}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={formData.attachmentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                      >
                        Preview <ExternalLink className="h-3 w-3" />
                      </a>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive"
                        onClick={() => {
                          setFormData((p) => ({ ...p, attachmentUrl: "" }));
                          setUploadedFileName("");
                        }}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-border/80 hover:border-primary/60 rounded-2xl p-6 text-center cursor-pointer transition-colors bg-muted/20"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,.doc"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file);
                      }}
                    />
                    {isUploading ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="h-6 w-6 text-primary animate-spin" />
                        <p className="text-xs font-medium text-muted-foreground">
                          Uploading to Cloudflare R2...
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1.5">
                        <div className="p-2.5 rounded-full bg-primary/10 text-primary mb-1">
                          <Upload className="h-4 w-4" />
                        </div>
                        <p className="text-xs font-bold text-foreground">
                          Click to upload worksheet attachment
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Supports PDF, JPG, PNG, DOCX up to 5MB
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Broadcast Notice Toggle */}
              {!editing && (
                <div className="col-span-2 pt-2 border-t border-border/50">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.broadcastNotice}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, broadcastNotice: e.target.checked }))
                      }
                      className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                    />
                    <div className="leading-tight">
                      <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Megaphone className="h-3.5 w-3.5 text-primary" />
                        Broadcast announcement to student noticeboard
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Automatically publishes a circular to this class on the institutional notice board
                      </p>
                    </div>
                  </label>
                </div>
              )}
            </ERPFormGrid>
          </ERPFormSection>
        </form>
      </TopSheet>

      {/* Submissions & Fast-Grading Modal */}
      <TopSheet
        isOpen={!!viewSubmissions}
        onClose={() => setViewSubmissions(null)}
        title={`${viewSubmissions?.title || ""} — Submissions`}
        description={`Review student work, grade assignments, and leave remarks.`}
        maxWidth="3xl"
      >
        <div className="space-y-4">
          {/* Header Stats & Filter Tabs */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-muted/40 border border-border">
            <div className="flex items-center gap-4">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Total Received</p>
                <p className="text-lg font-bold text-foreground">{rawSubmissions.length}</p>
              </div>
              <div className="h-8 w-px bg-border" />
              <div>
                <p className="text-xs text-muted-foreground font-medium">Graded</p>
                <p className="text-lg font-bold text-emerald-600">
                  {gradedCount} / {rawSubmissions.length}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 bg-background p-1 rounded-lg border border-border">
              <Button
                variant={submissionFilter === "ALL" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setSubmissionFilter("ALL")}
                className="h-7 text-xs"
              >
                All ({rawSubmissions.length})
              </Button>
              <Button
                variant={submissionFilter === "PENDING" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setSubmissionFilter("PENDING")}
                className="h-7 text-xs"
              >
                Pending ({rawSubmissions.length - gradedCount})
              </Button>
              <Button
                variant={submissionFilter === "GRADED" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setSubmissionFilter("GRADED")}
                className="h-7 text-xs"
              >
                Graded ({gradedCount})
              </Button>
            </div>
          </div>

          {isSubLoading ? (
            <div className="space-y-3" aria-busy="true">
              <Skeleton className="h-14 w-full rounded-xl" />
              <Skeleton className="h-14 w-full rounded-xl" />
              <Skeleton className="h-14 w-full rounded-xl" />
            </div>
          ) : filteredSubmissions.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-border rounded-2xl">
              <Calendar className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm font-semibold text-foreground">No submissions found</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Students will appear here once they turn in their homework.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredSubmissions.map((s: any) => (
                <Card key={s.id} className="border-border shadow-xs">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-sm text-foreground">
                            {s.studentProfile?.firstName} {s.studentProfile?.lastName}
                          </p>
                          <span className="text-xs font-mono text-muted-foreground">
                            Roll #{s.studentProfile?.rollNumber || "—"}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Submitted:{" "}
                          {s.submittedAt
                            ? new Date(s.submittedAt).toLocaleString()
                            : "Manual / Class Turn-in"}
                        </p>
                        {s.attachmentUrl && (
                          <a
                            href={s.attachmentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary font-semibold hover:underline mt-1"
                          >
                            <Paperclip className="h-3 w-3" /> View Submitted File
                          </a>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        <Badge
                          variant={
                            s.status === "GRADED"
                              ? "default"
                              : s.status === "LATE"
                              ? "destructive"
                              : "secondary"
                          }
                          className="text-xs"
                        >
                          {s.status}
                        </Badge>
                        {s.grade && (
                          <p className="text-base font-bold text-emerald-600 mt-1">
                            Grade: {s.grade}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Remarks display if graded */}
                    {s.remarks && (
                      <div className="p-2.5 rounded-lg bg-muted/50 text-xs text-muted-foreground italic border border-border/50">
                        &ldquo;{s.remarks}&rdquo;
                      </div>
                    )}

                    {/* Teacher Quick-Grade Panel */}
                    {canManage && (
                      <div className="pt-2 border-t border-border/60 space-y-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] font-semibold text-muted-foreground mr-1">
                            Quick Grade:
                          </span>
                          {["A+ (Outstanding)", "A (Excellent)", "B (Good)", "C (Pass)", "Needs Revision"].map(
                            (presetGrade) => (
                              <button
                                key={presetGrade}
                                type="button"
                                onClick={() => handleGrade(s.id, presetGrade.split(" ")[0])}
                                className="text-[11px] font-medium px-2 py-0.5 rounded-md border border-border bg-background hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition-colors"
                              >
                                {presetGrade}
                              </button>
                            )
                          )}
                        </div>

                        {/* Custom Grade & Remarks Input */}
                        <div className="flex gap-2 pt-1">
                          <Input
                            placeholder="Score / Grade"
                            value={gradingId === s.id ? gradeData.grade : ""}
                            onChange={(e) => {
                              setGradingId(s.id);
                              setGradeData((p) => ({ ...p, grade: e.target.value }));
                            }}
                            className="h-8 text-xs w-32"
                          />
                          <Input
                            placeholder="Custom feedback / remarks..."
                            value={gradingId === s.id ? gradeData.remarks : ""}
                            onChange={(e) => {
                              setGradingId(s.id);
                              setGradeData((p) => ({ ...p, remarks: e.target.value }));
                            }}
                            className="h-8 text-xs flex-1"
                          />
                          <Button
                            size="sm"
                            onClick={() => handleGrade(s.id)}
                            disabled={isGuardedGrade && gradingId === s.id}
                            aria-busy={(isGuardedGrade && gradingId === s.id) || undefined}
                            className="h-8 text-xs font-semibold px-3"
                          >
                            {isGuardedGrade && gradingId === s.id ? "Grading..." : "Save Grade"}
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </TopSheet>
    </div>
  );
}
