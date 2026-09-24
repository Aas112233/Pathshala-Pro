"use client";

import { useState } from "react";
import { TopSheet } from "@/components/ui/top-sheet";
import { AppDropdown } from "@/components/ui/app-dropdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Building2, Save, Loader2 } from "lucide-react";
import { useCreateBankAccount } from "@/hooks/use-queries";
import { BANK_ACCOUNT_TYPES, type BankAccountType } from "@/lib/schemas";
import { useTenantFormatting } from "@/components/providers/tenant-settings-provider";
import { useTranslations } from "next-intl";

interface AddAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

/** Bank/cash account type -> label key (labels already exist in all 4 locales). */
const ACCOUNT_TYPE_LABEL_KEY: Record<BankAccountType, string> = {
  CHECKING: "accounting.accountsForm.typeChecking",
  SAVINGS: "accounting.accountsForm.typeSavings",
  PETTY_CASH: "accounting.accountsForm.typePettyCash",
};

export function AddAccountModal({ isOpen, onClose, onSuccess }: AddAccountModalProps) {
  const t = useTranslations();
  const { currencyCode } = useTenantFormatting();
  const createAccountMutation = useCreateBankAccount();

  const [formData, setFormData] = useState({
    accountName: "",
    accountNumber: "",
    bankName: "",
    branchName: "",
    accountType: "CHECKING" as BankAccountType,
    accountCode: "",
    openingBalance: "0",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.accountName.trim() || !formData.bankName.trim() || !formData.accountNumber.trim()) {
      toast.error(t("accounting.accountsForm.errRequired"));
      return;
    }

    createAccountMutation.mutate(
      {
        ...formData,
        accountCode: formData.accountCode.trim() || undefined,
        openingBalance: parseFloat(formData.openingBalance) || 0,
        currency: currencyCode,
      },
      {
          onSuccess: () => {
            toast.success(t("accounting.accountsForm.created"));
            setFormData({
              accountName: "",
              accountNumber: "",
              bankName: "",
              branchName: "",
              accountType: "CHECKING",
              accountCode: "",
              openingBalance: "0",
            });
          onClose();
          if (onSuccess) onSuccess();
        },
        onError: (err: any) => {
          toast.error(err.message || t("accounting.accountsForm.createFailed"));
        },
      }
    );
  };

  return (
    <TopSheet
      isOpen={isOpen}
      onClose={onClose}
      title={t("accounting.accountsForm.title")}
      subtitle={t("accounting.accountsForm.subtitle")}
      description={t("accounting.accountsForm.description")}
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">{t("accounting.accountsForm.nameLabel")}</Label>
            <Input
              placeholder={t("accounting.accountsForm.namePlaceholder")}
              value={formData.accountName}
              onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
              className="h-10 text-sm"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">{t("accounting.accountsForm.bankLabel")}</Label>
            <Input
              placeholder={t("accounting.accountsForm.bankPlaceholder")}
              value={formData.bankName}
              onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
              className="h-10 text-sm"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">{t("accounting.accountsForm.ibanLabel")}</Label>
            <Input
              placeholder={t("accounting.accountsForm.ibanPlaceholder")}
              value={formData.accountNumber}
              onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
              className="h-10 text-sm font-mono"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">{t("accounting.accountsForm.branchLabel")}</Label>
            <Input
              placeholder={t("accounting.accountsForm.branchPlaceholder")}
              value={formData.branchName}
              onChange={(e) => setFormData({ ...formData, branchName: e.target.value })}
              className="h-10 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">{t("accounting.accountsForm.typeLabel")}</Label>
            <AppDropdown
              value={formData.accountType}
              onChange={(v) => setFormData({ ...formData, accountType: v as BankAccountType })}
              options={BANK_ACCOUNT_TYPES.map((type) => ({
                value: type,
                label: t(ACCOUNT_TYPE_LABEL_KEY[type]),
              }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">
              {t("accounting.accountsForm.openingBalanceLabel", { code: currencyCode })}
            </Label>
            <Input
              type="number"
              min="0"
              value={formData.openingBalance}
              onChange={(e) => setFormData({ ...formData, openingBalance: e.target.value })}
              className="h-10 text-sm font-semibold"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">{t("accounting.accountsForm.glCodeLabel")}</Label>
            <Input
              placeholder={t("accounting.accountsForm.glCodePlaceholder")}
              value={formData.accountCode}
              onChange={(e) => setFormData({ ...formData, accountCode: e.target.value.replace(/[^0-9]/g, "").slice(0, 6) })}
              className="h-10 text-sm font-mono"
            />
            <p className="text-[11px] text-muted-foreground">{t("accounting.accountsForm.glCodeHint")}</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
          <Button variant="ghost" type="button" onClick={onClose} disabled={createAccountMutation.isPending}>
            {t("common.cancel")}
          </Button>
          <Button
            type="submit"
            disabled={createAccountMutation.isPending}
            className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
          >
            {createAccountMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            <span>{t("common.save")}</span>
          </Button>
        </div>
      </form>
    </TopSheet>
  );
}
