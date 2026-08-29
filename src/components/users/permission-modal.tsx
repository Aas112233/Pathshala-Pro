"use client";

import { useState, useEffect, useMemo } from "react";
import { TopSheet } from "@/components/ui/top-sheet";
import { ERPFormSection } from "@/components/ui/erp-form-layout";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { AppDropdown } from "@/components/ui/app-dropdown";
import { useAuth } from "@/components/providers/auth-provider";
import { useUpdateUser } from "@/hooks/use-queries";
import { toast } from "sonner";
import {
  ShieldCheck,
  ShieldAlert,
  RotateCcw,
  Unlock,
  Lock,
  BookOpen,
  Ban,
  ChevronDown,
  ChevronRight,
  Info,
  GraduationCap,
  FileCheck,
  Wallet,
  Building2,
  Settings,
} from "lucide-react";
import type { PermissionAction, UserPermissions } from "@/lib/permissions";
import {
  MODULE_CATEGORIES,
  ROLE_DEFAULT_PERMISSIONS,
  FULL_ACCESS_PERMISSIONS,
  READ_ONLY_PERMISSIONS,
  NO_ACCESS_PERMISSIONS,
  ACCESS_LEVEL_LABELS,
  ACCESS_LEVEL_PERMISSIONS,
  getPermissionsDiff,
  canAssignAccessLevel,
} from "@/lib/permissions";
import type { UserRecord } from "@/types/users";

interface PermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserRecord | null;
}

const ACTIONS: ReadonlyArray<{ id: PermissionAction; label: string; shortLabel: string }> = [
  { id: "read", label: "View (Read)", shortLabel: "Read" },
  { id: "write", label: "Create / Edit (Write)", shortLabel: "Write" },
  { id: "manage", label: "Delete / Approve (Manage)", shortLabel: "Manage" },
];

// Flatten all module IDs from categories
const ALL_MODULE_IDS = MODULE_CATEGORIES.flatMap((cat) => cat.modules.map((m) => m.id));

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  "student-academic": GraduationCap,
  "exams-results": FileCheck,
  finance: Wallet,
  "academic-ops": BookOpen,
  campus: Building2,
  system: Settings,
};

type PermState = Record<string, Record<PermissionAction, boolean>>;

function buildPermState(perms: UserPermissions): PermState {
  const state: PermState = {};
  ALL_MODULE_IDS.forEach((id) => {
    state[id] = {
      read: !!perms?.[id]?.read,
      write: !!perms?.[id]?.write,
      manage: !!perms?.[id]?.manage,
    };
  });
  return state;
}

function permStateToUserPermissions(state: PermState): UserPermissions {
  const perms: UserPermissions = {};
  Object.entries(state).forEach(([mod, actions]) => {
    perms[mod] = { ...actions };
  });
  return perms;
}

const ROLE_BADGE_COLORS: Record<string, string> = {
  SUPER_ADMIN: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
  ADMIN: "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30",
  SYSTEM_ADMIN: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
  PRINCIPAL: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-500/30",
  MANAGER: "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30",
  ACCOUNTANT: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  TEACHER: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
  CLERK: "bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/30",
  STUDENT: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 border-cyan-500/30",
  PARENT: "bg-teal-500/15 text-teal-700 dark:text-teal-400 border-teal-500/30",
};

interface PresetButton {
  label: string;
  icon: React.ReactNode;
  getPerms: () => UserPermissions;
  variant?: "default" | "outline" | "secondary" | "destructive" | "ghost";
}

