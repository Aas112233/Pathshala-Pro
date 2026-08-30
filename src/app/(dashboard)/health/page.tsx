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
import { useHealthViewModel } from "@/viewmodels/health/use-health-view-model";
import { useAuth } from "@/components/providers/auth-provider";
import { hasPermission, getEffectivePermissions } from "@/lib/permissions";
import type { ColumnDef } from "@tanstack/react-table";
import { HeartPulse, Plus, Pencil, Trash2, Search } from "lucide-react";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];

export default function HealthPage() {
  const t = useTranslations("health");
  const tCommon = useTranslations("common");
  const common = useTranslations("common");
  const { user: authUser, isLoading: isAuthLoading } = useAuth();
  const perms = getEffectivePermissions(authUser?.role as string, (authUser as any)?.permissions, (authUser as any)?.accessLevel);
  const canRead = hasPermission(perms, "health", "read");
  const canWrite = hasPermission(perms, "health", "write");
  const canManage = hasPermission(perms, "health", "manage");

  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [formData, setFormData] = useState({
    studentProfileId: "",
    bloodGroup: "",
    allergies: "",
    chronicConditions: "",
    medications: "",
    heightCm: "",
    weightKg: "",
    visionLeft: "",
    visionRight: "",
    lastCheckupDate: "",
    remarks: "",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const { records, pagination, isLoading, createRecord, updateRecord, deleteRecord, isMutating } = useHealthViewModel(search, page);

  const { data: studentsData } = useQuery({
    queryKey: ["students-health"],
    queryFn: async () => {
      const r = await fetch("/api/students?limit=100", { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });
  const students = (studentsData as any)?.data ?? [];

  const openAdd = () => {
    setEditing(null);
    setFormData({ studentProfileId: "", bloodGroup: "", allergies: "", chronicConditions: "", medications: "", heightCm: "", weightKg: "", visionLeft: "", visionRight: "", lastCheckupDate: "", remarks: "" });
    setFormErrors({});
    setIsSheetOpen(true);
  };
  const openEdit = (rec: any) => {
    setEditing(rec);
    setFormData({
      studentProfileId: rec.studentProfileId || "",
      bloodGroup: rec.bloodGroup || "",
      allergies: rec.allergies || "",
      chronicConditions: rec.chronicConditions || "",
      medications: rec.medications || "",
      heightCm: rec.heightCm ? String(rec.heightCm) : "",
      weightKg: rec.weightKg ? String(rec.weightKg) : "",
      visionLeft: rec.visionLeft || "",
      visionRight: rec.visionRight || "",
      lastCheckupDate: rec.lastCheckupDate ? new Date(rec.lastCheckupDate).toISOString().slice(0, 10) : "",
      remarks: rec.remarks || "",
    });
    setFormErrors({});
    setIsSheetOpen(true);
  };
  const validate = () => {
    const e: Record<string, string> = {};
    if (!formData.studentProfileId) e.studentProfileId = tCommon("required");
    setFormErrors(e);
    return Object.keys(e).length === 0;
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const payload: any = {
      studentProfileId: formData.studentProfileId,
      bloodGroup: formData.bloodGroup || null,
      allergies: formData.allergies.trim() || null,
      chronicConditions: formData.chronicConditions.trim() || null,
      medications: formData.medications.trim() || null,
      heightCm: formData.heightCm ? parseFloat(formData.heightCm) : null,
      weightKg: formData.weightKg ? parseFloat(formData.weightKg) : null,
      visionLeft: formData.visionLeft.trim() || null,
      visionRight: formData.visionRight.trim() || null,
      lastCheckupDate: formData.lastCheckupDate || null,
      remarks: formData.remarks.trim() || null,
    };
    try {
      if (editing) await updateRecord(editing.id, payload);
      else await createRecord(payload);
      setIsSheetOpen(false);
    } catch {}
  };
  const handleDelete = async (id: string) => {
    if (!confirm(t("confirmDelete"))) return;
    try { await deleteRecord(id); } catch {}
  };

  const withAllergies = records.filter((r: any) => r.allergies).length;

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: "studentProfile",
      header: t("student"),
      cell: ({ row }) => {
        const s = row.original.studentProfile;
        return s ? <span className="text-sm font-medium">{s.firstName} {s.lastName} <span className="text-xs text-muted-foreground">({s.rollNumber})</span></span> : "—";
      },
    },
    {
      accessorKey: "bloodGroup",
      header: t("bloodGroup"),
      cell: ({ getValue }) => {
        const v = getValue() as string | null;
        return v ? <Badge variant="outline" className="text-xs font-mono">{v}</Badge> : <span className="text-muted-foreground text-xs">—</span>;
      },
    },
    {
      accessorKey: "allergies",
      header: t("allergies"),
      cell: ({ getValue }) => {
        const v = getValue() as string | null;
        return v ? <span className="text-xs truncate max-w-[150px] block" title={v}>{v}</span> : <span className="text-muted-foreground text-xs">—</span>;
      },
    },
    {
      accessorKey: "heightCm",
      header: "H/W",
      cell: ({ row }) => {
        const h = row.original.heightCm, w = row.original.weightKg;
        if (!h && !w) return <span className="text-muted-foreground text-xs">—</span>;
        return <span className="text-xs">{h ? `${h}cm` : ""} {w ? `${w}kg` : ""}</span>;
      },
    },
    {
      accessorKey: "visionLeft",
      header: "Vision",
      cell: ({ row }) => {
        const l = row.original.visionLeft, r = row.original.visionRight;
        if (!l && !r) return <span className="text-muted-foreground text-xs">—</span>;
        return <span className="text-xs">{l || "—"} / {r || "—"}</span>;
      },
    },
    {
      accessorKey: "lastCheckupDate",
      header: t("lastCheckupDate"),
      cell: ({ getValue }) => {
        const v = getValue() as string | null;
        return v ? new Date(v).toLocaleDateString() : <span className="text-muted-foreground text-xs">—</span>;
      },
    },
    {
      id: "actions",
      header: t("actions"),
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          {canWrite && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(row.original)}><Pencil className="h-3.5 w-3.5" /></Button>}
          {canManage && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(row.original.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} icon={HeartPulse}>
        {canWrite && <Button onClick={openAdd} className="gap-2"><Plus className="h-4 w-4" />{t("addRecord")}</Button>}
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
        <Card><CardContent className="pt-6 flex items-center gap-3"><div className="p-2 bg-primary/10 rounded-lg"><HeartPulse className="h-5 w-5 text-primary" /></div><div><p className="text-2xl font-bold">{(pagination as any)?.totalCount ?? records.length}</p><p className="text-xs text-muted-foreground">{t("totalRecords")}</p></div></CardContent></Card>
        <Card className={withAllergies > 0 ? "border-amber-200 bg-amber-50/50 dark:bg-amber-950/20" : ""}><CardContent className="pt-6 flex items-center gap-3"><div className="p-2 bg-amber-500/10 rounded-lg"><HeartPulse className="h-5 w-5 text-amber-600" /></div><div><p className="text-2xl font-bold text-amber-600">{withAllergies}</p><p className="text-xs text-amber-600">{t("withAllergies")}</p></div></CardContent></Card>
        <Card><CardContent className="pt-6 flex items-center gap-3"><div className="p-2 bg-emerald-500/10 rounded-lg"><HeartPulse className="h-5 w-5 text-emerald-600" /></div><div><p className="text-2xl font-bold text-emerald-600">{records.filter((r: any) => r.lastCheckupDate).length}</p><p className="text-xs text-emerald-600">{t("lastCheckup")}</p></div></CardContent></Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (setSearch(searchInput), setPage(1))} placeholder={t("searchPlaceholder")} className="pl-9" />
            </div>
            <Button variant="outline" onClick={() => { setSearch(searchInput); setPage(1); }}><Search className="h-4 w-4" /></Button>
          </div>
        </CardContent>
      </Card>

      <DataTable columns={columns as any} data={records} pagination={pagination} onPageChange={setPage} onSearch={(v) => { setSearch(v); setPage(1); }} isLoading={isLoading} searchPlaceholder={t("searchPlaceholder")} />
        </>
      )}

      <TopSheet isOpen={isSheetOpen} onClose={() => setIsSheetOpen(false)} title={editing ? t("editRecord") : t("addRecord")} description={t("description")} maxWidth="2xl" footer={<div className="flex justify-end gap-3 w-full"><Button variant="outline" type="button" onClick={() => setIsSheetOpen(false)}>{t("cancel")}</Button><Button type="submit" form="health-form" disabled={isMutating}>{t("save")}</Button></div>}>
        <form id="health-form" onSubmit={handleSubmit} className="space-y-6">
          <ERPFormSection title={t("healthDetails")}>
            <ERPFormGrid cols={2}>
              <ERPFormField label={t("student")} required error={formErrors.studentProfileId}>
                <AppDropdown value={formData.studentProfileId} onChange={(v) => setFormData((p) => ({ ...p, studentProfileId: v }))} options={students.map((s: any) => ({ value: s.id, label: `${s.firstName} ${s.lastName} (${s.rollNumber})` }))} placeholder={t("selectStudent")} searchable disabled={!!editing} />
              </ERPFormField>
              <ERPFormField label={t("bloodGroup")}>
                <AppDropdown value={formData.bloodGroup} onChange={(v) => setFormData((p) => ({ ...p, bloodGroup: v }))} options={BLOOD_GROUPS.map((bg) => ({ value: bg, label: bg }))} placeholder={t("selectBloodGroup")} />
              </ERPFormField>
              <ERPFormField label={t("allergies")}><Input value={formData.allergies} onChange={(e) => setFormData((p) => ({ ...p, allergies: e.target.value }))} placeholder={t("allergies")} /></ERPFormField>
              <ERPFormField label={t("chronicConditions")}><Input value={formData.chronicConditions} onChange={(e) => setFormData((p) => ({ ...p, chronicConditions: e.target.value }))} placeholder={t("chronicConditions")} /></ERPFormField>
              <ERPFormField label={t("medications")}><Input value={formData.medications} onChange={(e) => setFormData((p) => ({ ...p, medications: e.target.value }))} placeholder={t("medications")} /></ERPFormField>
              <ERPFormField label={t("height")}><Input type="number" step="0.1" value={formData.heightCm} onChange={(e) => setFormData((p) => ({ ...p, heightCm: e.target.value }))} placeholder={t("height")} /></ERPFormField>
              <ERPFormField label={t("weight")}><Input type="number" step="0.1" value={formData.weightKg} onChange={(e) => setFormData((p) => ({ ...p, weightKg: e.target.value }))} placeholder={t("weight")} /></ERPFormField>
              <ERPFormField label={t("visionLeft")}><Input value={formData.visionLeft} onChange={(e) => setFormData((p) => ({ ...p, visionLeft: e.target.value }))} placeholder={t("visionLeft")} /></ERPFormField>
              <ERPFormField label={t("visionRight")}><Input value={formData.visionRight} onChange={(e) => setFormData((p) => ({ ...p, visionRight: e.target.value }))} placeholder={t("visionRight")} /></ERPFormField>
              <ERPFormField label={t("lastCheckupDate")}><Input type="date" value={formData.lastCheckupDate} onChange={(e) => setFormData((p) => ({ ...p, lastCheckupDate: e.target.value }))} /></ERPFormField>
              <div className="col-span-2">
                <ERPFormField label={t("remarks")}><textarea value={formData.remarks} onChange={(e) => setFormData((p) => ({ ...p, remarks: e.target.value }))} placeholder={t("remarks")} rows={3} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" /></ERPFormField>
              </div>
            </ERPFormGrid>
          </ERPFormSection>
        </form>
      </TopSheet>
    </div>
  );
}

