"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Layers,
  Plus,
  Pencil,
  Copy,
  RotateCcw,
  Trash2,
  X,
  Save,
  Loader2,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AppDropdown } from "@/components/ui/app-dropdown";
import { TopSheet } from "@/components/ui/top-sheet";
import { TableSkeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { CLASS_TEMPLATE_PRESETS } from "@/lib/schemas";
import type { TemplateClassDef } from "@/lib/onboarding-templates";
import { cn } from "@/lib/utils";

const BUILT_IN_CODES = CLASS_TEMPLATE_PRESETS as unknown as string[];

interface TemplateSummary {
  id: string;
  code: string;
  label: string | null;
  description: string | null;
  isActive: boolean;
  isBuiltIn: boolean;
  stats: { classes: number; sections: number; groups: number; subjects: number };
  updatedAt: string;
  version: number;
}

interface EditableSubject {
  name: string;
  code: string;
  type: "THEORY" | "PRACTICAL" | "BOTH";
  totalMarks: string;
  passMarks: string;
}

interface EditableGroup {
  name: string;
  shortName: string;
}

interface EditableClass {
  name: string;
  code: string;
  sequence: string;
  sectionsText: string;
  groups: EditableGroup[];
  subjects: EditableSubject[];
}

const SUBJECT_TYPES = ["THEORY", "PRACTICAL", "BOTH"];
const COUNTRIES = ["PK", "IN", "BD", "INTL"];
const CATEGORIES = ["NATIONAL", "INTERNATIONAL", "RELIGIOUS", "GENERIC"];

function toEditorClasses(classes: TemplateClassDef[]): EditableClass[] {
  return (classes ?? []).map((c: any) => ({
    name: c.name ?? "",
    code: c.code ?? "",
    sequence: String(c.sequence ?? 1),
    sectionsText: (c.sections ?? []).join(", "),
    groups: (c.groups ?? []).map((g: any) => ({
      name: g.name ?? "",
      shortName: g.shortName ?? "",
    })),
    subjects: (c.subjects ?? []).map((s: any) => ({
      name: s.name ?? "",
      code: s.code ?? "",
      type: (["THEORY", "PRACTICAL", "BOTH"] as string[]).includes(s.type) ? s.type : "THEORY",
      totalMarks: s.totalMarks != null ? String(s.totalMarks) : "",
      passMarks: s.passMarks != null ? String(s.passMarks) : "",
    })),
  }));
}

/** Editor state back to the API's override shape (subjectCodes default server-side). */
function toOverridePayload(classes: EditableClass[]) {
  return classes.map((c, idx) => ({
    name: c.name.trim(),
    code: c.code.trim(),
    sequence: parseInt(c.sequence, 10) || idx + 1,
    sections: c.sectionsText.split(",").map((s) => s.trim()).filter(Boolean),
    groups: c.groups
      .filter((g) => g.name.trim())
      .map((g) => ({ name: g.name.trim(), shortName: g.shortName.trim() || "GRP", subjects: [] as string[] })),
    subjects: c.subjects
      .filter((s) => s.name.trim() && s.code.trim())
      .map((s) => ({
        name: s.name.trim(),
        code: s.code.trim(),
        type: s.type,
        ...(s.totalMarks ? { totalMarks: parseInt(s.totalMarks, 10) } : {}),
        ...(s.passMarks ? { passMarks: parseInt(s.passMarks, 10) } : {}),
      })),
  }));
}

const blankClass = (): EditableClass => ({
  name: "",
  code: "",
  sequence: "1",
  sectionsText: "Section A, Section B",
  groups: [],
  subjects: [],
});

async function api(path: string, init?: RequestInit) {
  const res = await fetch(path, { credentials: "include", ...init });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    const details = Array.isArray(json?.error?.details) ? `: ${json.error.details[0]?.message}` : "";
    throw new Error(`${json.message || json.error?.message || "Request failed"}${details}`);
  }
  return json.data;
}

