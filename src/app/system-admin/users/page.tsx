"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Users,
  UserCheck,
  Search,
  Shield,
  Building2,
  Mail,
  Calendar,
  Lock,
} from "lucide-react";
import { ERPDataTable, ERPStatusPill, type ColumnDef } from "@/components/ui/erp-data-table";

export default function SystemAdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<(string | number)[]>([]);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/users?limit=100");
      const json = await res.json();
      if (json.success) {
        setUsers(json.data || []);
      } else {
        toast.error("Failed to load users directory");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filteredUsers = users.filter((u: any) => {
    return (
      !search ||
      u.name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.tenantId?.toLowerCase().includes(search.toLowerCase())
    );
  });

  const columns: ColumnDef<any>[] = [
    {
      key: "name",
      header: "USER & EMAIL",
      cell: (row) => (
        <div>
          <p className="text-xs font-bold text-foreground">{row.name}</p>
          <p className="text-[11px] text-muted-foreground font-mono">{row.email}</p>
        </div>
      ),
    },
    {
      key: "role",
      header: "SYSTEM ROLE",
      cell: (row) => (
        <Badge
          variant="outline"
          className="text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
        >
          {row.role}
        </Badge>
      ),
    },
    {
      key: "tenantId",
      header: "INSTITUTE TENANT",
      cell: (row) => (
        <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded text-foreground">
          {row.tenantId}
        </code>
      ),
    },
    {
      key: "isActive",
      header: "STATUS",
      cell: (row) => (
        <ERPStatusPill
          status={row.isActive ? "ACTIVE" : "DISABLED"}
          variant={row.isActive ? "emerald" : "amber"}
        />
      ),
    },
    {
      key: "lastLoginAt",
      header: "LAST LOGIN",
      cell: (row) => (
        <span className="text-xs text-muted-foreground font-mono">
          {row.lastLoginAt ? new Date(row.lastLoginAt).toLocaleDateString() : "Never"}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Global Users & Administrators"
        description="Cross-Tenant Authentication & Administrator Accounts Directory"
        icon={UserCheck}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="border border-border/80 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase">
                Total Users
              </span>
              <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                <Users className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <h3 className="text-2xl font-extrabold text-foreground">{users.length}</h3>
            <p className="text-[11px] text-muted-foreground">Accounts globally</p>
          </CardContent>
        </Card>

        <Card className="border border-border/80 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase">
                Administrators
              </span>
              <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
                <Shield className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <h3 className="text-2xl font-extrabold text-foreground">
              {users.filter((u) => u.role === "ADMIN" || u.role === "SYSTEM_ADMIN" || u.role === "SUPER_ADMIN").length}
            </h3>
            <p className="text-[11px] text-muted-foreground">Privileged roles</p>
          </CardContent>
        </Card>

        <Card className="border border-border/80 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase">
                Active State
              </span>
              <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                <UserCheck className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <h3 className="text-2xl font-extrabold text-foreground">
              {users.filter((u) => u.isActive).length}
            </h3>
            <p className="text-[11px] text-muted-foreground">Enabled logins</p>
          </CardContent>
        </Card>
      </div>

      <ERPDataTable<any>
        title="Global User Accounts"
        subtitle={`Managing ${filteredUsers.length} total user accounts`}
        data={filteredUsers}
        columns={columns}
        keyExtractor={(row) => row.id}
        searchPlaceholder="Search by user name, email, or school tenant ID..."
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
      />
    </div>
  );
}
