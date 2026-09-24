"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { FileSearch, Search, type LucideIcon } from "lucide-react";

interface ReportEmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
  /** Overrides the default FileSearch glyph. */
  icon?: LucideIcon;
  /**
   * `denied` swaps the accent from the primary token to the destructive token,
   * for permission states where "no results" would be a misleading message.
   */
  variant?: "default" | "denied";
}

export function ReportEmptyState({
  title,
  description,
  actionLabel,
  onAction,
  className,
  icon: Icon = FileSearch,
  variant = "default",
}: ReportEmptyStateProps) {
  const denied = variant === "denied";

  return (
    <Card className={cn("border-dashed border-border/80 bg-muted/20", className)}>
      <CardContent className="flex flex-col items-center justify-center gap-4 px-6 py-12 text-center">
        <div
          className={cn(
            "flex h-14 w-14 items-center justify-center rounded-lg",
            denied ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
          )}
        >
          <Icon className="h-7 w-7" />
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          <p className="max-w-xl text-sm text-muted-foreground">{description}</p>
        </div>
        {actionLabel && onAction ? (
          <Button onClick={onAction}>
            <Search className="mr-2 h-4 w-4" />
            {actionLabel}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
