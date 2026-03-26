"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { UserCheck, Plus, Pencil, Trash2, ShieldCheck } from "lucide-react";
import { useUsers, useDeleteUser } from "@/hooks/use-queries";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { UserFormModal } from "@/components/users/user-form-modal";
import { PermissionModal } from "@/components/users/permission-modal";
import { useTenantFormatting } from "@/components/providers/tenant-settings-provider";

export default function UsersPage() {
  const t = useTranslations('users');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const { formatDate } = useTenantFormatting();

  const { data, isLoading } = useUsers({
    page,
    limit: 20,
    search: search || undefined,
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

  const columns: ColumnDef<any>[] = [
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
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
            getValue<boolean>()
              ? "bg-green-100 text-green-800"
              : "bg-gray-100 text-gray-800"
          }`}
        >
          {getValue<boolean>() ? t('status.active') : t('status.inactive')}
        </span>
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
          <Button 
            variant="ghost" 
            size="icon"
            title={t('managePermissions')}
            onClick={() => {
              setEditingUser(row.original);
              setIsPermissionModalOpen(true);
            }}
          >
            <ShieldCheck className="h-4 w-4 text-primary" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon"
            title={t('editUserTitle')}
            onClick={() => {
              setEditingUser(row.original);
              setIsFormOpen(true);
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title={t('deleteUserTitle')}
            onClick={() => handleDelete(row.original.id)}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  const pagination = "pagination" in (data || {})
    ? (data as any).pagination
    : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        description={t('description')}
        icon={UserCheck}
      >
        <Button onClick={() => {
          setEditingUser(null);
          setIsFormOpen(true);
        }}>
          <Plus className="mr-2 h-4 w-4" />
          {t('addUser')}
        </Button>
      </PageHeader>

      <DataTable
        columns={columns}
        data={("data" in (data || {})) ? (data as any).data : []}
        pagination={pagination}
        onPageChange={setPage}
        onSearch={setSearch}
        isLoading={isLoading}
        searchPlaceholder={t('searchPlaceholder')}
      />
      
      <UserFormModal 
        isOpen={isFormOpen} 
        onClose={() => setIsFormOpen(false)} 
        user={editingUser} 
      />

      <PermissionModal
        isOpen={isPermissionModalOpen}
        onClose={() => setIsPermissionModalOpen(false)}
        user={editingUser}
      />
    </div>
  );
}
