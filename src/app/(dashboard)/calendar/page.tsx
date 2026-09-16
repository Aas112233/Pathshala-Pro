"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/components/providers/auth-provider";
import { useTenantSettings } from "@/components/providers/tenant-settings-provider";
import { useAcademicYearContext } from "@/components/providers/academic-year-provider";
import { getEffectivePermissions, hasPermission } from "@/lib/permissions";
import { calendarApi, timetableApi } from "@/lib/api-client";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { AppDropdown } from "@/components/ui/app-dropdown";
import {
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  List,
  Plus,
  Printer,
  Receipt,
  Sun,
  BookOpen,
  Megaphone,
  Layers,
  CalendarClock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCalendarItems } from "@/hooks/use-calendar";
import type { CalendarItem } from "@/lib/calendar-service";
import {
  MonthView,
  WeekView,
  DayView,
  AgendaView,
} from "@/components/calendar/calendar-views";
import { CalendarEventSheet } from "@/components/calendar/calendar-event-sheet";
import { HolidayManagerSheet } from "@/components/calendar/holiday-manager-sheet";
import { EventDetailDialog } from "@/components/calendar/event-detail-dialog";
import {
  addDays,
  addMonths,
  endOfDay,
  firstDayOfWeekIndex,
  monthGridCells,
  startOfDay,
  startOfWeek,
} from "@/components/calendar/calendar-utils";

type CalendarViewMode = "month" | "week" | "day" | "agenda";

const FILTER_SOURCES = [
  { key: "EVENT", icon: CalendarDays },
  { key: "EXAM", icon: FileText },
  { key: "HOLIDAY", icon: Sun },
  { key: "HOMEWORK", icon: BookOpen },
  { key: "NOTICE", icon: Megaphone },
  { key: "FEE", icon: Receipt },
  { key: "LIBRARY", icon: Layers },
] as const;

const VIEW_META: Record<CalendarViewMode, { icon: typeof CalendarDays; labelKey: string }> = {
  month: { icon: CalendarDays, labelKey: "views.month" },
  week: { icon: CalendarRange, labelKey: "views.week" },
  day: { icon: CalendarClock, labelKey: "views.day" },
  agenda: { icon: List, labelKey: "views.agenda" },
};

