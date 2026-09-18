"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { ImpersonationBanner } from "./impersonation-banner";
import { GlobalBroadcastBanner } from "./global-broadcast-banner";
import { SubscriptionStatusBanner } from "./subscription-status-banner";
import { LoginAnnouncementsDialog } from "@/components/notices/login-announcements-dialog";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { hasPermission, getModuleForPath } from "@/lib/permissions";
import { NotAuthorizedScreen } from "@/components/auth/permission-gate";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  // Initial state must match SSR (expanded) to avoid hydration mismatch;
  // viewport-based collapse is applied in the effect below after mount.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const pathname = usePathname();
  const { user, isLoading } = useAuth();

  // Auto-shrink sidebar according to screen size on open + on resize
  useEffect(() => {
    const update = () => setSidebarCollapsed(window.innerWidth < 1024);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  
  // Dynamic Route Evaluator
  const isAuthorized = () => {
    // If still loading, assume authorized temporarily to prevent SSR hydration mismatch 
    // and flash of Not Authorized screens
    if (isLoading) return true; 

    if (!user) return false;
    if (user.role === "SUPER_ADMIN") return true;

    const moduleName = getModuleForPath(pathname);
    if (!moduleName) return true; // public path (like dashboard)
    
    return hasPermission(user.permissions, moduleName, "read");
  };

  const hasAccess = isAuthorized();

  return (
    <div className="flex min-h-screen">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <div
        className={cn(
          "flex flex-1 flex-col transition-[padding] duration-200 ease-out min-w-0",
          sidebarCollapsed ? "pl-[68px]" : "pl-[260px]"
        )}
      >
        <ImpersonationBanner />
        <GlobalBroadcastBanner />
        <SubscriptionStatusBanner />
        <LoginAnnouncementsDialog />
        <Header />
        <main className="flex-1 p-6">
          {hasAccess ? children : <NotAuthorizedScreen />}
        </main>
      </div>
    </div>
  );
}
