"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { SIDEBAR_NAV, APP_NAME } from "@/lib/constants";
import { useAuth } from "@/components/providers/auth-provider";
import { hasPermission, getModuleForPath } from "@/lib/permissions";
import { ChevronLeft, GraduationCap } from "lucide-react";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const t = useTranslations();
  const { user, isLoading } = useAuth();

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

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {SIDEBAR_NAV.map((group) => {
          // Filter items based on permissions
          const allowedItems = group.items.filter((item) => {
            // Assume true during loading to prevent SSR hydration errors
            if (isLoading) return true;

            if (!user) return false;
            // Super admins see everything
            if (user.role === "SUPER_ADMIN") return true;
            
            // Check specific route requirements
            const moduleName = getModuleForPath(item.href);
            if (!moduleName) return true; // public modules (e.g. dashboard)
            
            return hasPermission(user.permissions, moduleName, "read");
          });

          // Don't render empty groups
          if (allowedItems.length === 0) return null;

          return (
            <div key={group.labelKey} className="mb-4">
              {!collapsed && (
                <p className="mb-2 px-2 text-xs font-medium uppercase tracking-wider text-sidebar-foreground/50">
                  {t(group.labelKey as any) || group.labelKey}
                </p>
              )}
              <div className="space-y-0.5">
                {allowedItems.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/" && pathname.startsWith(item.href));
                  const label = t(item.titleKey as any);
  
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
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
                      {!collapsed && <span>{label}</span>}
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
          );
        })}
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
