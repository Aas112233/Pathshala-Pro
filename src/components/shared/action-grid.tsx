import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface ActionItem {
  id: string;
  label: string;
  description?: string;
  icon?: LucideIcon;
  value?: string | number;
  onClick?: () => void;
  disabled?: boolean;
}

interface ActionGridProps {
  items: ActionItem[];
  columns?: 2 | 3 | 4;
  className?: string;
}

const gridCols = {
  2: "grid-cols-2",
  3: "grid-cols-2 sm:grid-cols-3",
  4: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
};

export function ActionGrid({
  items,
  columns = 3,
  className,
}: ActionGridProps) {
  return (
    <div className={cn("grid gap-3", gridCols[columns], className)}>
      {items.map((item) => (
        <button
          key={item.id}
          onClick={item.onClick}
          disabled={item.disabled}
          className={cn(
            "flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 text-center transition-all hover:border-primary/30 hover:bg-primary/5 hover:shadow-sm",
            item.disabled && "cursor-not-allowed opacity-50"
          )}
        >
          {item.icon && (
            <item.icon className="h-6 w-6 text-primary" />
          )}
          {item.value !== undefined && (
            <span className="text-2xl font-bold text-foreground">
              {item.value}
            </span>
          )}
          <span className="text-sm font-medium text-foreground">
            {item.label}
          </span>
          {item.description && (
            <span className="text-xs text-muted-foreground">
              {item.description}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
