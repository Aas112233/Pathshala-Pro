"use client";

import { useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table";
import { Search, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
    <div className={cn("space-y-3", className)}>
      {/* Search */}
      {onSearch ? (
        <div className="relative max-w-sm h-10">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="h-10 w-full rounded-lg pl-10 pr-4 text-sm focus:border-primary focus:ring-primary"
          />
        </div>
      ) : null}

      {/* Table */}
      <div className="min-h-[460px] overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/30">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left text-xs font-medium text-muted-foreground"
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
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="h-12">
                  {columns.map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 animate-pulse rounded bg-muted/60" />
                    </td>
                  ))}
                </tr>
              ))
            ) : table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="transition-colors hover:bg-muted/30"
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
      <div className="flex h-9 items-center justify-between">
        {pagination ? (
          <>
            <p className="text-sm text-muted-foreground">
              Showing page {pagination.currentPage} of {pagination.totalPages}
              {" "}({pagination.totalCount} total)
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => onPageChange?.(pagination.currentPage - 1)}
                disabled={!pagination.hasPreviousPage || isLoading}
                aria-label="Previous page"
              >
                {isLoading && pagination.hasPreviousPage ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ChevronLeft className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => onPageChange?.(pagination.currentPage + 1)}
                disabled={!pagination.hasNextPage || isLoading}
                aria-label="Next page"
              >
                {isLoading && pagination.hasNextPage ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
