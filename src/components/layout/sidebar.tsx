"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { SIDEBAR_NAV, APP_NAME } from "@/lib/constants";
import { useAuth } from "@/components/providers/auth-provider";
import { hasPermission, getModuleForPath } from "@/lib/permissions";
import { ChevronLeft, GraduationCap, Search, X } from "lucide-react";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

/** Highlight matching substring within text */
function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <span>{text}</span>;

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase().trim();
  const idx = lowerText.indexOf(lowerQuery);

  if (idx === -1) return <span>{text}</span>;

  return (
    <span>
      {text.slice(0, idx)}
      <mark className="bg-primary/25 text-inherit rounded-sm px-0.5">{text.slice(idx, idx + lowerQuery.length)}</mark>
      {text.slice(idx + lowerQuery.length)}
    </span>
  );
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const t = useTranslations();
  const { user, isLoading } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Ctrl+K / Cmd+K shortcut to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        if (collapsed) return;
        searchInputRef.current?.focus();
      }
      // Escape to clear search
      if (e.key === "Escape" && searchQuery) {
        setSearchQuery("");
        searchInputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [collapsed, searchQuery]);

  // Clear search when sidebar collapses
  useEffect(() => {
    if (collapsed) setSearchQuery("");
  }, [collapsed]);

  // Build filtered navigation with permission checks + search filtering
  const filteredNav = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    return SIDEBAR_NAV.map((group) => {
      // First filter by permissions
      const permissionFiltered = group.items.filter((item) => {
        if (isLoading) return true;
        if (!user) return false;
        if (user.role === "SUPER_ADMIN") return true;
        const moduleName = getModuleForPath(item.href);
        if (!moduleName) return true;
        return hasPermission(user.permissions, moduleName, "read");
      });

      // Then filter by search query
      const searchFiltered = query
        ? permissionFiltered.filter((item) => {
            const label = t(item.titleKey as any)?.toLowerCase() || "";
            return label.includes(query);
          })
        : permissionFiltered;

      return { ...group, items: searchFiltered };
    }).filter((group) => group.items.length > 0);
  }, [searchQuery, isLoading, user, t]);

  const hasResults = filteredNav.length > 0;

  const clearSearch = useCallback(() => {
    setSearchQuery("");
    searchInputRef.current?.focus();
  }, []);

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300",
        collapsed ? "w-[68px]" : "w-[260px]"
      )}
    >
      {/* Brand */}
      <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
        <Link href="/" className="flex items-center gap-2.5 overflow-hidden">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <GraduationCap className="h-4 w-4" />
          </div>
          {!collapsed && (
            <span className="text-sm font-semibold tracking-tight text-sidebar-foreground">
              {APP_NAME}
            </span>
          )}
        </Link>
        <button
          onClick={onToggle}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <ChevronLeft
            className={cn(
              "h-4 w-4 transition-transform",
              collapsed && "rotate-180"
            )}
          />
        </button>
      </div>

      {/* Search Bar */}
      {!collapsed && (
        <div className="px-3 pt-3 pb-1">
          <div className="relative group">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-sidebar-foreground/40 transition-colors group-focus-within:text-primary" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search menu..."
              className="h-8 w-full rounded-lg border border-sidebar-border bg-sidebar-accent/50 pl-8 pr-8 text-xs text-sidebar-foreground placeholder:text-sidebar-foreground/35 outline-none transition-all focus:border-primary/50 focus:bg-sidebar-accent focus:ring-1 focus:ring-primary/25"
            />
            {searchQuery ? (
              <button
                onClick={clearSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-sidebar-foreground/40 hover:text-sidebar-foreground transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            ) : (
              <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 hidden items-center gap-0.5 rounded border border-sidebar-border bg-sidebar px-1.5 py-0.5 text-[10px] font-medium text-sidebar-foreground/30 sm:flex">
                ⌘K
              </kbd>
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
        {hasResults ? (
          filteredNav.map((group) => (
            <div key={group.labelKey} className="mb-4">
              {!collapsed && (
                <p className="mb-2 px-2 text-xs font-medium uppercase tracking-wider text-sidebar-foreground/50">
                  {t(group.labelKey as any) || group.labelKey}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/" && pathname.startsWith(item.href));
                  const label = t(item.titleKey as any);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setSearchQuery("")}
                      className={cn(
                        "group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                      )}
                      title={collapsed ? label : undefined}
                    >
                      <item.icon
                        className={cn(
                          "h-4 w-4 shrink-0 transition-colors",
                          isActive
                            ? "text-primary"
                            : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground"
                        )}
                      />
                      {!collapsed && (
                        <span>
                          <HighlightMatch text={label} query={searchQuery} />
                        </span>
                      )}
                      {!collapsed && item.badge && (
                        <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))
        ) : (
          /* No results state */
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Search className="h-8 w-8 text-sidebar-foreground/20 mb-2" />
            <p className="text-xs text-sidebar-foreground/40">No menu items found</p>
            <button
              onClick={clearSearch}
              className="mt-2 text-xs text-primary hover:text-primary/80 transition-colors"
            >
              Clear search
            </button>
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-3">
        {!collapsed && (
          <p className="text-xs text-sidebar-foreground/40">v0.1.0</p>
        )}
      </div>
    </aside>
  );
}
