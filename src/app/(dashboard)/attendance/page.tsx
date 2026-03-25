import { PageHeader } from "@/components/shared/page-header";
import { CalendarCheck } from "lucide-react";

export default function AttendancePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance"
        description="Mark and review daily attendance for students and staff."
        icon={CalendarCheck}
      >
        <button className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
          Mark Attendance
        </button>
      </PageHeader>

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
          Attendance grid will be rendered here.
        </div>
      </div>
    </div>
  );
}
