"use client";

import { useState } from "react";
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
import { useEnquiriesViewModel } from "@/viewmodels/enquiries/use-enquiries-view-model";
import { useAuth } from "@/components/providers/auth-provider";
import { hasPermission, getEffectivePermissions } from "@/lib/permissions";
import type { ColumnDef } from "@tanstack/react-table";
import {
  ClipboardList,
  Plus,
  Pencil,
  Trash2,
  CheckCircle,
  Search,
  Kanban,
  TableIcon,
  Phone,
  ArrowRight,
} from "lucide-react";

const STATUSES = ["NEW", "CONTACTED", "VISITED", "ADMITTED", "REJECTED"] as const;
const SOURCES = ["WALK_IN", "PHONE", "WEBSITE", "REFERRAL", "SOCIAL", "OTHER"] as const;

function statusColor(s: string) {
  switch (s) {
    case "NEW": return "bg-muted text-muted-foreground border-border";
    case "CONTACTED": return "bg-blue-50 text-blue-700 border-blue-200";
    case "VISITED": return "bg-amber-50 text-amber-700 border-amber-200";
    case "ADMITTED": return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "REJECTED": return "bg-rose-50 text-rose-700 border-rose-200";
    default: return "bg-muted text-muted-foreground";
  }
}

export default function EnquiriesPage() {
  const t = useTranslations("enquiries");
  const tCommon = useTranslations("common");
  const { user: authUser, isLoading: isAuthLoading } = useAuth();
  const perms = getEffectivePermissions(authUser?.role as string, (authUser as any)?.permissions, (authUser as any)?.accessLevel);
  const canRead = hasPermission(perms, "enquiries", "read");
  const canWrite = hasPermission(perms, "enquiries", "write");
  const canManage = hasPermission(perms, "enquiries", "manage");

  const {
    enquiries,
    pagination,
    isLoading,
    filters,
    setFilters,
    page,
    setPage,
    viewMode,
    setViewMode,
    createEnquiry,
    updateEnquiry,
    deleteEnquiry,
    convertEnquiry,
    isMutating,
  } = useEnquiriesViewModel();

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [searchInput, setSearchInput] = useState(filters.search);
  const [formData, setFormData] = useState({
    studentName: "",
    guardianName: "",
    phone: "",
    email: "",
    classAppliedId: "",
    source: "WALK_IN",
    status: "NEW",
    followUpDate: "",
    notes: "",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const { data: classesData } = useQuery({
    queryKey: ["classes-enquiries"],
    queryFn: async () => {
      const r = await fetch("/api/classes?limit=100", { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });
  const classes = (classesData as any)?.data ?? [];
  const classOptions = classes.map((c: any) => ({ value: c.id, label: c.name }));

  const openAdd = () => {
    setEditing(null);
    setFormData({ studentName: "", guardianName: "", phone: "", email: "", classAppliedId: "", source: "WALK_IN", status: "NEW", followUpDate: "", notes: "" });
    setFormErrors({});
    setIsSheetOpen(true);
  };
  const openEdit = (e: any) => {
    setEditing(e);
    setFormData({
      studentName: e.studentName || "",
      guardianName: e.guardianName || "",
      phone: e.phone || "",
      email: e.email || "",
      classAppliedId: e.classAppliedId || "",
      source: e.source || "WALK_IN",
      status: e.status || "NEW",
      followUpDate: e.followUpDate ? new Date(e.followUpDate).toISOString().slice(0, 10) : "",
      notes: e.notes || "",
    });
    setFormErrors({});
    setIsSheetOpen(true);
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!formData.studentName.trim()) errs.studentName = tCommon("required");
    if (!formData.guardianName.trim()) errs.guardianName = tCommon("required");
    if (!formData.phone.trim()) errs.phone = tCommon("required");
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const payload: any = {
      studentName: formData.studentName.trim(),
      guardianName: formData.guardianName.trim(),
      phone: formData.phone.trim(),
      email: formData.email.trim() || null,
      classAppliedId: formData.classAppliedId || null,
      source: formData.source,
      status: formData.status,
      followUpDate: formData.followUpDate || null,
      notes: formData.notes.trim() || null,
    };
    try {
      if (editing) await updateEnquiry(editing.id, payload);
      else await createEnquiry(payload);
      setIsSheetOpen(false);
      setEditing(null);
    } catch {}
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("confirmDelete"))) return;
    try { await deleteEnquiry(id); } catch {}
  };
  const handleConvert = async (id: string) => {
    try { await convertEnquiry(id); } catch {}
  };

  const handleSearch = () => setFilters({ search: searchInput });

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: "studentName",
      header: t("studentName"),
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.studentName}</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />{row.original.phone}</p>
        </div>
      ),
    },
    { accessorKey: "guardianName", header: t("guardianName") },
    {
      accessorKey: "classApplied",
      header: t("classApplied"),
      cell: ({ row }) => row.original.classApplied?.name || "—",
    },
    {
      accessorKey: "source",
      header: t("source"),
      cell: ({ getValue }) => <Badge variant="outline" className="text-xs">{String(getValue())}</Badge>,
    },
    {
      accessorKey: "status",
      header: t("status"),
      cell: ({ getValue }) => {
        const s = String(getValue());
        return <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold border ${statusColor(s)}`}>{s}</span>;
      },
    },
    {
      accessorKey: "followUpDate",
      header: t("followUpDate"),
      cell: ({ getValue }) => {
        const v = getValue() as string | null;
        if (!v) return <span className="text-muted-foreground">—</span>;
        const d = new Date(v);
        const overdue = d < new Date() && v;
        return <span className={overdue ? "text-rose-600 font-medium" : ""}>{d.toLocaleDateString()}</span>;
      },
    },
    {
      id: "actions",
      header: t("actions"),
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          {canWrite && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(row.original)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
          {row.original.status !== "ADMITTED" && canManage && (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-600" onClick={() => handleConvert(row.original.id)} title={t("convertToAdmission")}>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          )}
          {canManage && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(row.original.id)}>
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  // Kanban grouping
  const grouped = (() => {
    const g: Record<string, any[]> = {};
    for (const s of STATUSES) g[s] = [];
    for (const e of enquiries) {
      if (g[e.status]) g[e.status].push(e);
      else (g["NEW"] ??= []).push(e);
    }
    return g;
  })();

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} icon={ClipboardList}>
        {canWrite && (
          <Button onClick={openAdd} className="gap-2">
            <Plus className="h-4 w-4" />
            {t("addEnquiry")}
          </Button>
        )}
      </PageHeader>

      {!canRead && !isAuthLoading ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">{tCommon("noPermission")}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Filters */}
          <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[220px] flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder={t("searchPlaceholder")}
                  className="pl-9"
                />
              </div>
              <Button variant="outline" onClick={handleSearch}>{t("search")}</Button>
            </div>
            <AppDropdown
              value={filters.status}
              onChange={(v) => setFilters({ status: v })}
              options={[{ value: "", label: t("allStatuses") }, ...STATUSES.map((s) => ({ value: s, label: s }))]}
              placeholder={t("filterStatus")}
            />
            <AppDropdown
              value={filters.source}
              onChange={(v) => setFilters({ source: v })}
              options={[{ value: "", label: t("allSources") }, ...SOURCES.map((s) => ({ value: s, label: s.replace("_", " ") }))]}
              placeholder={t("filterSource")}
            />
            <div className="flex rounded-lg border p-1 gap-1">
              <Button variant={viewMode === "kanban" ? "secondary" : "ghost"} size="sm" onClick={() => setViewMode("kanban")} className="gap-1.5 h-7">
                <Kanban className="h-3.5 w-3.5" /> {t("kanban")}
              </Button>
              <Button variant={viewMode === "table" ? "secondary" : "ghost"} size="sm" onClick={() => setViewMode("table")} className="gap-1.5 h-7">
                <TableIcon className="h-3.5 w-3.5" /> {t("table")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      {isLoading ? (
        viewMode === "kanban" ? (
          <div className="grid gap-4 md:grid-cols-5">
            {STATUSES.map((s) => (
              <div key={s} className="space-y-3">
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="pt-6 space-y-3">
              <Skeleton className="h-8 w-full" />
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </CardContent>
          </Card>
        )
      ) : enquiries.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <ClipboardList className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm font-medium">{t("noEnquiries")}</p>
            <p className="text-xs text-muted-foreground mt-1">{t("noEnquiriesHint")}</p>
            {canWrite && <Button onClick={openAdd} className="mt-4 gap-2"><Plus className="h-4 w-4" />{t("addEnquiry")}</Button>}
          </CardContent>
        </Card>
      ) : viewMode === "kanban" ? (
        <div className="grid gap-4 md:grid-cols-5 items-start">
          {STATUSES.map((status) => (
            <div key={status} className="rounded-lg border bg-card">
              <div className={`px-3 py-2.5 border-b flex items-center justify-between rounded-t-xl ${statusColor(status)} bg-opacity-30`}>
                <span className="text-xs font-bold uppercase tracking-wider">{status}</span>
                <Badge variant="secondary" className="h-5 min-w-5 text-xs">{grouped[status]?.length || 0}</Badge>
              </div>
              <div className="p-2 space-y-2 min-h-[300px]">
                {(grouped[status] || []).map((e: any) => {
                  const overdue = e.followUpDate && new Date(e.followUpDate) < new Date() && e.status !== "ADMITTED" && e.status !== "REJECTED";
                  return (
                    <div key={e.id} className={`rounded-lg border p-3 bg-card hover:shadow-md transition-shadow ${overdue ? "border-amber-300 bg-amber-50/50 dark:bg-amber-950/20" : ""}`}>
                      <p className="text-sm font-semibold truncate">{e.studentName}</p>
                      <p className="text-xs text-muted-foreground truncate">{e.guardianName} · {e.phone}</p>
                      {e.classApplied && <p className="text-xs mt-1 flex items-center gap-1"><CheckCircle className="h-3 w-3 text-primary" />{e.classApplied.name}</p>}
                      <div className="flex items-center gap-1 mt-2 flex-wrap">
                        <Badge variant="outline" className="text-[10px] h-5">{e.source.replace("_", " ")}</Badge>
                        {overdue && <Badge className="bg-amber-500 text-white text-[10px] h-5">{t("followUpOverdue")}</Badge>}
                      </div>
                      <div className="flex items-center gap-1 mt-2">
                        {canWrite && <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(e)}><Pencil className="h-3 w-3" /></Button>}
                        {e.status !== "ADMITTED" && canManage && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-600" onClick={() => handleConvert(e.id)}><ArrowRight className="h-3 w-3" /></Button>
                        )}
                        {canManage && <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(e.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>}
                      </div>
                    </div>
                  );
                })}
                {(!grouped[status] || grouped[status].length === 0) && (
                  <p className="text-xs text-muted-foreground text-center py-8">—</p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={enquiries}
          pagination={pagination}
          onPageChange={setPage}
          onSearch={(v) => setFilters({ search: v })}
          isLoading={isLoading}
          searchPlaceholder={t("searchPlaceholder")}
        />
      )}
        </>
      )}

      {/* Form Sheet */}
      <TopSheet
        isOpen={isSheetOpen}
        onClose={() => { setIsSheetOpen(false); setEditing(null); }}
        title={editing ? t("editEnquiry") : t("addEnquiry")}
        description={t("description")}
        maxWidth="2xl"
        footer={
          <div className="flex justify-end gap-3 w-full">
            <Button variant="outline" type="button" onClick={() => { setIsSheetOpen(false); setEditing(null); }}>{t("cancel")}</Button>
            <Button type="submit" form="enquiry-form" disabled={isMutating}>{t("save")}</Button>
          </div>
        }
      >
        <form id="enquiry-form" onSubmit={handleSubmit} className="space-y-6">
          <ERPFormSection title={t("enquiryDetails")}>
            <ERPFormGrid cols={2}>
              <ERPFormField label={t("studentName")} required error={formErrors.studentName}>
                <Input value={formData.studentName} onChange={(e) => setFormData((p) => ({ ...p, studentName: e.target.value }))} placeholder={t("studentName")} />
              </ERPFormField>
              <ERPFormField label={t("guardianName")} required error={formErrors.guardianName}>
                <Input value={formData.guardianName} onChange={(e) => setFormData((p) => ({ ...p, guardianName: e.target.value }))} placeholder={t("guardianName")} />
              </ERPFormField>
              <ERPFormField label={t("phone")} required error={formErrors.phone}>
                <Input value={formData.phone} onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))} placeholder={t("phonePlaceholder")} />
              </ERPFormField>
              <ERPFormField label={t("email")}>
                <Input value={formData.email} onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))} placeholder={t("emailPlaceholder")} />
              </ERPFormField>
              <ERPFormField label={t("classApplied")}>
                <AppDropdown value={formData.classAppliedId} onChange={(v) => setFormData((p) => ({ ...p, classAppliedId: v }))} options={classOptions} placeholder={t("selectClass")} searchable />
              </ERPFormField>
              <ERPFormField label={t("source")}>
                <AppDropdown value={formData.source} onChange={(v) => setFormData((p) => ({ ...p, source: v }))} options={SOURCES.map((s) => ({ value: s, label: s.replace("_", " ") }))} placeholder={t("selectSource")} />
              </ERPFormField>
              <ERPFormField label={t("status")}>
                <AppDropdown value={formData.status} onChange={(v) => setFormData((p) => ({ ...p, status: v }))} options={STATUSES.map((s) => ({ value: s, label: s }))} placeholder={t("selectStatus")} />
              </ERPFormField>
              <ERPFormField label={t("followUpDate")}>
                <Input type="date" value={formData.followUpDate} onChange={(e) => setFormData((p) => ({ ...p, followUpDate: e.target.value }))} />
              </ERPFormField>
              <div className="col-span-2">
                <ERPFormField label={t("notes")}>
                  <textarea value={formData.notes} onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))} placeholder={t("notes")} rows={3} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                </ERPFormField>
              </div>
            </ERPFormGrid>
          </ERPFormSection>
        </form>
      </TopSheet>
    </div>
  );
}
