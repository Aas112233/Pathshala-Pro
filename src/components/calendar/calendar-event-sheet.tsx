"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { TopSheet } from "@/components/ui/top-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TenantDateInput } from "@/components/ui/tenant-date-input";
import { Switch } from "@/components/ui/switch";
import { AppDropdown } from "@/components/ui/app-dropdown";
import { ERPFormSection, ERPFormGrid, ERPFormField } from "@/components/ui/erp-form-layout";
import {
  useCreateCalendarEvent,
  useDeleteCalendarEvent,
  useUpdateCalendarEvent,
} from "@/hooks/use-calendar";
import type { CalendarItem } from "@/lib/calendar-service";
import {
  CALENDAR_CATEGORIES,
  CALENDAR_COLORS,
  CALENDAR_RECURRENCES,
  CALENDAR_AUDIENCES,
} from "@/lib/schemas";
import {
  CALENDAR_COLOR_STYLES,
  extractTime,
  toISODateLocal,
  toLocalDateTimeIso,
} from "./calendar-utils";

const EMPTY_FORM = {
  title: "",
  description: "",
  category: "EVENT",
  location: "",
  color: "blue",
  startDate: "",
  endDate: "",
  isAllDay: true,
  startTime: "09:00",
  endTime: "10:00",
  recurrence: "NONE",
  recurrenceEndDate: "",
  audience: "ALL",
  classId: "",
  sectionId: "",
};

interface CalendarEventSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** EVENT item being edited, or null to create. */
  editing: CalendarItem | null;
  /** Default date to prefill when opening for create (the clicked day). */
  defaultDate: Date;
  classes: any[];
  sections: any[];
}

