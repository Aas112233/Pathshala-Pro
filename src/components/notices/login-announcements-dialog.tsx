"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/providers/auth-provider";
import {
  Megaphone,
  Pin,
  AlertTriangle,
  Calendar,
  User,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  X,
  CreditCard,
  GraduationCap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  type NoticeItem,
  getAcknowledgedLoginAnnouncements,
  acknowledgeLoginAnnouncements,
  markNoticeAsRead,
  formatNoticeRelativeTime,
} from "@/lib/notices-helpers";
import { NoticeDetailModal } from "./notice-detail-modal";

export function LoginAnnouncementsDialog() {
  const t = useTranslations();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [announcements, setAnnouncements] = useState<NoticeItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [viewingDetail, setViewingDetail] = useState<NoticeItem | null>(null);

  const checkLoginAnnouncements = useCallback(async () => {
    if (!user || isAuthLoading) return;

    try {
      const res = await fetch("/api/notices?activeOnly=true");
      const json = await res.json();

      if (json.success && Array.isArray(json.data) && json.data.length > 0) {
        const ackSet = getAcknowledgedLoginAnnouncements();
        
        // Filter for urgent, pinned, or unacknowledged announcements
        const unacknowledged = json.data.filter((n: NoticeItem) => {
          if (ackSet.has(n.id)) return false;
          // Show if pinned, urgent, or published in last 14 days
          const pubDate = new Date(n.publishDate).getTime();
          const fourteenDaysAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
          return n.isPinned || n.priority === "URGENT" || n.priority === "HIGH" || pubDate > fourteenDaysAgo;
        });

        if (unacknowledged.length > 0) {
          setAnnouncements(unacknowledged);
          setCurrentIndex(0);
          setIsOpen(true);
        }
      }
    } catch {
      // Silent catch for login announcement check
    }
  }, [user, isAuthLoading]);

  useEffect(() => {
    // Run announcement check on login / initial load
    void checkLoginAnnouncements();
  }, [checkLoginAnnouncements]);

  if (!isOpen || announcements.length === 0) {
    return viewingDetail ? (
      <NoticeDetailModal
        isOpen={!!viewingDetail}
        onClose={() => setViewingDetail(null)}
        notice={viewingDetail}
      />
    ) : null;
  }

  const activeNotice = announcements[currentIndex];
  if (!activeNotice) return null;

  const isUrgent = activeNotice.priority === "URGENT";
  const isGlobal = activeNotice.scope === "GLOBAL";

  const handleDismiss = () => {
    setIsOpen(false);
  };

  const handleAcknowledgeAll = () => {
    const ids = announcements.map((n) => n.id);
    acknowledgeLoginAnnouncements(ids);
    ids.forEach((id) => markNoticeAsRead(id));
    setIsOpen(false);
  };

  const handleAcknowledgeCurrent = () => {
    acknowledgeLoginAnnouncements([activeNotice.id]);
    markNoticeAsRead(activeNotice.id);
    if (currentIndex < announcements.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setIsOpen(false);
    }
  };

  const handleOpenDetail = () => {
    markNoticeAsRead(activeNotice.id);
    setViewingDetail(activeNotice);
  };

  const viewDetailNotice = viewingDetail;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in-0 duration-200">
        <div
          role="dialog"
          aria-modal="true"
          className="relative w-full max-w-lg rounded-2xl border border-border/80 bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-200"
        >
          {/* Top Banner Ribbon */}
          <div className="flex items-center justify-between pb-4 border-b border-border/60">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-xl",
                  isUrgent
                    ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                    : "bg-primary/10 text-primary"
                )}
              >
                {isUrgent ? (
                  <AlertTriangle className="h-5 w-5 animate-pulse" />
                ) : (
                  <Megaphone className="h-5 w-5" />
                )}
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  {t("announcements.welcomeTitle")}
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  {announcements.length > 1
                    ? `Announcement ${currentIndex + 1} of ${announcements.length}`
                    : t("announcements.welcomeSubtitle")}
                </p>
              </div>
            </div>

            <button
              onClick={handleDismiss}
              className="p-1 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              title={t("announcements.dismiss")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Announcement Card Content */}
          <div className="py-5 space-y-3">
            {/* Metadata Tags */}
            <div className="flex flex-wrap items-center gap-1.5">
              {activeNotice.isPinned && (
                <Badge className="bg-indigo-600 text-white gap-1 text-[10px] px-2 py-0.5">
                  <Pin className="h-2.5 w-2.5 fill-white" /> {t("announcements.pinnedBadge")}
                </Badge>
              )}
              {isUrgent && (
                <Badge variant="destructive" className="bg-rose-600 text-white text-[10px] px-2 py-0.5 font-bold">
                  {t("announcements.urgentBadge")}
                </Badge>
              )}
              <Badge variant="outline" className="text-[10px] uppercase font-mono px-2 py-0.5">
                {activeNotice.category}
              </Badge>
              {isGlobal && (
                <Badge className="bg-purple-600 text-white text-[10px] px-2 py-0.5">
                  {t("announcements.platformAlert")}
                </Badge>
              )}
              <span className="text-[11px] text-muted-foreground font-mono ml-auto">
                {formatNoticeRelativeTime(activeNotice.publishDate)}
              </span>
            </div>

            {/* Title */}
            <h4 className="text-base font-bold text-foreground leading-snug">
              {activeNotice.title}
            </h4>

            {/* Excerpt Body */}
            <div className="p-3.5 rounded-xl border border-border/70 bg-muted/20 text-xs text-foreground leading-relaxed max-h-48 overflow-y-auto whitespace-pre-wrap">
              {activeNotice.content}
            </div>

            {/* Author Footer */}
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
              <div className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-primary" />
                <span className="font-medium text-foreground">
                  {activeNotice.authorName || "Principal / Administration"}
                </span>
                <span className="text-[10px] capitalize">
                  • {activeNotice.authorRole?.toLowerCase() || "Admin"}
                </span>
              </div>
              <button
                onClick={handleOpenDetail}
                className="text-xs font-semibold text-primary hover:text-primary/80 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <span>{t("announcements.viewNotice")}</span>
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          </div>

          {/* Navigation & Action Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-border/60 gap-2">
            {/* Pagination Controls */}
            {announcements.length > 1 ? (
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex((prev) => prev - 1)}
                  className="h-8 w-8 p-0 rounded-lg cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs text-muted-foreground font-mono px-1">
                  {currentIndex + 1}/{announcements.length}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentIndex === announcements.length - 1}
                  onClick={() => setCurrentIndex((prev) => prev + 1)}
                  className="h-8 w-8 p-0 rounded-lg cursor-pointer"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div />
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDismiss}
                className="h-8 text-xs cursor-pointer"
              >
                {t("announcements.dismiss")}
              </Button>
              <Button
                size="sm"
                onClick={handleAcknowledgeAll}
                className="h-8 text-xs bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5 shadow-xs cursor-pointer"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>{t("announcements.dontShowAgain")}</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {viewDetailNotice && (
        <NoticeDetailModal
          isOpen={!!viewDetailNotice}
          onClose={() => setViewingDetail(null)}
          notice={viewDetailNotice}
        />
      )}
    </>
  );
}
