"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { User, Users, Briefcase, CheckCircle2, XCircle, Clock } from "lucide-react";
import { AppModal } from "@/components/ui/app-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useStudents, useStaff } from "@/hooks/use-queries";
import { useTenantFormatting } from "@/components/providers/tenant-settings-provider";

interface MarkAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type AttendanceType = "student" | "staff";
type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "LEAVE";

interface AttendanceEntry {
  id: string;
  name: string;
  rollOrStaffId: string;
  type: AttendanceType;
  status: AttendanceStatus;
  note: string;
}

export function MarkAttendanceModal({ isOpen, onClose }: MarkAttendanceModalProps) {
  const t = useTranslations('attendance');
  const { formatDate } = useTenantFormatting();
  const [attendanceType, setAttendanceType] = useState<AttendanceType>("student");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [search, setSearch] = useState("");
  const [attendanceList, setAttendanceList] = useState<AttendanceEntry[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const { data: studentsData } = useStudents({ limit: 100 });
  const { data: staffData } = useStaff({ limit: 100 });

  const students = (studentsData as any)?.data || [];
  const staff = (staffData as any)?.data || [];

  // Initialize attendance list when type changes
  useEffect(() => {
    const list: AttendanceEntry[] = [];
    const currentStudents = (studentsData as any)?.data || [];
    const currentStaff = (staffData as any)?.data || [];
    const people = attendanceType === "student" ? currentStudents : currentStaff;

    people.forEach((person: any) => {
      list.push({
        id: person.id,
        name: `${person.firstName} ${person.lastName}`,
        rollOrStaffId: attendanceType === "student" ? person.studentId : person.staffId,
        type: attendanceType,
        status: "PRESENT",
        note: "",
      });
    });

    setAttendanceList(list);
  }, [attendanceType, studentsData, staffData]);

  const handleStatusChange = (id: string, status: AttendanceStatus) => {
    setAttendanceList(prev =>
      prev.map(entry =>
        entry.id === id ? { ...entry, status } : entry
      )
    );
  };

  const handleNoteChange = (id: string, note: string) => {
    setAttendanceList(prev =>
      prev.map(entry =>
        entry.id === id ? { ...entry, note } : entry
      )
    );
  };

  const handleMarkAll = (status: AttendanceStatus) => {
    setAttendanceList(prev =>
      prev.map(entry => ({ ...entry, status }))
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const promises = attendanceList
        .filter(entry => entry.status !== "PRESENT")
        .map(entry => ({
          studentProfileId: attendanceType === "student" ? entry.id : undefined,
          staffProfileId: attendanceType === "staff" ? entry.id : undefined,
          date: new Date(selectedDate).toISOString(),
          status: entry.status,
          note: entry.note || undefined,
        }));

      for (const attendance of promises) {
        await fetch("/api/attendance", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(attendance),
        });
      }

      onClose();
    } catch (error) {
      console.error("Failed to save attendance:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredList = attendanceList.filter(entry =>
    entry.name.toLowerCase().includes(search.toLowerCase()) ||
    entry.rollOrStaffId.toLowerCase().includes(search.toLowerCase())
  );

  const presentCount = attendanceList.filter(e => e.status === "PRESENT").length;
  const absentCount = attendanceList.filter(e => e.status === "ABSENT").length;
  const lateCount = attendanceList.filter(e => e.status === "LATE").length;

  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      title={t('markAttendance')}
      description={formatDate(selectedDate)}
      maxWidth="6xl"
      className="max-h-[90vh]"
    >
      <div className="space-y-4 -mx-1 px-1">
        {/* Type Selector */}
        <div className="flex items-center gap-4">
          <Button
            variant={attendanceType === "student" ? "default" : "outline"}
            onClick={() => setAttendanceType("student")}
            className="flex-1"
          >
            <Users className="h-4 w-4 mr-2" />
            {t('viewType.students')}
          </Button>
          <Button
            variant={attendanceType === "staff" ? "default" : "outline"}
            onClick={() => setAttendanceType("staff")}
            className="flex-1"
          >
            <Briefcase className="h-4 w-4 mr-2" />
            {t('viewType.staff')}
          </Button>
        </div>

        {/* Date and Search */}
        <div className="flex gap-4">
          <div className="flex-1">
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full"
            />
          </div>
          <div className="flex-1">
            <Input
              placeholder={t('searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full"
            />
          </div>
        </div>

        {/* Bulk Actions */}
        <div className="rounded-lg bg-muted/50 p-3">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleMarkAll("PRESENT")}
              >
                <CheckCircle2 className="h-4 w-4 mr-2 text-green-600" />
                {t('present')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleMarkAll("ABSENT")}
              >
                <XCircle className="h-4 w-4 mr-2 text-red-600" />
                {t('absent')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleMarkAll("LATE")}
              >
                <Clock className="h-4 w-4 mr-2 text-yellow-600" />
                {t('late')}
              </Button>
            </div>
            <div className="flex gap-4 text-sm">
              <span className="text-green-600 font-medium">{t('present')}: {presentCount}</span>
              <span className="text-red-600 font-medium">{t('absent')}: {absentCount}</span>
              <span className="text-yellow-600 font-medium">{t('late')}: {lateCount}</span>
            </div>
          </div>
        </div>

        {/* Attendance List */}
        <div className="space-y-2 max-h-[40vh] overflow-y-auto">
          {filteredList.map((entry) => (
            <Card key={entry.id} className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    {attendanceType === "student" ? (
                      <User className="h-5 w-5 text-primary" />
                    ) : (
                      <Briefcase className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">{entry.name}</p>
                    <p className="text-sm text-muted-foreground">{entry.rollOrStaffId}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant={entry.status === "PRESENT" ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleStatusChange(entry.id, "PRESENT")}
                    className={entry.status === "PRESENT" ? "bg-green-600 hover:bg-green-700" : ""}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={entry.status === "ABSENT" ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleStatusChange(entry.id, "ABSENT")}
                    className={entry.status === "ABSENT" ? "bg-red-600 hover:bg-red-700" : ""}
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={entry.status === "LATE" ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleStatusChange(entry.id, "LATE")}
                    className={entry.status === "LATE" ? "bg-yellow-600 hover:bg-yellow-700" : ""}
                  >
                    <Clock className="h-4 w-4" />
                  </Button>
                  <Input
                    placeholder="Note (optional)"
                    value={entry.note}
                    onChange={(e) => handleNoteChange(entry.id, e.target.value)}
                    className="w-[200px]"
                  />
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            Total: {attendanceList.length} | {t('present')}: {presentCount} | {t('absent')}: {absentCount} | {t('late')}: {lateCount}
          </p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose}>
              {t('cancel')}
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? t('saving') : t('saveChanges')}
            </Button>
          </div>
        </div>
      </div>
    </AppModal>
  );
}
