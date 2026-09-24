"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AppModal } from "@/components/ui/app-modal";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle } from "lucide-react";

interface RejectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
  staffName?: string;
  isSubmitting?: boolean;
}

export function RejectionDialog({
  isOpen,
  onClose,
  onConfirm,
  staffName,
  isSubmitting = false,
}: RejectionDialogProps) {
  const t = useTranslations("salary");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim() || reason.trim().length < 3) {
      setError(t("approvals.rejectionReasonRequired"));
      return;
    }
    setError("");
    await onConfirm(reason.trim());
    setReason("");
    onClose();
  };

  const handleClose = () => {
    setReason("");
    setError("");
    onClose();
  };

  return (
    <AppModal
      isOpen={isOpen}
      onClose={handleClose}
      title={t("approvals.rejectTitle")}
      description={
        staffName
          ? t("approvals.rejectDescriptionStaff", { name: staffName })
          : t("approvals.rejectDescription")
      }
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        <div className="space-y-2">
          <label htmlFor="rejection-reason" className="text-xs font-semibold text-foreground">
            {t("approvals.reasonLabel")} <span className="text-destructive">*</span>
          </label>
          <textarea
            id="rejection-reason"
            rows={4}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (error) setError("");
            }}
            placeholder={t("approvals.reasonPlaceholder")}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isSubmitting}
          />
          {error && (
            <p className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>{error}</span>
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            {t("approvals.cancel")}
          </Button>
          <Button
            type="submit"
            variant="destructive"
            size="sm"
            disabled={isSubmitting || reason.trim().length < 3}
          >
            {isSubmitting && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            {t("approvals.confirmReject")}
          </Button>
        </div>
      </form>
    </AppModal>
  );
}
