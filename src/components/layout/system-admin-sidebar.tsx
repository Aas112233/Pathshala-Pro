"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { SYSTEM_ADMIN_NAV, APP_NAME } from "@/lib/constants";
import { useAuth } from "@/components/providers/auth-provider";
import { ChevronLeft, ShieldCheck, ArrowLeft, LayoutDashboard } from "lucide-react";

interface SystemAdminSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function SystemAdminSidebar({ collapsed, onToggle }: SystemAdminSidebarProps) {
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
        <Link href="/system-admin" className="flex items-center gap-2.5 overflow-hidden">
          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary text-primary-foreground">
            <Image src="/pathshalapro-app-icon.webp" alt="App Icon" fill className="object-cover scale-125 rounded-lg" />
          </div>
          {!collapsed && (
            <span className="text-sm font-semibold tracking-tight text-sidebar-foreground">
              {APP_NAME} <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded ml-1 border border-primary/20 font-mono">SYSTEM</span>
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
        {SYSTEM_ADMIN_NAV.map((group) => (
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
                  (item.href !== "/system-admin" && pathname.startsWith(item.href));
                const label = t(item.titleKey as any);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary border border-primary/20"
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
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-3 space-y-2">
        <Link
          href="/"
          className={cn(
            "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors",
            collapsed && "justify-center px-0"
          )}
          title={collapsed ? "Switch to School ERP" : undefined}
        >
          <LayoutDashboard className="h-3.5 w-3.5 shrink-0 text-primary" />
          {!collapsed && <span>Switch to School ERP</span>}
        </Link>

        {!collapsed && (
          <div className="flex items-center gap-2 px-1 pt-1">
            <div className="h-2 w-2 rounded-full bg-emerald-500" />
            <p className="text-[10px] font-medium text-sidebar-foreground/50 uppercase tracking-widest">Platform Healthy</p>
          </div>
        )}
      </div>
    </aside>
  );
}
