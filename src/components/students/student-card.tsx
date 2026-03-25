"use client";

import { useState } from "react";
import { User, Phone, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { StudentStatusBadge } from "./student-status-badge";
import { StudentActionsDropdown } from "./student-actions-dropdown";
import { ImagePreviewModal } from "@/components/shared/image-preview-modal";
import type { StudentProfile } from "@/types/entities";

interface StudentCardProps {
  student: StudentProfile;
  onEdit?: (student: StudentProfile) => void;
  onView?: (student: StudentProfile) => void;
  onDelete?: (student: StudentProfile) => void;
  className?: string;
}

export function StudentCard({
  student,
  onEdit,
  onView,
  onDelete,
  className,
}: StudentCardProps) {
  const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false);
  const fullName = `${student.firstName} ${student.lastName}`;
  const initials = `${student.firstName.charAt(0)}${student.lastName.charAt(0)}`;
  const hasImage = !!student.profilePictureUrl;

  return (
    <>
      <div
        className={cn(
          "group relative overflow-hidden rounded-xl border border-border bg-card p-5 transition-all hover:shadow-lg hover:border-primary/20",
          className
        )}
      >
        {/* Header with actions */}
        <div className="absolute right-3 top-3 opacity-0 transition-opacity group-hover:opacity-100">
          <StudentActionsDropdown
            student={student}
            onEdit={onEdit}
            onView={onView}
            onDelete={onDelete}
          />
        </div>

        {/* Profile Section */}
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div
            className={cn(
              "flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary",
              hasImage && "cursor-pointer overflow-hidden ring-2 ring-primary/20 transition-all hover:ring-primary/40 hover:scale-105"
            )}
            onClick={() => hasImage && setIsImagePreviewOpen(true)}
            role={hasImage ? "button" : undefined}
            tabIndex={hasImage ? 0 : -1}
            onKeyDown={(e) => {
              if (hasImage && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                setIsImagePreviewOpen(true);
              }
            }}
            aria-label={hasImage ? `Click to preview ${fullName}'s photo` : undefined}
          >
            {student.profilePictureUrl ? (
              <img
                src={student.profilePictureUrl}
                alt={fullName}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-lg font-semibold">{initials}</span>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground">{fullName}</h3>
              <StudentStatusBadge status={student.status} />
            </div>
            <p className="text-sm text-muted-foreground">Roll: {student.rollNumber}</p>
            <p className="text-xs text-muted-foreground">ID: {student.studentId}</p>
          </div>
        </div>

        {/* Details Section */}
        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <User className="h-4 w-4" />
            <span>Guardian: {student.guardianName}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Phone className="h-4 w-4" />
            <span>{student.guardianContact}</span>
          </div>
          {student.guardianEmail && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="h-4 w-4" />
              <span>{student.guardianEmail}</span>
            </div>
          )}
          {student.gender && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-4 w-4" />
              <span>Gender: {student.gender}</span>
            </div>
          )}
        </div>
      </div>

      <ImagePreviewModal
        isOpen={isImagePreviewOpen}
        onClose={() => setIsImagePreviewOpen(false)}
        src={student.profilePictureUrl || ""}
        alt={`${fullName}'s profile photo`}
        title={fullName}
      />
    </>
  );
}
