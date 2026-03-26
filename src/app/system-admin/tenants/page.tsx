"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { 
  Building2, 
  Search, 
  Settings, 
  ShieldAlert, 
  Calendar,
  Layers,
  MoreVertical,
  Plus
} from "lucide-react";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription
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
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/tenants");
        const json = await res.json();
        if (json.success) setTenants(json.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const filtered = tenants.filter(t => 
    t.name.toLowerCase().includes(search.toLowerCase()) || 
    t.tenantId.toLowerCase().includes(search.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const s = status.toUpperCase();
    if (s === "ACTIVE") return <Badge variant="default" className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none px-2 shadow-none">Active</Badge>;
    if (s === "SUSPENDED") return <Badge variant="destructive" className="bg-rose-100 text-rose-700 hover:bg-rose-100 border-none px-2 shadow-none">Suspended</Badge>;
    if (s === "TRIAL") return <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-none px-2 shadow-none">Trial</Badge>;
    return <Badge variant="outline">{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">{t("systemAdmin.tenants")}</h1>
          <p className="text-slate-500">Overview and control of all software school instances.</p>
        </div>
        <Button className="bg-indigo-600 hover:bg-indigo-700 gap-2">
          <Plus className="h-4 w-4" />
          Onboard New School
        </Button>
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder={t("systemAdmin.searchTenants")}
                className="pl-10 bg-slate-50/50 border-slate-100 shadow-none focus-visible:ring-indigo-500"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-slate-100 overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow className="border-slate-100 italic">
                  <TableHead className="font-semibold text-slate-900">School Name</TableHead>
                  <TableHead className="font-semibold text-slate-900 text-center">Tenant ID</TableHead>
                  <TableHead className="font-semibold text-slate-900">Subscription</TableHead>
                  <TableHead className="font-semibold text-slate-900 text-center">User Count</TableHead>
                  <TableHead className="font-semibold text-slate-900 text-center">Student Count</TableHead>
                  <TableHead className="font-semibold text-slate-900 text-right pr-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                   <TableRow>
                     <TableCell colSpan={6} className="text-center py-10 text-slate-400">Loading platform data...</TableCell>
                   </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-slate-400">No schools found matching your search.</TableCell>
                  </TableRow>
                ) : filtered.map((tenant) => (
                  <TableRow key={tenant.id} className="border-slate-100 hover:bg-slate-50/50 transition-colors">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600">
                          <Building2 className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-slate-900">{tenant.name}</p>
                          <p className="text-[10px] text-slate-400">{new Date(tenant.createdAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                       <code className="text-xs font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{tenant.tenantId}</code>
                    </TableCell>
                    <TableCell>{getStatusBadge(tenant.subscriptionStatus)}</TableCell>
                    <TableCell className="text-center">
                       <Badge variant="outline" className="text-slate-600 border-slate-100 font-normal">{tenant._count?.users || 0}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                       <Badge variant="outline" className="text-slate-600 border-slate-100 font-normal">{tenant._count?.studentProfiles || 0}</Badge>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <TenantActionsDropdown tenant={tenant} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
