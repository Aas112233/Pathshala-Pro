"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Landmark, Loader2, Pencil, Save } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { TopSheet } from "@/components/ui/top-sheet";
import { Button } from "@/components/ui/button";
import { AppDropdown } from "@/components/ui/app-dropdown";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useFeeHeadMappings, useSaveFeeHeadMappings } from "@/hooks/use-queries";
import { useAuth } from "@/components/providers/auth-provider";
import { hasPermission, getEffectivePermissions } from "@/lib/permissions";

type FeeHead = { id: string; code: string; name: string; accountCode: string };
type RevenueAccount = { id: string; code: string; name: string };

export default function FeeHeadsAccountingPage() {
  const t = useTranslations("accounting.feeHeads");
  const tCommon = useTranslations("common");
  const { user: authUser } = useAuth();
  const perms = getEffectivePermissions(authUser?.role as string, (authUser as any)?.permissions, (authUser as any)?.accessLevel);
  const canRead = hasPermission(perms, "accounting", "read");
  const canManage = hasPermission(perms, "accounting", "manage");
  const { data: response, isLoading } = useFeeHeadMappings();
  const saveMutation = useSaveFeeHeadMappings();
  const [editing, setEditing] = useState<FeeHead | null>(null);
  const [accountCode, setAccountCode] = useState("");

  const payload = (response as any)?.data;
  const feeHeads = (payload?.feeHeads || []) as FeeHead[];
  const revenueAccounts = (payload?.revenueAccounts || []) as RevenueAccount[];
  const accountByCode = useMemo(
    () => new Map(revenueAccounts.map((account) => [account.code, account])),
    [revenueAccounts]
  );

  const openEditor = (head: FeeHead) => {
    setEditing(head);
    setAccountCode(head.accountCode);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing || !accountCode) return;

    try {
      await saveMutation.mutateAsync({ mappings: [{ code: editing.code, accountCode }] });
      toast.success(t("saved"));
      setEditing(null);
    } catch (error: any) {
      toast.error(error.message || t("saveFailed"));
    }
  };

  if (!canRead) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("title")} description={t("description")} icon={Landmark} />
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">{tCommon("accessRestricted")}</h2>
          <p className="text-sm text-muted-foreground mt-2">{tCommon("noPermission")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <PageHeader title={t("title")} description={t("description")} icon={Landmark} />

      <Card className="border border-border/80 shadow-none">
        <CardHeader className="border-b border-border/60">
          <CardTitle className="text-base">{t("tableTitle")}</CardTitle>
          <p className="text-xs text-muted-foreground">{t("tableDescription")}</p>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-14 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> {t("loading")}
            </div>
          ) : feeHeads.length === 0 ? (
            <div className="py-14 text-center text-sm text-muted-foreground">{t("empty")}</div>
          ) : (
            <div className="divide-y divide-border/60">
              {feeHeads.map((head) => {
                const account = accountByCode.get(head.accountCode);
                return (
                  <div key={head.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-[11px] font-semibold">{head.code}</span>
                        <span className="text-sm font-semibold text-foreground">{head.name}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("mappedTo")} <span className="font-mono">{head.accountCode}</span>
                        {account ? ` — ${account.name}` : ""}
                      </p>
                    </div>
                    {canManage && (
                      <Button variant="outline" size="sm" onClick={() => openEditor(head)} className="gap-1.5 self-start sm:self-auto">
                        <Pencil className="h-3.5 w-3.5" /> {t("editMapping")}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <TopSheet
        isOpen={!!editing}
        onClose={() => setEditing(null)}
        title={t("editTitle")}
        subtitle={editing?.code}
        description={t("editDescription")}
        maxWidth="2xl"
      >
        <form onSubmit={save} className="space-y-5">
          <div className="space-y-1.5">
            <Label>{t("feeHeadLabel")}</Label>
            <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
              {editing?.name}
              <span className="ml-2 font-mono text-xs text-muted-foreground">({editing?.code})</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="revenue-account">{t("revenueAccountLabel")}</Label>
            <AppDropdown
              id="revenue-account"
              value={accountCode}
              onChange={setAccountCode}
              options={revenueAccounts.map((account) => ({ value: account.code, label: `${account.code} — ${account.name}` }))}
              placeholder={t("selectRevenueAccount")}
              searchable
            />
          </div>
          <div className="flex justify-end gap-3 border-t border-border pt-3">
            <Button type="button" variant="ghost" onClick={() => setEditing(null)} disabled={saveMutation.isPending}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={saveMutation.isPending || !accountCode} className="gap-2">
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {t("save")}
            </Button>
          </div>
        </form>
      </TopSheet>
    </div>
  );
}
