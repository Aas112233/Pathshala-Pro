import { PageHeader } from "@/components/shared/page-header";
import { Users } from "lucide-react";

export default function StaffPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff"
        description="Manage staff profiles, departments, and records."
        icon={Users}
      >
        <button className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
          Add Staff
        </button>
      </PageHeader>

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
          Staff directory data table will be rendered here.
        </div>
      </div>
    </div>
  );
}
