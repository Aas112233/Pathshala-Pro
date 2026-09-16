"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { TopSheet } from "@/components/ui/top-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppDropdown } from "@/components/ui/app-dropdown";
import { ERPFormSection, ERPFormGrid, ERPFormField } from "@/components/ui/erp-form-layout";
import { useCreateHoliday, useDeleteHoliday, useHolidays } from "@/hooks/use-calendar";
import { HOLIDAY_TYPES } from "@/lib/schemas";

const EMPTY_HOLIDAY = {
  title: "",
  holidayType: "PUBLIC",
  startDate: "",
  endDate: "",
  description: "",
};

interface HolidayManagerSheetProps {
  isOpen: boolean;
  onClose: () => void;
  academicYearId: string;
  canWrite: boolean;
}

export function HolidayManagerSheet({
  isOpen,
  onClose,
  academicYearId,
  canWrite,
}: HolidayManagerSheetProps) {
  const t = useTranslations("calendar.holidays");
  const tToast = useTranslations("calendar.toast");

  const { data: holidays = [], isLoading } = useHolidays(academicYearId, {
    enabled: isOpen && !!academicYearId,
  });
  const createHoliday = useCreateHoliday();
  const deleteHoliday = useDeleteHoliday();

  const [form, setForm] = useState(EMPTY_HOLIDAY);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      setForm(EMPTY_HOLIDAY);
      setErrors({});
    }
  }, [isOpen]);

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!form.title.trim()) next.title = t("nameRequired");
    if (!form.startDate) next.startDate = t("startDateRequired");
    if (!form.endDate) next.endDate = t("endDateRequired");
    if (form.startDate && form.endDate && form.endDate < form.startDate) {
      next.endDate = t("endDateInvalid");
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    try {
      await createHoliday.mutateAsync({
        academicYearId,
        title: form.title.trim(),
        holidayType: form.holidayType,
        startDate: form.startDate,
        endDate: form.endDate,
        description: form.description.trim(),
      });
      toast.success(tToast("holidayCreated"));
      setForm(EMPTY_HOLIDAY);
    } catch (err: any) {
      toast.error(err?.message || tToast("error"));
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteHoliday.mutateAsync(id);
      toast.success(tToast("holidayDeleted"));
    } catch (err: any) {
      toast.error(err?.message || tToast("error"));
    }
  }

  return (
    <TopSheet
      isOpen={isOpen}
      onClose={onClose}
      title={t("title")}
      description={t("description")}
      maxWidth="2xl"
    >
      <div className="space-y-5 p-6">
        {canWrite && (
          <ERPFormSection title={t("add")}>
            <form onSubmit={handleCreate}>
              <ERPFormGrid cols={2}>
                <ERPFormField label={t("name")} required error={errors.title}>
                  <Input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder={t("namePlaceholder")}
                    aria-invalid={Boolean(errors.title)}
                  />
                </ERPFormField>
                <ERPFormField label={t("type")}>
                  <AppDropdown
                    value={form.holidayType}
                    onChange={(v) => setForm({ ...form, holidayType: v })}
                    options={HOLIDAY_TYPES.map((type) => ({
                      value: type,
                      label: t(`types.${type.charAt(0)}${type.slice(1).toLowerCase()}`),
                    }))}
                  />
                </ERPFormField>
                <ERPFormField label={t("startDate")} required error={errors.startDate}>
                  <Input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  />
                </ERPFormField>
                <ERPFormField label={t("endDate")} required error={errors.endDate}>
                  <Input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    min={form.startDate || undefined}
                    disabled={!form.startDate}
                  />
                </ERPFormField>
                <ERPFormField label={t("notes")} className="md:col-span-2">
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={2}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </ERPFormField>
              </ERPFormGrid>
              <div className="mt-4 flex justify-end">
                <Button type="submit" disabled={createHoliday.isPending} className="gap-2">
                  {createHoliday.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                  {t("save")}
                </Button>
              </div>
            </form>
          </ERPFormSection>
        )}

        <div>
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("existingTitle")}
          </Label>
          {isLoading ? (
            <div className="mt-2 space-y-2">
              {[0, 1, 2].map((index) => (
                <div key={index} className="h-12 animate-pulse rounded-lg bg-muted/50" />
              ))}
            </div>
          ) : holidays.length === 0 ? (
            <p className="mt-2 rounded-lg border border-dashed border-border/80 px-4 py-6 text-center text-xs text-muted-foreground">
              {t("empty")}
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {holidays.map((holiday: any) => (
                <li
                  key={holiday.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-card px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{holiday.title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {format(new Date(holiday.startDate), "dd MMM yyyy")} –{" "}
                      {format(new Date(holiday.endDate), "dd MMM yyyy")}
                      {" · "}
                      {t(`types.${String(holiday.holidayType).charAt(0)}${String(holiday.holidayType).slice(1).toLowerCase()}`)}
                    </p>
                  </div>
                  {canWrite && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(holiday.id)}
                      disabled={deleteHoliday.isPending}
                      className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {t("delete")}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </TopSheet>
  );
}
