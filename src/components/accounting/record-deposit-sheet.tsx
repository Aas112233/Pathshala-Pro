"use client";

import { useState } from "react";
import { TopSheet } from "@/components/ui/top-sheet";
import { ERPFormSection, ERPFormGrid, ERPFormField } from "@/components/ui/erp-form-layout";
import { AppDropdown } from "@/components/ui/app-dropdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ArrowRightLeft, Loader2 } from "lucide-react";
import { useCreateDeposit } from "@/hooks/use-queries";
import { useTranslations } from "next-intl";

interface RecordDepositSheetProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: any[];
}

export function RecordDepositSheet({ isOpen, onClose, accounts }: RecordDepositSheetProps) {
  const t = useTranslations("accounting.deposits");
  const tCommon = useTranslations("common");
  const createDeposit = useCreateDeposit();

  const linked = (accounts || []).filter((a: any) => a.accountCode);
  const [fromCode, setFromCode] = useState("1020");
  const [toCode, setToCode] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const toOptions = linked.map((a: any) => ({
    value: String(a.accountCode),
    label: `${a.accountName} (${a.accountCode})`,
  }));

  const handleSubmit = async () => {
    const amt = parseFloat(amount);
    if (!toCode) {
      toast.error(t("selectDestination"));
      return;
    }
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error(t("invalidAmount"));
      return;
    }
    try {
      await createDeposit.mutateAsync({ fromCode: fromCode || "1020", toCode, amount: amt, note: note || undefined });
      toast.success(t("depositRecorded"));
      setToCode("");
      setAmount("");
      setNote("");
      onClose();
    } catch (err: any) {
      toast.error(err?.message || t("depositFailed"));
    }
  };

  return (
    <TopSheet
      isOpen={isOpen}
      onClose={onClose}
      title={t("recordDeposit")}
      description={t("description")}
      maxWidth="2xl"
      footer={
        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={createDeposit.isPending}>
            {tCommon("cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={createDeposit.isPending || !toCode || !amount} className="gap-2">
            {createDeposit.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ArrowRightLeft className="h-3.5 w-3.5" />
            )}
            {t("recordDeposit")}
          </Button>
        </div>
      }
    >
      <div className="space-y-6 py-2">
        <ERPFormSection title={t("transferTitle")} description={t("transferDescription")}>
          <ERPFormGrid cols={2}>
            <ERPFormField label={t("fromAccount")} required>
              <Input
                value={fromCode}
                onChange={(e) => setFromCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
                className="h-10 font-mono"
                placeholder="1020"
              />
            </ERPFormField>
            <ERPFormField label={t("toAccount")} required>
              {toOptions.length > 0 ? (
                <AppDropdown
                  options={toOptions}
                  value={toCode}
                  onChange={(v) => setToCode(String(v))}
                  placeholder={t("selectDestination")}
                  searchable
                />
              ) : (
                <Input
                  value={toCode}
                  onChange={(e) => setToCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
                  className="h-10 font-mono"
                  placeholder={t("toAccountPlaceholder")}
                />
              )}
            </ERPFormField>
            <ERPFormField label={t("amount")} required>
              <Input
                type="number"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-10 font-mono font-bold"
                placeholder="0.00"
              />
            </ERPFormField>
            <ERPFormField label={t("note")}>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="h-10"
                placeholder={t("notePlaceholder")}
              />
            </ERPFormField>
          </ERPFormGrid>
        </ERPFormSection>
      </div>
    </TopSheet>
  );
}
