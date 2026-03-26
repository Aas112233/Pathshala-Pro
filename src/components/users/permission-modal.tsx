"use client";

import { useState, useEffect } from "react";
import { AppModal } from "@/components/ui/app-modal";
import { Button } from "@/components/ui/button";
import { useUpdateUser } from "@/hooks/use-queries";
import { toast } from "sonner";
import { ShieldCheck, ShieldAlert } from "lucide-react";

interface PermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any | null;
}

const MODULES = [
  { id: "students", label: "Students Directory" },
  { id: "attendance", label: "Attendance Records" },
  { id: "exams", label: "Exams & Results" },
  { id: "fees", label: "Fee Vouchers" },
  { id: "transactions", label: "Transactions" },
  { id: "staff", label: "Staff Directory" },
  { id: "salary", label: "Salary Payroll" },
  { id: "users", label: "System Users" },
  { id: "settings", label: "System Settings" },
  { id: "academic-years", label: "Academic Years" },
];

const ACTIONS = [
  { id: "read", label: "View (Read)" },
  { id: "write", label: "Create / Edit (Write)" },
  { id: "manage", label: "Delete / Approve (Manage)" },
];

export function PermissionModal({ isOpen, onClose, user }: PermissionModalProps) {
  const updateMutation = useUpdateUser(user?.id || "");
  
  // permissions[module][action] = boolean
  const [permissions, setPermissions] = useState<Record<string, Record<string, boolean>>>({});

  // Initialize permissions state when modal opens
  useEffect(() => {
    if (user && isOpen) {
        // Safe parsing if stringified in database, or use object if raw JSON
        let initialPerms = {};
        try {
            if (typeof user.permissions === "string") {
                initialPerms = JSON.parse(user.permissions);
            } else if (typeof user.permissions === "object" && user.permissions !== null) {
                initialPerms = user.permissions;
            }
        } catch(e) {}
        
        // Ensure all modules and actions exist in state
        const state: Record<string, Record<string, boolean>> = {};
        MODULES.forEach(mod => {
            state[mod.id] = {};
            ACTIONS.forEach(act => {
                state[mod.id][act.id] = (initialPerms as any)?.[mod.id]?.[act.id] || false;
            });
        });
        
        setPermissions(state);
    }
  }, [user, isOpen]);

  const handleToggle = (moduleId: string, actionId: string, checked: boolean) => {
    setPermissions(prev => ({
        ...prev,
        [moduleId]: {
            ...prev[moduleId],
            [actionId]: checked
        }
    }));
  };

  const handleToggleRow = (moduleId: string, checked: boolean) => {
    setPermissions(prev => {
        const next = { ...prev };
        next[moduleId] = {
            read: checked,
            write: checked,
            manage: checked,
        };
        return next;
    });
  };

  const handleToggleColumn = (actionId: string, checked: boolean) => {
     setPermissions(prev => {
         const next = { ...prev };
         Object.keys(next).forEach(mod => {
             next[mod] = {
                 ...next[mod],
                 [actionId]: checked
             };
         });
         return next;
     });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Send the raw permissions JSON object to your API
    updateMutation.mutate(
      { permissions },
      {
        onSuccess: () => {
          toast.success("Permissions updated successfully");
          onClose();
        },
        onError: (error) => {
          toast.error(error.message || "Failed to update permissions");
        },
      }
    );
  };

  if (!user) return null;

  const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
  const isLoading = updateMutation.isPending;

  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      title="Manage Access & Permissions"
      description={`Configure module access levels for ${user.name} (${user.email})`}
      maxWidth="3xl"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-6 pt-4 max-h-[70vh] overflow-y-auto">
        
        {isAdmin && (
            <div className="flex items-start gap-3 rounded-lg border border-orange-200 bg-orange-50 p-4 dark:border-orange-500/30 dark:bg-orange-500/10">
                <ShieldAlert className="mt-0.5 h-5 w-5 text-orange-600 dark:text-orange-400 shrink-0" />
                <div className="text-sm text-orange-800 dark:text-orange-200">
                    <p className="font-semibold mb-1">Warning: Admin Account</p>
                    <p>This user has the <strong>{user.role}</strong> role, which ordinarily grants full bypassing system access. Setting explicit restrictions below may or may not override their global Admin override depending on your backend strictness policy.</p>
                </div>
            </div>
        )}

        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
            <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 border-b border-border">
                    <tr>
                        <th className="px-4 py-3 font-semibold text-foreground">
                            Module Directory
                        </th>
                        {ACTIONS.map(action => (
                            <th key={action.id} className="px-4 py-3 font-semibold text-foreground text-center">
                                <div className="flex flex-col items-center gap-2">
                                    <span>{action.label}</span>
                                    <label className="flex items-center gap-1.5 text-xs font-normal text-muted-foreground cursor-pointer hover:text-foreground">
                                        <input 
                                            type="checkbox" 
                                            className="accent-primary w-3.5 h-3.5"
                                            checked={MODULES.every(m => permissions?.[m.id]?.[action.id])}
                                            onChange={(e) => handleToggleColumn(action.id, e.target.checked)}
                                        />
                                        All
                                    </label>
                                </div>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                    {MODULES.map(module => (
                        <tr key={module.id} className="hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-3 font-medium text-foreground">
                                <div className="flex items-center gap-2">
                                    <label className="flex items-center gap-1.5 text-xs font-normal text-muted-foreground cursor-pointer shrink-0">
                                        <input 
                                            type="checkbox" 
                                            className="accent-primary w-3 h-3 rounded"
                                            checked={ACTIONS.every(a => permissions?.[module.id]?.[a.id])}
                                            onChange={(e) => handleToggleRow(module.id, e.target.checked)}
                                        />
                                    </label>
                                    {module.label}
                                </div>
                            </td>
                            {ACTIONS.map(action => (
                                <td key={action.id} className="px-4 py-3 text-center">
                                    <input
                                        type="checkbox"
                                        className="accent-primary w-4 h-4 rounded cursor-pointer transition-transform hover:scale-110"
                                        checked={!!permissions?.[module.id]?.[action.id]}
                                        onChange={(e) => handleToggle(module.id, action.id, e.target.checked)}
                                    />
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>

        <div className="flex justify-end gap-3 sticky bottom-0 bg-background pt-4 border-t">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
            type="button"
          >
            Discard
          </Button>
          <Button type="submit" disabled={isLoading} className="shadow-md">
            <ShieldCheck className="mr-2 h-4 w-4" />
            {isLoading ? "Enforcing Rules..." : "Save Policies"}
          </Button>
        </div>
      </form>
    </AppModal>
  );
}
