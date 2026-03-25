"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown, Search, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/hooks/use-debounce";

interface SelectOption {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  endpoint?: string;
  options?: SelectOption[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  className?: string;
}

export function SearchableSelect({
  endpoint,
  options: staticOptions,
  value,
  onChange,
  placeholder = "Select...",
  disabled = false,
  error,
  className,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [options, setOptions] = useState<SelectOption[]>(staticOptions ?? []);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debouncedSearch = useDebounce(search, 300);

  const selectedLabel = options.find((o) => o.value === value)?.label;

  useEffect(() => {
    if (!endpoint || !open) return;

    const fetchOptions = async () => {
      setLoading(true);
      setFetchError(null);
      try {
        const url = new URL(endpoint, window.location.origin);
        if (debouncedSearch) {
          url.searchParams.set("search", debouncedSearch);
        }
        const res = await fetch(url.toString());
        if (!res.ok) throw new Error("Failed to fetch options");
        const json = await res.json();
        setOptions(json.data ?? []);
      } catch (err) {
        setFetchError(
          err instanceof Error ? err.message : "Failed to load options"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchOptions();
  }, [endpoint, debouncedSearch, open]);

  useEffect(() => {
    if (staticOptions) setOptions(staticOptions);
  }, [staticOptions]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = endpoint
    ? options
    : options.filter((o) =>
        o.label.toLowerCase().includes(search.toLowerCase())
      );

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-lg border border-input bg-background px-3 text-sm transition-colors",
          error
            ? "border-destructive"
            : "hover:border-primary focus:border-primary",
          disabled && "cursor-not-allowed opacity-50"
        )}
      >
        <span
          className={cn(
            selectedLabel ? "text-foreground" : "text-muted-foreground"
          )}
        >
          {selectedLabel ?? placeholder}
        </span>
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </button>

      {value && !disabled && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onChange("");
          }}
          className="absolute right-8 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3 w-3" />
        </button>
      )}

      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}

      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
          <div className="relative border-b border-border p-2">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="h-8 w-full rounded-md bg-muted pl-8 pr-3 text-sm outline-none placeholder:text-muted-foreground"
              autoFocus
            />
          </div>
          <div className="max-h-60 overflow-y-auto p-1">
            {loading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : fetchError ? (
              <p className="px-3 py-4 text-center text-sm text-destructive">
                {fetchError}
              </p>
            ) : filteredOptions.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-muted-foreground">
                No options found.
              </p>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                    setSearch("");
                  }}
                  className={cn(
                    "flex w-full items-center rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent",
                    value === option.value
                      ? "bg-primary/10 text-primary"
                      : "text-foreground"
                  )}
                >
                  {option.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
