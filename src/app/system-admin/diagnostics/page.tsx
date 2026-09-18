"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "next-intl";
import { Loader2, Search, ShieldCheck, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppDropdown } from "@/components/ui/app-dropdown";
import { ERPDataTable, ERPStatusPill, type ColumnDef } from "@/components/ui/erp-data-table";
import type { DiagnosticRow, DiagnosticsResult } from "@/lib/admin-diagnostics";

export default function AdminDiagnosticsPage() {
  const t = useTranslations("adminTools");
  const format = useFormatter();
  const [draftTenant, setDraftTenant] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [check, setCheck] = useState("placement");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");
  const query = useQuery<DiagnosticsResult, Error>({
    queryKey: ["diagnostics", { tenantId, check, page, pageSize, search }],
    enabled: !!tenantId,
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 0,
    gcTime: 0,
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({ tenantId, check, page: String(page), pageSize: String(pageSize), search });
      const response = await fetch(`/api/system-admin/diagnostics?${params}`, { signal, cache: "no-store" });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.message || t("requestFailed", { status: response.status }));
      return body.data;
    },
  });
  useEffect(() => { if (query.error) toast.error(query.error.message); }, [query.error]);
  const reset = () => { setTenantId(""); setDraftTenant(""); setSearch(""); setPage(1); };
  const columns: ColumnDef<DiagnosticRow>[] = [
    { key: "reference", header: t("reference"), cell: (row) => <span className="font-mono text-xs">{row.reference}</span> },
    { key: "status", header: t("status"), cell: (row) => <ERPStatusPill status={t(row.issues.length ? "review" : "noIssue")} variant={row.issues.length ? "amber" : "subtle"} /> },
    { key: "issues", header: t("findings"), cell: (row) => row.issues.length
      ? <ul className="space-y-1 text-sm">{row.issues.map((issue) => <li key={issue}>{t(issue)}</li>)}</ul>
      : <span className="text-sm text-muted-foreground">{t("checkPassed")}</span> },
  ];
  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} icon={ShieldCheck} />
      <div className="rounded-lg border border-border/80 bg-muted/30 p-4 text-sm" role="note">
        <p className="font-semibold">{t("readOnly")}</p>
        <p className="mt-1 text-muted-foreground">{t("limitations")}</p>
      </div>
      <form className="flex flex-wrap items-end gap-3 rounded-lg border border-border/80 bg-card p-4" onSubmit={(event) => {
        event.preventDefault();
        if (!draftTenant.trim()) return;
        if (tenantId === draftTenant.trim()) { void query.refetch(); return; }
        setSearch(""); setPage(1); setTenantId(draftTenant.trim());
      }}>
        <div className="min-w-56 flex-1 space-y-2">
          <label htmlFor="diagnostics-tenant" className="text-sm font-medium">{t("tenant")}</label>
          <Input id="diagnostics-tenant" value={draftTenant} maxLength={100} required placeholder={t("tenantPlaceholder")}
            onChange={(event) => { setDraftTenant(event.target.value); setTenantId(""); setPage(1); }} />
        </div>
        <div className="min-w-56 flex-1 space-y-2">
          <label htmlFor="diagnostics-check" className="text-sm font-medium">{t("check")}</label>
          <AppDropdown id="diagnostics-check" value={check} onChange={(value) => { setCheck(value); setPage(1); setSearch(""); }}
            options={[{ value: "placement", label: t("placement") }, { value: "fees", label: t("fees") }]}
            placeholder={t("check")} searchPlaceholder={t("search")} noOptionsText={t("empty")} />
        </div>
        <Button type="submit" disabled={!draftTenant.trim() || query.isFetching}>
          {query.isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
          {t(query.isFetching ? "running" : "run")}
        </Button>
        <Button type="button" variant="outline" onClick={reset}><RotateCcw className="mr-2 h-4 w-4" />{t("reset")}</Button>
      </form>
      {query.error && <p role="alert" className="text-sm text-destructive">{query.error.message}</p>}
      {tenantId && !query.error && <>
        <p className="text-sm text-muted-foreground">{t("scope", { tenantId })}</p>
        {query.data && <p className="text-xs text-muted-foreground">{t("checkedAt", { time: format.dateTime(new Date(query.data.checkedAt), { dateStyle: "medium", timeStyle: "medium" }) })}</p>}
        <ERPDataTable title={t("results")} data={query.data?.rows ?? []} columns={columns} keyExtractor={(row) => row.id}
          isLoading={query.isFetching} searchValue={search} searchPlaceholder={t("search")}
          onSearchChange={(value) => { setSearch(value); setPage(1); }}
          page={page} pageSize={pageSize} totalCount={query.data?.totalCount ?? 0} pageSizeOptions={[10, 20, 50, 100]}
          onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
          paginationLabels={{ rowsPerPage: t("rowsPerPage"), previous: t("previous"), next: t("next"), range: (start, end, total) => t("range", { start, end, total }) }}
          emptyState={<div className="space-y-3 p-6"><p>{t("empty")}</p><Button variant="outline" onClick={reset}><RotateCcw className="mr-2 h-4 w-4" />{t("reset")}</Button></div>} />
      </>}
    </div>
  );
}
