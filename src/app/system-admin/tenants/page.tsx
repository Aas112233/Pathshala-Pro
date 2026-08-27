"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { 
  Building2, 
  Search, 
  Plus,
  ArrowUpRight,
  ExternalLink,
} from "lucide-react";
import { 
  Card, 
  CardContent, 
  CardHeader, 
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TenantActionsDropdown } from "@/components/layout/tenant-actions-dropdown";
import { OnboardInstituteModal } from "@/components/system-admin/onboard-institute-modal";
import { EditTenantModal } from "@/components/system-admin/edit-tenant-modal";

interface Tenant {
  id: string;
  tenantId: string;
  name: string;
  subscriptionStatus: string;
  createdAt: string;
  _count?: {
    users: number;
    studentProfiles: number;
  };
}

export default function TenantsPage() {
  const t = useTranslations();
  const router = useRouter();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isOnboardModalOpen, setIsOnboardModalOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<any>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tenants");
      const json = await res.json();
      const list = json?.data ?? (Array.isArray(json) ? json : []);
      if (Array.isArray(list)) {
        setTenants(list);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = tenants.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.tenantId.toLowerCase().includes(search.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const s = status.toUpperCase();
    if (s === "ACTIVE")
      return (
        <Badge
          variant="default"
          className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-none px-2 shadow-none text-[11px]"
        >
          Active
        </Badge>
      );
    if (s === "SUSPENDED")
      return (
        <Badge
          variant="destructive"
          className="bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-none px-2 shadow-none text-[11px]"
        >
          Suspended
        </Badge>
      );
    if (s === "TRIAL")
      return (
        <Badge
          variant="secondary"
          className="bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-none px-2 shadow-none text-[11px]"
        >
          Trial
        </Badge>
      );
    return <Badge variant="outline" className="text-[11px]">{status}</Badge>;
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
            {t("systemAdmin.tenants")}
          </h1>
          <p className="text-xs text-muted-foreground">
            Overview and 360° telemetry of all software school instances.
          </p>
        </div>
        <Button
          onClick={() => setIsOnboardModalOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shadow-sm cursor-pointer text-xs h-9"
        >
          <Plus className="h-4 w-4" />
          Onboard New School
        </Button>
      </div>

      <Card className="border border-border/80 shadow-xs">
        <CardHeader className="p-4 pb-3">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder={t("systemAdmin.searchTenants")}
                className="pl-9 h-9 text-xs"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow className="border-border">
                  <TableHead className="font-semibold text-foreground text-xs">School Name</TableHead>
                  <TableHead className="font-semibold text-foreground text-center text-xs">Tenant ID</TableHead>
                  <TableHead className="font-semibold text-foreground text-xs">Subscription</TableHead>
                  <TableHead className="font-semibold text-foreground text-center text-xs">User Count</TableHead>
                  <TableHead className="font-semibold text-foreground text-center text-xs">Student Count</TableHead>
                  <TableHead className="font-semibold text-foreground text-right pr-6 text-xs">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-muted-foreground text-xs">
                      Loading platform data...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-muted-foreground text-xs">
                      No schools found matching your search.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((tenant) => (
                    <TableRow
                      key={tenant.id}
                      className="border-border hover:bg-muted/20 transition-colors"
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-lg flex items-center justify-center">
                            <Building2 className="h-4 w-4" />
                          </div>
                          <div>
                            <button
                              onClick={() => router.push(`/system-admin/tenants/${tenant.id || tenant.tenantId}`)}
                              className="font-bold text-xs text-foreground hover:text-indigo-600 text-left flex items-center gap-1 transition-colors group cursor-pointer"
                            >
                              <span>{tenant.name}</span>
                              <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground" />
                            </button>
                            <p className="text-[10px] text-muted-foreground">
                              {new Date(tenant.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded text-foreground">
                          {tenant.tenantId}
                        </code>
                      </TableCell>
                      <TableCell>{getStatusBadge(tenant.subscriptionStatus)}</TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant="outline"
                          className="text-xs font-mono"
                        >
                          {tenant._count?.users || 0}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant="outline"
                          className="text-xs font-mono"
                        >
                          {tenant._count?.studentProfiles || 0}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <TenantActionsDropdown
                          tenant={tenant}
                          onEdit={(t) => setEditingTenant(t)}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <OnboardInstituteModal
        isOpen={isOnboardModalOpen}
        onClose={() => setIsOnboardModalOpen(false)}
        onSuccess={fetchData}
      />

      <EditTenantModal
        isOpen={!!editingTenant}
        onClose={() => setEditingTenant(null)}
        tenant={editingTenant}
        onSuccess={fetchData}
      />
    </div>
  );
}
