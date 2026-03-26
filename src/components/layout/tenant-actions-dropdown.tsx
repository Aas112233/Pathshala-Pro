"use client";

import { useState, useRef, useEffect } from "react";
import { MoreVertical, Settings, ShieldAlert, Building2, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

interface TenantActionsDropdownProps {
  tenant: any;
  onEdit?: (tenant: any) => void;
  onSuspend?: (tenant: any) => void;
}

export function TenantActionsDropdown({
  tenant,
  onEdit,
  onSuspend,
}: TenantActionsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
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

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-900 transition-colors"
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {isOpen && (
        <div
          className="z-50 min-w-[200px] overflow-hidden rounded-xl border border-slate-100 bg-white p-2 shadow-xl"
          style={{
            position: "fixed",
            top: `${(dropdownRef.current?.getBoundingClientRect().bottom || 0) + 4}px`,
            left: `${(dropdownRef.current?.getBoundingClientRect().right || 0) - 200}px`,
          }}
        >
          <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors">
            <Settings className="h-4 w-4" />
            <span>Edit Configuration</span>
          </button>
          <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors">
            <Calendar className="h-4 w-4" />
            <span>Extend Billing</span>
          </button>
          <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors">
            <Building2 className="h-4 w-4" />
            <span>View Profile</span>
          </button>
          <div className="my-1 border-t border-slate-100" />
          <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 transition-colors">
            <ShieldAlert className="h-4 w-4" />
            <span>Suspend School</span>
          </button>
        </div>
      )}
    </div>
  );
}
