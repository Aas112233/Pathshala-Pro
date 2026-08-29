"use client";

import React, { useState, type ReactNode } from "react";
import {
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  SlidersHorizontal,
  Download,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { Input } from "./input";
import { Checkbox } from "./checkbox";
import { TableSkeleton } from "./skeleton";

export interface ColumnDef<T> {
  key: string;
  header: ReactNode | ((props: { allSelected: boolean; onToggleAll: () => void }) => ReactNode);
  cell: (row: T, index: number) => ReactNode;
  className?: string;
  headerClassName?: string;
}

export interface ERPDataTableProps<T> {
  title?: string;
  subtitle?: string;
  data: T[];
  columns: ColumnDef<T>[];
  keyExtractor: (row: T, index: number) => string | number;
  // Search & Filter
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (val: string) => void;
  filterLabel?: string;
  activeFilterCount?: number;
  onFilterClick?: () => void;
  // Header Actions
  actionLabel?: string;
  actionIcon?: ReactNode;
  onActionClick?: () => void;
  secondaryAction?: ReactNode;
  // Selection
  selectedIds?: (string | number)[];
  onSelectionChange?: (selectedIds: (string | number)[]) => void;
  // Pagination
  page?: number;
  pageSize?: number;
  totalCount?: number;
  pageSizeOptions?: number[];
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  // Row Click
  onRowClick?: (row: T) => void;
  isLoading?: boolean;
  emptyState?: ReactNode;
  className?: string;
}

export function ERPDataTable<T>({
  title,
  subtitle,
  data,
  columns,
  keyExtractor,
  searchPlaceholder = "Search by name, ID or keyword...",
  searchValue,
  onSearchChange,
  filterLabel = "Filter",
  activeFilterCount = 0,
  onFilterClick,
  actionLabel,
  actionIcon,
  onActionClick,
  secondaryAction,
  selectedIds,
  onSelectionChange,
  page = 1,
  pageSize = 10,
  totalCount = data.length,
  pageSizeOptions = [5, 10, 20, 50],
  onPageChange,
  onPageSizeChange,
  onRowClick,
  isLoading = false,
  emptyState,
  className,
}: ERPDataTableProps<T>) {
  const [internalSearch, setInternalSearch] = useState("");
  const isSearchControlled = searchValue !== undefined;
  const currentSearch = isSearchControlled ? searchValue : internalSearch;

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!isSearchControlled) setInternalSearch(val);
    onSearchChange?.(val);
  };

  const allRowKeys = data.map((row, idx) => keyExtractor(row, idx));
  const isAllSelected =
    data.length > 0 &&
    selectedIds !== undefined &&
    data.every((row, idx) => selectedIds.includes(keyExtractor(row, idx)));

  const handleToggleAll = () => {
    if (!onSelectionChange) return;
    if (isAllSelected) {
      onSelectionChange([]);
    } else {
      onSelectionChange(allRowKeys);
    }
  };

  const handleToggleRow = (key: string | number) => {
    if (!onSelectionChange || !selectedIds) return;
    if (selectedIds.includes(key)) {
      onSelectionChange(selectedIds.filter((id) => id !== key));
    } else {
      onSelectionChange([...selectedIds, key]);
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  const startRow = (page - 1) * pageSize + 1;
  const endRow = Math.min(page * pageSize, totalCount);

  return (
    <div
      className={cn(
        "flex flex-col rounded-lg border border-border/80 bg-card shadow-none overflow-hidden",
        className
      )}
    >
      {/* Top Section Toolbar */}
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/60">
        <div>
          {title && (
            <h3 className="text-base font-semibold tracking-tight text-foreground">
              {title}
            </h3>
          )}
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>

        {/* Toolbar Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {onFilterClick && (
            <Button
              variant="outline"
              size="sm"
              onClick={onFilterClick}
              className="relative h-9 gap-1.5 rounded-md border-border/80 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <Filter className="h-3.5 w-3.5" />
              <span>{filterLabel}</span>
              {activeFilterCount > 0 && (
                <span className="ml-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          )}

          {/* Search Box */}
          <div className="relative min-w-[200px] flex-1 sm:w-64 sm:flex-initial">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
            <Input
              value={currentSearch}
              onChange={handleSearchChange}
              placeholder={searchPlaceholder}
              className="h-9 w-full rounded-md pl-9 pr-3 text-xs bg-muted/30 focus:bg-background border-border/70"
            />
          </div>

          {secondaryAction}

          {actionLabel && (
            <Button
              size="sm"
              onClick={onActionClick}
              className="h-9 gap-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground shadow-xs hover:bg-primary/90"
            >
              {actionIcon || <Plus className="h-3.5 w-3.5" />}
              <span>{actionLabel}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Table Canvas */}
      <div className="relative w-full overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-border/60 bg-muted/20 text-muted-foreground">
              {onSelectionChange && (
                <th className="w-10 px-4 py-3 text-center align-middle">
                  <Checkbox
                    checked={isAllSelected}
                    onCheckedChange={handleToggleAll}
                    aria-label="Select all rows"
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "px-4 py-3.5 font-medium text-xs text-muted-foreground",
                    col.headerClassName
                  )}
                >
                  {typeof col.header === "function"
                    ? col.header({ allSelected: isAllSelected, onToggleAll: handleToggleAll })
                    : col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50 text-foreground/90">
            {isLoading ? (
              <tr>
                <td
                  colSpan={columns.length + (onSelectionChange ? 1 : 0)}
                  className="p-0"
                >
                  <TableSkeleton rows={5} />
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (onSelectionChange ? 1 : 0)}
                  className="py-12 text-center text-muted-foreground"
                >
                  {emptyState || (
                    <div className="flex flex-col items-center justify-center gap-1">
                      <span className="text-xs font-medium">No records found</span>
                      <span className="text-[11px] text-muted-foreground/60">
                        Try adjusting your search or filters
                      </span>
                    </div>
                  )}
                </td>
              </tr>
            ) : (
              data.map((row, idx) => {
                const key = keyExtractor(row, idx);
                const isSelected = selectedIds?.includes(key);

                return (
                  <tr
                    key={key}
                    onClick={() => onRowClick?.(row)}
                    className={cn(
                      "transition-colors hover:bg-muted/35",
                      isSelected && "bg-primary/5",
                      onRowClick && "cursor-pointer"
                    )}
                  >
                    {onSelectionChange && (
                      <td
                        className="w-10 px-4 py-3 text-center align-middle"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => handleToggleRow(key)}
                          aria-label={`Select row ${key}`}
                        />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={cn("px-4 py-3.5 align-middle", col.className)}
                      >
                        {col.cell(row, idx)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border/60 bg-muted/10 px-5 py-3 text-xs text-muted-foreground">
        {/* Rows per page selector */}
        {onPageSizeChange && (
          <div className="flex items-center gap-2">
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-7 rounded-lg border border-border/80 bg-background px-2 py-0.5 text-xs text-foreground focus:border-primary focus:outline-none"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Count and Chevrons */}
        <div className="flex items-center gap-4 ml-auto">
          <span>
            {totalCount > 0 ? `${startRow}-${endRow} of ${totalCount}` : "0 of 0"}
          </span>

          {onPageChange && (
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                disabled={page <= 1 || isLoading}
                onClick={() => onPageChange(page - 1)}
                className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                disabled={page >= totalPages || isLoading}
                onClick={() => onPageChange(page + 1)}
                className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers & Subcomponents
// ---------------------------------------------------------------------------

/** User / Staff / Student Avatar Table Cell */
export function ERPUserCell({
  name,
  subtitle,
  avatarSrc,
  initials,
}: {
  name: string;
  subtitle?: string;
  avatarSrc?: string;
  initials?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      {avatarSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarSrc}
          alt={name}
          className="h-9 w-9 shrink-0 rounded-full object-cover border border-border"
        />
      ) : (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
          {initials || name.slice(0, 2).toUpperCase()}
        </div>
      )}
      <div className="flex flex-col">
        <span className="font-semibold text-foreground leading-tight">{name}</span>
        {subtitle && (
          <span className="text-[11px] text-muted-foreground">{subtitle}</span>
        )}
      </div>
    </div>
  );
}

/** Status & Shift Pill Badges */
export function ERPStatusPill({
  status,
  variant = "subtle",
}: {
  status: string;
  variant?: "dark" | "subtle" | "emerald" | "amber" | "rose" | "indigo";
}) {
  const styles: Record<string, string> = {
    dark: "bg-foreground text-background font-medium",
    subtle: "border border-border/80 bg-muted/40 text-foreground font-medium",
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-medium",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-medium",
    rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 font-medium",
    indigo: "bg-primary/10 text-primary border border-primary/20 font-medium",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-lg px-2.5 py-1 text-[11px] leading-tight",
        styles[variant]
      )}
    >
      {status}
    </span>
  );
}
