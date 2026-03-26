"use client";

import { useState } from "react";
import { SystemAdminSidebar } from "./system-admin-sidebar";
import { Header } from "./header";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/auth-provider";
import { NotAuthorizedScreen } from "@/components/auth/permission-gate";

interface SystemAdminShellProps {
  children: React.ReactNode;
}

export function SystemAdminShell({ children }: SystemAdminShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { user, isLoading } = useAuth();
  
  // Strict System Admin Access Check
  if (!isLoading && user?.role !== "SYSTEM_ADMIN") {
    return <NotAuthorizedScreen />;
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
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
