"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { TopSheet } from "@/components/ui/top-sheet";
import { ERPDataTable, ERPUserCell, ERPStatusPill } from "@/components/ui/erp-data-table";
import { useAuth } from "@/components/providers/auth-provider";
import { useTenantFormatting } from "@/components/providers/tenant-settings-provider";
import { getEffectivePermissions, hasPermission } from "@/lib/permissions";
import { toast } from "sonner";
import {
  CreditCard,
  Info,
  Loader2,
  Search,
  Users,
  Wallet,
  X,
} from "lucide-react";

interface CollectorRow {
  id: string;
  name: string;
  email: string;
  role: string;
  accessLevel: number | null;
  isActive: boolean;
  lastLoginAt: string | null;
  posCollect: boolean;
  bulkCollect: boolean;
  todayCollected: number;
  todayReceipts: number;
  lastCollectedAt: string | null;
}

export default function FeeCollectorsPage() {
  const t = useTranslations("collectors");
  const tCommon = useTranslations("common");
  const qc = useQueryClient();
  const { formatCurrency, formatDate } = useTenantFormatting();
  const { user: authUser, isLoading: isAuthLoading } = useAuth();

  const perms = getEffectivePermissions(
    authUser?.role as string,
    (authUser as any)?.permissions,
    (authUser as any)?.accessLevel
  );
  const canReadCollectors = hasPermission(perms, "users", "read");
  const canManageCollectors = hasPermission(perms, "users", "write");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<CollectorRow | null>(null);
  const [posDesk, setPosDesk] = useState(false);
  const [bulkDesk, setBulkDesk] = useState(false);

  // Debounced so typing a clerk's name does not fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["collectors", { page, pageSize, search }],
    queryFn: async () => {
      const p = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (search) p.set("search", search);
      const res = await fetch(`/api/fees/collectors?${p.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error(t("loadError"));
      return res.json();
    },
    enabled: canReadCollectors,
  });

  const collectors: CollectorRow[] = (data as any)?.data ?? [];
  const pagination = (data as any)?.pagination;

  const updateCapability = useMutation({
    mutationFn: async (input: { id: string; posCollect: boolean; bulkCollect: boolean }) => {
      const res = await fetch(`/api/fees/collectors/${input.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ posCollect: input.posCollect, bulkCollect: input.bulkCollect }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.message || t("saveError"));
      }
      return res.json();
    },
    onSuccess: (_result, input) => {
      qc.invalidateQueries({ queryKey: ["collectors"] });
      toast.success(t("saved", { name: editing?.name ?? input.id }));
      setEditing(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const openDeskEditor = (row: CollectorRow) => {
    setEditing(row);
    setPosDesk(row.posCollect);
    setBulkDesk(row.bulkCollect);
  };

  const columns = useMemo(
    () => [
      {
        key: "collector",
        header: t("columns.collector"),
        cell: (row: CollectorRow) => (
          <ERPUserCell name={row.name} subtitle={row.email} initials={row.name?.slice(0, 2)} />
        ),
      },
      {
        key: "role",
        header: t("columns.role"),
        cell: (row: CollectorRow) => <ERPStatusPill status={row.role} variant="subtle" />,
      },
      {
        key: "account",
        header: t("columns.account"),
        cell: (row: CollectorRow) => (
          <ERPStatusPill
            status={row.isActive ? t("active") : t("inactive")}
            variant={row.isActive ? "emerald" : "rose"}
          />
        ),
      },
      {
        key: "posDesk",
        header: t("columns.posDesk"),
        cell: (row: CollectorRow) => (
          <ERPStatusPill
            status={row.posCollect ? t("granted") : t("notGranted")}
            variant={row.posCollect ? "emerald" : "subtle"}
          />
        ),
      },
      {
        key: "bulkDesk",
        header: t("columns.bulkDesk"),
        cell: (row: CollectorRow) => (
          <ERPStatusPill
            status={row.bulkCollect ? t("granted") : t("notGranted")}
            variant={row.bulkCollect ? "emerald" : "subtle"}
          />
        ),
      },
      {
        key: "todayCollected",
        header: t("columns.todayCollected"),
        cell: (row: CollectorRow) => (
          <div className="flex flex-col">
            <span className="font-mono text-xs font-semibold text-foreground">
              {formatCurrency(row.todayCollected)}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {t("receiptsCount", { count: row.todayReceipts })}
            </span>
          </div>
        ),
      },
      {
        key: "lastCollected",
        header: t("columns.lastCollected"),
        cell: (row: CollectorRow) => (
          <span className="text-xs text-muted-foreground">
            {row.lastCollectedAt ? formatDate(row.lastCollectedAt) : t("neverCollected")}
          </span>
        ),
      },
      {
        key: "actions",
        header: t("columns.actions"),
        cell: (row: CollectorRow) => (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs font-semibold"
            disabled={!canManageCollectors}
            onClick={() => openDeskEditor(row)}
          >
            <CreditCard className="h-3.5 w-3.5" />
            {t("manage")}
          </Button>
        ),
        className: "w-[140px]",
      },
    ],
    [t, formatCurrency, formatDate, canManageCollectors]
  );

  if (!isAuthLoading && !canReadCollectors) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("title")} description={t("description")} icon={Wallet} />
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground">{tCommon("accessRestricted")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{tCommon("noPermission")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} icon={Wallet} />

      <Card className="border-border/80">
        <CardContent className="p-4">
          <div className="flex items-start gap-2.5">
            <Info className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">{t("deskNote")}</p>
          </div>
        </CardContent>
      </Card>

      <ERPDataTable
        data={collectors}
        columns={columns}
        keyExtractor={(row: CollectorRow) => row.id}
        isLoading={isLoading || isFetching}
        page={page}
        pageSize={pageSize}
        totalCount={pagination?.totalCount ?? 0}
        pageSizeOptions={[10, 20, 50, 100]}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder={t("searchPlaceholder")}
        paginationLabels={{
          rowsPerPage: t("pagination.rowsPerPage"),
          range: (start, end, total) => t("pagination.range", { start, end, total }),
          previous: t("pagination.previous"),
          next: t("pagination.next"),
        }}
        emptyState={
          search ? (
            <div className="py-12 text-center">
              <Search className="h-6 w-6 mx-auto mb-2 text-muted-foreground/40" />
              <p className="text-sm font-semibold text-foreground">{t("noMatches", { term: search })}</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearchInput("")}
                className="mt-2 gap-1.5 text-xs font-semibold text-primary"
              >
                <X className="h-3.5 w-3.5" />
                {t("clearSearch")}
              </Button>
            </div>
          ) : (
            <div className="py-12 text-center">
              <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
              <p className="text-sm font-semibold text-foreground">{t("noCollectors")}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t("noCollectorsHint")}</p>
            </div>
          )
        }
      />

      <TopSheet
        isOpen={!!editing}
        onClose={() => setEditing(null)}
        title={t("sheetTitle", { name: editing?.name ?? "" })}
        description={t("sheetDescription")}
        maxWidth="md"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(null)}>
              {tCommon("cancel")}
            </Button>
            <Button
              size="sm"
              disabled={updateCapability.isPending || !canManageCollectors}
              onClick={() =>
                editing &&
                updateCapability.mutate({
                  id: editing.id,
                  posCollect: posDesk,
                  bulkCollect: bulkDesk,
                })
              }
              className="gap-1.5"
            >
              {updateCapability.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {t("saving")}
                </>
              ) : (
                t("save")
              )}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4 rounded-lg border border-border/80 p-4">
            <div className="space-y-0.5">
              <Label htmlFor="pos-desk" className="text-sm font-semibold">
                {t("posDesk")}
              </Label>
              <p className="text-xs text-muted-foreground">{t("posDeskHint")}</p>
            </div>
            <Switch
              id="pos-desk"
              checked={posDesk}
              disabled={!canManageCollectors}
              onCheckedChange={setPosDesk}
            />
          </div>

          <div className="flex items-start justify-between gap-4 rounded-lg border border-border/80 p-4">
            <div className="space-y-0.5">
              <Label htmlFor="bulk-desk" className="text-sm font-semibold">
                {t("bulkDesk")}
              </Label>
              <p className="text-xs text-muted-foreground">{t("bulkDeskHint")}</p>
            </div>
            <Switch
              id="bulk-desk"
              checked={bulkDesk}
              disabled={!canManageCollectors}
              onCheckedChange={setBulkDesk}
            />
          </div>

          <div className="flex items-start gap-2.5 rounded-lg border border-amber-300/70 bg-amber-50/60 p-3 dark:border-amber-800/70 dark:bg-amber-950/25">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
            <p className="text-[11px] text-amber-900 dark:text-amber-200">{t("sessionNote")}</p>
          </div>
        </div>
      </TopSheet>
    </div>
  );
}
