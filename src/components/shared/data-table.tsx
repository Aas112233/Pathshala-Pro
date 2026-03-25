"use client";

import { useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PaginationMeta } from "@/types/api";

interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  pagination?: PaginationMeta;
  onPageChange?: (page: number) => void;
  onSearch?: (query: string) => void;
  isLoading?: boolean;
  searchPlaceholder?: string;
  className?: string;
}

export function DataTable<TData>({
  columns,
  data,
  pagination,
  onPageChange,
  onSearch,
  isLoading,
  searchPlaceholder = "Search...",
  className,
}: DataTableProps<TData>) {
  const [searchQuery, setSearchQuery] = useState("");

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: pagination?.totalPages ?? -1,
  });

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    onSearch?.(value);
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Search */}
      {onSearch && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="h-10 w-full rounded-lg border border-input bg-background pl-10 pr-4 text-sm text-foreground outline-none ring-ring transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/50">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left font-medium text-muted-foreground"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {columns.map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 animate-pulse rounded bg-muted" />
                    </td>
                  ))}
                </tr>
              ))
            ) : table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="transition-colors hover:bg-muted/50"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 text-foreground">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-12 text-center text-muted-foreground"
                >
                  No results found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing page {pagination.currentPage} of {pagination.totalPages}
            {" "}({pagination.totalCount} total)
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange?.(pagination.currentPage - 1)}
              disabled={!pagination.hasPreviousPage}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-input text-muted-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => onPageChange?.(pagination.currentPage + 1)}
              disabled={!pagination.hasNextPage}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-input text-muted-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
