"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  Bell,
  CheckCheck,
  Check,
  Pin,
  Megaphone,
  Calendar,
  CreditCard,
  GraduationCap,
  AlertTriangle,
  FileText,
  ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  NOTIFICATION_TABS,
  type NotificationCategoryGroup,
  type NoticeItem,
  filterNoticesByCategory,
  calculateNotificationCategoryCounts,
  getReadNoticeIds,
  markNoticeAsRead,
  markAllNoticesAsRead,
  formatNoticeRelativeTime,
} from "@/lib/notices-helpers";
import { NoticeDetailModal } from "@/components/notices/notice-detail-modal";

export function HeaderNotificationCenter() {
  const t = useTranslations();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<NotificationCategoryGroup>("ALL");
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [viewingNotice, setViewingNotice] = useState<NoticeItem | null>(null);
  const [mounted, setMounted] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    setReadIds(getReadNoticeIds());
  }, []);

  const fetchNotices = useCallback(async () => {
    try {
      const res = await fetch("/api/notices?activeOnly=true");
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setNotices(json.data);
      }
    } catch {
      // Silent catch for header notification polling
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotices();
    // Optional refresh interval every 60s
    const interval = setInterval(fetchNotices, 60000);
    return () => clearInterval(interval);
  }, [fetchNotices]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const counts = useMemo(
    () => calculateNotificationCategoryCounts(notices, readIds),
    [notices, readIds]
  );

  const filteredNotices = useMemo(
    () => filterNoticesByCategory(notices, activeTab),
    [notices, activeTab]
  );

  const totalUnread = counts.ALL.unread;
  const hasUrgent = notices.some((n) => n.priority === "URGENT" && !readIds.has(n.id));

  const handleMarkAllRead = (e: React.MouseEvent) => {
    e.stopPropagation();
    const allIds = notices.map((n) => n.id);
    markAllNoticesAsRead(allIds);
    setReadIds(getReadNoticeIds());
  };

  const handleSelectNotice = (notice: NoticeItem) => {
    markNoticeAsRead(notice.id);
    setReadIds(getReadNoticeIds());
    setViewingNotice(notice);
    setIsOpen(false);
  };

  const handleToggleRead = (e: React.MouseEvent, noticeId: string) => {
    e.stopPropagation();
    markNoticeAsRead(noticeId);
    setReadIds(getReadNoticeIds());
  };

  const getCategoryIcon = (category: string, priority: string) => {
    const cat = (category || "").toUpperCase();
    const pri = (priority || "").toUpperCase();

    if (pri === "URGENT" || cat === "URGENT_ALERT") {
      return <AlertTriangle className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />;
    }
    if (cat === "ACADEMIC" || cat === "EXAMINATION" || cat === "EXAM") {
      return <GraduationCap className="h-3.5 w-3.5 text-primary" />;
    }
    if (cat === "FEE_REMINDER" || cat === "FEE" || cat === "BILLING_ALERT") {
      return <CreditCard className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />;
    }
    if (cat === "EVENT" || cat === "HOLIDAY") {
      return <Calendar className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />;
    }
    return <Megaphone className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer",
          isOpen && "bg-muted text-foreground"
        )}
        title={t("notifications.title")}
        aria-label={t("notifications.title")}
      >
        <Bell className="h-4 w-4" />
        {mounted && totalUnread > 0 && (
          <span
            className={cn(
              "absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white shadow-xs",
              hasUrgent ? "bg-rose-600 animate-pulse" : "bg-primary"
            )}
          >
            {totalUnread > 99 ? "99+" : totalUnread}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-lg border border-border/80 bg-popover text-popover-foreground shadow-xl z-50 animate-in fade-in-50 zoom-in-95 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-3 bg-muted/20">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-foreground">
                {t("notifications.title")}
              </span>
              {mounted && totalUnread > 0 && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-mono">
                  {totalUnread} new
                </Badge>
              )}
            </div>
            {mounted && totalUnread > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 font-medium transition-colors cursor-pointer"
                title={t("notifications.markAllRead")}
              >
                <CheckCheck className="h-3.5 w-3.5" />
                <span>{t("notifications.markAllRead")}</span>
              </button>
            )}
          </div>

          {/* Categorized Filter Tabs */}
          <div className="flex items-center gap-1 border-b border-border/50 px-2 py-1.5 overflow-x-auto bg-muted/10 no-scrollbar">
            {NOTIFICATION_TABS.map((tab) => {
              const tabCount = counts[tab.id];
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-all cursor-pointer",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <span>{t(tab.labelKey as any) || tab.fallbackLabel}</span>
                  {mounted && tabCount.unread > 0 && (
                    <span
                      className={cn(
                        "flex h-4 min-w-[14px] items-center justify-center rounded-full px-1 text-[9px] font-bold",
                        isActive
                          ? "bg-primary-foreground text-primary"
                          : "bg-primary/15 text-primary"
                      )}
                    >
                      {tabCount.unread}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Notifications List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-border/40">
            {isLoading ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                Loading notifications...
              </div>
            ) : filteredNotices.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground space-y-1">
                <FileText className="h-6 w-6 mx-auto text-muted-foreground/40 mb-2" />
                <p className="font-medium text-foreground/80">
                  {t("notifications.noNotifications")}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  You are all caught up in this category.
                </p>
              </div>
            ) : (
              filteredNotices.map((notice) => {
                const isRead = mounted ? readIds.has(notice.id) : true;
                const isUrgent = notice.priority === "URGENT";
                const isGlobal = notice.scope === "GLOBAL";

                return (
                  <div
                    key={notice.id}
                    onClick={() => handleSelectNotice(notice)}
                    className={cn(
                      "group relative flex items-start gap-3 p-3.5 text-left transition-all cursor-pointer hover:bg-muted/50",
                      !isRead && "bg-primary/[0.03] dark:bg-primary/[0.06]"
                    )}
                  >
                    {/* Unread indicator dot */}
                    {!isRead && (
                      <span
                        className={cn(
                          "absolute left-1.5 top-5 h-1.5 w-1.5 rounded-full",
                          isUrgent ? "bg-rose-500" : "bg-primary"
                        )}
                      />
                    )}

                    {/* Category Icon Badge */}
                    <div
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
                        isUrgent
                          ? "border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/60"
                          : "border-border/60 bg-muted/40"
                      )}
                    >
                      {getCategoryIcon(notice.category, notice.priority)}
                    </div>

                    {/* Notice Text Content */}
                    <div className="flex-1 min-w-0 pr-1">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        {notice.isPinned && (
                          <span className="flex items-center gap-0.5 text-[9px] font-medium text-primary bg-primary/10 px-1 rounded">
                            <Pin className="h-2.5 w-2.5 fill-indigo-600" /> Pinned
                          </span>
                        )}
                        {isUrgent && (
                          <span className="text-[9px] font-bold uppercase text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-1 rounded">
                            Urgent
                          </span>
                        )}
                        {isGlobal && (
                          <span className="text-[9px] font-bold uppercase text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/60 px-1 rounded">
                            SuperAdmin
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground font-mono ml-auto shrink-0">
                          {formatNoticeRelativeTime(notice.publishDate)}
                        </span>
                      </div>

                      <h4
                        className={cn(
                          "text-xs font-semibold text-foreground line-clamp-1 group-hover:text-primary transition-colors",
                          !isRead && "font-bold"
                        )}
                      >
                        {notice.title}
                      </h4>
                      <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed">
                        {notice.content}
                      </p>
                    </div>

                    {/* Quick action button */}
                    {!isRead && (
                      <button
                        onClick={(e) => handleToggleRead(e, notice.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-primary transition-all self-center"
                        title={t("notifications.markAsRead")}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Navigation Link */}
          <div className="border-t border-border/60 p-2.5 bg-muted/20 text-center">
            <Link
              href="/notices"
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors py-0.5"
            >
              <span>{t("notifications.viewNoticeboard")}</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* Notice Detail TopSheet Modal */}
      {viewingNotice && (
        <NoticeDetailModal
          isOpen={!!viewingNotice}
          onClose={() => setViewingNotice(null)}
          notice={viewingNotice}
        />
      )}
    </div>
  );
}
