"use client";

import { useState, useEffect } from "react";
import { SystemAdminSidebar } from "./system-admin-sidebar";
import { Header } from "./header";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/auth-provider";
import { NotAuthorizedScreen } from "@/components/auth/permission-gate";

interface SystemAdminShellProps {
  children: React.ReactNode;
}

export function SystemAdminShell({ children }: SystemAdminShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 1024
  );
  const { user, isLoading } = useAuth();

  // Auto-shrink sidebar according to screen size on open + on resize
  useEffect(() => {
    const update = () => setSidebarCollapsed(window.innerWidth < 1024);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  
  // Strict System Admin Access Check
  const isAuthorized =
    user?.role === "SYSTEM_ADMIN" ||
    !!(user as any)?.impersonatedBy;

  if (!isLoading && !isAuthorized) {
    return <NotAuthorizedScreen />;
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <SystemAdminSidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <div
        className={cn(
          "flex flex-1 flex-col transition-all duration-300 min-w-0",
          sidebarCollapsed ? "pl-[68px]" : "pl-[260px]"
        )}
      >
        <Header />
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
