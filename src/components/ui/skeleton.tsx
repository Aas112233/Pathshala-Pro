import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}

/** Row-pulse skeleton matching the table body dimensions */
export function TableSkeleton({
  rows = 5,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div className={cn("w-full space-y-3 px-4 py-4", className)} aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="hidden h-4 w-28 sm:block" />
          <Skeleton className="hidden h-4 w-20 md:block" />
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-8 w-8 shrink-0 rounded-md" />
        </div>
      ))}
    </div>
  );
}

/** Skeleton mirroring the ERPMetricCard anatomy: title row, hero number, breakdown bars */
export function MetricCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border/80 bg-card p-4 shadow-none",
        className
      )}
      aria-busy="true"
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
      <Skeleton className="mt-4 h-9 w-28" />
      <div className="mt-5 space-y-3">
        {[80, 60, 45].map((w, i) => (
          <div key={i} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Skeleton className="h-2.5 w-16" />
              <Skeleton className="h-2.5 w-8" />
            </div>
            <Skeleton className="h-1.5" style={{ width: `${w}%` }} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Responsive card-grid placeholder for grid/list views */
export function CardGridSkeleton({
  count = 6,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3",
        className
      )}
      aria-busy="true"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-lg border border-border/80 bg-card p-4 shadow-none"
        >
          <div className="flex items-center gap-3">
            <Skeleton className="h-12 w-12 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
          </div>
          <div className="mt-4 flex items-center justify-between">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Full-width chart/widget placeholder */
export function ChartWidgetSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border/80 bg-card p-4 shadow-none",
        className
      )}
      aria-busy="true"
    >
      <Skeleton className="h-4 w-36" />
      <div className="mt-6 flex items-center justify-center">
        <Skeleton className="h-40 w-40 rounded-full" />
      </div>
      <div className="mt-6 flex items-end justify-between gap-2">
        {[45, 70, 55, 85, 60, 75, 50].map((h, i) => (
          <Skeleton key={i} className="w-full" style={{ height: `${h}px` }} />
        ))}
      </div>
    </div>
  );
}

export { Skeleton };