export function PermissionModal({ isOpen, onClose, user }: PermissionModalProps) {
  const updateMutation = useUpdateUser(user?.id || "");
  const { user: authUser } = useAuth();
  const [permissions, setPermissions] = useState<PermState>({});
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const requesterLevel = (authUser as any)?.accessLevel ?? null;
  const isRequesterPrivileged =
    ["PLATFORM_OWNER", "SUPER_ADMIN", "SYSTEM_ADMIN"].includes(
      ((authUser as any)?.role || "").toUpperCase()
    );
  const availableLevelOptions = useMemo(() => {
    return Object.entries(ACCESS_LEVEL_LABELS)
      .filter(([lvl]) => {
        const n = parseInt(lvl, 10);
        if (isRequesterPrivileged) return true;
        return canAssignAccessLevel(requesterLevel, n);
      })
      .map(([lvl, label]) => ({ value: lvl, label: `Level ${lvl} - ${label}` }));
  }, [requesterLevel, isRequesterPrivileged]);

  // Initialize permissions state when modal opens
  useEffect(() => {
    if (user && isOpen) {
      let initialPerms: UserPermissions = {};
      try {
        if (typeof user.permissions === "string") {
          initialPerms = JSON.parse(user.permissions) as UserPermissions;
        } else if (typeof user.permissions === "object" && user.permissions !== null) {
          initialPerms = user.permissions;
        }
      } catch {}

      // If no explicit permissions, use role defaults
      if (Object.keys(initialPerms).length === 0) {
        const roleKey = (user.role || "").toUpperCase();
        initialPerms = ROLE_DEFAULT_PERMISSIONS[roleKey] || {};
      }

      setPermissions(buildPermState(initialPerms));
      setSelectedLevel(user.accessLevel || null);
      setCollapsedCategories(new Set());
    }
  }, [user, isOpen]);

  // Role defaults for comparison
  const roleDefaults = useMemo(() => {
    if (!user) return {};
    return ROLE_DEFAULT_PERMISSIONS[(user.role || "").toUpperCase()] || {};
  }, [user]);

  const changedModules = useMemo(() => {
    return getPermissionsDiff(permStateToUserPermissions(permissions), roleDefaults);
  }, [permissions, roleDefaults]);

  const isMatchingDefaults = changedModules.size === 0;

  // Handlers
  const handleToggle = (moduleId: string, actionId: PermissionAction, checked: boolean) => {
    setPermissions((prev) => ({
      ...prev,
      [moduleId]: {
        ...prev[moduleId],
        [actionId]: checked,
      },
    }));
  };

  const handleToggleRow = (moduleId: string, checked: boolean) => {
    setPermissions((prev) => ({
      ...prev,
      [moduleId]: { read: checked, write: checked, manage: checked },
    }));
  };

  const handleToggleCategoryRow = (categoryId: string, checked: boolean) => {
    const cat = MODULE_CATEGORIES.find((c) => c.id === categoryId);
    if (!cat) return;
    setPermissions((prev) => {
      const next = { ...prev };
      cat.modules.forEach((mod) => {
        next[mod.id] = { read: checked, write: checked, manage: checked };
      });
      return next;
    });
  };

  const handleToggleColumn = (actionId: PermissionAction, checked: boolean) => {
    setPermissions((prev) => {
      const next = { ...prev };
      ALL_MODULE_IDS.forEach((mod) => {
        next[mod] = { ...next[mod], [actionId]: checked };
      });
      return next;
    });
  };

  const handleApplyPreset = (presetPerms: UserPermissions) => {
    setPermissions(buildPermState(presetPerms));
  };

  const handleResetToDefaults = () => {
    handleApplyPreset(roleDefaults);
    toast.info("Permissions reset to role defaults");
  };

  const handleLevelChange = (value: string) => {
    const lvl = value ? parseInt(value, 10) : null;
    setSelectedLevel(lvl);
    if (lvl && ACCESS_LEVEL_PERMISSIONS[lvl]) {
      setPermissions(buildPermState(ACCESS_LEVEL_PERMISSIONS[lvl]));
      toast.info(`Applied ${ACCESS_LEVEL_LABELS[lvl]} access level`);
    }
  };

  const toggleCategory = (catId: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) {
        next.delete(catId);
      } else {
        next.add(catId);
      }
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    updateMutation.mutate(
      {
        permissions: permStateToUserPermissions(permissions),
        ...(selectedLevel !== null ? { accessLevel: selectedLevel } : {}),
      },
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

  const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN" || user.role === "SYSTEM_ADMIN";
  const isLoading = updateMutation.isPending;
  const roleDisplay = (user.role || "CLERK").replace(/_/g, " ");
  const badgeColor = ROLE_BADGE_COLORS[(user.role || "").toUpperCase()] || ROLE_BADGE_COLORS.CLERK;
  const accessLevelLabel = user.accessLevel ? ACCESS_LEVEL_LABELS[user.accessLevel] : null;

  const presets: PresetButton[] = [
    {
      label: "Full Access",
      icon: <Unlock className="h-3.5 w-3.5" />,
      getPerms: () => FULL_ACCESS_PERMISSIONS,
      variant: "outline",
    },
    {
      label: "Principal",
      icon: <ShieldCheck className="h-3.5 w-3.5" />,
      getPerms: () => ROLE_DEFAULT_PERMISSIONS.PRINCIPAL || {},
      variant: "outline",
    },
    {
      label: "Accountant",
      icon: <ShieldCheck className="h-3.5 w-3.5" />,
      getPerms: () => ROLE_DEFAULT_PERMISSIONS.ACCOUNTANT || {},
      variant: "outline",
    },
    {
      label: "Teacher",
      icon: <ShieldCheck className="h-3.5 w-3.5" />,
      getPerms: () => ROLE_DEFAULT_PERMISSIONS.TEACHER || {},
      variant: "outline",
    },
    {
      label: "Read-Only",
      icon: <BookOpen className="h-3.5 w-3.5" />,
      getPerms: () => READ_ONLY_PERMISSIONS,
      variant: "outline",
    },
    {
      label: "No Access",
      icon: <Ban className="h-3.5 w-3.5" />,
      getPerms: () => NO_ACCESS_PERMISSIONS,
      variant: "outline",
    },
  ];

  // Check if all modules in a category are fully toggled
  const isCategoryAllChecked = (catId: string) => {
    const cat = MODULE_CATEGORIES.find((c) => c.id === catId);
    if (!cat) return false;
    return cat.modules.every((m) =>
      ACTIONS.every((a) => permissions?.[m.id]?.[a.id])
    );
  };

  return (
    <TopSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Manage Access & Permissions"
      description={`Configure module access levels for ${user.name} (${user.email})`}
      maxWidth="4xl"
      footer={
        <div className="flex items-center justify-between gap-3 w-full">
          <div className="flex items-center gap-2">
            {!isMatchingDefaults && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetToDefaults}
                disabled={isLoading}
                type="button"
                className="text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                Reset to Defaults
              </Button>
            )}
            {isMatchingDefaults && (
              <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5" />
                Matches {roleDisplay} role defaults
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
              type="button"
            >
              Discard
            </Button>
            <Button type="submit" form="permissions-form" disabled={isLoading} className="shadow-md">
              <ShieldCheck className="mr-2 h-4 w-4" />
              {isLoading ? "Enforcing Rules..." : "Save Policies"}
            </Button>
          </div>
        </div>
      }
    >
      <form id="permissions-form" onSubmit={handleSubmit} className="flex flex-col gap-5">
        <ERPFormSection>
          {/* ─── User Context Header ─── */}
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm uppercase">
                {(user.name || "?").charAt(0)}
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{user.name}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={`text-[11px] font-semibold capitalize ${badgeColor}`}>
                {roleDisplay}
              </Badge>
              <div className="min-w-[200px]">
                <AppDropdown
                  value={selectedLevel ? String(selectedLevel) : ""}
                  onChange={handleLevelChange}
                  options={[{ value: "", label: "No Access Level" }, ...availableLevelOptions]}
                  placeholder="Select access level"
                />
              </div>
              {user.lastLoginAt && (
                <span className="text-[10px] text-muted-foreground hidden sm:inline-block">
                  Last login: {new Date(user.lastLoginAt).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>

          {/* ─── Admin Warning Banner ─── */}
          {isAdmin && (
            <div className="flex items-start gap-3 rounded-lg border border-orange-200 bg-orange-50 p-4 dark:border-orange-500/30 dark:bg-orange-500/10">
              <ShieldAlert className="mt-0.5 h-5 w-5 text-orange-600 dark:text-orange-400 shrink-0" />
              <div className="text-sm text-orange-800 dark:text-orange-200">
                <p className="font-semibold mb-1">Warning: Admin Account</p>
                <p>
                  This user has the <strong>{user.role}</strong> role, which ordinarily grants full
                  bypassing system access. Setting explicit restrictions below may override their
                  global admin permissions.
                </p>
              </div>
            </div>
          )}

          {/* ─── Role Preset Buttons ─── */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Quick Presets
            </p>
            <div className="flex flex-wrap gap-2">
              {presets.map((preset) => (
                <Button
                  key={preset.label}
                  type="button"
                  variant={preset.variant || "outline"}
                  size="sm"
                  className="h-8 text-xs gap-1.5"
                  onClick={() => handleApplyPreset(preset.getPerms())}
                >
                  {preset.icon}
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>

          {/* ─── Permission Matrix ─── */}
          <div className="rounded-lg border border-border bg-card shadow-sm overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm text-left">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-4 py-3 font-semibold text-foreground w-[45%]">
                    Module Directory
                  </th>
                  {ACTIONS.map((action) => (
                    <th key={action.id} className="px-3 py-3 font-semibold text-foreground text-center w-[18%]">
                      <div className="flex flex-col items-center gap-1.5">
                        <span className="hidden sm:inline">{action.label}</span>
                        <span className="sm:hidden">{action.shortLabel}</span>
                        <label className="flex items-center gap-1 text-[10px] font-normal text-muted-foreground cursor-pointer hover:text-foreground">
                          <Checkbox
                            className="w-3 h-3"
                            checked={ALL_MODULE_IDS.every((m) => permissions?.[m]?.[action.id])}
                            onCheckedChange={(checked) =>
                              handleToggleColumn(action.id, checked === true)
                            }
                          />
                          All
                        </label>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
                {MODULE_CATEGORIES.map((category) => {
                  const isCollapsed = collapsedCategories.has(category.id);
                  const catAllChecked = isCategoryAllChecked(category.id);

                  return (
                    <tbody key={category.id}>
                      {/* Category Header Row */}
                      <tr
                        className="bg-muted/30 border-y border-border/60 cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => toggleCategory(category.id)}
                      >
                        <td className="px-4 py-2.5" colSpan={1}>
                          <div className="flex items-center gap-2">
                            {isCollapsed ? (
                              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                            {(() => {
                              const Icon = CATEGORY_ICONS[category.id] || Settings;
                              return <Icon className="h-3.5 w-3.5 text-muted-foreground" />;
                            })()}
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              {category.label}
                            </span>
                            <Badge variant="secondary" className="text-[10px] h-4 px-1.5 ml-1">
                              {category.modules.length}
                            </Badge>
                          </div>
                        </td>
                        {ACTIONS.map((action) => (
                          <td key={action.id} className="px-3 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              className="w-3.5 h-3.5"
                              checked={catAllChecked}
                              onCheckedChange={(checked) =>
                                handleToggleCategoryRow(category.id, checked === true)
                              }
                            />
                          </td>
                        ))}
                      </tr>

                      {/* Module Rows (collapsible) */}
                      {!isCollapsed &&
                        category.modules.map((module) => {
                          const isChanged = changedModules.has(module.id);
                          const allRowChecked = ACTIONS.every((a) => permissions?.[module.id]?.[a.id]);

                          return (
                            <tr
                              key={module.id}
                              className={`hover:bg-muted/20 transition-colors border-b border-border/30 ${
                                isChanged ? "bg-amber-500/5" : ""
                              }`}
                            >
                              <td className="px-4 py-2.5 pl-10 font-medium text-foreground">
                                <div className="flex items-center gap-2">
                                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer shrink-0">
                                    <Checkbox
                                      className="w-3 h-3 rounded"
                                      checked={allRowChecked}
                                      onCheckedChange={(checked) =>
                                        handleToggleRow(module.id, checked === true)
                                      }
                                    />
                                  </label>
                                  <span className="text-sm">{module.label}</span>
                                  {isChanged && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" title="Modified from role defaults" />
                                  )}
                                </div>
                              </td>
                              {ACTIONS.map((action) => (
                                <td key={action.id} className="px-3 py-2.5 text-center">
                                  <Checkbox
                                    className="w-4 h-4 cursor-pointer transition-transform hover:scale-110"
                                    checked={!!permissions?.[module.id]?.[action.id]}
                                    onCheckedChange={(checked) =>
                                      handleToggle(module.id, action.id, checked === true)
                                    }
                                  />
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                    </tbody>
                  );
                })}
            </table>
          </div>

          {/* ─── Summary Footer ─── */}
          <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
            <span>
              {ALL_MODULE_IDS.length} modules across {MODULE_CATEGORIES.length} categories
            </span>
            {changedModules.size > 0 && (
              <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <Lock className="h-3 w-3" />
                {changedModules.size} module{changedModules.size !== 1 ? "s" : ""} differ from{" "}
                {roleDisplay} defaults
              </span>
            )}
          </div>
        </ERPFormSection>
      </form>
    </TopSheet>
  );
}
