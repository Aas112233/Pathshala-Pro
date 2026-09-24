"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppDropdown } from "@/components/ui/app-dropdown";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Wallet,
  Building2,
  CreditCard,
  Smartphone,
  Receipt,
  Plus,
  Trash2,
  Edit2,
  RotateCcw,
  Save,
  Loader2,
} from "lucide-react";
import {
  CustomPaymentMethod,
  DEFAULT_PAYMENT_METHODS,
  TenantSettings,
} from "@/lib/tenant-settings";
import { ERPFormSection } from "@/components/ui/erp-form-layout";
import { useTenantSettings } from "@/components/providers/tenant-settings-provider";
import { GL_CODES } from "@/lib/constants";
import { useChartAccounts } from "@/hooks/use-queries";
import { toast } from "sonner";

interface PaymentMethodsSettingsSectionProps {
  settings: TenantSettings;
  onChange: <K extends keyof TenantSettings>(key: K, value: TenantSettings[K]) => void;
}

export function PaymentMethodsSettingsSection({
  settings,
  onChange,
}: PaymentMethodsSettingsSectionProps) {
  const t = useTranslations("settings");
  const { refreshSettings, setSettings: setGlobalSettings } = useTenantSettings();
  const { data: chartResponse } = useChartAccounts({ accountType: "ASSET" });
  const assetAccounts = ((chartResponse as any)?.data as any)?.accounts || [];
  const glOptions =
    assetAccounts.length > 0
      ? assetAccounts.map((a: any) => ({ value: String(a.code), label: `${a.name} (${a.code})` }))
      : [
          { value: GL_CODES.BANK, label: t("paymentMethods.modal.glAccount1010") },
          { value: GL_CODES.CASH, label: t("paymentMethods.modal.glAccount1020") },
          { value: GL_CODES.RECEIVABLE, label: t("paymentMethods.modal.glAccount1030") },
        ];
  const methods = settings.paymentMethods && settings.paymentMethods.length > 0
    ? settings.paymentMethods
    : DEFAULT_PAYMENT_METHODS;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMethod, setEditingMethod] = useState<CustomPaymentMethod | null>(null);
  const [isSavingDirectly, setIsSavingDirectly] = useState(false);

  // Form State
  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formType, setFormType] = useState<CustomPaymentMethod["type"]>("DIGITAL");
  const [formAccountCode, setFormAccountCode] = useState<string>(GL_CODES.BANK);
  const [formInstructions, setFormInstructions] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);

  const persistMethods = async (updated: CustomPaymentMethod[]) => {
    // Serialize: each persist sends the FULL array, so two in-flight PUTs
    // last-write-win at the JSON column and one action can silently undo
    // another.
    if (isSavingDirectly) return;
    // Snapshot for rollback: the optimistic onChange lands before the fetch,
    // so a failed write must revert local state or the UI shows phantom
    // methods that a later whole-settings Save would persist to the DB.
    const previous = settings.paymentMethods;
    onChange("paymentMethods", updated);
    setIsSavingDirectly(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethods: updated }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || "Failed to save payment methods");
      }
      const json = await res.json();
      if (json.data) {
        setGlobalSettings(json.data);
      }
      await refreshSettings();
      toast.success(t("ui.saved"));
    } catch (err: any) {
      console.error("Failed to persist payment methods:", err);
      toast.error(err.message || t("ui.saveFailed"));
    } finally {
      setIsSavingDirectly(false);
    }
  };

  const openAddModal = () => {
    setEditingMethod(null);
    setFormName("");
    setFormCode("");
    setFormType("DIGITAL");
    setFormAccountCode(GL_CODES.BANK);
    setFormInstructions("");
    setFormIsActive(true);
    setIsModalOpen(true);
  };

  const openEditModal = (method: CustomPaymentMethod) => {
    setEditingMethod(method);
    setFormName(method.name);
    setFormCode(method.code);
    setFormType(method.type);
    setFormAccountCode(method.accountCode || (method.type === "CASH" ? GL_CODES.CASH : GL_CODES.BANK));
    setFormInstructions(method.instructions || "");
    setFormIsActive(method.isActive);
    setIsModalOpen(true);
  };

  const handleSaveMethod = async () => {
    if (!formName.trim()) return;
    const cleanCode = (formCode.trim() || formName.trim().toUpperCase().replace(/[^A-Z0-9]/g, "_")).slice(0, 30);

    let updated: CustomPaymentMethod[];
    if (editingMethod) {
      updated = methods.map((m) =>
        m.id === editingMethod.id
          ? {
              ...m,
              name: formName.trim(),
              code: cleanCode,
              type: formType,
              accountCode: formAccountCode,
              instructions: formInstructions.trim() || undefined,
              isActive: formIsActive,
            }
          : m
      );
    } else {
      const newMethod: CustomPaymentMethod = {
        id: `pm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: formName.trim(),
        code: cleanCode,
        type: formType,
        accountCode: formAccountCode,
        instructions: formInstructions.trim() || undefined,
        isActive: formIsActive,
      };
      updated = [...methods, newMethod];
    }

    setIsModalOpen(false);
    await persistMethods(updated);
  };

  const handleToggleActive = async (id: string, active: boolean) => {
    const updated = methods.map((m) => (m.id === id ? { ...m, isActive: active } : m));
    await persistMethods(updated);
  };

  const handleSetDefault = async (id: string) => {
    const updated = methods.map((m) => ({
      ...m,
      isDefault: m.id === id,
      isActive: m.id === id ? true : m.isActive,
    }));
    await persistMethods(updated);
  };

  const handleDeleteMethod = async (id: string) => {
    const removed = methods.find((m) => m.id === id);
    let updated = methods.filter((m) => m.id !== id);
    // Deleting the default must not leave the tenant with zero defaults —
    // promote the first remaining active method.
    if (removed?.isDefault && updated.length > 0 && !updated.some((m) => m.isDefault)) {
      const fallback = updated.find((m) => m.isActive) ?? updated[0];
      updated = updated.map((m) => ({ ...m, isDefault: m.id === fallback.id }));
    }
    await persistMethods(updated.length > 0 ? updated : DEFAULT_PAYMENT_METHODS);
  };

  const handleResetDefaults = async () => {
    await persistMethods(DEFAULT_PAYMENT_METHODS);
  };

  const getTypeIcon = (type: CustomPaymentMethod["type"]) => {
    switch (type) {
      case "CASH":
        return Wallet;
      case "BANK":
        return Building2;
      case "DIGITAL":
        return Smartphone;
      case "CHEQUE":
        return Receipt;
      default:
        return CreditCard;
    }
  };

  const activeCount = methods.filter((m) => m.isActive).length;

  return (
    <div className="space-y-6">
      <ERPFormSection
        title={t("paymentMethods.title")}
        description={t("paymentMethods.description")}
      >
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-2">
          <div className="text-xs text-muted-foreground">
            {t("paymentMethods.activeCount", { active: activeCount, total: methods.length })}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResetDefaults}
              disabled={isSavingDirectly}
              className="text-xs h-8 gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {t("paymentMethods.resetDefaults")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={openAddModal}
              disabled={isSavingDirectly}
              className="text-xs h-8 gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              {t("paymentMethods.addMethod")}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => persistMethods(methods)}
              disabled={isSavingDirectly}
              className="text-xs h-8 gap-1.5 bg-primary text-primary-foreground shadow-2xs"
            >
              {isSavingDirectly ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              {isSavingDirectly ? t("ui.saving") : t("paymentMethods.saveBtn")}
            </Button>
          </div>
        </div>

        {/* Methods List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {methods.map((method) => {
            const Icon = getTypeIcon(method.type);
            const isCash = method.type === "CASH" || method.code === "CASH";

            return (
              <div
                key={method.id}
                className={`p-4 rounded-xl border transition-all flex flex-col justify-between gap-3 ${
                  method.isActive
                    ? "bg-card border-border shadow-xs"
                    : "bg-muted/40 border-border/50 opacity-60"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2.5 rounded-lg border ${
                        method.isActive
                          ? "bg-primary/10 text-primary border-primary/20"
                          : "bg-muted text-muted-foreground border-border"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-foreground">{method.name}</h4>
                        {method.isDefault && (
                          <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300">
                            {t("paymentMethods.defaultBadge")}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          {method.code}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {t("paymentMethods.glPrefix")}: {method.accountCode || (isCash ? `${GL_CODES.CASH} (${t("paymentMethods.cashInHand")})` : `${GL_CODES.BANK} (${t("paymentMethods.bankDigital")})`)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch
                      checked={method.isActive}
                      onCheckedChange={(checked) => handleToggleActive(method.id, checked)}
                      disabled={isSavingDirectly}
                      aria-label={`Toggle ${method.name}`}
                    />
                  </div>
                </div>

                {method.instructions && (
                  <p className="text-xs text-muted-foreground italic bg-muted/30 p-2 rounded border border-border/40">
                    "{method.instructions}"
                  </p>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-border/40 text-xs">
                  <div>
                    {!method.isDefault && method.isActive && (
                      <button
                        type="button"
                        onClick={() => handleSetDefault(method.id)}
                        disabled={isSavingDirectly}
                        className="text-[11px] text-primary hover:underline font-medium disabled:opacity-50"
                      >
                        {t("paymentMethods.setAsDefault")}
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditModal(method)}
                      disabled={isSavingDirectly}
                      className="h-7 px-2 text-xs"
                    >
                      <Edit2 className="h-3.5 w-3.5 mr-1" />
                      {t("paymentMethods.edit")}
                    </Button>
                    {!["cash", "bank_transfer"].includes(method.id) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteMethod(method.id)}
                        disabled={isSavingDirectly}
                        className="h-7 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </ERPFormSection>

      {/* Add / Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              {editingMethod ? t("paymentMethods.modal.titleEdit") : t("paymentMethods.modal.titleAdd")}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{t("paymentMethods.modal.nameLabel")}</Label>
              <Input
                placeholder={t("paymentMethods.modal.namePlaceholder")}
                value={formName}
                onChange={(e) => {
                  setFormName(e.target.value);
                  if (!editingMethod && !formCode) {
                    setFormCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "_"));
                  }
                }}
                className="h-9"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{t("paymentMethods.modal.codeLabel")}</Label>
                <Input
                  placeholder={t("paymentMethods.modal.codePlaceholder")}
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""))}
                  className="h-9 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{t("paymentMethods.modal.typeLabel")}</Label>
                <AppDropdown
                  value={formType}
                  onChange={(v) => {
                    const newType = v as CustomPaymentMethod["type"];
                    setFormType(newType);
                    if (newType === "CASH") setFormAccountCode(GL_CODES.CASH);
                    else setFormAccountCode(GL_CODES.BANK);
                  }}
                  options={[
                    { value: "DIGITAL", label: t("paymentMethods.modal.typeDigital") },
                    { value: "BANK", label: t("paymentMethods.modal.typeBank") },
                    { value: "CASH", label: t("paymentMethods.modal.typeCash") },
                    { value: "CHEQUE", label: t("paymentMethods.modal.typeCheque") },
                    { value: "OTHER", label: t("paymentMethods.modal.typePos") }
                  ]}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{t("paymentMethods.modal.glAccountLabel")}</Label>
              <AppDropdown
                value={formAccountCode}
                onChange={(v) => setFormAccountCode(v)}
                options={glOptions}
                searchable
              />
              <p className="text-[11px] text-muted-foreground">
                {t("paymentMethods.modal.glHint")}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{t("paymentMethods.modal.instructionsLabel")}</Label>
              <Input
                placeholder={t("paymentMethods.modal.instructionsPlaceholder")}
                value={formInstructions}
                onChange={(e) => setFormInstructions(e.target.value)}
                className="h-9"
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border">
              <div>
                <p className="text-xs font-semibold text-foreground">{t("paymentMethods.modal.activeInPos")}</p>
                <p className="text-[11px] text-muted-foreground">{t("paymentMethods.modal.activeInPosDesc")}</p>
              </div>
              <Switch checked={formIsActive} onCheckedChange={setFormIsActive} />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsModalOpen(false)}
            >
              {t("paymentMethods.modal.cancel")}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSaveMethod}
              disabled={!formName.trim() || isSavingDirectly}
              className="bg-primary text-primary-foreground gap-1.5"
            >
              {isSavingDirectly && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {editingMethod ? t("paymentMethods.modal.saveChanges") : t("paymentMethods.modal.addBtn")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
