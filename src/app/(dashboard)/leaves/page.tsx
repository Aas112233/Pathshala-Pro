// @ts-nocheck
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
import { DataTable } from "@/components/shared/data-table";
import { useLeavesViewModel } from "@/viewmodels/leaves/use-leaves-view-model";
import { useAuth } from "@/components/providers/auth-provider";
import { hasPermission, getEffectivePermissions } from "@/lib/permissions";
import type { ColumnDef } from "@tanstack/react-table";
import { CalendarOff, Plus, Pencil, Trash2, Search, CheckCircle, XCircle, Clock, User, GraduationCap } from "lucide-react";

export default function LeavesPage() {
  const t = useTranslations("leaves");
  const tCommon = useTranslations("common");
  const common = useTranslations("common");
  const { user: authUser, isLoading: isAuthLoading } = useAuth();
  const perms = getEffectivePermissions(authUser?.role as string, (authUser as any)?.permissions, (authUser as any)?.accessLevel);
  const canRead = hasPermission(perms, "leaves", "read");
  const canWrite = hasPermission(perms, "leaves", "write");
  const canManage = hasPermission(perms, "leaves", "manage");

  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [applicantType, setApplicantType] = useState("STUDENT");
  const [page, setPage] = useState(1);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const [formData, setFormData] = useState({
    applicantType: "STUDENT" as "STUDENT" | "STAFF",
    applicantId: "",
    leaveType: "SICK",
    fromDate: "",
    toDate: "",
    reason: "",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const { leaves, pagination, isLoading, createLeave, updateLeave, deleteLeave, approveLeave, rejectLeave, isMutating } = useLeavesViewModel({
    search,
    status: statusFilter,
    applicantType: typeFilter || undefined,
    page,
  });

  const { data: studentsData } = useQuery({
    queryKey: ["students-leaves"],
    queryFn: async () => {
      const r = await fetch("/api/students?limit=100", { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });
  const { data: staffData } = useQuery({
    queryKey: ["staff-leaves"],
    queryFn: async () => {
      const r = await fetch("/api/staff?limit=100", { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });
  const students = (studentsData as any)?.data ?? [];
  const staffList = (staffData as any)?.data ?? [];

  const openAdd = () => {
    setEditing(null);
    setFormData({ applicantType: "STUDENT", applicantId: "", leaveType: "SICK", fromDate: new Date().toISOString().slice(0, 10), toDate: new Date().toISOString().slice(0, 10), reason: "" });
    setFormErrors({});
    setIsSheetOpen(true);
  };
  const openEdit = (l: any) => {
    setEditing(l);
    setFormData({
      applicantType: l.applicantType || "STUDENT",
      applicantId: l.studentProfileId || l.staffProfileId || "",
      leaveType: l.leaveType || "SICK",
      fromDate: l.fromDate ? new Date(l.fromDate).toISOString().slice(0, 10) : "",
      toDate: l.toDate ? new Date(l.toDate).toISOString().slice(0, 10) : "",
      reason: l.reason || "",
    });
    setFormErrors({});
    setIsSheetOpen(true);
  };
  const validate = () => {
    const e: Record<string, string> = {};
    if (!formData.applicantId) e.applicantId = tCommon("required");
    if (!formData.fromDate) e.fromDate = tCommon("required");
    if (!formData.toDate) e.toDate = tCommon("required");
    if (!formData.reason.trim()) e.reason = tCommon("required");
    setFormErrors(e);
    return Object.keys(e).length === 0;
  };
  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    const payload: any = {
      applicantType: formData.applicantType,
      leaveType: formData.leaveType,
      fromDate: new Date(formData.fromDate).toISOString(),
      toDate: new Date(formData.toDate).toISOString(),
      reason: formData.reason.trim(),
      ...(formData.applicantType === "STUDENT" ? { studentProfileId: formData.applicantId } : { staffProfileId: formData.applicantId }),
    };
    try {
      if (editing) await updateLeave(editing.id, payload);
      else await createLeave(payload);
      setIsSheetOpen(false);
    } catch {}
  };
  const handleDelete = async (id: string) => {
    if (!confirm(t("confirmDelete"))) return;
    try { await deleteLeave(id); } catch {}
  };

  const getDuration = (from: string, to: string) => {
    const days = Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / 86400000) + 1;
    return t("days", { count: String(days) });
  };

  const pendingCount = leaves.filter((l: any) => l.status === "PENDING").length;
  const approvedCount = leaves.filter((l: any) => l.status === "APPROVED").length;

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: "applicant",
      header: t("applicant"),
      cell: ({ row }) => {
        const l = row.original;
        const name = l.studentProfile ? `${l.studentProfile.firstName} ${l.studentProfile.lastName}` : l.staffProfile ? `${l.staffProfile.firstName} ${l.staffProfile.lastName}` : "—";
        const idNo = l.studentProfile?.rollNumber || l.staffProfile?.staffId || "";
        return (
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              {l.applicantType === "STUDENT" ? <GraduationCap className="h-4 w-4 text-primary" /> : <User className="h-4 w-4 text-primary" />}
            </div>
            <div>
              <p className="text-sm font-medium">{name}</p>
              <p className="text-xs text-muted-foreground">{l.applicantType} {idNo ? `· ${idNo}` : ""}</p>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "leaveType",
      header: t("leaveType"),
      cell: ({ getValue }) => <Badge variant="outline" className="text-xs">{String(getValue())}</Badge>,
    },
    {
      accessorKey: "fromDate",
      header: t("duration"),
      cell: ({ row }) => (
        <div className="text-xs">
          <p>{new Date(row.original.fromDate).toLocaleDateString()} → {new Date(row.original.toDate).toLocaleDateString()}</p>
          <p className="text-muted-foreground">{getDuration(row.original.fromDate, row.original.toDate)}</p>
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: t("status"),
      cell: ({ getValue }) => {
        const s = String(getValue());
        const cls = s === "PENDING" ? "bg-amber-50 text-amber-700 border-amber-200" : s === "APPROVED" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200";
        return <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold border ${cls}`}>{s}</span>;
      },
    },
    {
      accessorKey: "reason",
      header: t("reason"),
      cell: ({ getValue }) => <span className="text-xs truncate max-w-[200px] block">{String(getValue())}</span>,
    },
    {
      id: "actions",
      header: t("actions"),
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          {row.original.status === "PENDING" && canManage && (
            <>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-600" onClick={() => approveLeave(row.original.id)} title={t("approve")}><CheckCircle className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600" onClick={() => rejectLeave(row.original.id)} title={t("reject")}><XCircle className="h-3.5 w-3.5" /></Button>
            </>
          )}
          {canWrite && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(row.original)}><Pencil className="h-3.5 w-3.5" /></Button>}
          {canManage && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(row.original.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} icon={CalendarOff}>
        {canWrite && <Button onClick={openAdd} className="gap-2"><Plus className="h-4 w-4" />{t("applyLeave")}</Button>}
      </PageHeader>

      {!canRead && !isAuthLoading ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">{common("noPermission")}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
        <Card><CardContent className="pt-6 flex items-center gap-3"><div className="p-2 bg-primary/10 rounded-lg"><CalendarOff className="h-5 w-5 text-primary" /></div><div><p className="text-2xl font-bold">{(pagination as any)?.totalCount ?? leaves.length}</p><p className="text-xs text-muted-foreground">{t("totalLeaves")}</p></div></CardContent></Card>
        <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20"><CardContent className="pt-6 flex items-center gap-3"><div className="p-2 bg-amber-500/10 rounded-lg"><Clock className="h-5 w-5 text-amber-600" /></div><div><p className="text-2xl font-bold text-amber-600">{pendingCount}</p><p className="text-xs text-amber-600">{t("pendingLeaves")}</p></div></CardContent></Card>
        <Card className="border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20"><CardContent className="pt-6 flex items-center gap-3"><div className="p-2 bg-emerald-500/10 rounded-lg"><CheckCircle className="h-5 w-5 text-emerald-600" /></div><div><p className="text-2xl font-bold text-emerald-600">{approvedCount}</p><p className="text-xs text-emerald-600">{t("approvedLeaves")}</p></div></CardContent></Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && setSearch(searchInput)} placeholder={t("searchPlaceholder")} className="pl-9" />
            </div>
            <AppDropdown value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }} options={[{ value: "", label: t("allStatuses") }, { value: "PENDING", label: t("pending") }, { value: "APPROVED", label: t("approved") }, { value: "REJECTED", label: t("rejected") }]} placeholder={t("filterStatus")} />
            <AppDropdown value={typeFilter} onChange={(v) => { setTypeFilter(v); setPage(1); }} options={[{ value: "", label: t("allTypes") }, { value: "SICK", label: t("sick") }, { value: "CASUAL", label: t("casual") }, { value: "EMERGENCY", label: t("emergency") }, { value: "OTHER", label: t("other") }]} placeholder={t("filterType")} />
            <Button variant="outline" onClick={() => { setSearch(searchInput); setPage(1); }}><Search className="h-4 w-4" /></Button>
          </div>
        </CardContent>
      </Card>

      <DataTable columns={columns as any} data={leaves} pagination={pagination} onPageChange={setPage} onSearch={(v) => { setSearch(v); setPage(1); }} isLoading={isLoading} searchPlaceholder={t("searchPlaceholder")} />
        </>
      )}

      <TopSheet isOpen={isSheetOpen} onClose={() => setIsSheetOpen(false)} title={editing ? t("leaveDetails") : t("applyLeave")} description={t("description")} maxWidth="2xl" footer={<div className="flex justify-end gap-3 w-full"><Button variant="outline" type="button" onClick={() => setIsSheetOpen(false)}>{t("cancel")}</Button><Button type="submit" form="leave-form" disabled={isMutating}>{t("save")}</Button></div>}>
        <form id="leave-form" onSubmit={handleSubmit} className="space-y-6">
          <ERPFormSection>
            <ERPFormGrid cols={2}>
              <ERPFormField label={t("applicantType")} required>
                <AppDropdown value={formData.applicantType} onChange={(v) => setFormData((p) => ({ ...p, applicantType: v as any, applicantId: "" }))} options={[{ value: "STUDENT", label: t("student") }, { value: "STAFF", label: t("staff") }]} />
              </ERPFormField>
              <ERPFormField label={t("applicant")} required error={formErrors.applicantId}>
                {formData.applicantType === "STUDENT" ? (
                  <AppDropdown value={formData.applicantId} onChange={(v) => setFormData((p) => ({ ...p, applicantId: v }))} options={students.map((s: any) => ({ value: s.id, label: `${s.firstName} ${s.lastName} (${s.rollNumber})` }))} placeholder={t("selectApplicant")} searchable />
                ) : (
                  <AppDropdown value={formData.applicantId} onChange={(v) => setFormData((p) => ({ ...p, applicantId: v }))} options={staffList.map((s: any) => ({ value: s.id, label: `${s.firstName} ${s.lastName} (${s.staffId})` }))} placeholder={t("selectApplicant")} searchable />
                )}
              </ERPFormField>
              <ERPFormField label={t("leaveType")} required>
                <AppDropdown value={formData.leaveType} onChange={(v) => setFormData((p) => ({ ...p, leaveType: v }))} options={[{ value: "SICK", label: t("sick") }, { value: "CASUAL", label: t("casual") }, { value: "EMERGENCY", label: t("emergency") }, { value: "OTHER", label: t("other") }]} />
              </ERPFormField>
              <div />
              <ERPFormField label={t("fromDate")} required error={formErrors.fromDate}><Input type="date" value={formData.fromDate} onChange={(e) => setFormData((p) => ({ ...p, fromDate: e.target.value }))} /></ERPFormField>
              <ERPFormField label={t("toDate")} required error={formErrors.toDate}><Input type="date" value={formData.toDate} onChange={(e) => setFormData((p) => ({ ...p, toDate: e.target.value }))} /></ERPFormField>
              <div className="col-span-2">
                <ERPFormField label={t("reason")} required error={formErrors.reason}><textarea value={formData.reason} onChange={(e) => setFormData((p) => ({ ...p, reason: e.target.value }))} placeholder={t("reason")} rows={3} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" /></ERPFormField>
              </div>
            </ERPFormGrid>
          </ERPFormSection>
        </form>
      </TopSheet>
    </div>
  );
}

