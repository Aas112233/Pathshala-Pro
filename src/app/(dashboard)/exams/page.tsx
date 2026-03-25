import { PageHeader } from "@/components/shared/page-header";
import { BookOpen } from "lucide-react";

export default function ExamsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Exams"
        description="Manage exam schedules, enter marks, and view results."
        icon={BookOpen}
      >
        <button className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
          Enter Marks
        </button>
      </PageHeader>

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
          Exam results data table will be rendered here.
        </div>
      </div>
    </div>
  );
}
