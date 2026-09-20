"use client";

import { useEffect, useState } from "react";
import { TopSheet } from "@/components/ui/top-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Loader2,
  ShieldAlert,
  Trash2,
} from "lucide-react";

interface ForceDeleteTenantModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenant: { id?: string; tenantId: string; name: string } | null;
  onSuccess?: () => void;
}

interface ImpactCounts {
  users: number;
  studentProfiles: number;
  feeVouchers: number;
  transactions: number;
}

function isProtectedTenant(tenantId?: string): boolean {
  if (!tenantId) return true;
  return ["SYSTEM", "SYSTEM-PLATFORM", "PLATFORM"].includes(tenantId.trim().toUpperCase());
}

export function ForceDeleteTenantModal({
  isOpen,
  onClose,
  tenant,
  onSuccess,
}: ForceDeleteTenantModalProps) {
  const t = useTranslations("systemAdmin");
  const [step, setStep] = useState(1);
  const [acknowledged, setAcknowledged] = useState(false);
  const [tenantIdInput, setTenantIdInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [reason, setReason] = useState("");
  const [impact, setImpact] = useState<ImpactCounts | null>(null);
  const [isLoadingImpact, setIsLoadingImpact] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (isOpen && tenant) {
      setStep(1);
      setAcknowledged(false);
      setTenantIdInput("");
      setNameInput("");
      setReason("");
      setImpact(null);
      setIsLoadingImpact(true);
      fetch(`/api/tenants/${tenant.id || tenant.tenantId}`, { credentials: "include" })
        .then((r) => r.json())
        .then((json) => {
          if (json?.success) {
            const counts = json.data?._count || {};
            setImpact({
              users: json.data?.users?.length ?? counts.users ?? 0,
              studentProfiles: counts.studentProfiles ?? 0,
              feeVouchers: counts.feeVouchers ?? 0,
              transactions: counts.transactions ?? 0,
            });
          }
        })
        .catch(() => {
          toast.error(t("forceDelete.loadFailed"));
        })
        .finally(() => setIsLoadingImpact(false));
    }
  }, [isOpen, tenant, t]);

  if (!tenant) return null;
  const blocked = isProtectedTenant(tenant.tenantId);
  const tenantIdMatch = tenantIdInput.trim() === tenant.tenantId;
  const nameMatch = nameInput.trim() === tenant.name;
  const reasonValid = reason.trim().length >= 8;

  const handleDelete = async () => {
    if (!nameMatch || !reasonValid || blocked) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/tenants/${tenant.id || tenant.tenantId}?mode=hard`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          confirmTenantId: tenantIdInput.trim(),
          confirmName: nameInput.trim(),
          acknowledged: true,
          reason: reason.trim(),
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        toast.error(json?.error?.message || json?.message || t("forceDelete.deleteFailed"));
        return;
      }
      toast.success(t("forceDelete.success", { name: tenant.name }));
      onClose();
      if (onSuccess) onSuccess();
    } catch {
      toast.error(t("forceDelete.networkError"));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <TopSheet
      isOpen={isOpen}
      onClose={onClose}
      title={t("forceDelete.title")}
      subtitle={t("forceDelete.subtitle", { name: tenant.name })}
      description={t("forceDelete.description")}
      maxWidth="lg"
      closeOnOutsideClick={!isDeleting}
    >
      {blocked ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/40">
          <ShieldAlert className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">{t("forceDelete.blockedTitle")}</p>
            <p className="text-xs text-muted-foreground">{t("forceDelete.blockedDescription")}</p>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Step indicator */}
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex flex-1 items-center gap-2">
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
                    step === s
                      ? "bg-destructive text-destructive-foreground"
                      : step > s
                        ? "bg-emerald-500 text-white"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {s}
                </div>
                <div className={`h-0.5 flex-1 rounded ${step > s ? "bg-emerald-500" : "bg-muted"}`} />
              </div>
            ))}
            <span className="text-[11px] font-medium text-muted-foreground">
              {t("forceDelete.stepLabel", { current: step })}
            </span>
          </div>

          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
                <div className="space-y-1">
                  <p className="text-sm font-bold text-foreground">
                    {t("forceDelete.step1WarningTitle")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("forceDelete.step1WarningBody", { name: tenant.name })}
                  </p>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("forceDelete.step1ImpactTitle")}
                </p>
                {isLoadingImpact ? (
                  <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("forceDelete.loadingImpact")}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {[
                      { label: t("forceDelete.impactUsers"), value: impact?.users ?? 0 },
                      { label: t("forceDelete.impactStudents"), value: impact?.studentProfiles ?? 0 },
                      { label: t("forceDelete.impactVouchers"), value: impact?.feeVouchers ?? 0 },
                      { label: t("forceDelete.impactTransactions"), value: impact?.transactions ?? 0 },
                    ].map((m) => (
                      <div
                        key={m.label}
                        className="rounded-lg border border-border/80 bg-muted/30 p-3 text-center"
                      >
                        <p className="text-lg font-extrabold tabular-nums">{m.value}</p>
                        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          {m.label}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border/80 p-3 text-xs">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-red-600"
                />
                <span className="font-medium text-foreground">{t("forceDelete.step1Acknowledge")}</span>
              </label>

              <div className="flex items-center justify-end gap-3 border-t border-border pt-3">
                <Button variant="ghost" onClick={onClose} disabled={isDeleting}>
                  {t("forceDelete.cancel")}
                </Button>
                <Button onClick={() => setStep(2)} disabled={!acknowledged} variant="destructive">
                  {t("forceDelete.continue")}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                {t("forceDelete.step2Description", { tenantId: tenant.tenantId })}
              </p>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{t("forceDelete.step2Label")}</Label>
                <Input
                  value={tenantIdInput}
                  onChange={(e) => setTenantIdInput(e.target.value)}
                  placeholder={t("forceDelete.step2Placeholder", { tenantId: tenant.tenantId })}
                  className="h-10 font-mono text-sm"
                  autoComplete="off"
                />
              </div>
              <div className="flex items-center justify-between border-t border-border pt-3">
                <Button variant="ghost" onClick={() => setStep(1)} disabled={isDeleting}>
                  <ArrowLeft className="h-3.5 w-3.5" />
                  {t("forceDelete.back")}
                </Button>
                <Button onClick={() => setStep(3)} disabled={!tenantIdMatch} variant="destructive">
                  {t("forceDelete.continue")}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="destructive" className="text-[11px]">
                  {t("forceDelete.finalStepBadge")}
                </Badge>
                <p className="text-xs text-muted-foreground">{t("forceDelete.step3Description")}</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  {t("forceDelete.step3NameLabel", { name: tenant.name })}
                </Label>
                <Input
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder={t("forceDelete.step3NamePlaceholder", { name: tenant.name })}
                  className="h-10 text-sm"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{t("forceDelete.step3ReasonLabel")}</Label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={t("forceDelete.step3ReasonPlaceholder")}
                  rows={3}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div className="flex items-center justify-between border-t border-border pt-3">
                <Button variant="ghost" onClick={() => setStep(2)} disabled={isDeleting}>
                  <ArrowLeft className="h-3.5 w-3.5" />
                  {t("forceDelete.back")}
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={!nameMatch || !reasonValid || isDeleting}
                  className="gap-2"
                >
                  {isDeleting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  {isDeleting ? t("forceDelete.deleting") : t("forceDelete.confirmButton")}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </TopSheet>
  );
}
