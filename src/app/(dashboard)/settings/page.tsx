import { PageHeader } from "@/components/shared/page-header";
import { Settings } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Configure school profile, preferences, and system settings."
        icon={Settings}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="mb-4 text-base font-semibold text-card-foreground">
            School Profile
          </h3>
          <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
            School profile settings will be rendered here.
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="mb-4 text-base font-semibold text-card-foreground">
            System Preferences
          </h3>
          <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
            System preferences will be rendered here.
          </div>
        </div>
      </div>
    </div>
  );
}
