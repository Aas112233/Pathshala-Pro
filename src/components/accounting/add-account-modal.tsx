"use client";

import { useState } from "react";
import { TopSheet } from "@/components/ui/top-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Building2, Save, Loader2 } from "lucide-react";
import { useCreateBankAccount } from "@/hooks/use-queries";
import { useTenantFormatting } from "@/components/providers/tenant-settings-provider";
import { useTranslations } from "next-intl";

interface AddAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AddAccountModal({ isOpen, onClose, onSuccess }: AddAccountModalProps) {
  const t = useTranslations();
  const { currencyCode } = useTenantFormatting();
  const createAccountMutation = useCreateBankAccount();

  const [formData, setFormData] = useState({
    accountName: "",
    accountNumber: "",
    bankName: "",
    branchName: "",
    accountType: "CHECKING" as "CHECKING" | "SAVINGS" | "PETTY_CASH",
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
            <select
              value={formData.accountType}
              onChange={(e) => setFormData({ ...formData, accountType: e.target.value as any })}
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-xs"
            >
              <option value="CHECKING">{t("accounting.accountsForm.typeChecking")}</option>
              <option value="SAVINGS">{t("accounting.accountsForm.typeSavings")}</option>
              <option value="PETTY_CASH">{t("accounting.accountsForm.typePettyCash")}</option>
            </select>
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
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
          <Button variant="ghost" type="button" onClick={onClose} disabled={createAccountMutation.isPending}>
            {t("common.cancel")}
          </Button>
          <Button
            type="submit"
            disabled={createAccountMutation.isPending}
            className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shadow-sm"
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
