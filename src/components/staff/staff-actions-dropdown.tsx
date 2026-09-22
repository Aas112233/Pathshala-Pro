"use client";

import { useState } from "react";
import { MoreVertical, Pencil, Trash2, Eye, UserCheck, UserX, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  const [isDeleting, setIsDeleting] = useState(false);
  const [isToggling, setIsToggling] = useState(false);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Staff actions">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent>
        {onView && (
          <DropdownMenuItem onSelect={() => onView(staff)}>
            <Eye className="h-4 w-4" />
            <span>View Details</span>
          </DropdownMenuItem>
        )}
        {onEdit && (
          <DropdownMenuItem onSelect={() => onEdit(staff)}>
            <Pencil className="h-4 w-4" />
            <span>Edit</span>
          </DropdownMenuItem>
        )}
        {onToggleStatus && (
          <DropdownMenuItem
            disabled={isToggling}
            className={
              staff.isActive
                ? "text-[var(--status-warning-text)] focus:bg-[var(--status-warning-bg)] focus:text-[var(--status-warning-text)]"
                : "text-[var(--status-success-text)] focus:bg-[var(--status-success-bg)] focus:text-[var(--status-success-text)]"
            }
            onSelect={async (event) => {
              event.preventDefault();
              setIsToggling(true);
              try {
                await onToggleStatus(staff);
              } finally {
                setIsToggling(false);
              }
            }}
          >
            {isToggling ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : staff.isActive ? (
              <UserX className="h-4 w-4" />
            ) : (
              <UserCheck className="h-4 w-4" />
            )}
            <span>
              {isToggling ? "Updating..." : staff.isActive ? "Deactivate" : "Activate"}
            </span>
          </DropdownMenuItem>
        )}
        {onDelete && (
          <DropdownMenuItem
            variant="destructive"
            disabled={isDeleting}
            onSelect={async (event) => {
              event.preventDefault();
              setIsDeleting(true);
              try {
                await onDelete(staff);
              } finally {
                setIsDeleting(false);
              }
            }}
          >
            {isDeleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            <span>{isDeleting ? "Deleting..." : "Delete"}</span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
