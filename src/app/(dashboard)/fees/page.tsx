import { PageHeader } from "@/components/shared/page-header";
import { Receipt } from "lucide-react";

export default function FeesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Fee Vouchers"
        description="Create, manage, and track fee vouchers for students."
        icon={Receipt}
      >
        <button className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
          Create Voucher
        </button>
      </PageHeader>

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
          Fee voucher data table will be rendered here.
        </div>
      </div>
    </div>
  );
}