export default function CalendarPage() {
  const t = useTranslations("calendar");
  const tMonths = useTranslations("months");
  const { user } = useAuth();
  const { settings } = useTenantSettings();
  const { selectedAcademicYearId } = useAcademicYearContext();

  const perms = getEffectivePermissions(
    user?.role,
    (user as any)?.permissions,
    (user as any)?.accessLevel
  );
  const canWrite = hasPermission(perms, "calendar", "write");
  const canManage = hasPermission(perms, "calendar", "manage");

  const [view, setView] = useState<CalendarViewMode>("month");
  const [cursor, setCursor] = useState<Date>(() => startOfDay(new Date()));
  const [selectedDay, setSelectedDay] = useState<Date>(() => startOfDay(new Date()));
  const [disabledSources, setDisabledSources] = useState<Set<string>>(new Set());
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [eventSheetOpen, setEventSheetOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CalendarItem | null>(null);
  const [detailItem, setDetailItem] = useState<CalendarItem | null>(null);
  const [holidaySheetOpen, setHolidaySheetOpen] = useState(false);

  const weekStartsOn = firstDayOfWeekIndex(settings.firstDayOfWeek || "sunday");

  const range = useMemo((): { from: Date; to: Date } => {
    if (view === "month") {
      const cells = monthGridCells(cursor, weekStartsOn);
      return { from: startOfDay(cells[0]), to: endOfDay(cells[cells.length - 1]) };
    }
    if (view === "week") {
      const weekStart = startOfWeek(cursor, weekStartsOn);
      return { from: weekStart, to: endOfDay(addDays(weekStart, 6)) };
    }
    if (view === "day") {
      return { from: startOfDay(selectedDay), to: endOfDay(selectedDay) };
    }
    return { from: startOfDay(new Date()), to: endOfDay(addDays(new Date(), 29)) };
  }, [view, cursor, selectedDay, weekStartsOn]);

  const { data: items = [], isLoading } = useCalendarItems(
    {
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      classId: classId || undefined,
      sectionId: sectionId || undefined,
    },
    { enabled: true }
  );

  const visibleItems = useMemo(
    () => items.filter((item) => !disabledSources.has(item.source === "FEE_DUE" ? "FEE" : item.source === "LIBRARY_DUE" ? "LIBRARY" : item.source)),
    [items, disabledSources]
  );

  // Classes & sections for the scope filter and event form
  const { data: classesData } = useQuery<any[]>({
    queryKey: ["classes", "calendar-page"],
    queryFn: async () => {
      const res = await fetch("/api/classes?limit=100&isActive=true", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load classes");
      const json = await res.json();
      return Array.isArray(json?.data) ? json.data : json?.data?.items ?? [];
    },
  });
  const classes = useMemo(() => classesData ?? [], [classesData]);

  const { data: sectionsData } = useQuery<any[]>({
    queryKey: ["sections", "calendar-page"],
    queryFn: async () => {
      const res = await fetch("/api/sections?limit=200", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load sections");
      const json = await res.json();
      return Array.isArray(json?.data) ? json.data : json?.data?.items ?? [];
    },
  });
  const sections = useMemo(() => sectionsData ?? [], [sectionsData]);

  // Class routine for the Day view
  const { data: timetableData, isLoading: isTimetableLoading } = useQuery<any[]>({
    queryKey: ["timetables", "calendar-day", classId, sectionId],
    queryFn: async () => {
      const response = await timetableApi.list({
        classId,
        ...(sectionId ? { sectionId } : {}),
      });
      const data = (response as any)?.data;
      return Array.isArray(data) ? data : [];
    },
    enabled: view === "day" && !!classId,
  });

  function navigate(direction: -1 | 1) {
    if (view === "month") setCursor((prev) => addMonths(prev, direction));
    else if (view === "week") setCursor((prev) => addDays(prev, 7 * direction));
    else if (view === "day")
      setSelectedDay((prev) => addDays(prev, direction));
    else setCursor((prev) => addDays(prev, 30 * direction));
  }

  function goToday() {
    const now = startOfDay(new Date());
    setCursor(now);
    setSelectedDay(now);
  }

  function openCreate() {
    setEditingItem(null);
    setEventSheetOpen(true);
  }

  function handleEditItem(item: CalendarItem) {
    setDetailItem(null);
    setEditingItem(item);
    setSelectedDay(startOfDay(new Date(item.start)));
    setEventSheetOpen(true);
  }

  const periodLabel = useMemo(() => {
    if (view === "month") {
      return `${tMonths(new Intl.DateTimeFormat("en", { month: "long" }).format(cursor).toLowerCase())} ${cursor.getFullYear()}`;
    }
    if (view === "week") {
      const weekStart = startOfWeek(cursor, weekStartsOn);
      const weekEnd = addDays(weekStart, 6);
      const sameMonth = weekStart.getMonth() === weekEnd.getMonth();
      const startLabel = sameMonth
        ? weekStart.getDate()
        : `${tMonths(new Intl.DateTimeFormat("en", { month: "short" }).format(weekStart).toLowerCase())} ${weekStart.getDate()}`;
      return `${startLabel} – ${tMonths(new Intl.DateTimeFormat("en", { month: "short" }).format(weekEnd).toLowerCase())} ${weekEnd.getDate()}, ${weekEnd.getFullYear()}`;
    }
    if (view === "day") {
      return `${tMonths(new Intl.DateTimeFormat("en", { month: "long" }).format(selectedDay).toLowerCase())} ${selectedDay.getDate()}, ${selectedDay.getFullYear()}`;
    }
    return t("agendaLabel");
  }, [view, cursor, selectedDay, weekStartsOn, tMonths, t]);

  const sectionOptions = useMemo(
    () =>
      sections
        .filter((s: any) => s.classId === classId)
        .map((s: any) => ({ value: s.id, label: s.name })),
    [sections, classId]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        icon={CalendarRange}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => window.print()}
          >
            <Printer className="h-3.5 w-3.5" />
            {t("print")}
          </Button>
          <Button variant="outline" size="sm" className="gap-2" asChild>
            <a
              href={calendarApi.icsUrl({
                start: range.from.toISOString(),
                end: range.to.toISOString(),
              })}
              download
            >
              <Download className="h-3.5 w-3.5" />
              {t("exportIcs")}
            </a>
          </Button>
          {canManage && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setHolidaySheetOpen(true)}
            >
              <Sun className="h-3.5 w-3.5" />
              {t("manageHolidays")}
            </Button>
          )}
          {canWrite && (
            <Button size="sm" className="gap-2" onClick={openCreate}>
              <Plus className="h-3.5 w-3.5" />
              {t("addEvent")}
            </Button>
          )}
        </div>
      </PageHeader>

      {/* Toolbar: view switcher, date navigation, filters */}
      <div className="flex flex-col gap-3 print:hidden lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-lg border border-border/80 bg-card p-0.5">
            {(Object.keys(VIEW_META) as CalendarViewMode[]).map((mode) => {
              const meta = VIEW_META[mode];
              const Icon = meta.icon;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setView(mode)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors",
                    view === mode
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t(meta.labelKey)}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigate(-1)} aria-label="previous">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" className="h-8 px-3 text-xs font-semibold" onClick={goToday}>
              {t("today")}
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigate(1)} aria-label="next">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <span className="ml-1.5 text-sm font-bold text-foreground">{periodLabel}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-card px-2 py-1">
            {FILTER_SOURCES.map(({ key, icon: Icon }) => {
              const active = !disabledSources.has(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() =>
                    setDisabledSources((prev) => {
                      const next = new Set(prev);
                      if (next.has(key)) next.delete(key);
                      else next.add(key);
                      return next;
                    })
                  }
                  title={t(`categories.${key}`)}
                  className={cn(
                    "flex h-7 items-center gap-1 rounded-lg border px-2 text-[11px] font-semibold transition-colors",
                    active
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border/60 bg-transparent text-muted-foreground opacity-60 hover:opacity-100"
                  )}
                >
                  <Icon className="h-3 w-3" />
                  <span className="hidden xl:inline">{t(`categories.${key}`)}</span>
                </button>
              );
            })}
          </div>

          <AppDropdown
            value={classId}
            onChange={(v) => {
              setClassId(v);
              setSectionId("");
            }}
            options={classes.map((c: any) => ({ value: c.id, label: c.name }))}
            placeholder={t("filters.class")}
            searchable
            className="w-[150px]"
            triggerClassName="h-9 text-xs"
          />
          <AppDropdown
            value={sectionId}
            onChange={setSectionId}
            options={sectionOptions}
            placeholder={classId ? t("filters.section") : t("filters.selectClassFirst")}
            disabled={!classId}
            searchable
            className="w-[140px]"
            triggerClassName="h-9 text-xs"
          />
        </div>
      </div>

      {/* View body */}
      {isLoading ? (
        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-border/80">
          {Array.from({ length: 35 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse bg-muted/40" />
          ))}
        </div>
      ) : view === "month" ? (
        <MonthView
          items={visibleItems}
          anchor={cursor}
          weekStartsOn={weekStartsOn}
          onSelectItem={setDetailItem}
          onSelectDay={(day) => {
            setSelectedDay(startOfDay(day));
            setView("day");
          }}
        />
      ) : view === "week" ? (
        <WeekView
          items={visibleItems}
          anchor={cursor}
          weekStartsOn={weekStartsOn}
          onSelectItem={setDetailItem}
          onSelectDay={(day) => {
            setSelectedDay(startOfDay(day));
            setView("day");
          }}
        />
      ) : view === "day" ? (
        <DayView
          items={visibleItems}
          anchor={selectedDay}
          day={selectedDay}
          weekStartsOn={weekStartsOn}
          timetable={timetableData ?? []}
          isTimetableLoading={isTimetableLoading}
          hasClassSelected={!!classId}
          onSelectItem={setDetailItem}
          onSelectDay={(day) => setSelectedDay(startOfDay(day))}
        />
      ) : (
        <AgendaView
          items={visibleItems}
          anchor={cursor}
          weekStartsOn={weekStartsOn}
          onSelectItem={setDetailItem}
          onSelectDay={(day) => {
            setSelectedDay(startOfDay(day));
            setView("day");
          }}
        />
      )}

      {/* Sheets & dialogs */}
      <CalendarEventSheet
        isOpen={eventSheetOpen}
        onClose={() => setEventSheetOpen(false)}
        editing={editingItem}
        defaultDate={selectedDay}
        classes={classes}
        sections={sections}
      />
      <HolidayManagerSheet
        isOpen={holidaySheetOpen}
        onClose={() => setHolidaySheetOpen(false)}
        academicYearId={selectedAcademicYearId}
        canWrite={canManage}
      />
      <EventDetailDialog
        item={detailItem}
        onClose={() => setDetailItem(null)}
        onEdit={handleEditItem}
        canWrite={canWrite}
        settings={settings}
      />
    </div>
  );
}
