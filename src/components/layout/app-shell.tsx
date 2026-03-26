"use client";

import { useState } from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { hasPermission, getModuleForPath } from "@/lib/permissions";
import { NotAuthorizedScreen } from "@/components/auth/permission-gate";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const pathname = usePathname();
  const { user, isLoading } = useAuth();
  
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
          "flex flex-1 flex-col transition-all duration-300 min-w-0",
          sidebarCollapsed ? "pl-[68px]" : "pl-[260px]"
        )}
      >
        <Header />
        <main className="flex-1 p-6">
          {hasAccess ? children : <NotAuthorizedScreen />}
        </main>
      </div>
    </div>
  );
}
