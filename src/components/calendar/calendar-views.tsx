"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Clock, MapPin, Repeat } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CalendarItem } from "@/lib/calendar-service";
import {
  addDays,
  dayOfWeekKey,
  isSameDay,
  itemColorClass,
  itemEndDate,
  itemIcon,
  itemStartDate,
  monthGridCells,
  startOfDay,
} from "./calendar-utils";

export function itemDisplayTitle(
  item: CalendarItem,
  t: (key: string, values?: Record<string, string | number>) => string
): string {
  if (item.source === "FEE_DUE") {
    return t("sources.feeDues", { count: (item.meta?.voucherCount as number) ?? 0 });
  }
  if (item.source === "LIBRARY_DUE") {
    return t("sources.libraryDues");
  }
  return item.title;
}

interface ItemChipProps {
  item: CalendarItem;
  onSelect: (item: CalendarItem) => void;
  compact?: boolean;
}

export function ItemChip({ item, onSelect, compact = false }: ItemChipProps) {
  const t = useTranslations("calendar");
  const Icon = itemIcon(item);
  const start = itemStartDate(item);
  const end = itemEndDate(item);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onSelect(item);
      }}
      className={cn(
        "w-full flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-left text-[11px] font-medium transition-colors hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        itemColorClass(item)
      )}
      title={itemDisplayTitle(item, t)}
    >
      <Icon className="h-3 w-3 shrink-0" />
      {!item.isAllDay && (
        <span className="shrink-0 tabular-nums opacity-80">
          {start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      )}
      <span className="truncate">{itemDisplayTitle(item, t)}</span>
      {!compact && !isSameDay(start, end) && (
        <span className="ml-auto shrink-0 opacity-70">
          {t("multiDay")}
        </span>
      )}
    </button>
  );
}

interface CalendarViewsProps {
  items: CalendarItem[];
  /** View anchor: month/week cursor or the selected day. */
  anchor: Date;
  weekStartsOn: number;
  onSelectItem: (item: CalendarItem) => void;
  onSelectDay: (date: Date) => void;
}

