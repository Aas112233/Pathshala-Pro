"use client";

import { useState } from "react";
import { TopSheet } from "@/components/ui/top-sheet";
import { AppDropdown } from "@/components/ui/app-dropdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Receipt, Save, Loader2 } from "lucide-react";
import { useExpenseCategories, useCreateExpense } from "@/hooks/use-queries";
import { useTenantFormatting } from "@/components/providers/tenant-settings-provider";
import { useTranslations } from "next-intl";

interface AddExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AddExpenseModal({ isOpen, onClose, onSuccess }: AddExpenseModalProps) {
  const t = useTranslations();
  const { currencySymbol } = useTenantFormatting();
  const { data: categoriesResponse, isLoading: isCategoriesLoading } = useExpenseCategories();
  const categories = (categoriesResponse as any)?.data || [];

  const createExpenseMutation = useCreateExpense();

  const [formData, setFormData] = useState({
    title: "",
    categoryId: "",
    amount: "",
    paymentMethod: "CASH" as "CASH" | "BANK" | "CHEQUE" | "DIGITAL",
    expenseDate: new Date().toISOString().split("T")[0],
    payeeName: "",
    receiptNumber: "",
    notes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      toast.error(t("accounting.expensesForm.errTitle"));
      return;
    }

    const selectedCat = formData.categoryId || categories[0]?.id;
    if (!selectedCat) {
      toast.error(t("accounting.expensesForm.errCategory"));
      return;
    }

    const amountNum = parseFloat(formData.amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error(t("accounting.expensesForm.errAmount"));
      return;
    }

    createExpenseMutation.mutate(
      {
        ...formData,
        categoryId: selectedCat,
        amount: amountNum,
      },
      {
        onSuccess: () => {
          toast.success(t("accounting.expensesForm.created"));
          setFormData({
            title: "",
            categoryId: "",
            amount: "",
            paymentMethod: "CASH",
            expenseDate: new Date().toISOString().split("T")[0],
            payeeName: "",
            receiptNumber: "",
            notes: "",
          });
          onClose();
          if (onSuccess) onSuccess();
        },
        onError: (err: any) => {
          toast.error(err.message || t("accounting.expensesForm.createFailed"));
        },
      }
    );
  };

  return (
    <TopSheet
      isOpen={isOpen}
      onClose={onClose}
      title={t("accounting.expensesForm.title")}
      subtitle={t("accounting.expensesForm.subtitle")}
      description={t("accounting.expensesForm.description")}
      maxWidth="3xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Title */}
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs font-semibold">{t("accounting.expensesForm.titleLabel")}</Label>
            <Input
              placeholder={t("accounting.expensesForm.titlePlaceholder")}
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="h-10 text-sm"
              required
            />
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">{t("accounting.expensesForm.categoryLabel")}</Label>
            <AppDropdown
              value={formData.categoryId || categories[0]?.id || ""}
              onChange={(v) => setFormData({ ...formData, categoryId: v })}
              options={categories.map((cat: any) => ({ value: cat.id, label: cat.name }))}
              placeholder={t("accounting.expensesForm.categoryLabel")}
              disabled={isCategoriesLoading}
              searchable
            />
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">
              {t("accounting.expensesForm.amountLabel", { symbol: currencySymbol })}
            </Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder={t("accounting.expensesForm.amountPlaceholder")}
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              className="h-10 text-sm font-semibold"
              required
            />
          </div>

          {/* Payment Method */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Payment Method</Label>
            <AppDropdown
              value={formData.paymentMethod}
              onChange={(v) => setFormData({ ...formData, paymentMethod: v as any })}
              options={[
                { value: "CASH", label: "Petty Cash Register" },
                { value: "BANK", label: "Bank Account Transfer" },
                { value: "CHEQUE", label: "Bank Cheque / Pay Order" },
                { value: "DIGITAL", label: "Digital / Online Wallet" }
              ]}
            />
          </div>

          {/* Expense Date */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Expense Date *</Label>
            <Input
              type="date"
              value={formData.expenseDate}
              onChange={(e) => setFormData({ ...formData, expenseDate: e.target.value })}
              className="h-10 text-sm"
              required
            />
          </div>

          {/* Payee / Vendor */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Payee / Vendor Name</Label>
            <Input
              placeholder="e.g. National Power Grid / ABC Stationers"
              value={formData.payeeName}
              onChange={(e) => setFormData({ ...formData, payeeName: e.target.value })}
              className="h-10 text-xs"
            />
          </div>

          {/* Receipt / Invoice # */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Bill / Receipt Number</Label>
            <Input
              placeholder="e.g. INV-98421"
              value={formData.receiptNumber}
              onChange={(e) => setFormData({ ...formData, receiptNumber: e.target.value })}
              className="h-10 text-xs"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs font-semibold">Internal Audit Notes</Label>
            <Textarea
              placeholder="Additional details, approval remarks, or purchase authorization references..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="text-xs resize-none"
              rows={2}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
          <Button variant="ghost" type="button" onClick={onClose} disabled={createExpenseMutation.isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={createExpenseMutation.isPending}
            className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
          >
            {createExpenseMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            <span>Save Expense Voucher</span>
          </Button>
        </div>
      </form>
    </TopSheet>
  );
}
