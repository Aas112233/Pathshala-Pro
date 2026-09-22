"use client";

import { useState } from "react";
import {
  MoreVertical,
  Settings,
  ShieldAlert,
  Building2,
  Calendar,
  LogIn,
  Loader2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TenantActionsDropdownProps {
  tenant: any;
  onEdit?: (tenant: any) => void;
  onSuspend?: (tenant: any) => void;
  onForceDelete?: (tenant: any) => void;
}

export function TenantActionsDropdown({
  tenant,
  onEdit,
  onSuspend,
  onForceDelete,
}: TenantActionsDropdownProps) {
  const t = useTranslations("systemAdmin");
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [isSuspending, setIsSuspending] = useState(false);

  const handleImpersonate = async () => {
    setIsImpersonating(true);
    try {
      const response = await fetch("/api/system-admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetTenantId: tenant.tenantId }),
      });

      const json = await response.json();
      if (response.ok && json.success) {
        toast.success(`Logged in as ${tenant.name}`);
        // Clear local cached tenant settings so new tenant is loaded fresh
        localStorage.removeItem(`tenant_settings_${tenant.tenantId}`);
        window.location.href = "/";
      } else {
        toast.error(json.error?.message || t("impersonateError"));
        setIsImpersonating(false);
      }
    } catch {
      toast.error(t("networkError"));
      setIsImpersonating(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Tenant actions">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="min-w-[210px] p-1.5">
        {/* Support Impersonation Action */}
        <DropdownMenuItem
          disabled={isImpersonating}
          className="rounded-lg bg-primary/10 text-xs font-medium text-primary focus:bg-primary/15 focus:text-primary"
          onSelect={async (event) => {
            event.preventDefault();
            await handleImpersonate();
          }}
        >
          {isImpersonating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <LogIn className="h-4 w-4" />
          )}
          <span>Login as School Admin</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          className="rounded-lg text-xs font-medium"
          onSelect={() => {
            window.location.href = `/system-admin/tenants/${tenant.id || tenant.tenantId}`;
          }}
        >
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span>View 360° Telemetry</span>
        </DropdownMenuItem>

        <DropdownMenuItem
          className="rounded-lg text-xs font-medium"
          onSelect={() => onEdit?.(tenant)}
        >
          <Settings className="h-4 w-4 text-muted-foreground" />
          <span>Edit Configuration</span>
        </DropdownMenuItem>

        <DropdownMenuItem
          className="rounded-lg text-xs font-medium"
          onSelect={() => {
            window.location.href = `/system-admin/billing`;
          }}
        >
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span>Extend Billing / Trial</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          variant="destructive"
          disabled={isSuspending}
          className="rounded-lg text-xs font-medium"
          onSelect={async (event) => {
            event.preventDefault();
            if (!onSuspend) return;
            setIsSuspending(true);
            try {
              await onSuspend(tenant);
            } finally {
              setIsSuspending(false);
            }
          }}
        >
          {isSuspending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ShieldAlert className="h-4 w-4" />
          )}
          <span>{isSuspending ? "Suspending..." : "Suspend School"}</span>
        </DropdownMenuItem>

        {onForceDelete && (
          <DropdownMenuItem
            variant="destructive"
            className="rounded-lg text-xs font-medium focus:bg-destructive focus:text-destructive-foreground data-[highlighted]:bg-destructive data-[highlighted]:text-destructive-foreground"
            onSelect={() => onForceDelete(tenant)}
          >
            <Trash2 className="h-4 w-4" />
            <span>{t("forceDelete.menuLabel")}</span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
