"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { SYSTEM_ADMIN_NAV, APP_NAME } from "@/lib/constants";
import { useAuth } from "@/components/providers/auth-provider";
import { ChevronLeft, ShieldCheck } from "lucide-react";

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
        "fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-sidebar-border bg-[#0f172a] transition-all duration-300",
        collapsed ? "w-[68px]" : "w-[260px]"
      )}
    >
      {/* Brand */}
      <div className="flex h-16 items-center justify-between border-b border-white/10 px-4">
        <Link href="/system-admin" className="flex items-center gap-2.5 overflow-hidden">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <ShieldCheck className="h-4 w-4" />
          </div>
          {!collapsed && (
            <span className="text-sm font-semibold tracking-tight text-white">
              {APP_NAME} <span className="text-[10px] bg-indigo-600/20 text-indigo-400 px-1.5 py-0.5 rounded ml-1 border border-indigo-500/30">SAAS</span>
            </span>
          )}
        </Link>
        <button
          onClick={onToggle}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-white/60 hover:bg-white/10 hover:text-white"
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
              <p className="mb-2 px-2 text-xs font-medium uppercase tracking-wider text-white/30">
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
                        ? "bg-indigo-600/10 text-indigo-400 border border-indigo-500/20"
                        : "text-white/60 hover:bg-white/5 hover:text-white"
                    )}
                    title={collapsed ? label : undefined}
                  >
                    <item.icon
                      className={cn(
                        "h-4 w-4 shrink-0 transition-colors",
                        isActive
                          ? "text-indigo-400"
                          : "text-white/30 group-hover:text-white"
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
      <div className="border-t border-white/10 p-3">
        {!collapsed && (
          <div className="flex items-center gap-2 px-1">
            <div className="h-2 w-2 rounded-full bg-emerald-500" />
            <p className="text-[10px] font-medium text-white/40 uppercase tracking-widest">Platform Healthy</p>
          </div>
        )}
      </div>
    </aside>
  );
}
