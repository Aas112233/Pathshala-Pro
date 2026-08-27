"use client";

import { MoreHorizontal, ArrowUpRight, ArrowDownRight, RefreshCw } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { Skeleton } from "./skeleton";

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
  emerald: { bg: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400", bar: "bg-emerald-500" },
  amber: { bg: "bg-amber-500", text: "text-amber-600 dark:text-amber-400", bar: "bg-amber-500" },
  rose: { bg: "bg-rose-500", text: "text-rose-600 dark:text-rose-400", bar: "bg-rose-500" },
  cyan: { bg: "bg-cyan-500", text: "text-cyan-600 dark:text-cyan-400", bar: "bg-cyan-500" },
  indigo: { bg: "bg-indigo-500", text: "text-indigo-600 dark:text-indigo-400", bar: "bg-indigo-500" },
  purple: { bg: "bg-purple-500", text: "text-purple-600 dark:text-purple-400", bar: "bg-purple-500" },
  slate: { bg: "bg-slate-500", text: "text-slate-600 dark:text-slate-400", bar: "bg-slate-500" },
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
          "flex flex-col rounded-2xl border border-border/70 bg-card p-5 shadow-xs",
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
        "group relative flex flex-col justify-between rounded-2xl border border-border/70 bg-card p-5 shadow-xs transition-all hover:border-border hover:shadow-md",
        className
      )}
    >
      {/* Top Header Row */}
      <div>
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-0.5">
            {subtitle && (
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                {subtitle}
              </span>
            )}
            {title && (
              <h3 className="text-sm font-semibold text-foreground/90">{title}</h3>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {detailsLink || onDetailsClick ? (
              <button
                onClick={onDetailsClick}
                className="text-[11px] font-semibold uppercase tracking-wider text-primary hover:text-primary/80 transition-colors"
              >
                DETAILS
              </button>
            ) : null}

            {onOptionsClick && (
              <button
                onClick={onOptionsClick}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground/60 hover:bg-muted hover:text-foreground transition-colors"
                title="Options"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            )}

            {Icon && (
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
            )}
          </div>
        </div>

        {/* Hero Value & Trend */}
        <div className="mt-3 flex items-baseline gap-2.5">
          <span className="text-3xl font-bold tracking-tight text-foreground">
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
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
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
        <div className="mt-5 pt-3 border-t border-border/50">
          {actionLabel ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onAction}
              className="w-full rounded-xl text-xs font-medium text-foreground hover:bg-primary/5 hover:text-primary hover:border-primary/40 transition-all"
            >
              {actionLabel}
            </Button>
          ) : lastUpdated ? (
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
