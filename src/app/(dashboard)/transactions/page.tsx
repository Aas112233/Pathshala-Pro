import { PageHeader } from "@/components/shared/page-header";
import { ArrowLeftRight } from "lucide-react";

export default function TransactionsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Transactions"
        description="View and manage all payment transactions."
        icon={ArrowLeftRight}
      />

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
          Transaction history data table will be rendered here.
        </div>
      </div>
    </div>
  );
}
