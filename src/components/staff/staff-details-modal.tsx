"use client";

import { AppModal } from "@/components/ui/app-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { UserCircle, Mail, Phone, MapPin, Calendar, Briefcase, DollarSign, IdCard } from "lucide-react";
import type { StaffProfileWithDetails } from "@/types/entities";
import { useTenantFormatting } from "@/components/providers/tenant-settings-provider";

interface StaffDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  staff: StaffProfileWithDetails | null;
  onEdit?: (staff: StaffProfileWithDetails) => void;
}

export function StaffDetailsModal({
  isOpen,
  onClose,
  staff,
  onEdit,
}: StaffDetailsModalProps) {
  const { formatDate, formatCurrency } = useTenantFormatting();

  if (!staff) return null;

  const InfoRow = ({ 
    icon: Icon, 
    label, 
    value, 
    empty = "-" 
  }: { 
    icon: any; 
    label: string; 
    value: string | number | undefined | null; 
    empty?: string 
  }) => (
    <div className="flex items-start gap-3 py-2">
      <Icon className="h-5 w-5 text-muted-foreground mt-0.5" />
      <div className="flex-1">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value || empty}</p>
      </div>
    </div>
  );

  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      title="Staff Member Details"
      description={`${staff.firstName} ${staff.lastName} - ${staff.designation}`}
      maxWidth="4xl"
      className="max-h-[90vh]"
    >
      <div className="space-y-6 pt-2">
        {/* Header with Photo */}
        <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50">
          <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
            {staff.profilePictureUrl ? (
              <img 
                src={staff.profilePictureUrl} 
                alt={`${staff.firstName} ${staff.lastName}`}
                className="h-full w-full object-cover"
              />
            ) : (
              <UserCircle className="h-16 w-16 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold">
                  {staff.firstName} {staff.lastName}
                  {staff.firstNameBn || staff.lastNameBn ? (
                    <span className="text-muted-foreground font-normal ml-2">
                      ({staff.firstNameBn} {staff.lastNameBn})
                    </span>
                  ) : null}
                </h3>
                <p className="text-sm text-muted-foreground">{staff.staffId}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={staff.isActive ? "default" : "secondary"}>
                  {staff.isActive ? "Active" : "Inactive"}
                </Badge>
                {onEdit && (
                  <Button variant="outline" size="sm" onClick={() => {
                    onEdit(staff);
                    onClose();
                  }}>
                    Edit
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Personal Information */}
          <Card>
            <CardHeader className="pb-3">
              <h4 className="text-sm font-semibold">Personal Information</h4>
            </CardHeader>
            <CardContent className="space-y-1">
              <InfoRow 
                icon={IdCard} 
                label="Gender" 
                value={staff.gender ? staff.gender.charAt(0) + staff.gender.slice(1).toLowerCase() : undefined} 
              />
              <InfoRow 
                icon={Calendar} 
                label="Date of Birth" 
                value={staff.dateOfBirth ? formatDate(staff.dateOfBirth) : undefined} 
              />
              <InfoRow 
                icon={MapPin} 
                label="Address" 
                value={staff.address} 
              />
            </CardContent>
          </Card>

          {/* Employment Information */}
          <Card>
            <CardHeader className="pb-3">
              <h4 className="text-sm font-semibold">Employment Information</h4>
            </CardHeader>
            <CardContent className="space-y-1">
              <InfoRow 
                icon={Briefcase} 
                label="Department" 
                value={staff.department} 
              />
              <InfoRow 
                icon={IdCard} 
                label="Designation" 
                value={staff.designation} 
              />
              <InfoRow 
                icon={Calendar} 
                label="Hire Date" 
                value={staff.hireDate ? formatDate(staff.hireDate) : undefined} 
              />
              <InfoRow 
                icon={Calendar} 
                label="Joining Date" 
                value={staff.joiningDate ? formatDate(staff.joiningDate) : undefined} 
              />
              <InfoRow 
                icon={DollarSign} 
                label="Base Salary" 
                value={formatCurrency(staff.baseSalary)} 
              />
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card>
            <CardHeader className="pb-3">
              <h4 className="text-sm font-semibold">Contact Information</h4>
            </CardHeader>
            <CardContent className="space-y-1">
              <InfoRow 
                icon={Mail} 
                label="Email" 
                value={staff.email} 
              />
              <InfoRow 
                icon={Phone} 
                label="Phone" 
                value={staff.phone} 
              />
            </CardContent>
          </Card>

          {/* Additional Information */}
          <Card>
            <CardHeader className="pb-3">
              <h4 className="text-sm font-semibold">Additional Information</h4>
            </CardHeader>
            <CardContent className="space-y-1">
              <InfoRow 
                icon={IdCard} 
                label="Qualification" 
                value={staff.qualification} 
              />
              <InfoRow 
                icon={Calendar} 
                label="Created At" 
                value={staff.createdAt ? formatDate(staff.createdAt) : undefined} 
              />
              <InfoRow 
                icon={Calendar} 
                label="Last Updated" 
                value={staff.updatedAt ? formatDate(staff.updatedAt) : undefined} 
              />
            </CardContent>
          </Card>
        </div>

        {/* Salary History */}
        {staff.salaryLedgers && staff.salaryLedgers.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <h4 className="text-sm font-semibold">Recent Salary Records</h4>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {staff.salaryLedgers.map((ledger) => (
                  <div 
                    key={ledger.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                  >
                    <div>
                      <p className="font-medium">
                        {["January", "February", "March", "April", "May", "June", 
                          "July", "August", "September", "October", "November", "December"][ledger.month - 1]} {ledger.year}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Base: {formatCurrency(ledger.baseSalary)} | 
                        Deductions: {formatCurrency(ledger.deductions)} | 
                        Advances: {formatCurrency(ledger.advances)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(ledger.netPayable)}</p>
                      <Badge variant={ledger.status === "PAID" ? "default" : ledger.status === "PARTIAL" ? "secondary" : "outline"}>
                        {ledger.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Attendance Records */}
        {staff.attendances && staff.attendances.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <h4 className="text-sm font-semibold">Recent Attendance Records</h4>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {staff.attendances.map((attendance) => (
                  <div 
                    key={attendance.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                  >
                    <div className="flex items-center gap-3">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{formatDate(attendance.date)}</p>
                        {attendance.note && (
                          <p className="text-xs text-muted-foreground">{attendance.note}</p>
                        )}
                      </div>
                    </div>
                    <Badge 
                      variant={
                        attendance.status === "PRESENT" ? "default" :
                        attendance.status === "ABSENT" ? "destructive" :
                        attendance.status === "LATE" ? "secondary" : "outline"
                      }
                    >
                      {attendance.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppModal>
  );
}
