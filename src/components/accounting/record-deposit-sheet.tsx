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
import { GL_CODES } from "@/lib/constants";

interface RecordDepositSheetProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: any[];
}

export function RecordDepositSheet({ isOpen, onClose, accounts }: RecordDepositSheetProps) {
  const t = useTranslations("accounting.deposits");
  const tCommon = useTranslations("common");
  const createDeposit = useCreateDeposit();

  // Map bank accounts to options, ensuring each has an account code (defaulting to GL_CODES.BANK if unlinked)
  const rawBankOptions = (accounts || []).map((a: any) => {
    const code = a.accountCode ? String(a.accountCode) : GL_CODES.BANK;
    const details = [a.bankName, a.accountNumber ? `••••${String(a.accountNumber).slice(-4)}` : ""].filter(Boolean).join(" - ");
    return {
      value: code,
      label: `${a.accountName || t("toAccount")}${details ? ` (${details})` : ""} [${code}]`,
    };
  });

  // Always ensure the standard Main Bank Account is available as an option
  const hasBank = rawBankOptions.some((o: { value: string }) => o.value === GL_CODES.BANK);
  const allBankOptions = hasBank
    ? rawBankOptions
    : [{ value: GL_CODES.BANK, label: `${t("toAccount")} - Main Bank (${GL_CODES.BANK})` }, ...rawBankOptions];

  // De-duplicate by GL code
  const uniqueBankOptions: { value: string; label: string }[] = allBankOptions.filter(
    (item: { value: string }, index: number, self: { value: string }[]) =>
      index === self.findIndex((o) => o.value === item.value)
  );

  const [fromCode, setFromCode] = useState<string>("");
  const [toCode, setToCode] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [bankReference, setBankReference] = useState("");
  const [receiptRefs, setReceiptRefs] = useState("");

  const fromOptions = [
    { value: GL_CODES.CASH, label: `${t("fromAccount")} (${GL_CODES.CASH})` },
    ...uniqueBankOptions.filter((o) => o.value !== GL_CODES.CASH && o.value !== toCode),
  ];
  const toOptions = uniqueBankOptions.filter((o) => o.value !== fromCode);

  const handleSubmit = async () => {
    const amt = parseFloat(amount);
    if (!fromCode) {
      toast.error(t("selectSource"));
      return;
    }
    if (!toCode) {
      toast.error(t("selectDestination"));
      return;
    }
    if (fromCode === toCode) {
      toast.error(t("sameAccount"));
      return;
    }
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error(t("invalidAmount"));
      return;
    }
    try {
      await createDeposit.mutateAsync({
        fromCode,
        toCode,
        amount: amt,
        note: note || undefined,
        bankReference: bankReference.trim() || undefined,
        receiptRefs: receiptRefs.trim() || undefined,
      });
      toast.success(t("depositRecorded"));
      setFromCode("");
      setToCode("");
      setAmount("");
      setNote("");
      setBankReference("");
      setReceiptRefs("");
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
          <Button onClick={handleSubmit} disabled={createDeposit.isPending || !fromCode || !toCode || !amount} className="gap-2">
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
              <AppDropdown
                options={fromOptions}
                value={fromCode}
                onChange={(v) => setFromCode(String(v))}
                placeholder={t("selectSource")}
                searchable
              />
            </ERPFormField>
            <ERPFormField label={t("toAccount")} required>
              <AppDropdown
                options={toOptions}
                value={toCode}
                onChange={(v) => setToCode(String(v))}
                placeholder={t("selectDestination")}
                searchable
              />
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
            <ERPFormField label={t("bankReference")}>
              <Input
                value={bankReference}
                onChange={(e) => setBankReference(e.target.value.slice(0, 100))}
                className="h-10 font-mono"
                placeholder={t("bankReferencePlaceholder")}
              />
            </ERPFormField>
            <ERPFormField label={t("receiptRefs")}>
              <Input
                value={receiptRefs}
                onChange={(e) => setReceiptRefs(e.target.value.slice(0, 1000))}
                className="h-10 font-mono"
                placeholder={t("receiptRefsPlaceholder")}
              />
            </ERPFormField>
          </ERPFormGrid>
        </ERPFormSection>
      </div>
    </TopSheet>
  );
}
