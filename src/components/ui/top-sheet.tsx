"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { useUnsavedChanges } from "@/providers/unsaved-changes-provider";

export interface TopSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  description?: string;
  badge?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl" | "6xl" | "full";
  closeOnOutsideClick?: boolean;
  isDirty?: boolean;
}

const ANIMATION_DURATION = 250; // ms

export function TopSheet({
  isOpen,
  onClose,
  title,
  subtitle,
  description,
  badge,
  children,
  footer,
  className,
  maxWidth = "4xl",
  closeOnOutsideClick = true,
  isDirty = false,
}: TopSheetProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [animationState, setAnimationState] = useState<"entering" | "open" | "exiting" | "closed">("closed");
  const [formDirty, setFormDirty] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const sheetId = useId();
  const effectiveDirty = isDirty || formDirty;
  const { confirmExit } = useUnsavedChanges(isOpen && effectiveDirty, `top-sheet-${sheetId}`);

  const handleSafeClose = () => {
    if (effectiveDirty) {
      confirmExit(onClose);
    } else {
      onClose();
    }
  };

  useEffect(() => {
    if (isOpen) {
      setIsMounted(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setAnimationState("entering");
          const timer = setTimeout(() => setAnimationState("open"), ANIMATION_DURATION);
          return () => clearTimeout(timer);
        });
      });
      document.body.style.overflow = "hidden";
    } else if (isMounted) {
      setAnimationState("exiting");
      const timer = setTimeout(() => {
        setAnimationState("closed");
        setIsMounted(false);
        document.body.style.overflow = "unset";
      }, ANIMATION_DURATION);
      return () => clearTimeout(timer);
    }
  }, [isOpen, isMounted]);

  useEffect(() => {
    return () => {
      document.body.style.overflow = "unset";
    };
  }, []);

  useEffect(() => {
    if (!isMounted || !isOpen || !containerRef.current) return;
    const container = containerRef.current;
    const markDirty = () => setFormDirty(true);
    container.addEventListener("input", markDirty, true);
    container.addEventListener("change", markDirty, true);
    return () => {
      container.removeEventListener("input", markDirty, true);
      container.removeEventListener("change", markDirty, true);
    };
  }, [isMounted, isOpen]);

  useEffect(() => {
    if (!isOpen) setFormDirty(false);
  }, [isOpen]);

  // Escape key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        handleSafeClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, effectiveDirty]);

  if (!isMounted || typeof document === "undefined") return null;

  const isVisible = animationState === "entering" || animationState === "open";

  const maxWidthClasses: Record<string, string> = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
    "3xl": "max-w-3xl",
    "4xl": "max-w-4xl",
    "5xl": "max-w-5xl",
    "6xl": "max-w-6xl",
    full: "max-w-[96vw]",
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center">
      {/* Backdrop with smooth blur & fade */}
      <div
        className={cn(
          "fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity",
          isVisible ? "opacity-100 duration-250 ease-out" : "opacity-0 duration-200 ease-in"
        )}
        onClick={closeOnOutsideClick ? handleSafeClose : undefined}
        aria-hidden
      />

      {/* Top Drawer Content — Slides down from top of viewport */}
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="top-sheet-title"
        aria-describedby={description ? "top-sheet-desc" : undefined}
        className={cn(
          "relative z-50 w-full flex flex-col max-h-[92vh] bg-background border-x border-b border-border shadow-xl rounded-b-lg overflow-hidden will-change-[transform,opacity] transform-gpu transition-[transform,opacity]",
          isVisible
            ? "duration-300 ease-out translate-y-0 opacity-100"
            : "duration-200 ease-in -translate-y-6 opacity-0",
          maxWidthClasses[maxWidth],
          className
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-border/80 bg-muted/20">
          <div className="space-y-1 pr-6">
            <div className="flex items-center gap-2.5">
              <h2 id="top-sheet-title" className="text-base font-semibold text-foreground tracking-tight">
                {title}
              </h2>
              {badge}
            </div>
            {subtitle && (
              <p className="text-xs font-medium text-primary/90">{subtitle}</p>
            )}
            {description && (
              <p id="top-sheet-desc" className="text-xs text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSafeClose}
            className="h-8 w-8 p-0 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/80 shrink-0"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {children}
        </div>

        {/* Sticky Footer Action Bar */}
        {footer && (
          <div className="sticky bottom-0 z-10 border-t border-border/80 bg-background/98 px-6 py-3.5 flex items-center justify-between">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
