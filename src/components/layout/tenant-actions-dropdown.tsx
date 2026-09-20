"use client";

import { useState, useRef, useEffect } from "react";
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
  const [isOpen, setIsOpen] = useState(false);
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [isSuspending, setIsSuspending] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {isOpen && (() => {
        const rect = dropdownRef.current?.getBoundingClientRect();
        const menuHeight = 260; // approximate rendered height of the menu
        const spaceBelow = rect ? window.innerHeight - rect.bottom : 0;
        const spaceAbove = rect ? rect.top : 0;
        const openUpward = spaceBelow < menuHeight && spaceAbove > spaceBelow;

        return (
        <div
          className="z-50 min-w-[210px] overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground p-1.5 shadow-xl"
          style={{
            position: "fixed",
            ...(openUpward
              ? { bottom: `${window.innerHeight - (rect?.top || 0) + 4}px` }
              : { top: `${(rect?.bottom || 0) + 4}px` }),
            left: `${(rect?.right || 0) - 210}px`,
          }}
        >
          {/* Support Impersonation Action */}
          <button
            onClick={handleImpersonate}
            disabled={isImpersonating}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-primary bg-primary/10 hover:bg-primary/15 transition-colors"
          >
            {isImpersonating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogIn className="h-4 w-4" />
            )}
            <span>Login as School Admin</span>
          </button>

          <div className="my-1 border-t border-border" />

          <button
            onClick={() => {
              setIsOpen(false);
              window.location.href = `/system-admin/tenants/${tenant.id || tenant.tenantId}`;
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors"
          >
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span>View 360° Telemetry</span>
          </button>

          <button
            onClick={() => {
              setIsOpen(false);
              if (onEdit) onEdit(tenant);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors"
          >
            <Settings className="h-4 w-4 text-muted-foreground" />
            <span>Edit Configuration</span>
          </button>

          <button
            onClick={() => {
              setIsOpen(false);
              window.location.href = `/system-admin/billing`;
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors"
          >
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span>Extend Billing / Trial</span>
          </button>

          <div className="my-1 border-t border-border" />

          <button
            onClick={async () => {
              if (!onSuspend) return;
              setIsSuspending(true);
              try { await onSuspend(tenant); setIsOpen(false); } finally { setIsSuspending(false); }
            }}
            disabled={isSuspending}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
          >
            {isSuspending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
            <span>{isSuspending ? "Suspending..." : "Suspend School"}</span>
          </button>

          {onForceDelete && (
            <button
              onClick={() => {
                setIsOpen(false);
                onForceDelete(tenant);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors"
            >
              <Trash2 className="h-4 w-4" />
              <span>{t("forceDelete.menuLabel")}</span>
            </button>
          )}
        </div>
        );
      })()}
    </div>
  );
}
