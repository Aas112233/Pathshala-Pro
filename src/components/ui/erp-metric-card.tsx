"use client";

import { MoreHorizontal, ArrowUpRight, ArrowDownRight, RefreshCw, ArrowRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "./skeleton";
import { Button } from "./button";

export interface MetricBreakdown {
  label: string;
  count: number | string;
  color?: "emerald" | "amber" | "rose" | "cyan" | "indigo" | "purple" | "slate";
  percentage?: number;
}

export interface ERPMetricCardProps {
  title?: string;
  subtitle?: string;
  value: string | number;
  unit?: string;
  trend?: {
    value: string | number;
    isPositive?: boolean;
    label?: string;
  };
  breakdowns?: MetricBreakdown[];
  actionLabel?: string;
  onAction?: () => void;
  lastUpdated?: string;
  detailsLink?: string;
  onDetailsClick?: () => void;
  onOptionsClick?: () => void;
  icon?: LucideIcon;
  isLoading?: boolean;
  className?: string;
}

const colorMap = {
  emerald: { bg: "bg-[var(--metric-emerald)]", text: "text-[var(--metric-emerald)]", bar: "bg-[var(--metric-emerald)]" },
  amber: { bg: "bg-[var(--metric-amber)]", text: "text-[var(--metric-amber)]", bar: "bg-[var(--metric-amber)]" },
  rose: { bg: "bg-[var(--metric-rose)]", text: "text-[var(--metric-rose)]", bar: "bg-[var(--metric-rose)]" },
  cyan: { bg: "bg-[var(--metric-cyan)]", text: "text-[var(--metric-cyan)]", bar: "bg-[var(--metric-cyan)]" },
  indigo: { bg: "bg-[var(--metric-indigo)]", text: "text-[var(--metric-indigo)]", bar: "bg-[var(--metric-indigo)]" },
  purple: { bg: "bg-[var(--metric-purple)]", text: "text-[var(--metric-purple)]", bar: "bg-[var(--metric-purple)]" },
  slate: { bg: "bg-muted", text: "text-muted-foreground", bar: "bg-muted" },
};

export function ERPMetricCard({
  title,
  subtitle,
  value,
  unit,
  trend,
  breakdowns,
  actionLabel,
  onAction,
  lastUpdated,
  detailsLink,
  onDetailsClick,
  onOptionsClick,
  icon: Icon,
  isLoading = false,
  className,
}: ERPMetricCardProps) {
  if (isLoading) {
    return (
      <div
        className={cn(
          "flex flex-col rounded-lg border border-border/80 bg-card p-4 shadow-none",
          className
        )}
        aria-busy="true"
      >
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <Skeleton className="h-2.5 w-20" />
            <Skeleton className="h-3.5 w-24" />
          </div>
          <Skeleton className="h-9 w-9 rounded-xl" />
        </div>
        <Skeleton className="mt-4 h-9 w-28" />
        <div className="mt-5 space-y-3 border-t border-border/50 pt-3">
          {[75, 55, 40].map((w, i) => (
            <div key={i} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Skeleton className="h-2.5 w-14" />
                <Skeleton className="h-2.5 w-7" />
              </div>
              <Skeleton className="h-1.5" style={{ width: `${w}%` }} />
            </div>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div
      className={cn(
        "group relative flex flex-col justify-between rounded-lg border border-border/80 bg-card p-4 shadow-none transition-colors hover:border-primary/40",
        className
      )}
    >
      {/* Top Header Row */}
      <div>
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-0.5">
            {subtitle && (
              <span className="text-[10px] font-medium tracking-wide text-muted-foreground">
                {subtitle}
              </span>
            )}
            {title && (
              <h3 className="text-sm font-semibold text-foreground/90">{title}</h3>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {detailsLink || onDetailsClick ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={onDetailsClick}
                className="h-auto px-1.5 text-xs font-medium text-primary hover:text-primary/80 hover:bg-transparent"
              >
                DETAILS
              </Button>
            ) : null}

            {onOptionsClick && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onOptionsClick}
                className="h-7 w-7 text-muted-foreground/60 hover:bg-muted hover:text-foreground"
                aria-label="Options"
                title="Options"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            )}

            {Icon && (
              <Icon className="mt-0.5 h-5 w-5 text-muted-foreground" />
            )}
          </div>
        </div>

        {/* Hero Value & Trend */}
        <div className="mt-3 flex items-baseline gap-2.5">
          <span className="text-2xl font-semibold tracking-tight text-foreground">
            {value}
          </span>
          {unit && (
            <span className="text-sm font-medium text-muted-foreground">
              {unit}
            </span>
          )}
          {trend && (
            <div
              className={cn(
                "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold",
                trend.isPositive !== false
                  ? "bg-[var(--status-success-bg)] text-[var(--status-success-text)]"
                  : "bg-[var(--status-error-bg)] text-[var(--status-error-text)]"
              )}
            >
              {trend.isPositive !== false ? (
                <ArrowUpRight className="h-3 w-3" />
              ) : (
                <ArrowDownRight className="h-3 w-3" />
              )}
              <span>{trend.value}</span>
            </div>
          )}
        </div>

        {/* Sub-metric Breakdown Lines */}
        {breakdowns && breakdowns.length > 0 && (
          <div className="mt-4 space-y-2.5 pt-2 border-t border-border/50">
            {breakdowns.map((item, idx) => {
              const theme = colorMap[item.color || "indigo"];
              return (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="font-semibold text-foreground">{item.count}</span>
                  </div>
                  {item.percentage !== undefined ? (
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
                      <div
                        className={cn("h-full rounded-full transition-all duration-500", theme.bar)}
                        style={{ width: `${Math.min(Math.max(item.percentage, 0), 100)}%` }}
                      />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer: Action Button or Last Updated Indicator */}
      {(actionLabel || lastUpdated) && (
        <div className="mt-5 pt-3 border-t border-border/50 flex items-center justify-between">
          {actionLabel ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={onAction}
              className="h-auto px-1 text-xs font-medium text-muted-foreground hover:text-primary hover:bg-transparent group/action"
            >
              <span>{actionLabel}</span>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/60 transition-transform group-hover/action:translate-x-0.5 group-hover/action:text-primary" />
            </Button>
          ) : null}
          {lastUpdated ? (
            <div className="flex items-center justify-between text-[11px] text-muted-foreground/70">
              <span className="flex items-center gap-1">
                <RefreshCw className="h-3 w-3 animate-spin-slow" />
                {lastUpdated}
              </span>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
