"use client";

import { useState, useRef, useEffect } from "react";
import { MoreVertical, Pencil, Trash2, Eye, User } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StudentProfile } from "@/types/entities";

interface StudentActionsDropdownProps {
  student: StudentProfile;
  onEdit?: (student: StudentProfile) => void;
  onView?: (student: StudentProfile) => void;
  onDelete?: (student: StudentProfile) => void;
}

export function StudentActionsDropdown({
  student,
  onEdit,
  onView,
  onDelete,
}: StudentActionsDropdownProps) {
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

  const handleAction = (callback?: (student: StudentProfile) => void) => {
    setIsOpen(false);
    callback?.(student);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        aria-label="Student actions"
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 top-full mt-1 z-50 min-w-[160px] overflow-hidden rounded-lg border border-border bg-popover shadow-lg"
          style={{
            position: "fixed",
            top: `${dropdownRef.current?.getBoundingClientRect().bottom || 0 + 4}px`,
            left: `${(dropdownRef.current?.getBoundingClientRect().right || 0) - 160}px`,
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
            {onDelete && (
              <button
                onClick={() => handleAction(onDelete)}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                <span>Delete</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