export function CalendarEventSheet({
  isOpen,
  onClose,
  editing,
  defaultDate,
  classes,
  sections,
}: CalendarEventSheetProps) {
  const t = useTranslations("calendar.eventForm");
  const tCalendar = useTranslations("calendar");
  const tCategories = useTranslations("calendar.categories");

  const createEvent = useCreateCalendarEvent();
  const updateEvent = useUpdateCalendarEvent();
  const deleteEvent = useDeleteCalendarEvent();

  const [form, setForm] = useState<typeof EMPTY_FORM>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const setField = (field: string, value: any) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  useEffect(() => {
    if (!isOpen) return;
    setErrors({});
    if (editing) {
      const startDate = new Date(editing.start);
      const endDate = editing.end ? new Date(editing.end) : null;
      setForm({
        title: editing.title,
        description: editing.description ?? "",
        category: editing.category,
        location: editing.location ?? "",
        color: editing.color,
        startDate: toISODateLocal(startDate),
        endDate: editing.end && !isSameLocalDay(startDate, endDate!) ? toISODateLocal(endDate!) : "",
        isAllDay: editing.isAllDay,
        startTime: editing.isAllDay ? "09:00" : extractTime(editing.start),
        endTime: editing.isAllDay ? "10:00" : extractTime(editing.end ?? editing.start),
        recurrence: (editing.meta?.recurrence as string) ?? "NONE",
        recurrenceEndDate: "",
        audience: (editing.meta?.audience as string) ?? "ALL",
        classId: editing.classId ?? "",
        sectionId: editing.sectionId ?? "",
      });
    } else {
      setForm({ ...EMPTY_FORM, startDate: toISODateLocal(defaultDate) });
    }
  }, [isOpen, editing, defaultDate]);

  const classOptions = useMemo(
    () => classes.map((c: any) => ({ value: c.id, label: c.name })),
    [classes]
  );

  const sectionOptions = useMemo(
    () =>
      sections
        .filter((s: any) => s.classId === form.classId)
        .map((s: any) => ({ value: s.id, label: s.name })),
    [sections, form.classId]
  );

  const isRecurring = form.recurrence !== "NONE";

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!form.title.trim()) next.title = t("titleRequired");
    if (!form.startDate) next.startDate = t("startDateRequired");
    if (form.endDate && form.startDate && form.endDate < form.startDate) {
      next.endDate = t("endDateInvalid");
    }
    if (form.audience === "CLASS" && !form.classId) next.classId = t("classRequired");
    if (isRecurring && form.recurrenceEndDate && form.recurrenceEndDate < form.startDate) {
      next.recurrenceEndDate = t("recurrenceEndInvalid");
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    const startIso = form.isAllDay
      ? form.startDate
      : toLocalDateTimeIso(new Date(`${form.startDate}T00:00:00`), form.startTime);
    const endIso = form.isAllDay
      ? form.endDate || ""
      : toLocalDateTimeIso(new Date(`${form.endDate || form.startDate}T00:00:00`), form.endTime);

    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category,
      location: form.location.trim(),
      color: form.color,
      startDate: startIso,
      endDate: endIso,
      isAllDay: form.isAllDay,
      recurrence: form.recurrence,
      recurrenceEndDate: isRecurring && form.recurrenceEndDate ? form.recurrenceEndDate : "",
      audience: form.audience,
      classId: form.audience === "CLASS" ? form.classId : "",
      sectionId: form.audience === "CLASS" ? form.sectionId : "",
    };

    try {
      if (editing) {
        await updateEvent.mutateAsync({ id: editing.sourceId, data: payload });
        toast.success(tCalendar("toast.updated"));
      } else {
        await createEvent.mutateAsync(payload);
        toast.success(tCalendar("toast.created"));
      }
      onClose();
    } catch (err: any) {
      toast.error(err?.message || tCalendar("toast.error"));
    }
  }

  async function handleDelete() {
    if (!editing) return;
    try {
      await deleteEvent.mutateAsync(editing.sourceId);
      toast.success(tCalendar("toast.deleted"));
      onClose();
    } catch (err: any) {
      toast.error(err?.message || tCalendar("toast.error"));
    }
  }

  const isSaving = createEvent.isPending || updateEvent.isPending;

  return (
    <TopSheet
      isOpen={isOpen}
      onClose={onClose}
      title={editing ? t("edit") : t("create")}
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="p-6">
        <ERPFormSection title={editing ? t("edit") : t("create")}>
          <ERPFormGrid cols={2}>
            <ERPFormField label={t("title")} required error={errors.title}>
              <Input
                value={form.title}
                onChange={(e) => setField("title", e.target.value)}
                placeholder={t("titlePlaceholder")}
                aria-invalid={Boolean(errors.title)}
              />
            </ERPFormField>

            <ERPFormField label={t("category")}>
              <AppDropdown
                value={form.category}
                onChange={(v) => setField("category", v)}
                options={CALENDAR_CATEGORIES.map((category) => ({
                  value: category,
                  label: tCategories(category),
                }))}
              />
            </ERPFormField>

            <ERPFormField label={t("startDate")} required error={errors.startDate}>
              <TenantDateInput
                value={form.startDate}
                onChange={(v) => setField("startDate", v)}
                aria-invalid={Boolean(errors.startDate)}
              />
            </ERPFormField>

            <ERPFormField label={t("endDate")} error={errors.endDate}>
              <TenantDateInput
                value={form.endDate}
                onChange={(v) => setField("endDate", v)}
                disabled={!form.startDate}
              />
            </ERPFormField>

            <ERPFormField label={t("location")}>
              <Input
                value={form.location}
                onChange={(e) => setField("location", e.target.value)}
                placeholder={t("locationPlaceholder")}
              />
            </ERPFormField>

            <ERPFormField label={t("color")}>
              <div className="flex h-10 items-center gap-1.5">
                {CALENDAR_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setField("color", color)}
                    aria-label={color}
                    className={cn(
                      "h-6 w-6 rounded-full border transition-transform",
                      CALENDAR_COLOR_STYLES[color],
                      form.color === color && "ring-2 ring-ring ring-offset-2 ring-offset-background scale-110"
                    )}
                  />
                ))}
              </div>
            </ERPFormField>

            <ERPFormField label={t("isAllDay")}>
              <div className="flex h-10 items-center">
                <Switch
                  checked={form.isAllDay}
                  onCheckedChange={(checked) => setField("isAllDay", checked)}
                />
              </div>
            </ERPFormField>

            {!form.isAllDay && (
              <>
                <ERPFormField label={t("startTime")}>
                  <Input
                    type="time"
                    value={form.startTime}
                    onChange={(e) => setField("startTime", e.target.value)}
                  />
                </ERPFormField>
                <ERPFormField label={t("endTime")}>
                  <Input
                    type="time"
                    value={form.endTime}
                    onChange={(e) => setField("endTime", e.target.value)}
                  />
                </ERPFormField>
              </>
            )}

            <ERPFormField label={t("recurrence")}>
              <AppDropdown
                value={form.recurrence}
                onChange={(v) => setField("recurrence", v)}
                options={CALENDAR_RECURRENCES.map((recurrence) => ({
                  value: recurrence,
                  label: t(`recurrence${recurrence.charAt(0)}${recurrence.slice(1).toLowerCase()}`),
                }))}
              />
            </ERPFormField>

              {isRecurring && (
              <ERPFormField label={t("recurrenceUntil")} error={errors.recurrenceEndDate}>
                <TenantDateInput
                  value={form.recurrenceEndDate}
                  onChange={(v) => setField("recurrenceEndDate", v)}
                  disabled={!form.startDate}
                />
              </ERPFormField>
            )}

            <ERPFormField label={t("audience")}>
              <AppDropdown
                value={form.audience}
                onChange={(v) => {
                  setField("audience", v);
                  if (v !== "CLASS") {
                    setField("classId", "");
                    setField("sectionId", "");
                  }
                }}
                options={CALENDAR_AUDIENCES.map((audience) => ({
                  value: audience,
                  label: t(`audience${audience.charAt(0)}${audience.slice(1).toLowerCase()}`),
                }))}
              />
            </ERPFormField>

            {form.audience === "CLASS" && (
              <>
                <ERPFormField label={t("class")} required error={errors.classId}>
                  <AppDropdown
                    value={form.classId}
                    onChange={(v) => {
                      setField("classId", v);
                      setField("sectionId", "");
                    }}
                    options={classOptions}
                    placeholder={t("selectClass")}
                    searchable
                  />
                </ERPFormField>
                <ERPFormField label={t("section")}>
                  <AppDropdown
                    value={form.sectionId}
                    onChange={(v) => setField("sectionId", v)}
                    options={sectionOptions}
                    placeholder={form.classId ? t("selectSection") : t("selectClassFirst")}
                    disabled={!form.classId}
                    searchable
                  />
                </ERPFormField>
              </>
            )}

            <ERPFormField label={t("description")} className="sm:col-span-2">
              <textarea
                value={form.description}
                onChange={(e) => setField("description", e.target.value)}
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </ERPFormField>
          </ERPFormGrid>
        </ERPFormSection>

        <div className="mt-6 flex items-center justify-between gap-3 border-t border-border/60 pt-4">
          <div>
            {editing && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={deleteEvent.isPending}
                className="gap-2"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t("delete")}
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={isSaving} className="gap-2">
              {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {isSaving ? t("saving") : t("save")}
            </Button>
          </div>
        </div>
      </form>
    </TopSheet>
  );
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
