"use client";

import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { useTranslations } from "next-intl";
import { MoreVertical, Pencil, Trash2, Eye, TrendingUp, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { StudentProfile } from "@/types/entities";

interface StudentActionsDropdownProps {
  student: StudentProfile;
  onEdit?: (student: StudentProfile) => void;
  onView?: (student: StudentProfile) => void;
  onViewPerformance?: (student: StudentProfile) => void;
  onDelete?: (student: StudentProfile) => void;
}

export function StudentActionsDropdown({
  student,
  onEdit,
  onView,
  onViewPerformance,
  onDelete,
}: StudentActionsDropdownProps) {
  const t = useTranslations("students");
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useLayoutEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + 4,
        left: rect.right - 160,
      });
    }
  }, [isOpen]);

  const handleAction = (callback?: (student: StudentProfile) => void) => {
    setIsOpen(false);
    callback?.(student);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        ref={triggerRef}
        variant="ghost"
        size="icon-sm"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={t("actions.studentActions")}
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <MoreVertical className="h-4 w-4" />
      </Button>

      {isOpen && (
        <div
          className="fixed z-50 min-w-[160px] overflow-hidden rounded-lg border border-border bg-popover shadow-lg"
          style={{
            top: `${dropdownPos.top}px`,
            left: `${dropdownPos.left}px`,
          }}
        >
          <div className="p-1" role="menu">
            {onView && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 rounded-md px-3 py-2 text-sm text-popover-foreground hover:bg-muted"
                onClick={() => handleAction(onView)}
              >
                <Eye className="h-4 w-4" />
                <span>{t("actions.viewDetails")}</span>
              </Button>
            )}
            {onViewPerformance && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 rounded-md px-3 py-2 text-sm text-popover-foreground hover:bg-muted"
                onClick={() => handleAction(onViewPerformance)}
              >
                <TrendingUp className="h-4 w-4 text-primary" />
                <span>{t("actions.viewPerformance")}</span>
              </Button>
            )}
            {onEdit && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 rounded-md px-3 py-2 text-sm text-popover-foreground hover:bg-muted"
                onClick={() => handleAction(onEdit)}
              >
                <Pencil className="h-4 w-4" />
                <span>{t("actions.edit")}</span>
              </Button>
            )}
            {onDelete && (
              <Button
                variant="destructive"
                size="sm"
                className="w-full justify-start gap-2 rounded-md px-3 py-2 text-sm hover:bg-destructive/10"
                onClick={async () => {
                  setIsDeleting(true);
                  try {
                    await onDelete(student);
                    setIsOpen(false);
                  } finally {
                    setIsDeleting(false);
                  }
                }}
                disabled={isDeleting}
              >
                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                <span>{isDeleting ? t("actions.deleting") : t("actions.delete")}</span>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