export default function OnboardingTemplatesPage() {
  const t = useTranslations("systemAdminPages");
  const tOnb = useTranslations("onboarding");
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(0);

  // Editor form state
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [country, setCountry] = useState("INTL");
  const [category, setCategory] = useState("GENERIC");
  const [currency, setCurrency] = useState("PKR");
  const [isActive, setIsActive] = useState(true);
  const [editClasses, setEditClasses] = useState<EditableClass[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ["onboarding-templates"],
    queryFn: () => api("/api/system-admin/onboarding-templates"),
  });
  const templates: TemplateSummary[] = data ?? [];

  const resolveLabel = (tpl: TemplateSummary) => {
    if (tpl.label) return tpl.label;
    if (BUILT_IN_CODES.includes(tpl.code)) {
      try {
        return tOnb(`templates.${tpl.code}.label`);
      } catch {
        return tpl.code;
      }
    }
    return tpl.code;
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter(
      (tpl) =>
        tpl.code.toLowerCase().includes(q) ||
        resolveLabel(tpl).toLowerCase().includes(q)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templates, search]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["onboarding-templates"] });

  const toggleMutation = useMutation({
    mutationFn: (tpl: TemplateSummary) =>
      api(`/api/system-admin/onboarding-templates/${tpl.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !tpl.isActive }),
      }),
    onSuccess: refresh,
    onError: (e: any) => toast.error(e.message || t("templates.failed")),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      api(`/api/system-admin/onboarding-templates/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      refresh();
      toast.success(t("templates.deleted"));
    },
    onError: (e: any) => toast.error(e.message || t("templates.failed")),
  });

  const resetMutation = useMutation({
    mutationFn: (id: string) =>
      api(`/api/system-admin/onboarding-templates/${id}/reset`, { method: "POST" }),
    onSuccess: () => {
      refresh();
      toast.success(t("templates.resetDone"));
    },
    onError: (e: any) => toast.error(e.message || t("templates.failed")),
  });

  const duplicateMutation = useMutation({
    mutationFn: async (tpl: TemplateSummary) => {
      const base = `${tpl.code}_COPY`.slice(0, 32);
      const taken = new Set(templates.map((x) => x.code));
      let candidate = base;
      let n = 2;
      while (taken.has(candidate)) candidate = `${base.slice(0, 32 - String(n).length)}${n++}`;
      return api("/api/system-admin/onboarding-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ duplicateOf: tpl.id, code: candidate }),
      });
    },
    onSuccess: () => {
      refresh();
      toast.success(t("templates.duplicated"));
    },
    onError: (e: any) => toast.error(e.message || t("templates.failed")),
  });

  const openNew = () => {
    setIsNew(true);
    setEditingId(null);
    setCode("");
    setLabel("");
    setDescription("");
    setCountry("INTL");
    setCategory("GENERIC");
    setCurrency("PKR");
    setIsActive(true);
    setEditClasses([blankClass()]);
    setExpanded(0);
    setEditorOpen(true);
  };

  const openEdit = async (tpl: TemplateSummary) => {
    try {
      const full = await api(`/api/system-admin/onboarding-templates/${tpl.id}`);
      setIsNew(false);
      setEditingId(tpl.id);
      setCode(tpl.code);
      setLabel(full.label ?? "");
      setDescription(full.description ?? "");
      setCountry(full.countryCode ?? "INTL");
      setCategory(full.category ?? "GENERIC");
      setCurrency(full.currency ?? "PKR");
      setIsActive(full.isActive);
      const cls = toEditorClasses(Array.isArray(full.classes) ? full.classes : []);
      setEditClasses(cls.length ? cls : [blankClass()]);
      setExpanded(0);
      setEditorOpen(true);
    } catch (e: any) {
      toast.error(e.message || t("templates.failed"));
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        label,
        description,
        countryCode: country,
        category,
        currency: currency.toUpperCase().slice(0, 3) || "PKR",
        classes: toOverridePayload(editClasses),
        isActive,
      };
      if (isNew) {
        return api("/api/system-admin/onboarding-templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, code: code.toUpperCase().trim() }),
        });
      }
      return api(`/api/system-admin/onboarding-templates/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      setEditorOpen(false);
      refresh();
      toast.success(t("templates.saved"));
    },
    onError: (e: any) => toast.error(e.message || t("templates.failed")),
  });

  const patchClass = (idx: number, patch: Partial<EditableClass>) =>
    setEditClasses((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)));

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" /> {t("templates.title")}
          </h1>
          <p className="text-xs text-muted-foreground mt-1 max-w-2xl">{t("templates.description")}</p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="h-4 w-4" /> {t("templates.newTemplate")}
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("templates.searchPlaceholder")}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <TableSkeleton rows={6} />
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("templates.noTemplates")}</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((tpl) => (
            <Card key={tpl.id} className="border border-border/80 shadow-xs">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate">{resolveLabel(tpl)}</p>
                    <p className="text-[11px] font-mono text-muted-foreground">{tpl.code}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Badge variant={tpl.isBuiltIn ? "secondary" : "outline"} className="text-[10px]">
                      {tpl.isBuiltIn ? t("templates.builtIn") : t("templates.custom")}
                    </Badge>
                    <Badge variant={tpl.isActive ? "default" : "outline"} className="text-[10px]">
                      {tpl.isActive ? t("templates.active") : t("templates.inactive")}
                    </Badge>
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  <span><b className="text-foreground">{tpl.stats.classes}</b> {t("templates.classes")}</span>
                  <span><b className="text-foreground">{tpl.stats.sections}</b> {t("templates.sections")}</span>
                  <span><b className="text-foreground">{tpl.stats.groups}</b> {t("templates.groups")}</span>
                  <span><b className="text-foreground">{tpl.stats.subjects}</b> {t("templates.subjects")}</span>
                </div>
                <div className="flex items-center justify-between border-t border-border/60 pt-3">
                  <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                    <Switch
                      checked={tpl.isActive}
                      disabled={toggleMutation.isPending}
                      onCheckedChange={() => toggleMutation.mutate(tpl)}
                    />
                    {t("templates.activeField")}
                  </label>
                  <span className="text-[10px] text-muted-foreground">{t("templates.version", { version: tpl.version ?? 1 })}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => openEdit(tpl)}>
                    <Pencil className="h-3 w-3" /> {t("templates.viewEdit")}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => duplicateMutation.mutate(tpl)} disabled={duplicateMutation.isPending}>
                    <Copy className="h-3 w-3" /> {t("templates.duplicate")}
                  </Button>
                  {tpl.isBuiltIn ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs gap-1"
                      disabled={resetMutation.isPending}
                      onClick={() => {
                        if (confirm(t("templates.confirmReset"))) resetMutation.mutate(tpl.id);
                      }}
                    >
                      <RotateCcw className="h-3 w-3" /> {t("templates.resetBuiltIn")}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs gap-1 text-destructive hover:text-destructive"
                      disabled={deleteMutation.isPending}
                      onClick={() => {
                        if (confirm(t("templates.confirmDelete"))) deleteMutation.mutate(tpl.id);
                      }}
                    >
                      <Trash2 className="h-3 w-3" /> {t("templates.deleteTemplate")}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <TopSheet
        isOpen={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={isNew ? t("templates.newTemplate") : t("templates.editTemplate")}
        subtitle={isNew ? undefined : code}
        maxWidth="5xl"
      >
        <div className="space-y-5 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {isNew && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{t("templates.codeField")}</Label>
                <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""))} placeholder="CUSTOM_STREAMS" className="h-9 text-xs font-mono" maxLength={32} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{t("templates.labelField")}</Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} className="h-9 text-xs" maxLength={80} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs font-semibold">{t("templates.descriptionField")}</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="text-xs" rows={2} maxLength={500} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{t("templates.countryField")}</Label>
              <AppDropdown value={country} onChange={setCountry} options={COUNTRIES.map((c) => ({ value: c, label: c }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{t("templates.categoryField")}</Label>
              <AppDropdown value={category} onChange={setCategory} options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{t("templates.currencyField")}</Label>
              <Input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))} className="h-9 text-xs font-mono" maxLength={3} />
            </div>
            <div className="flex items-center gap-2 pt-5">
              <Switch checked={isActive} onCheckedChange={setIsActive} />
              <span className="text-xs text-muted-foreground">{t("templates.activeField")}</span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">
                {t("templates.classes")} ({editClasses.length})
              </h3>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1"
                onClick={() => {
                  setEditClasses((prev) => [...prev, { ...blankClass(), sequence: String(prev.length + 1) }]);
                  setExpanded(editClasses.length);
                }}
              >
                <Plus className="h-3 w-3" /> {t("templates.addClass")}
              </Button>
            </div>
            {editClasses.map((cls, idx) => {
              const open = expanded === idx;
              return (
                <div key={idx} className="rounded-lg border border-border/70">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setExpanded(open ? null : idx)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setExpanded(open ? null : idx);
                      }
                    }}
                    className="flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
                  >
                    <span className="text-xs font-bold truncate">
                      {idx + 1}. {cls.name || <span className="text-muted-foreground">—</span>}
                      <span className="ml-2 font-mono font-normal text-muted-foreground">{cls.code}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      <span className="text-[10px] text-muted-foreground">
                        {cls.subjects.length} {t("templates.subjects")}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditClasses((prev) => prev.filter((_, i) => i !== idx));
                        }}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </span>
                  </div>
                  {open && (
                    <div className="space-y-3 border-t border-border/60 p-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[11px]">{t("templates.className")}</Label>
                          <Input value={cls.name} onChange={(e) => patchClass(idx, { name: e.target.value })} className="h-8 text-xs" maxLength={80} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px]">{t("templates.classCode")}</Label>
                          <Input value={cls.code} onChange={(e) => patchClass(idx, { code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "") })} className="h-8 text-xs font-mono" maxLength={16} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px]">{t("templates.sequence")}</Label>
                          <Input value={cls.sequence} onChange={(e) => patchClass(idx, { sequence: e.target.value.replace(/[^0-9]/g, "") })} className="h-8 text-xs" inputMode="numeric" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px]">{t("templates.sectionList")}</Label>
                        <Input value={cls.sectionsText} onChange={(e) => patchClass(idx, { sectionsText: e.target.value })} className="h-8 text-xs" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px]">{t("templates.groupList")}</Label>
                        {cls.groups.map((g, gi) => (
                          <div key={gi} className="flex gap-1.5">
                            <Input value={g.name} onChange={(e) => patchClass(idx, { groups: cls.groups.map((x, xi) => (xi === gi ? { ...x, name: e.target.value } : x)) })} placeholder="Science" className="h-8 text-xs" maxLength={40} />
                            <Input value={g.shortName} onChange={(e) => patchClass(idx, { groups: cls.groups.map((x, xi) => (xi === gi ? { ...x, shortName: e.target.value.toUpperCase().replace(/[^A-Z]/g, "") } : x)) })} placeholder="SCI" className="h-8 w-20 text-xs font-mono" maxLength={10} />
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive" onClick={() => patchClass(idx, { groups: cls.groups.filter((_, xi) => xi !== gi) })}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))}
                        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => patchClass(idx, { groups: [...cls.groups, { name: "", shortName: "" }] })}>
                          <Plus className="h-3 w-3" /> {t("templates.groups")}
                        </Button>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px]">{t("templates.subjectList")}</Label>
                        {cls.subjects.map((s, si) => (
                          <div key={si} className="grid grid-cols-12 gap-1.5">
                            <Input value={s.name} onChange={(e) => patchClass(idx, { subjects: cls.subjects.map((x, xi) => (xi === si ? { ...x, name: e.target.value } : x)) })} placeholder={t("templates.subjectName")} className="h-8 text-xs col-span-5" maxLength={80} />
                            <Input value={s.code} onChange={(e) => patchClass(idx, { subjects: cls.subjects.map((x, xi) => (xi === si ? { ...x, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "") } : x)) })} placeholder={t("templates.subjectCode")} className="h-8 text-xs font-mono col-span-2" maxLength={16} />
                            <div className="col-span-2">
                              <AppDropdown
                                value={s.type}
                                onChange={(v) => patchClass(idx, { subjects: cls.subjects.map((x, xi) => (xi === si ? { ...x, type: v as any } : x)) })}
                                options={SUBJECT_TYPES.map((x) => ({ value: x, label: x }))}
                                triggerClassName="h-8 text-xs w-full"
                              />
                            </div>
                            <Input value={s.totalMarks} onChange={(e) => patchClass(idx, { subjects: cls.subjects.map((x, xi) => (xi === si ? { ...x, totalMarks: e.target.value.replace(/[^0-9]/g, "") } : x)) })} placeholder={t("templates.maxMarks")} className="h-8 text-xs col-span-1" inputMode="numeric" />
                            <Input value={s.passMarks} onChange={(e) => patchClass(idx, { subjects: cls.subjects.map((x, xi) => (xi === si ? { ...x, passMarks: e.target.value.replace(/[^0-9]/g, "") } : x)) })} placeholder={t("templates.passMarks")} className="h-8 text-xs col-span-1" inputMode="numeric" />
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive col-span-1" onClick={() => patchClass(idx, { subjects: cls.subjects.filter((_, xi) => xi !== si) })}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))}
                        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => patchClass(idx, { subjects: [...cls.subjects, { name: "", code: "", type: "THEORY", totalMarks: "100", passMarks: "33" }] })}>
                          <Plus className="h-3 w-3" /> {t("templates.addSubject")}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex justify-end gap-2 border-t border-border/60 pt-4">
            <Button variant="outline" onClick={() => setEditorOpen(false)}>
              {t("templates.cancel")}
            </Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="gap-2">
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saveMutation.isPending ? t("templates.saving") : t("templates.saveChanges")}
            </Button>
          </div>
        </div>
      </TopSheet>
    </div>
  );
}
