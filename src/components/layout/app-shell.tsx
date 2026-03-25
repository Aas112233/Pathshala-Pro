"use client";

import { useState } from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { cn } from "@/lib/utils";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <div
        className={cn(
          "flex flex-1 flex-col transition-all duration-300",
          sidebarCollapsed ? "pl-[68px]" : "pl-[260px]"
        )}
      >
        <Header />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
