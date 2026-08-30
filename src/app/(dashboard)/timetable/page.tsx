// @ts-nocheck
"use client";

import { useState, useMemo } from "react";
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
import { useTimetableViewModel } from "@/viewmodels/timetable/use-timetable-view-model";
import { useAuth } from "@/components/providers/auth-provider";
import { hasPermission, getEffectivePermissions } from "@/lib/permissions";
import { useTenantSettings } from "@/components/providers/tenant-settings-provider";
import { usePDFExport } from "@/hooks/use-pdf-export";
import { toast } from "sonner";
import {
  CalendarRange,
  Plus,
  Pencil,
  Trash2,
  Printer,
  Clock,
  BookOpen,
  User,
  MapPin,
  Coffee,
} from "lucide-react";

const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"] as const;
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];

export default function TimetablePage() {
  const t = useTranslations("timetable");
  const tCommon = useTranslations("common");
  const { user: authUser, isLoading: isAuthLoading } = useAuth();
  const perms = getEffectivePermissions(authUser?.role as string, (authUser as any)?.permissions, (authUser as any)?.accessLevel);
  const canRead = hasPermission(perms, "timetable", "read");
  const canWrite = hasPermission(perms, "timetable", "write");
  const canManage = hasPermission(perms, "timetable", "manage");

  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSection, setSelectedSection] = useState("");
  const [selectedYear, setSelectedYear] = useState("");

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<any | null>(null);
  const [formData, setFormData] = useState({
    dayOfWeek: "MONDAY" as string,
    periodNumber: 1,
    startTime: "08:00",
    endTime: "08:45",
    subjectId: "",
    staffProfileId: "",
    roomNumber: "",
    isBreak: false,
    breakLabel: "",
  });

  // Masters for dropdowns
  const { data: classesData } = useQuery({
    queryKey: ["classes-all-timetable"],
    queryFn: async () => {
      const r = await fetch("/api/classes?limit=100", { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch classes");
      return r.json();
    },
  });
  const { data: sectionsData } = useQuery({
    queryKey: ["sections-all-timetable", selectedClass],
    queryFn: async () => {
      if (!selectedClass) return { data: [] };
      const r = await fetch(`/api/sections?limit=100&classId=${selectedClass}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch sections");
      return r.json();
    },
    enabled: !!selectedClass,
  });
  const { data: yearsData } = useQuery({
    queryKey: ["academic-years-timetable"],
    queryFn: async () => {
      const r = await fetch("/api/academic-years?limit=100", { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch years");
      return r.json();
    },
  });
  const { data: subjectsData } = useQuery({
    queryKey: ["subjects-all-timetable"],
    queryFn: async () => {
      const r = await fetch("/api/subjects", { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch subjects");
      return r.json();
    },
  });
  const { data: staffData } = useQuery({
    queryKey: ["staff-all-timetable"],
    queryFn: async () => {
      const r = await fetch("/api/staff?limit=100", { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch staff");
      return r.json();
    },
  });

  const classes = (classesData as any)?.data ?? [];
  const sections = (sectionsData as any)?.data ?? [];
  const academicYears = (yearsData as any)?.data ?? [];
  const subjects = (subjectsData as any)?.data ?? [];
  const staffList = (staffData as any)?.data ?? [];

  const { entries, isLoading, createEntry, updateEntry, deleteEntry, isMutating } =
    useTimetableViewModel({
      classId: selectedClass,
      sectionId: selectedSection || undefined,
      academicYearId: selectedYear || undefined,
    });

  const { settings } = useTenantSettings();
  const { exportTimetablePDF } = usePDFExport();

  const handlePrintPDF = async () => {
    if (!selectedClass) { toast.error(t("selectClass")); return; }
    const klass = classes.find((c:any)=>c.id===selectedClass);
    const section = sections.find((s:any)=>s.id===selectedSection);
    const year = academicYears.find((y:any)=>y.id===selectedYear);
    const school = { name: settings.name||"Pathshala Pro School", address: settings.address||"", phone: settings.phone||"", email: settings.email||"", logoUrl: settings.logoUrl };
    // Derive periods meta from entries
    const periodMap = new Map<number, any>();
    for (const e of entries) if (!periodMap.has(e.periodNumber)) periodMap.set(e.periodNumber, { periodNumber: e.periodNumber, startTime: e.startTime, endTime: e.endTime, isBreak: e.isBreak, breakLabel: e.breakLabel });
    const periods = Array.from(periodMap.values()).sort((a,b)=>a.periodNumber-b.periodNumber);
    // If no entries, still allow empty timetable with default periods 1-8
    const effPeriods = periods.length>0? periods: [1,2,3,4,5,6,7,8].map(n=>({periodNumber:n, startTime:`${7+n}:00`, endTime:`${7+n}:45`}));
    const data:any = {
      className: klass?.name || "Class",
      sectionName: section?.name,
      academicYear: year?.label,
      entries: entries.map((e:any)=>({
        dayOfWeek: e.dayOfWeek, periodNumber: e.periodNumber, startTime: e.startTime, endTime: e.endTime,
        subjectName: e.subject?.name, subjectCode: e.subject?.code, staffName: e.staffProfile?`${e.staffProfile.firstName} ${e.staffProfile.lastName}`:undefined,
        roomNumber: e.roomNumber, isBreak: e.isBreak, breakLabel: e.breakLabel,
      })),
      periods: effPeriods,
    };
    const res = await exportTimetablePDF(school, data, new Date().toLocaleDateString());
    if(res.success) toast.success("Timetable PDF downloaded"); else toast.error("Failed");
  };

  const entriesBySlot = useMemo(() => {
    const m = new Map<string, any>();
    for (const e of entries) {
      m.set(`${e.dayOfWeek}-${e.periodNumber}`, e);
    }
    return m;
  }, [entries]);

  const openAdd = (day: string, period: number) => {
    setEditingEntry(null);
    setFormData({
      dayOfWeek: day,
      periodNumber: period,
      startTime: "08:00",
      endTime: "08:45",
      subjectId: "",
      staffProfileId: "",
      roomNumber: "",
      isBreak: false,
      breakLabel: "",
    });
    setIsSheetOpen(true);
  };

  const openEdit = (entry: any) => {
    setEditingEntry(entry);
    setFormData({
      dayOfWeek: entry.dayOfWeek,
      periodNumber: entry.periodNumber,
      startTime: entry.startTime,
      endTime: entry.endTime,
      subjectId: entry.subjectId || "",
      staffProfileId: entry.staffProfileId || "",
      roomNumber: entry.roomNumber || "",
      isBreak: entry.isBreak || false,
      breakLabel: entry.breakLabel || "",
    });
    setIsSheetOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("confirmDelete"))) return;
    try {
      await deleteEntry(id);
    } catch {}
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClass) {
      toast.error(t("selectClass"));
      return;
    }
    const payload: any = {
      classId: selectedClass,
      sectionId: selectedSection || null,
      academicYearId: selectedYear || null,
      dayOfWeek: formData.dayOfWeek,
      periodNumber: Number(formData.periodNumber),
      startTime: formData.startTime,
      endTime: formData.endTime,
      isBreak: formData.isBreak,
      breakLabel: formData.isBreak ? formData.breakLabel || t("break") : null,
      subjectId: formData.isBreak ? null : formData.subjectId || null,
      staffProfileId: formData.isBreak ? null : formData.staffProfileId || null,
      roomNumber: formData.roomNumber || null,
    };

    try {
      if (editingEntry) {
        await updateEntry(editingEntry.id, payload);
      } else {
        await createEntry(payload);
      }
      setIsSheetOpen(false);
      setEditingEntry(null);
    } catch {}
  };

  const dayLabel = (d: string) => {
    const map: Record<string, string> = {
      MONDAY: t("dayMonday"),
      TUESDAY: t("dayTuesday"),
      WEDNESDAY: t("dayWednesday"),
      THURSDAY: t("dayThursday"),
      FRIDAY: t("dayFriday"),
      SATURDAY: t("daySaturday"),
      SUNDAY: t("daySunday"),
    };
    return map[d] || d;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        icon={CalendarRange}
      >
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handlePrintPDF} className="gap-2" disabled={!selectedClass} title="Download vector A4 timetable (landscape)">
            <Printer className="h-4 w-4" />
            {t("print")} PDF
          </Button>
          <Button variant="ghost" size="sm" onClick={() => window.print()} className="gap-1 text-xs" title="Browser print">
            <Printer className="h-3 w-3" /> Print
          </Button>
          {canWrite && selectedClass && (
            <Button onClick={() => openAdd("MONDAY", 1)} className="gap-2">
              <Plus className="h-4 w-4" />
              {t("addPeriod")}
            </Button>
          )}
        </div>
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
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">{t("selectClass")}</label>
              <AppDropdown
                value={selectedClass}
                onChange={(v) => {
                  setSelectedClass(v);
                  setSelectedSection("");
                }}
                options={classes.map((c: any) => ({ value: c.id, label: c.name }))}
                placeholder={t("selectClass")}
                searchable
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">{t("selectSection")}</label>
              <AppDropdown
                value={selectedSection}
                onChange={setSelectedSection}
                options={[
                  { value: "", label: t("allSections") },
                  ...sections.map((s: any) => ({ value: s.id, label: s.name })),
                ]}
                placeholder={t("allSections")}
                disabled={!selectedClass}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">{t("selectYear")}</label>
              <AppDropdown
                value={selectedYear}
                onChange={setSelectedYear}
                options={[
                  { value: "", label: t("allSections") },
                  ...academicYears.map((y: any) => ({ value: y.id, label: y.label })),
                ]}
                placeholder={t("selectYear")}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {!selectedClass ? (
        <Card>
          <CardContent className="py-16 text-center">
            <CalendarRange className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm font-medium">{t("selectClass")}</p>
            <p className="text-xs text-muted-foreground mt-1">{t("noEntriesHint")}</p>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <Card>
          <CardContent className="pt-6 space-y-3" aria-busy="true">
            <Skeleton className="h-8 w-full" />
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider w-20">
                    <Clock className="h-3.5 w-3.5 inline mr-1" />
                    {t("periodNumber")}
                  </th>
                  {DAYS.map((d) => (
                    <th
                      key={d}
                      className="px-2 py-3 text-center text-xs font-semibold uppercase tracking-wider min-w-[150px]"
                    >
                      {dayLabel(d)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {PERIODS.map((p) => (
                  <tr key={p} className="hover:bg-muted/20">
                    <td className="px-3 py-2 text-center">
                      <Badge variant="outline" className="font-mono text-xs">
                        {t("periodWithNumber", { number: String(p) })}
                      </Badge>
                    </td>
                    {DAYS.map((d) => {
                      const entry = entriesBySlot.get(`${d}-${p}`);
                      if (!entry) {
                        return (
                          <td key={d} className="px-2 py-2 text-center">
                            {canWrite ? (
                              <button
                                onClick={() => openAdd(d, p)}
                                className="w-full rounded-lg border border-dashed border-border py-6 text-xs text-muted-foreground hover:bg-primary/5 hover:border-primary/30 hover:text-primary transition-colors"
                              >
                                <Plus className="h-4 w-4 mx-auto mb-1" />
                                {t("addPeriod")}
                              </button>
                            ) : (
                              <span className="text-xs text-muted-foreground/40">—</span>
                            )}
                          </td>
                        );
                      }
                      if (entry.isBreak) {
                        return (
                          <td key={d} className="px-2 py-2">
                            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 text-center group relative">
                              <Coffee className="h-4 w-4 mx-auto text-amber-600 mb-1" />
                              <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">
                                {entry.breakLabel || t("break")}
                              </p>
                              <p className="text-[11px] text-amber-600 dark:text-amber-400">
                                {entry.startTime} - {entry.endTime}
                              </p>
                              {(canWrite || canManage) && (
                                <div className="absolute top-1 right-1 hidden group-hover:flex gap-1">
                                  {canWrite && (
                                    <button
                                      onClick={() => openEdit(entry)}
                                      className="h-6 w-6 rounded bg-white shadow flex items-center justify-center hover:bg-muted"
                                    >
                                      <Pencil className="h-3 w-3" />
                                    </button>
                                  )}
                                  {canManage && (
                                    <button
                                      onClick={() => handleDelete(entry.id)}
                                      className="h-6 w-6 rounded bg-white shadow flex items-center justify-center hover:bg-destructive hover:text-white"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                        );
                      }
                      return (
                        <td key={d} className="px-2 py-2">
                          <div className="rounded-lg border border-border bg-card p-2.5 shadow-xs hover:shadow-md transition-shadow group relative">
                            <div className="flex items-start justify-between gap-1">
                              <p className="text-xs font-semibold truncate flex-1 flex items-center gap-1">
                                <BookOpen className="h-3 w-3 text-primary shrink-0" />
                                {entry.subject?.name || "—"}
                              </p>
                              {(canWrite || canManage) && (
                                <div className="hidden group-hover:flex gap-1 shrink-0">
                                  {canWrite && (
                                    <button
                                      onClick={() => openEdit(entry)}
                                      className="h-6 w-6 rounded bg-muted flex items-center justify-center hover:bg-primary hover:text-white"
                                    >
                                      <Pencil className="h-3 w-3" />
                                    </button>
                                  )}
                                  {canManage && (
                                    <button
                                      onClick={() => handleDelete(entry.id)}
                                      className="h-6 w-6 rounded bg-muted flex items-center justify-center hover:bg-destructive hover:text-white"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                            {entry.staffProfile && (
                              <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-1 truncate">
                                <User className="h-3 w-3 shrink-0" />
                                {entry.staffProfile.firstName} {entry.staffProfile.lastName}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              <span className="text-[11px] font-mono bg-muted px-1.5 py-0.5 rounded">
                                {entry.startTime} - {entry.endTime}
                              </span>
                              {entry.roomNumber && (
                                <span className="text-[11px] flex items-center gap-0.5 text-muted-foreground">
                                  <MapPin className="h-3 w-3" />
                                  {entry.roomNumber}
                                </span>
                              )}
                            </div>
                            {entry.subject?.code && (
                              <Badge variant="secondary" className="mt-1.5 text-[10px] h-4">
                                {entry.subject.code}
                              </Badge>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
        </>
      )}

      {/* Add/Edit Sheet */}
      <TopSheet
        isOpen={isSheetOpen}
        onClose={() => {
          setIsSheetOpen(false);
          setEditingEntry(null);
        }}
        title={editingEntry ? t("editPeriod") : t("addPeriod")}
        description={t("description")}
        maxWidth="2xl"
        footer={
          <div className="flex justify-end gap-3 w-full">
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                setIsSheetOpen(false);
                setEditingEntry(null);
              }}
            >
              {tCommon("cancel")}
            </Button>
            <Button type="submit" form="timetable-form" disabled={isMutating}>
              {editingEntry ? t("editPeriod") : t("addPeriod")}
            </Button>
          </div>
        }
      >
        <form id="timetable-form" onSubmit={handleSubmit} className="space-y-6">
          <ERPFormSection title={t("period")}>
            <ERPFormGrid cols={3}>
              <ERPFormField label={t("dayOfWeek")} required>
                <AppDropdown
                  value={formData.dayOfWeek}
                  onChange={(v) => setFormData((p) => ({ ...p, dayOfWeek: v }))}
                  options={DAYS.map((d) => ({ value: d, label: dayLabel(d) }))}
                />
              </ERPFormField>
              <ERPFormField label={t("periodNumber")} required>
                <Input
                  type="number"
                  min={1}
                  max={12}
                  value={formData.periodNumber}
                  onChange={(e) => setFormData((p) => ({ ...p, periodNumber: parseInt(e.target.value) || 1 }))}
                />
              </ERPFormField>
              <ERPFormField label={t("room")} >
                <Input
                  value={formData.roomNumber}
                  onChange={(e) => setFormData((p) => ({ ...p, roomNumber: e.target.value }))}
                  placeholder="101"
                />
              </ERPFormField>
            </ERPFormGrid>
            <ERPFormGrid cols={2}>
              <ERPFormField label={t("startTime")} required>
                <Input
                  type="time"
                  value={formData.startTime}
                  onChange={(e) => setFormData((p) => ({ ...p, startTime: e.target.value }))}
                />
              </ERPFormField>
              <ERPFormField label={t("endTime")} required>
                <Input
                  type="time"
                  value={formData.endTime}
                  onChange={(e) => setFormData((p) => ({ ...p, endTime: e.target.value }))}
                />
              </ERPFormField>
            </ERPFormGrid>
          </ERPFormSection>

          <ERPFormSection title={t("subject")}>
            <div className="flex items-center gap-2 mb-3">
              <input
                type="checkbox"
                id="isBreak"
                checked={formData.isBreak}
                onChange={(e) => setFormData((p) => ({ ...p, isBreak: e.target.checked }))}
                className="h-4 w-4 rounded"
              />
              <label htmlFor="isBreak" className="text-sm font-medium">
                {t("break")} / {t("tiffinBreak")}
              </label>
            </div>
            {formData.isBreak ? (
              <ERPFormField label={t("break")}>
                <Input
                  value={formData.breakLabel}
                  onChange={(e) => setFormData((p) => ({ ...p, breakLabel: e.target.value }))}
                  placeholder={t("tiffinBreak")}
                />
              </ERPFormField>
            ) : (
              <ERPFormGrid cols={2}>
                <ERPFormField label={t("subject")} required>
                  <AppDropdown
                    value={formData.subjectId}
                    onChange={(v) => setFormData((p) => ({ ...p, subjectId: v }))}
                    options={subjects.map((s: any) => ({ value: s.id, label: `${s.name} (${s.code})` }))}
                    placeholder={t("subject")}
                    searchable
                  />
                </ERPFormField>
                <ERPFormField label={t("teacher")}>
                  <AppDropdown
                    value={formData.staffProfileId}
                    onChange={(v) => setFormData((p) => ({ ...p, staffProfileId: v }))}
                    options={staffList.map((s: any) => ({ value: s.id, label: `${s.firstName} ${s.lastName} (${s.staffId})` }))}
                    placeholder={t("teacher")}
                    searchable
                  />
                </ERPFormField>
              </ERPFormGrid>
            )}
          </ERPFormSection>
        </form>
      </TopSheet>
    </div>
  );
}

