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
import { useCertificatesViewModel } from "@/viewmodels/certificates/use-certificates-view-model";
import { useAuth } from "@/components/providers/auth-provider";
import { hasPermission, getEffectivePermissions } from "@/lib/permissions";
import { useTenantSettings } from "@/components/providers/tenant-settings-provider";
import { usePDFExport } from "@/hooks/use-pdf-export";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { Award, Plus, Pencil, Trash2, Search, Printer, Ban, Eye } from "lucide-react";

const CERT_TYPES = ["TRANSFER", "CHARACTER", "BONAFIDE", "STUDY", "MARKSHEET", "OTHER"] as const;

export default function CertificatesPage() {
  const t = useTranslations("certificates");
  const tCommon = useTranslations("common");
  const { user: authUser, isLoading: isAuthLoading } = useAuth();
  const perms = getEffectivePermissions(authUser?.role as string, (authUser as any)?.permissions, (authUser as any)?.accessLevel);
  const canRead = hasPermission(perms, "certificates", "read");
  const canWrite = hasPermission(perms, "certificates", "write");
  const canManage = hasPermission(perms, "certificates", "manage");

  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [formData, setFormData] = useState({ studentProfileId: "", certificateType: "BONAFIDE", certificateNumber: "", issueDate: new Date().toISOString().slice(0, 10), validUntil: "", purpose: "", remarks: "" });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [printingId, setPrintingId] = useState<string | null>(null);

  const { certificates, pagination, isLoading, createCertificate, updateCertificate, deleteCertificate, revokeCertificate, isMutating } = useCertificatesViewModel(search, typeFilter, statusFilter, page);
  const { settings } = useTenantSettings();
  const { exportTransferCertificatePDF, exportCharacterCertificatePDF, exportBonafideCertificatePDF } = usePDFExport();

  const { data: studentsData } = useQuery({
    queryKey: ["students-certificates"],
    queryFn: async () => {
      const r = await fetch("/api/students?limit=100", { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });
  const students = (studentsData as any)?.data ?? [];

  const openAdd = () => {
    setEditing(null);
    setFormData({ studentProfileId: "", certificateType: "BONAFIDE", certificateNumber: "", issueDate: new Date().toISOString().slice(0, 10), validUntil: "", purpose: "", remarks: "" });
    setFormErrors({});
    setIsSheetOpen(true);
  };
  const openEdit = (c: any) => {
    setEditing(c);
    setFormData({
      studentProfileId: c.studentProfileId || "",
      certificateType: c.certificateType || "BONAFIDE",
      certificateNumber: c.certificateNumber || "",
      issueDate: c.issueDate ? new Date(c.issueDate).toISOString().slice(0, 10) : "",
      validUntil: c.validUntil ? new Date(c.validUntil).toISOString().slice(0, 10) : "",
      purpose: c.purpose || "",
      remarks: c.remarks || "",
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
      certificateType: formData.certificateType,
      certificateNumber: formData.certificateNumber.trim() || undefined,
      issueDate: formData.issueDate ? new Date(formData.issueDate).toISOString() : undefined,
      validUntil: formData.validUntil ? new Date(formData.validUntil).toISOString() : null,
      purpose: formData.purpose.trim() || null,
      remarks: formData.remarks.trim() || null,
    };
    try {
      if (editing) await updateCertificate(editing.id, payload);
      else await createCertificate(payload);
      setIsSheetOpen(false);
    } catch {}
  };
  const handleDelete = async (id: string) => {
    if (!confirm(t("confirmDelete"))) return;
    try { await deleteCertificate(id); } catch {}
  };
  const handleRevoke = async (id: string) => {
    if (!confirm(t("confirmRevoke"))) return;
    try { await revokeCertificate(id); } catch {}
  };
  const handlePrint = async (cert: any) => {
    // Resolve enriched student if needed
    const s = cert.studentProfile || {};
    const student = students.find((x: any) => x.id === cert.studentProfileId) || {};
    const school = {
      name: settings.name || "Pathshala Pro School",
      address: settings.address || "",
      phone: settings.phone || "",
      email: settings.email || "",
      logoUrl: settings.logoUrl,
    };
    const verificationUrl = typeof window !== "undefined" ? `${window.location.origin}/verify/certificate/${cert.id || cert.certificateNumber}` : undefined;
    const studentName = `${s.firstName || student.firstName || ""} ${s.lastName || student.lastName || ""}`.trim() || t("defaultStudent");
    const base = {
      certificateNumber: cert.certificateNumber,
      issueDate: cert.issueDate ? new Date(cert.issueDate).toLocaleDateString() : new Date().toLocaleDateString(),
      validUntil: cert.validUntil ? new Date(cert.validUntil).toLocaleDateString() : undefined,
      studentName,
      fatherName: s.fatherName || student.fatherName || student.guardianName || s.guardianName || undefined,
      admissionNumber: s.studentId || student.studentId || s.admissionNumber || cert.studentProfileId?.slice(0, 8) || "—",
      rollNumber: s.rollNumber || student.rollNumber || "—",
      className: s.class?.name || student.class?.name || s.className || "—",
      section: s.section?.name || student.section?.name || undefined,
      academicYear: cert.academicYear || (cert.issueDate ? String(new Date(cert.issueDate).getFullYear()) : String(new Date().getFullYear())),
      purpose: cert.purpose || cert.remarks || t("generalPurpose"),
      remarks: cert.remarks || undefined,
    };
    setPrintingId(cert.id);
    try {
      let result: any = null;
      const type = String(cert.certificateType || "BONAFIDE").toUpperCase();
      if (type === "TRANSFER") {
        const tcData: any = {
          ...base,
          admissionDate: student.admissionDate ? new Date(student.admissionDate).toLocaleDateString() : base.issueDate,
          leavingDate: base.validUntil || new Date().toLocaleDateString(),
          lastClassAttended: base.className,
          dateOfBirth: student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString() : undefined,
          reasonForLeaving: cert.purpose || cert.remarks || t("transferReason"),
          conduct: cert.remarks ? t("defaultConduct") : t("defaultConduct"),
          guardianName: student.guardianName || undefined,
        };
        result = await exportTransferCertificatePDF(school, tcData, verificationUrl);
      } else if (type === "CHARACTER") {
        const ccData: any = {
          ...base,
          sessionFrom: student.admissionDate ? new Date(student.admissionDate).toLocaleDateString() : base.academicYear,
          sessionTo: base.issueDate,
          conduct: cert.remarks?.split(",")[0] || t("defaultConduct"),
          characterRating: t("defaultCharacterRating"),
          attendancePercentage: undefined,
          achievements: cert.remarks || undefined,
        };
        result = await exportCharacterCertificatePDF(school, ccData, verificationUrl);
      } else {
        // BONAFIDE, STUDY, OTHER, MARKSHEET fallback to bonafide
        const bcData: any = {
          ...base,
          dateOfBirth: student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString() : undefined,
          guardianName: student.guardianName || s.guardianName || undefined,
          purpose: cert.purpose || t("defaultPurpose"),
        };
        result = await exportBonafideCertificatePDF(school, bcData, verificationUrl);
      }
      if (result?.success) toast.success(t("printSuccess"));
      else toast.error(t("printFailed"));
    } catch (e) {
      console.error(e);
      toast.error(t("printFailed"));
    } finally {
      setPrintingId(null);
    }
  };

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: "certificateNumber",
      header: t("certificateNumber"),
      cell: ({ row }) => <span className="font-mono text-sm font-semibold">{row.original.certificateNumber}</span>,
    },
    {
      accessorKey: "studentProfile",
      header: t("student"),
      cell: ({ row }) => {
        const s = row.original.studentProfile;
        return s ? <span className="text-sm font-medium">{s.firstName} {s.lastName} <span className="text-xs text-muted-foreground">({s.rollNumber})</span></span> : "—";
      },
    },
    {
      accessorKey: "certificateType",
      header: t("certificateType"),
      cell: ({ getValue }) => <Badge variant="outline" className="text-xs">{String(getValue()).replace("_", " ")}</Badge>,
    },
    {
      accessorKey: "issueDate",
      header: t("issueDate"),
      cell: ({ getValue }) => new Date(getValue() as string).toLocaleDateString(),
    },
    {
      accessorKey: "status",
      header: t("status"),
      cell: ({ getValue }) => {
        const s = String(getValue());
        const cls = s === "ISSUED" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : s === "REVOKED" ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-amber-50 text-amber-700 border-amber-200";
        return <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold border ${cls}`}>{s}</span>;
      },
    },
    {
      id: "actions",
      header: t("actions"),
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handlePrint(row.original)} title={t("print")} disabled={printingId === row.original.id}><Printer className="h-3.5 w-3.5" /></Button>
          {canManage && row.original.status === "ISSUED" && (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-600" onClick={() => handleRevoke(row.original.id)} title={t("revoke")}><Ban className="h-3.5 w-3.5" /></Button>
          )}
          {canWrite && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(row.original)}><Pencil className="h-3.5 w-3.5" /></Button>
          )}
          {canManage && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(row.original.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
          )}
        </div>
      ),
    },
  ];

  const totalIssued = certificates.filter((c: any) => c.status === "ISSUED").length;
  const totalRevoked = certificates.filter((c: any) => c.status === "REVOKED").length;

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} icon={Award}>
        {canWrite && <Button onClick={openAdd} className="gap-2"><Plus className="h-4 w-4" />{t("addCertificate")}</Button>}
      </PageHeader>

      {!canRead && !isAuthLoading ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">{tCommon("noPermission")}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
        <Card><CardContent className="pt-6 flex items-center gap-3"><div className="p-2 bg-primary/10 rounded-lg"><Award className="h-5 w-5 text-primary" /></div><div><p className="text-2xl font-bold">{(pagination as any)?.totalCount ?? certificates.length}</p><p className="text-xs text-muted-foreground">{t("totalCertificates")}</p></div></CardContent></Card>
        <Card className="border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20"><CardContent className="pt-6 flex items-center gap-3"><div className="p-2 bg-emerald-500/10 rounded-lg"><Award className="h-5 w-5 text-emerald-600" /></div><div><p className="text-2xl font-bold text-emerald-600">{totalIssued}</p><p className="text-xs text-emerald-600">{t("issuedCount")}</p></div></CardContent></Card>
        <Card className={totalRevoked > 0 ? "border-rose-200 bg-rose-50/50" : ""}><CardContent className="pt-6 flex items-center gap-3"><div className="p-2 bg-rose-500/10 rounded-lg"><Ban className="h-5 w-5 text-rose-600" /></div><div><p className="text-2xl font-bold text-rose-600">{totalRevoked}</p><p className="text-xs text-rose-600">{t("revokedCount")}</p></div></CardContent></Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (setSearch(searchInput), setPage(1))} placeholder={t("searchPlaceholder")} className="pl-9" />
            </div>
            <AppDropdown value={typeFilter} onChange={(v) => { setTypeFilter(v); setPage(1); }} options={[{ value: "", label: "All Types" }, ...CERT_TYPES.map((c) => ({ value: c, label: c.replace("_", " ") }))]} placeholder={t("certificateType")} />
            <AppDropdown value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }} options={[{ value: "", label: "All Statuses" }, { value: "ISSUED", label: t("issued") }, { value: "REVOKED", label: t("revoked") }, { value: "DRAFT", label: t("draft") }]} placeholder={t("status")} />
            <Button variant="outline" onClick={() => { setSearch(searchInput); setPage(1); }}><Search className="h-4 w-4" /></Button>
          </div>
        </CardContent>
      </Card>

      <DataTable columns={columns as any} data={certificates} pagination={pagination} onPageChange={setPage} onSearch={(v) => { setSearch(v); setPage(1); }} isLoading={isLoading} searchPlaceholder={t("searchPlaceholder")} />
        </>
      )}

      <TopSheet isOpen={isSheetOpen} onClose={() => setIsSheetOpen(false)} title={editing ? t("editCertificate") : t("addCertificate")} description={t("description")} maxWidth="2xl" footer={<div className="flex justify-end gap-3 w-full"><Button variant="outline" type="button" onClick={() => setIsSheetOpen(false)}>{t("cancel")}</Button><Button type="submit" form="cert-form" disabled={isMutating}>{t("save")}</Button></div>}>
        <form id="cert-form" onSubmit={handleSubmit} className="space-y-6">
          <ERPFormSection title={t("certificateDetails")}>
            <ERPFormGrid cols={2}>
              <ERPFormField label={t("student")} required error={formErrors.studentProfileId}>
                <AppDropdown value={formData.studentProfileId} onChange={(v) => setFormData((p) => ({ ...p, studentProfileId: v }))} options={students.map((s: any) => ({ value: s.id, label: `${s.firstName} ${s.lastName} (${s.rollNumber})` }))} placeholder={t("selectStudent")} searchable />
              </ERPFormField>
              <ERPFormField label={t("certificateType")} required>
                <AppDropdown value={formData.certificateType} onChange={(v) => setFormData((p) => ({ ...p, certificateType: v }))} options={CERT_TYPES.map((c) => ({ value: c, label: c.replace("_", " ") }))} />
              </ERPFormField>
              <ERPFormField label={t("certificateNumber")}><Input value={formData.certificateNumber} onChange={(e) => setFormData((p) => ({ ...p, certificateNumber: e.target.value }))} placeholder={t("certificateNumberPlaceholder")} /></ERPFormField>
              <ERPFormField label={t("issueDate")}><Input type="date" value={formData.issueDate} onChange={(e) => setFormData((p) => ({ ...p, issueDate: e.target.value }))} /></ERPFormField>
              <ERPFormField label={t("validUntil")}><Input type="date" value={formData.validUntil} onChange={(e) => setFormData((p) => ({ ...p, validUntil: e.target.value }))} /></ERPFormField>
              <ERPFormField label={t("purpose")}><Input value={formData.purpose} onChange={(e) => setFormData((p) => ({ ...p, purpose: e.target.value }))} placeholder={t("purpose")} /></ERPFormField>
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

