"use client";

import { useState, useRef, useEffect } from "react";
import { MoreVertical, Pencil, Trash2, Eye, UserCheck, UserX, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StaffProfile } from "@/types/entities";

interface StaffActionsDropdownProps {
  staff: StaffProfile;
  onEdit?: (staff: StaffProfile) => void;
  onView?: (staff: StaffProfile) => void;
  onDelete?: (staff: StaffProfile) => void;
  onToggleStatus?: (staff: StaffProfile) => void;
}

export function StaffActionsDropdown({
  staff,
  onEdit,
  onView,
  onDelete,
  onToggleStatus,
}: StaffActionsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
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

  const handleAction = (callback?: (staff: StaffProfile) => void) => {
    setIsOpen(false);
    callback?.(staff);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        aria-label="Staff actions"
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 top-full mt-1 z-50 min-w-[180px] overflow-hidden rounded-lg border border-border bg-popover shadow-lg"
          style={{
            position: "fixed",
            top: `${dropdownRef.current?.getBoundingClientRect().bottom || 0 + 4}px`,
            left: `${(dropdownRef.current?.getBoundingClientRect().right || 0) - 180}px`,
          }}
        >
          <div className="p-1">
            {onView && (
              <button
                onClick={() => handleAction(onView)}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-popover-foreground hover:bg-muted transition-colors"
              >
                <Eye className="h-4 w-4" />
                <span>View Details</span>
              </button>
            )}
            {onEdit && (
              <button
                onClick={() => handleAction(onEdit)}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-popover-foreground hover:bg-muted transition-colors"
              >
                <Pencil className="h-4 w-4" />
                <span>Edit</span>
              </button>
            )}
            {onToggleStatus && (
              <button
                onClick={async () => {
                  setIsToggling(true);
                  try { await onToggleStatus(staff); setIsOpen(false); } finally { setIsToggling(false); }
                }}
                disabled={isToggling}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors disabled:opacity-50",
                  staff.isActive 
                    ? "text-amber-600 hover:bg-amber-50" 
                    : "text-green-600 hover:bg-green-50"
                )}
              >
                {isToggling ? <Loader2 className="h-4 w-4 animate-spin" /> : staff.isActive ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                <span>{isToggling ? "Updating..." : staff.isActive ? "Deactivate" : "Activate"}</span>
              </button>
            )}
            {onDelete && (
              <button
                onClick={async () => {
                  setIsDeleting(true);
                  try { await onDelete(staff); setIsOpen(false); } finally { setIsDeleting(false); }
                }}
                disabled={isDeleting}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
              >
                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                <span>{isDeleting ? "Deleting..." : "Delete"}</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
