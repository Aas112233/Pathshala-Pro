"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { UserCheck, Plus, Pencil, Trash2, ShieldCheck } from "lucide-react";
import { useUsers, useDeleteUser } from "@/hooks/use-queries";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { UserFormModal } from "@/components/users/user-form-modal";
import { PermissionModal } from "@/components/users/permission-modal";
import { useTenantFormatting } from "@/components/providers/tenant-settings-provider";
import { useAuth } from "@/components/providers/auth-provider";
import { hasPermission } from "@/lib/permissions";
import type { UserRecord } from "@/types/users";

export default function UsersPage() {
  const t = useTranslations('users');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const { formatDate } = useTenantFormatting();
  const { user, isLoading: isAuthLoading } = useAuth();
  const isSystemAdmin = user?.role === "SYSTEM_ADMIN";
  const canReadUsers =
    isSystemAdmin || (!!user && hasPermission(user.permissions, "users", "read"));
  const canWriteUsers =
    isSystemAdmin || (!!user && hasPermission(user.permissions, "users", "write"));
  const canManageUsers =
    isSystemAdmin || (!!user && hasPermission(user.permissions, "users", "manage"));

  const { data, isLoading } = useUsers({
    page,
    limit: 20,
    search: search || undefined,
  }, {
    enabled: !isAuthLoading && canReadUsers,
  });

  const deleteMutation = useDeleteUser();

  const handleDelete = (id: string) => {
    if (!confirm(t('confirmDelete'))) return;
    
    deleteMutation.mutate(id, {
      onSuccess: () => {
        toast.success(t('deleteSuccess'));
      },
      onError: (err) => {
        toast.error(err.message || t('deleteError'));
      },
    });
  };

  const columns: ColumnDef<UserRecord>[] = [
    {
      accessorKey: "email",
      header: t('tableColumns.email'),
      cell: ({ getValue }) => (
        <span className="font-medium">{getValue<string>()}</span>
      ),
    },
    {
      accessorKey: "name",
      header: t('tableColumns.name'),
    },
    {
      accessorKey: "role",
      header: t('tableColumns.role'),
      cell: ({ getValue }) => (
        <span className="capitalize">{getValue<string>().toLowerCase()}</span>
      ),
    },
    {
      accessorKey: "isActive",
      header: t('tableColumns.status'),
      cell: ({ getValue }) => (
        <StatusBadge
          status={getValue<boolean>()}
          domain="active"
          label={getValue<boolean>() ? t('status.active') : t('status.inactive')}
        />
      ),
    },
    {
      accessorKey: "lastLoginAt",
      header: t('tableColumns.lastLogin'),
      cell: ({ getValue }) =>
        getValue<string>() ? formatDate(getValue<string>()) : "Never",
    },
    {
      id: "actions",
      header: t('tableColumns.actions'),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {canManageUsers && (
            <Button 
              variant="ghost" 
              size="icon"
              title={t('managePermissions')}
              aria-label={t('managePermissions')}
              onClick={() => {
                setEditingUser(row.original);
                setIsPermissionModalOpen(true);
              }}
            >
              <ShieldCheck className="h-4 w-4 text-primary" />
            </Button>
          )}
          {canWriteUsers && (
            <Button 
              variant="ghost" 
              size="icon"
              title={t('editUserTitle')}
              aria-label={t('editUserTitle')}
              onClick={() => {
                setEditingUser(row.original);
                setIsFormOpen(true);
              }}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          {canManageUsers && (
            <Button
              variant="ghost"
              size="icon"
              title={row.original.id === user?.id ? "You cannot delete your own account" : t('deleteUserTitle')}
              aria-label={row.original.id === user?.id ? "You cannot delete your own account" : t('deleteUserTitle')}
              onClick={() => handleDelete(row.original.id)}
              disabled={row.original.id === user?.id}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  const pagination = "pagination" in (data || {})
    ? data.pagination
    : undefined;
  const users = "data" in (data || {})
    ? data.data
    : [];

  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingUser(null);
  };

  const handlePermissionClose = () => {
    setIsPermissionModalOpen(false);
    setEditingUser(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        description={t('description')}
        icon={UserCheck}
      >
        {canWriteUsers && (
          <Button onClick={() => {
            setEditingUser(null);
            setIsFormOpen(true);
          }}>
            <Plus className="mr-2 h-4 w-4" />
            {t('addUser')}
          </Button>
        )}
      </PageHeader>

      {!isAuthLoading && !canReadUsers ? (
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground">Access restricted</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            You do not have permission to view user accounts.
          </p>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={users}
          pagination={pagination}
          onPageChange={setPage}
          onSearch={setSearch}
          isLoading={isLoading || isAuthLoading}
          searchPlaceholder={t('searchPlaceholder')}
        />
      )}
      
      <UserFormModal 
        isOpen={isFormOpen} 
        onClose={handleFormClose} 
        user={editingUser} 
      />

      <PermissionModal
        isOpen={isPermissionModalOpen}
        onClose={handlePermissionClose}
        user={editingUser}
      />
    </div>
  );
}
