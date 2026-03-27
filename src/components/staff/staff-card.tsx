"use client";

import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserCircle, Mail, Phone, Briefcase } from "lucide-react";
import type { StaffProfile } from "@/types/entities";

interface StaffCardProps {
  staff: StaffProfile;
  onView?: (staff: StaffProfile) => void;
  onEdit?: (staff: StaffProfile) => void;
  onDelete?: (staff: StaffProfile) => void;
}

export function StaffCard({
  staff,
  onView,
  onEdit,
  onDelete,
}: StaffCardProps) {
  return (
    <Card className="group hover:shadow-lg transition-all duration-300 overflow-hidden">
      {/* Header with Photo */}
      <div className="relative h-32 bg-gradient-to-br from-primary/20 to-primary/5">
        <div className="absolute -bottom-10 left-1/2 -translate-x-1/2">
          <div className="h-20 w-20 rounded-full bg-background p-1">
            <div className="h-full w-full rounded-full bg-muted overflow-hidden flex items-center justify-center">
              {staff.profilePictureUrl ? (
                <img
                  src={staff.profilePictureUrl}
                  alt={`${staff.firstName} ${staff.lastName}`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <UserCircle className="h-12 w-12 text-muted-foreground" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <CardContent className="pt-12 pb-4">
        <div className="text-center space-y-2">
          <div className="space-y-1">
            <h3 className="font-semibold text-lg">
              {staff.firstName} {staff.lastName}
            </h3>
            {staff.firstNameBn || staff.lastNameBn ? (
              <p className="text-sm text-muted-foreground">
                {staff.firstNameBn} {staff.lastNameBn}
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">{staff.staffId}</p>
          </div>

          <Badge variant={staff.isActive ? "default" : "secondary"} className="mt-2">
            {staff.isActive ? "Active" : "Inactive"}
          </Badge>
        </div>

        {/* Info Section */}
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Briefcase className="h-4 w-4" />
            <span>{staff.designation}</span>
          </div>
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Briefcase className="h-4 w-4" />
            <span>{staff.department}</span>
          </div>
          {staff.email && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Mail className="h-4 w-4" />
              <span className="truncate max-w-full">{staff.email}</span>
            </div>
          )}
          {staff.phone && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Phone className="h-4 w-4" />
              <span>{staff.phone}</span>
            </div>
          )}
        </div>
      </CardContent>

      {/* Actions */}
      <CardFooter className="border-t pt-4 pb-4">
        <div className="grid grid-cols-3 gap-2 w-full">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onView?.(staff)}
            className="text-xs"
          >
            View
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit?.(staff)}
            className="text-xs"
          >
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDelete?.(staff)}
            className="text-xs text-destructive hover:text-destructive"
          >
            Delete
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
