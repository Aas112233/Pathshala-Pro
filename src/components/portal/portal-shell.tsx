"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useAuth } from "@/components/providers/auth-provider";
import { useTranslations } from "next-intl";
import { Bell, BookOpen, CalendarDays, ChevronDown, GraduationCap, LayoutDashboard, Moon, Sun, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

type Child = {
  id: string;
  firstName: string;
  lastName: string;
  class?: { name: string } | null;
  section?: { name: string } | null;
};

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard };

export function PortalShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations("portal");
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [childrenList, setChildrenList] = useState<Child[]>([]);
  const [childrenOpen, setChildrenOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const isParent = user?.role === "PARENT";
  const basePath = isParent ? "/parent" : "/student";
  const selectedChild = childrenList.find((child) => child.id === searchParams.get("studentId")) ?? childrenList[0];

  const nav: NavItem[] = isParent
    ? [
        { href: "/parent/dashboard", label: t("nav.overview"), icon: LayoutDashboard },
        { href: "/parent/fees", label: t("nav.fees"), icon: Wallet },
      ]
    : [
        { href: "/student/dashboard", label: t("nav.home"), icon: LayoutDashboard },
        { href: "/student/homework", label: t("nav.homework"), icon: BookOpen },
        { href: "/student/timetable", label: t("nav.timetable"), icon: CalendarDays },
        { href: "/student/results", label: t("nav.results"), icon: GraduationCap },
      ];

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!isParent) return;
    fetch("/api/portal/children", { credentials: "include" })
      .then((response) => (response.ok ? response.json() : null))
      .then((json) => setChildrenList(Array.isArray(json?.data) ? json.data : []))
      .catch(() => setChildrenList([]));
  }, [isParent]);

  function chooseChild(id: string) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("studentId", id);
    router.push(`${pathname}?${next.toString()}`);
    setChildrenOpen(false);
  }

  const childName = selectedChild ? `${selectedChild.firstName} ${selectedChild.lastName}` : "";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <Link href={`${basePath}/dashboard`} className="flex items-center gap-2 font-bold">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <GraduationCap className="h-5 w-5" />
            </span>
            <span className="hidden sm:inline">Pathshala Pro</span>
          </Link>
          <nav className="hidden flex-1 items-center justify-center gap-1 md:flex">
            {nav.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted",
                    pathname === item.href && "bg-primary/10 text-primary"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-1.5">
            {isParent && selectedChild ? (
              <div className="relative">
                <button
                  onClick={() => setChildrenOpen((open) => !open)}
                  className="flex max-w-[180px] items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs"
                  aria-label={t("children.switch")}
                >
                  <span className="truncate font-semibold">{childName}</span>
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
                {childrenOpen ? (
                  <div className="absolute right-0 top-full mt-2 w-60 rounded-xl border bg-popover p-1.5 shadow-xl">
                    {childrenList.map((child) => {
                      const name = `${child.firstName} ${child.lastName}`;
                      const classSection = `${child.class?.name ?? ""}${child.section?.name ? ` · ${child.section.name}` : ""}`;
                      return (
                        <button
                          key={child.id}
                          onClick={() => chooseChild(child.id)}
                          className={cn(
                            "w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-muted",
                            selectedChild.id === child.id && "bg-primary/10 text-primary"
                          )}
                        >
                          <span className="block font-semibold">{name}</span>
                          <span className="text-xs text-muted-foreground">{classSection}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ) : null}
            <button
              aria-label={t("notifications")}
              className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
            </button>
            <button
              aria-label={t("theme.toggle")}
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
            >
              {mounted && theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button
              onClick={() => void logout()}
              className="hidden rounded-lg px-2 py-2 text-xs text-muted-foreground hover:bg-muted sm:block"
            >
              {t("signOut")}
            </button>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto border-t px-4 py-2 md:hidden">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground",
                pathname === item.href && "bg-primary/10 text-primary"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}

export function PortalCard({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <section className={cn("rounded-2xl border border-border/70 bg-card p-5 shadow-sm", className)}>{children}</section>;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">{children}</div>;
}

export function Loading() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-48 animate-pulse rounded bg-muted" />
      <div className="h-48 animate-pulse rounded-2xl bg-muted" />
    </div>
  );
}
