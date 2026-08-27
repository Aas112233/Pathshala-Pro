"use client";

import { useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { ShieldAlert, LogOut, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function ImpersonationBanner() {
  const { user } = useAuth();
  const [isExiting, setIsExiting] = useState(false);

  // Check if current user is an impersonated session
  const impersonatedBy = (user as any)?.impersonatedBy;
  const schoolName = (user as any)?.tenantName || user?.tenantId;

  if (!impersonatedBy) return null;

  const handleExit = async () => {
    setIsExiting(true);
    try {
      const response = await fetch("/api/system-admin/impersonate", {
        method: "DELETE",
      });

      const json = await response.json();
      if (response.ok && json.success) {
        toast.success("Returned to System Admin console");
        window.location.href = "/system-admin/tenants";
      } else {
        toast.error("Failed to exit impersonation");
        setIsExiting(false);
      }
    } catch {
      toast.error("Error exiting impersonation");
      setIsExiting(false);
    }
  };

  return (
    <div className="sticky top-0 z-50 flex items-center justify-between bg-amber-500 px-4 py-2 text-xs font-semibold text-amber-950 shadow-md">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 shrink-0 text-amber-900" />
        <span>
          System Admin Support Mode: Viewing as <strong className="underline">{schoolName}</strong> (
          <code className="font-mono">{user?.tenantId}</code>).
        </span>
      </div>

      <Button
        size="sm"
        variant="outline"
        onClick={handleExit}
        disabled={isExiting}
        className="h-7 border-amber-800 bg-amber-600 text-white hover:bg-amber-700 hover:text-white text-xs gap-1.5 shadow-sm"
      >
        {isExiting ? <Loader2 className="h-3 w-3 animate-spin" /> : <LogOut className="h-3 w-3" />}
        Exit Impersonation
      </Button>
    </div>
  );
}
