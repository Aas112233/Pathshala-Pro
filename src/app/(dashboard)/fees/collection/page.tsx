import { PageHeader } from "@/components/shared/page-header";
import { CreditCard } from "lucide-react";

export default function FeeCollectionPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Fee Collection"
        description="POS interface for collecting fees from students."
        icon={CreditCard}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Student Search */}
        <div className="lg:col-span-1">
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="mb-4 text-base font-semibold text-card-foreground">
              Search Student
            </h3>
            <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
              Student search will be rendered here.
            </div>
          </div>
        </div>

        {/* Fee Details & Payment */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="mb-4 text-base font-semibold text-card-foreground">
              Outstanding Fees
            </h3>
            <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
              Fee details and payment form will be rendered here.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
