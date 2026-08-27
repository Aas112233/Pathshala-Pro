"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  HelpCircle,
  Save,
  Users,
  Check,
  Send,
  Loader2,
} from "lucide-react";

interface StudentItem {
  id: string;
  studentId: string;
  rollNumber: string;
  firstName: string;
  lastName: string;
}

interface FastAttendanceGridProps {
  students?: StudentItem[];
  classes?: Array<{ id: string; name: string; sections?: Array<{ id: string; name: string }> }>;
  onSaved?: () => void;
}

type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

export function FastAttendanceGrid({
  students = [],
  classes = [],
  onSaved,
}: FastAttendanceGridProps) {
  const t = useTranslations();

  const statusLabel = (status: AttendanceStatus): string => {
    switch (status) {
      case "PRESENT":
        return t("attendance.present");
      case "ABSENT":
        return t("attendance.absent");
      case "LATE":
        return t("attendance.late");
      default:
        return t("attendanceExtras.fastGrid.statusExcused");
    }
  };

  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [studentList, setStudentList] = useState<StudentItem[]>(students);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Status state mapped by student ID
  const [attendanceMap, setAttendanceMap] = useState<
    Record<string, { status: AttendanceStatus; note: string }>
  >({});

  // Fetch students when class/section filter changes
  useEffect(() => {
    async function loadStudents() {
      setIsLoadingStudents(true);
      try {
        const queryParams = new URLSearchParams({
          limit: "100",
          status: "ACTIVE",
          ...(selectedClassId && { classId: selectedClassId }),
        });

        const res = await fetch(`/api/students?${queryParams}`);
        const json = await res.json();
        if (json.success && json.data) {
          const list = json.data as StudentItem[];
          setStudentList(list);

          // Default all loaded students to PRESENT
          const initialMap: Record<string, { status: AttendanceStatus; note: string }> = {};
          list.forEach((st) => {
            initialMap[st.id] = { status: "PRESENT", note: "" };
          });
          setAttendanceMap(initialMap);
        }
      } catch (err) {
        console.error("Failed to load students for attendance:", err);
      } finally {
        setIsLoadingStudents(false);
      }
    }

    loadStudents();
  }, [selectedClassId, selectedSectionId]);

  const markAll = (status: AttendanceStatus) => {
    setAttendanceMap((prev) => {
      const next = { ...prev };
      studentList.forEach((st) => {
        next[st.id] = { ...next[st.id], status };
      });
      return next;
    });
    toast.info(
      t("attendanceExtras.fastGrid.markedAll", { status: statusLabel(status) })
    );
  };

  const updateStudentStatus = (studentId: string, status: AttendanceStatus) => {
    setAttendanceMap((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], status },
    }));
  };

  const updateStudentNote = (studentId: string, note: string) => {
    setAttendanceMap((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], note },
    }));
  };

  // Metrics calculation
  const totalStudents = studentList.length;
  const presentCount = Object.values(attendanceMap).filter((v) => v.status === "PRESENT").length;
  const absentCount = Object.values(attendanceMap).filter((v) => v.status === "ABSENT").length;
  const lateCount = Object.values(attendanceMap).filter((v) => v.status === "LATE").length;
  const excusedCount = Object.values(attendanceMap).filter((v) => v.status === "EXCUSED").length;
  const presenceRate = totalStudents > 0 ? ((presentCount / totalStudents) * 100).toFixed(0) : "0";

  const handleSaveAttendance = async () => {
    if (studentList.length === 0) {
      toast.error(t("attendanceExtras.fastGrid.noStudentsToSave"));
      return;
    }

    setIsSaving(true);
    try {
      const records = studentList.map((st) => ({
        studentProfileId: st.id,
        status: attendanceMap[st.id]?.status || "PRESENT",
        note: attendanceMap[st.id]?.note || undefined,
      }));

      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selectedDate,
          records,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error?.message || t("attendanceExtras.fastGrid.saveFailed"));
        return;
      }

      toast.success(
        t("attendanceExtras.fastGrid.savedSummary", {
          present: presentCount,
          absent: absentCount,
          rate: presenceRate,
        })
      );
      if (onSaved) onSaved();
    } catch (err: any) {
      toast.error(err.message || t("attendanceExtras.fastGrid.networkError"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="border border-border shadow-sm rounded-xl overflow-hidden">
      <CardHeader className="bg-muted/30 border-b border-border/70 py-4 px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-foreground">
                {t("attendanceExtras.fastGrid.cardTitle")}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {t("attendanceExtras.fastGrid.cardSubtitle")}
              </p>
            </div>
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-2.5">
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="h-9 w-36 text-xs bg-background"
            />

            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="h-9 px-3 rounded-md border border-input bg-background text-xs"
            >
              <option value="">{t("attendanceExtras.fastGrid.allClasses")}</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Live Metrics & Quick Actions Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 mt-3 border-t border-border/50 text-xs">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1.5 font-semibold">
              <Users className="h-3.5 w-3.5" />{" "}
              {t("attendanceExtras.fastGrid.totalCount", { count: totalStudents })}
            </Badge>
            <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-none font-semibold">
              {t("attendanceExtras.fastGrid.presentCount", {
                count: presentCount,
                rate: presenceRate,
              })}
            </Badge>
            <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-none font-semibold">
              {t("attendanceExtras.fastGrid.absentCount", { count: absentCount })}
            </Badge>
            {lateCount > 0 && (
              <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-none font-semibold">
                {t("attendanceExtras.fastGrid.lateCount", { count: lateCount })}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => markAll("PRESENT")}
              className="h-8 text-xs gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300"
            >
              <Check className="h-3.5 w-3.5" /> {t("attendanceExtras.fastGrid.markAllPresent")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => markAll("ABSENT")}
              className="h-8 text-xs gap-1.5 border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300"
            >
              <XCircle className="h-3.5 w-3.5" /> {t("attendanceExtras.fastGrid.markAllAbsent")}
            </Button>
            <Button
              size="sm"
              onClick={handleSaveAttendance}
              disabled={isSaving || totalStudents === 0}
              className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 shadow-sm"
            >
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {t("attendanceExtras.fastGrid.saveAttendance")}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {isLoadingStudents ? (
          <div className="py-12 text-center text-muted-foreground text-xs flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> {t("attendanceExtras.fastGrid.loadingStudents")}
          </div>
        ) : studentList.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-xs">
            {t("attendanceExtras.fastGrid.noStudents")}
          </div>
        ) : (
          <div className="divide-y divide-border/60 max-h-[500px] overflow-y-auto">
            {studentList.map((st, idx) => {
              const currentStatus = attendanceMap[st.id]?.status || "PRESENT";
              const currentNote = attendanceMap[st.id]?.note || "";

              return (
                <div
                  key={st.id}
                  className={`flex flex-wrap items-center justify-between p-3.5 text-xs transition-colors hover:bg-muted/20 ${
                    currentStatus === "ABSENT"
                      ? "bg-rose-50/40 dark:bg-rose-950/20"
                      : currentStatus === "LATE"
                      ? "bg-amber-50/40 dark:bg-amber-950/20"
                      : ""
                  }`}
                >
                  {/* Student Info */}
                  <div className="flex items-center gap-3 min-w-[200px]">
                    <span className="font-mono text-muted-foreground w-6 text-right">
                      {idx + 1}.
                    </span>
                    <div>
                      <p className="font-semibold text-foreground">
                        {st.firstName} {st.lastName}
                      </p>
                      <p className="text-[11px] text-muted-foreground font-mono">
                        {st.studentId} {t("attendanceExtras.fastGrid.rollNo", { roll: st.rollNumber })}
                      </p>
                    </div>
                  </div>

                  {/* Fast Action Buttons */}
                  <div className="flex items-center gap-2 my-1">
                    {[
                      { id: "PRESENT", label: "P", color: "bg-emerald-600 text-white" },
                      { id: "ABSENT", label: "A", color: "bg-rose-600 text-white" },
                      { id: "LATE", label: "L", color: "bg-amber-600 text-white" },
                      { id: "EXCUSED", label: "E", color: "bg-blue-600 text-white" },
                    ].map((btn) => {
                      const isSelected = currentStatus === btn.id;

                      return (
                        <button
                          key={btn.id}
                          type="button"
                          onClick={() => updateStudentStatus(st.id, btn.id as AttendanceStatus)}
                          className={`h-7 w-7 rounded-lg font-bold text-xs flex items-center justify-center transition-all ${
                            isSelected
                              ? `${btn.color} shadow-sm scale-105 ring-2 ring-offset-1 ring-primary`
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          }`}
                          title={t("attendanceExtras.fastGrid.markAs", {
                            status: statusLabel(btn.id as AttendanceStatus),
                          })}
                        >
                          {btn.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Optional Note */}
                  <div className="w-48">
                    <Input
                      placeholder={t("attendanceExtras.fastGrid.notePlaceholder")}
                      value={currentNote}
                      onChange={(e) => updateStudentNote(st.id, e.target.value)}
                      className="h-7 text-[11px] bg-background/80"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
