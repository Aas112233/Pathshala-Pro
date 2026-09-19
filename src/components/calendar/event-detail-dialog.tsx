"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { CalendarDays, Clock, MapPin, Pencil, Repeat, User } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CalendarItem } from "@/lib/calendar-service";
import { formatCurrencyWithSettings, formatDateWithSettings, formatTimeWithSettings, type TenantSettings } from "@/lib/tenant-settings";
import { itemColorClass, itemIcon, itemStartDate, itemEndDate } from "./calendar-utils";

interface EventDetailDialogProps {
  item: CalendarItem | null;
  onClose: () => void;
  onEdit: (item: CalendarItem) => void;
  canWrite: boolean;
  settings: TenantSettings;
}

const SOURCE_LABEL_KEYS: Record<string, string> = {
  EVENT: "detail.sourceEvent",
  HOLIDAY: "detail.sourceHoliday",
  EXAM: "detail.sourceExam",
  HOMEWORK: "detail.sourceHomework",
  NOTICE: "detail.sourceNotice",
  FEE_DUE: "detail.sourceFeeDue",
  LIBRARY_DUE: "detail.sourceLibraryDue",
};

export function EventDetailDialog({ item, onClose, onEdit, canWrite, settings }: EventDetailDialogProps) {
  const t = useTranslations("calendar");

  if (!item) return null;

  const Icon = itemIcon(item);
  const start = itemStartDate(item);
  const end = itemEndDate(item);
  const isSameDay = start.toDateString() === end.toDateString();

  const dateText = isSameDay
    ? formatDateWithSettings(start, settings, "D MMMM YYYY")
    : `${formatDateWithSettings(start, settings, "D MMMM YYYY")} – ${formatDateWithSettings(end, settings, "D MMMM YYYY")}`;

  const timeText = item.isAllDay
    ? t("allDay")
    : `${formatTimeWithSettings(start, settings)} – ${formatTimeWithSettings(end, settings)}`;

  return (
    <Dialog open={Boolean(item)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl border", itemColorClass(item))}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="truncate text-left text-base font-bold text-foreground">
                {item.source === "FEE_DUE"
                  ? t("sources.feeDues", { count: (item.meta?.voucherCount as number) ?? 0 })
                  : item.source === "LIBRARY_DUE"
                    ? t("sources.libraryDues")
                    : item.title}
              </DialogTitle>
              <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t(SOURCE_LABEL_KEYS[item.source] ?? "detail.sourceEvent")}
                {item.category !== item.source && item.source === "EVENT"
                  ? ` · ${t(`categories.${item.category}`)}`
                  : ""}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-2.5 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CalendarDays className="h-4 w-4 shrink-0 text-primary" />
            <span>{dateText}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4 shrink-0 text-primary" />
            <span className="tabular-nums">{timeText}</span>
          </div>
          {item.location && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4 shrink-0 text-primary" />
              <span>{item.location}</span>
            </div>
          )}
          {item.meta?.isRecurring ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Repeat className="h-4 w-4 shrink-0 text-primary" />
              <span>{t("recurring")}</span>
            </div>
          ) : null}
          {item.source === "FEE_DUE" && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <User className="h-4 w-4 shrink-0 text-primary" />
              <span>
                {t("detail.totalOutstanding", {
                  amount: formatCurrencyWithSettings(
                    (item.meta?.totalBalance as number) ?? 0,
                    settings
                  ),
                })}
              </span>
            </div>
          )}
          {item.source === "LIBRARY_DUE" && item.meta?.borrowerName ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <User className="h-4 w-4 shrink-0 text-primary" />
              <span>{String(item.meta.borrowerName)}</span>
            </div>
          ) : null}
          {item.source === "HOMEWORK" && item.meta?.subjectName ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="text-xs">
                {t("detail.subject")}: <span className="font-semibold text-foreground">{String(item.meta.subjectName)}</span>
              </span>
            </div>
          ) : null}
          {item.source === "EXAM" && item.meta?.isPublished === false && (
            <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-300">
              {t("detail.examNotPublished")}
            </p>
          )}
          {item.description && (
            <p className="whitespace-pre-line rounded-lg border border-border/60 bg-muted/20 p-3 text-xs leading-relaxed text-foreground/90">
              {item.description}
            </p>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between gap-2 sm:justify-between">
          {item.href ? (
            <Button asChild variant="outline" size="sm" className="gap-2">
              <Link href={item.href}>
                {t("detail.openInModule")}
              </Link>
            </Button>
          ) : (
            <span />
          )}
          {canWrite && item.source === "EVENT" && (
            <Button size="sm" className="gap-2" onClick={() => onEdit(item)}>
              <Pencil className="h-3.5 w-3.5" />
              {t("detail.edit")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
