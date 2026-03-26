"use client";

import { useState } from "react";
import { AppModal } from "@/components/ui/app-modal";
import { Button } from "@/components/ui/button";
import { ImagePreviewModal } from "@/components/shared/image-preview-modal";
import { StudentStatusBadge } from "./student-status-badge";
import { User, Phone, Mail, Calendar, MapPin, Hash, IdCard, ZoomIn } from "lucide-react";
import { cn, formatStudentName } from "@/lib/utils";
import type { StudentProfile } from "@/types/entities";
import { useTenantFormatting } from "@/components/providers/tenant-settings-provider";

interface StudentDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: StudentProfile | null;
  onEdit?: () => void;
}

export function StudentDetailsModal({
  isOpen,
  onClose,
  student,
  onEdit,
}: StudentDetailsModalProps) {
  const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false);
  const { formatDate } = useTenantFormatting();

  if (!student) return null;

  const fullName = formatStudentName(student.firstName, student.lastName, student.firstNameBn, student.lastNameBn);
  const initials = `${student.firstName.charAt(0)}${student.lastName.charAt(0)}`;
  const hasImage = !!student.profilePictureUrl;

  // Debug log
  if (process.env.NODE_ENV === 'development') {
    console.log('[StudentDetailsModal] Student:', student);
    console.log('[StudentDetailsModal] Has image:', hasImage);
    console.log('[StudentDetailsModal] Profile picture URL:', student.profilePictureUrl);
  }

  const DetailRow = ({
    icon: Icon,
    label,
    value,
  }: {
    icon: any;
    label: string;
    value?: string | null;
  }) => (
    <div className="flex items-start gap-3 py-2">
      <Icon className="mt-0.5 h-4 w-4 text-muted-foreground" />
      <div className="flex-1">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className="text-sm text-foreground">{value || "—"}</p>
      </div>
    </div>
  );

  return (
    <>
      <AppModal
        isOpen={isOpen}
        onClose={onClose}
        title="Student Details"
        description="View complete student information"
        maxWidth="lg"
      >
        <div className="space-y-6">
          {/* Profile Header */}
          <div className="flex items-start gap-4 rounded-lg bg-muted/50 p-4">
            <div
              className={cn(
                "relative flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary",
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
              title={hasImage ? "Click to preview photo" : undefined}
            >
              {student.profilePictureUrl ? (
                <>
                  <img
                    src={student.profilePictureUrl}
                    alt={fullName}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      console.error('[StudentDetailsModal] Image failed to load:', student.profilePictureUrl);
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity hover:opacity-100">
                    <ZoomIn className="h-6 w-6 text-white" />
                  </div>
                </>
              ) : (
                <span className="text-2xl font-semibold">{initials}</span>
              )}
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold">{fullName}</h3>
                <StudentStatusBadge status={student.status} />
              </div>
              <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Hash className="h-3 w-3" />
                  Roll: {student.rollNumber}
                </span>
                <span className="flex items-center gap-1">
                  <IdCard className="h-3 w-3" />
                  ID: {student.studentId}
                </span>
              </div>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Personal Information */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground">Personal Information</h4>
              <div className="rounded-lg border border-border bg-card p-3 space-y-1">
                <DetailRow
                  icon={User}
                  label="Gender"
                  value={student.gender}
                />
                <DetailRow
                  icon={Calendar}
                  label="Date of Birth"
                  value={student.dateOfBirth ? formatDate(student.dateOfBirth) : null}
                />
                <DetailRow
                  icon={MapPin}
                  label="Address"
                  value={student.address}
                />
              </div>
            </div>

            {/* Guardian Information */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground">Guardian Information</h4>
              <div className="rounded-lg border border-border bg-card p-3 space-y-1">
                <DetailRow
                  icon={User}
                  label="Guardian Name"
                  value={student.guardianName}
                />
                <DetailRow
                  icon={Phone}
                  label="Contact Number"
                  value={student.guardianContact}
                />
                <DetailRow
                  icon={Mail}
                  label="Email Address"
                  value={student.guardianEmail}
                />
              </div>
            </div>
          </div>

          {/* Admission Information */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Admission Information</h4>
            <div className="rounded-lg border border-border bg-card p-3">
              <DetailRow
                icon={Calendar}
                label="Admission Date"
                value={student.admissionDate ? formatDate(student.admissionDate) : null}
              />
              <DetailRow
                icon={User}
                label="Status"
                value={student.status}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            {onEdit && (
              <Button onClick={onEdit}>
                Edit Student
              </Button>
            )}
          </div>
        </div>
      </AppModal>

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
