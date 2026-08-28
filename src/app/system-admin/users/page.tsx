"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, Users, Search, Filter, ArrowLeftRight, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ERPDataTable } from "@/components/ui/erp-data-table";
import { TopSheet } from "@/components/ui/top-sheet";
import { ERPFormField, ERPFormGrid, ERPFormSection } from "@/components/ui/erp-form-layout";
import { AppDropdown } from "@/components/ui/app-dropdown";
import { toast } from "sonner";

interface GlobalUser {
  id: string;
  email: string;
  name: string;
  role: string;
  accessLevel?: number | null;
  tenantId: string;
  isActive: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
  tenant?: { name: string };
}

export default function SystemAdminUsersPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [tenantFilter, setTenantFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  // Edit sheet
  const [editUser, setEditUser] = useState<GlobalUser | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editRole, setEditRole] = useState("");
  const [editActive, setEditActive] = useState(true);

  const { data, isLoading } = useQuery({
    queryKey: ["system-admin-users", { page, search, tenantFilter, roleFilter }],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: "20", search, tenantId: tenantFilter, role: roleFilter });
      const res = await fetch(`/api/system-admin/users?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch global users");
      return res.json();
    },
  });

  const users: GlobalUser[] = data?.data?.users ?? [];
  const pagination = data?.data?.pagination;

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: any }) => {
      const res = await fetch(`/api/system-admin/users?id=${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Update failed");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system-admin-users"] });
      toast.success("User updated");
      setIsSheetOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleImpersonate = async (user: GlobalUser) => {
    if (!confirm(`Impersonate ${user.email} (${user.tenantId})?`)) return;
    try {
      const res = await fetch("/api/system-admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ tenantId: user.tenantId, userId: user.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Impersonate failed");
      toast.success(`Impersonating ${user.email} — reloading`);
      window.location.href = "/";
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const columns = [
    {
      key: "user",
      header: "User",
      cell: (row: GlobalUser) => (
        <div>
          <p className="font-semibold text-sm">{row.name}</p>
          <p className="text-xs text-muted-foreground font-mono">{row.email}</p>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role / Level",
      cell: (row: GlobalUser) => (
        <div className="flex flex-col gap-1">
          <Badge variant="outline" className="text-[10px] w-fit">{row.role}</Badge>
          {row.accessLevel != null && <span className="text-[10px] text-muted-foreground">L{row.accessLevel}</span>}
        </div>
      ),
    },
    {
      key: "tenant",
      header: "Tenant",
      cell: (row: GlobalUser) => (
        <div>
          <p className="text-xs font-mono">{row.tenantId}</p>
          <p className="text-[10px] text-muted-foreground">{row.tenant?.name ?? ""}</p>
        </div>
      ),
    },
    {
      key: "active",
      header: "Status",
      cell: (row: GlobalUser) => (
        <Badge variant={row.isActive ? "default" : "secondary"} className={row.isActive ? "bg-emerald-500 text-white text-[10px]" : "text-[10px]"}>
          {row.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      key: "login",
      header: "Last Login",
      cell: (row: GlobalUser) => <span className="text-xs text-muted-foreground">{row.lastLoginAt ? new Date(row.lastLoginAt).toLocaleDateString() : "—"}</span>,
    },
    {
      key: "actions",
      header: "Actions",
      cell: (row: GlobalUser) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={() => { setEditUser(row); setEditRole(row.role); setEditActive(row.isActive); setIsSheetOpen(true); }}>
            Edit
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={() => updateMutation.mutate({ id: row.id, payload: { isActive: !row.isActive } })}>
            <Power className="h-3 w-3 mr-1" /> {row.isActive ? "Deactivate" : "Activate"}
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-[11px] text-indigo-600" onClick={() => handleImpersonate(row)}>
            <ArrowLeftRight className="h-3 w-3 mr-1" /> Impersonate
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-indigo-600" /> Global User Directory</h1>
          <p className="text-xs text-muted-foreground">Cross-tenant search, role/level control, impersonate</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
            <Input placeholder="Search email/name" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-8 h-8 text-xs w-56" />
          </div>
          <Input placeholder="TenantId filter" value={tenantFilter} onChange={(e) => { setTenantFilter(e.target.value); setPage(1); }} className="h-8 text-xs w-32" />
          <Input placeholder="Role filter" value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }} className="h-8 text-xs w-28" />
        </div>
      </div>

      <ERPDataTable
        title="Platform Users"
        subtitle={`Total ${pagination?.totalCount ?? users.length} users`}
        data={users}
        columns={columns}
        keyExtractor={(r) => r.id}
        page={pagination?.currentPage ?? page}
        pageSize={pagination?.pageSize ?? 20}
        totalCount={pagination?.totalCount ?? users.length}
        onPageChange={setPage}
        isLoading={isLoading}
        emptyState={<div className="py-12 text-center text-xs text-muted-foreground">No users found</div>}
      />

      <TopSheet
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        title={`Edit ${editUser?.email ?? ""}`}
        description="Update role / access level / active status"
        maxWidth="lg"
        footer={
          <div className="flex justify-end gap-2 w-full">
            <Button variant="outline" onClick={() => setIsSheetOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!editUser) return;
                updateMutation.mutate({ id: editUser.id, payload: { role: editRole, isActive: editActive } });
              }}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        }
      >
        <ERPFormSection title="User Controls">
          <ERPFormGrid cols={2}>
            <ERPFormField label="Role">
              <AppDropdown
                value={editRole}
                onChange={setEditRole}
                options={[
                  { value: "SUPER_ADMIN", label: "SUPER_ADMIN (L1)" },
                  { value: "SYSTEM_ADMIN", label: "SYSTEM_ADMIN" },
                  { value: "ADMIN", label: "ADMIN (L1)" },
                  { value: "MANAGER", label: "MANAGER (L2)" },
                  { value: "ACCOUNTANT", label: "ACCOUNTANT (L3)" },
                  { value: "TEACHER", label: "TEACHER (L5)" },
                  { value: "PARENT", label: "PARENT (L6)" },
                  { value: "STUDENT", label: "STUDENT (L7)" },
                ]}
              />
            </ERPFormField>
            <ERPFormField label="Active">
              <AppDropdown value={editActive ? "true" : "false"} onChange={(v) => setEditActive(v === "true")} options={[{ value: "true", label: "Active" }, { value: "false", label: "Inactive" }]} />
            </ERPFormField>
          </ERPFormGrid>
        </ERPFormSection>
      </TopSheet>
    </div>
  );
}
