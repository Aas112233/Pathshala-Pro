import { PageHeader } from "@/components/shared/page-header";
import { CalendarRange } from "lucide-react";

export default function AcademicYearPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Academic Year"
        description="Configure academic year periods and lock completed sessions."
        icon={CalendarRange}
      >
        <button className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
          Add Academic Year
        </button>
      </PageHeader>

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
          Academic year management will be rendered here.
        </div>
      </div>
    </div>
  );
}