export function MonthView({ items, anchor, weekStartsOn, onSelectItem, onSelectDay }: CalendarViewsProps) {
  const locale = useLocale();
  const t = useTranslations("calendar");
  const cells = monthGridCells(anchor, weekStartsOn);

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const item of items) {
      const key = itemStartDate(item).toDateString();
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    return map;
  }, [items]);

  const weekdayHeaders = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(locale, { weekday: "short" });
    return Array.from(
      { length: 7 },
      (_, index) => formatter.format(new Date(2024, 8, 1 + ((weekStartsOn + index) % 7)))
    );
  }, [locale, weekStartsOn]);

  return (
    <div className="overflow-hidden rounded-xl border border-border/80 bg-card">
      <div className="grid grid-cols-7 border-b border-border/80 bg-muted/40">
        {weekdayHeaders.map((label) => (
          <div key={label} className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((cell, index) => {
          const dayItems = byDay.get(cell.toDateString()) ?? [];
          const inMonth = cell.getMonth() === anchor.getMonth();
          const isToday = isSameDay(cell, new Date());
          return (
            <button
              type="button"
              key={index}
              onClick={() => onSelectDay(cell)}
              className={cn(
                "flex min-h-[92px] flex-col gap-1 border-b border-r border-border/50 p-1.5 text-left align-top transition-colors hover:bg-muted/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                (index + 1) % 7 === 0 && "border-r-0",
                index >= 35 && "border-b-0",
                !inMonth && "bg-muted/20 text-muted-foreground"
              )}
            >
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                  isToday && "bg-primary text-primary-foreground",
                  !isToday && inMonth && "text-foreground",
                  !isToday && !inMonth && "text-muted-foreground"
                )}
              >
                {cell.getDate()}
              </span>
              <div className="flex flex-col gap-1">
                {dayItems.slice(0, 3).map((item) => (
                  <ItemChip key={item.id} item={item} onSelect={onSelectItem} compact />
                ))}
                {dayItems.length > 3 && (
                  <span className="pl-1 text-[10px] font-semibold text-muted-foreground">
                    {t("moreItems", { count: dayItems.length - 3 })}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function WeekView({ items, anchor, weekStartsOn, onSelectItem, onSelectDay }: CalendarViewsProps) {
  const t = useTranslations("calendar");
  const locale = useLocale();
  const gridStart = useMemo(() => {
    const diff = (startOfDay(anchor).getDay() - weekStartsOn + 7) % 7;
    return addDays(startOfDay(anchor), -diff);
  }, [anchor, weekStartsOn]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(gridStart, index)), [gridStart]);

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const item of items) {
      const key = itemStartDate(item).toDateString();
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    return map;
  }, [items]);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
      {days.map((day) => {
        const dayItems = (byDay.get(day.toDateString()) ?? []).sort((a, b) => a.start.localeCompare(b.start));
        const isToday = isSameDay(day, new Date());
        return (
          <div
            key={day.toDateString()}
            className={cn(
              "flex flex-col gap-2 rounded-xl border border-border/80 bg-card p-2",
              isToday && "border-primary/50 ring-1 ring-primary/30"
            )}
          >
            <button
              type="button"
              onClick={() => onSelectDay(day)}
              className="flex items-baseline justify-between rounded-lg px-1 py-0.5 text-left hover:bg-muted/40 focus:outline-none"
            >
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {new Intl.DateTimeFormat(locale, { weekday: "short" }).format(day)}
              </span>
              <span className={cn("text-sm font-bold", isToday ? "text-primary" : "text-foreground")}>
                {day.getDate()}
              </span>
            </button>
            {dayItems.length === 0 ? (
              <span className="px-1 pb-1 text-[11px] text-muted-foreground">{t("noEvents")}</span>
            ) : (
              dayItems.map((item) => <ItemChip key={item.id} item={item} onSelect={onSelectItem} />)
            )}
          </div>
        );
      })}
    </div>
  );
}

interface DayViewProps extends CalendarViewsProps {
  day: Date;
  timetable: any[];
  isTimetableLoading: boolean;
  hasClassSelected: boolean;
}

export function DayView({
  items,
  day,
  timetable,
  isTimetableLoading,
  hasClassSelected,
  onSelectItem,
}: DayViewProps) {
  const t = useTranslations("calendar");
  const locale = useLocale();
  const dayItems = useMemo(
    () =>
      items
        .filter((item) => isSameDay(itemStartDate(item), day))
        .sort((a, b) => a.start.localeCompare(b.start)),
    [items, day]
  );

  const periods = useMemo(
    () =>
      timetable
        .filter((entry) => entry.dayOfWeek === dayOfWeekKey(day) && !entry.isBreak)
        .sort((a, b) => String(a.startTime).localeCompare(String(b.startTime))),
    [timetable, day]
  );

  const dayLabel = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(day);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
      <div className="space-y-2 lg:col-span-3">
        <h3 className="text-sm font-bold text-foreground">{dayLabel}</h3>
        {dayItems.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/80 bg-card px-4 py-10 text-center">
            <p className="text-sm font-semibold text-foreground">{t("noEvents")}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t("noEventsHint")}</p>
          </div>
        ) : (
          dayItems.map((item) => {
            const Icon = itemIcon(item);
            const start = itemStartDate(item);
            const end = itemEndDate(item);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectItem(item)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl border bg-card p-3 text-left transition-colors hover:bg-muted/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  itemColorClass(item)
                )}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-inherit bg-background/60">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {itemDisplayTitle(item, t)}
                  </p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                    {item.isAllDay ? (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {t("allDay")}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <Clock className="h-3 w-3" />
                        {start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        {" – "}
                        {end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                    {item.location && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {item.location}
                      </span>
                    )}
                    {item.meta?.isRecurring ? (
                      <span className="inline-flex items-center gap-1">
                        <Repeat className="h-3 w-3" /> {t("recurring")}
                      </span>
                    ) : null}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      <div className="rounded-xl border border-border/80 bg-card p-3 lg:col-span-2">
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("classRoutine")}
        </h4>
        {!hasClassSelected ? (
          <p className="text-xs text-muted-foreground">{t("noTimetableHint")}</p>
        ) : isTimetableLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((index) => (
              <div key={index} className="h-10 animate-pulse rounded-lg bg-muted/50" />
            ))}
          </div>
        ) : periods.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("timetableEmpty")}</p>
        ) : (
          <ul className="space-y-1.5">
            {periods.map((period) => (
              <li
                key={period.id}
                className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/20 px-2.5 py-1.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-foreground">
                    {period.subject?.name ?? period.breakLabel ?? t("periodLabel", { number: period.periodNumber })}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {period.staffProfile
                      ? [period.staffProfile.firstName, period.staffProfile.lastName].filter(Boolean).join(" ")
                      : "\u00A0"}
                  </p>
                </div>
                <span className="ml-2 shrink-0 text-[10px] font-semibold tabular-nums text-muted-foreground">
                  {period.startTime}–{period.endTime}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function AgendaView({ items, onSelectItem }: CalendarViewsProps) {
  const t = useTranslations("calendar");
  const locale = useLocale();

  const groups = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const item of items) {
      const key = itemStartDate(item).toDateString();
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    return Array.from(map.entries());
  }, [items]);

  if (groups.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/80 bg-card px-4 py-12 text-center">
        <p className="text-sm font-semibold text-foreground">{t("noEvents")}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t("noEventsHint")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map(([dayKey, dayItems]) => (
        <div key={dayKey}>
          <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" }).format(
              itemStartDate(dayItems[0])
            )}
          </h3>
          <div className="space-y-1.5">
            {dayItems.map((item) => {
              const Icon = itemIcon(item);
              const start = itemStartDate(item);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectItem(item)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg border bg-card px-3 py-2 text-left transition-colors hover:bg-muted/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    itemColorClass(item)
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!item.isAllDay && (
                    <span className="shrink-0 text-xs font-semibold tabular-nums opacity-80">
                      {start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                  <span className="truncate text-sm font-medium text-foreground">
                    {itemDisplayTitle(item, t)}
                  </span>
                  {item.location && (
                    <span className="ml-auto hidden shrink-0 items-center gap-1 text-[11px] text-muted-foreground sm:inline-flex">
                      <MapPin className="h-3 w-3" /> {item.location}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
