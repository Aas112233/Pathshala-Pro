"use client";

import { TopSheet } from "@/components/ui/top-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Calendar, 
  User, 
  Eye, 
  Pin, 
  Clock, 
  Share2, 
  Printer,
  Building2,
  Tag,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

interface NoticeDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  notice: any;
}

export function NoticeDetailModal({
  isOpen,
  onClose,
  notice,
}: NoticeDetailModalProps) {
  if (!notice) return null;

  const isGlobal = notice.scope === "GLOBAL";

  const getPriorityBadge = (priority: string) => {
    const p = (priority || "NORMAL").toUpperCase();
    if (p === "URGENT") {
      return (
        <Badge variant="destructive" className="bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 text-[10px] font-bold">
          URGENT
        </Badge>
      );
    }
    if (p === "HIGH") {
      return (
        <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-[10px] font-bold">
          HIGH PRIORITY
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-[10px] font-mono">
        {p}
      </Badge>
    );
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(
      `Notice: ${notice.title}\nDate: ${new Date(notice.publishDate).toLocaleDateString()}\n\n${notice.content}`
    );
    toast.success("Copied");
  };

  return (
    <TopSheet
      isOpen={isOpen}
      onClose={onClose}
      title={notice.title}
      subtitle={isGlobal ? "Global Platform Announcement" : `Institutional Circular • ${notice.category}`}
      description={`Published on ${new Date(notice.publishDate).toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })}`}
      maxWidth="3xl"
    >
      <div className="space-y-6">
        {/* Header Metadata Ribbon */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-lg border border-border bg-muted/20 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            {notice.isPinned && (
              <Badge className="bg-primary text-primary-foreground gap-1 text-[10px]">
                <Pin className="h-3 w-3" /> Pinned
              </Badge>
            )}
            {getPriorityBadge(notice.priority)}
            <Badge variant="outline" className="text-[10px]">
              Audience: {notice.audience}
            </Badge>
            {isGlobal && (
              <Badge className="bg-purple-600 text-white text-[10px]">
                SuperAdmin Broadcast
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-4 text-muted-foreground text-[11px]">
            <span className="flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" />
              {notice.viewsCount || 0} reads
            </span>
            <span className="flex items-center gap-1 font-mono">
              <Clock className="h-3.5 w-3.5" />
              {new Date(notice.publishDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 rounded-lg border border-border/80 bg-card text-foreground whitespace-pre-wrap text-sm leading-relaxed font-sans">
          {notice.content}
        </div>

        {/* Author & Validity Footer */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-border text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
              <User className="h-3.5 w-3.5" />
            </div>
            <div>
              <p className="font-semibold text-foreground">{notice.authorName || "Principal / Administration"}</p>
              <p className="text-[10px] text-muted-foreground capitalize">{notice.authorRole?.toLowerCase() || "Administrator"}</p>
            </div>
          </div>

          {notice.expiresAt && (
            <div className="text-right text-[11px]">
              <span className="text-muted-foreground">Valid until: </span>
              <span className="font-semibold text-foreground font-mono">{new Date(notice.expiresAt).toLocaleDateString()}</span>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-end gap-2.5 pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="text-xs h-8 gap-1.5"
          >
            <Share2 className="h-3.5 w-3.5" />
            Copy Circular
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="text-xs h-8 gap-1.5"
          >
            <Printer className="h-3.5 w-3.5" />
            Print / PDF
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onClose}
            className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs h-8"
          >
            Done
          </Button>
        </div>
      </div>
    </TopSheet>
  );
}
