"use client";

import { useState, useEffect } from "react";
import { TopSheet } from "@/components/ui/top-sheet";
import { ERPFormSection, ERPFormGrid, ERPFormField } from "@/components/ui/erp-form-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useCreateUser, useUpdateUser } from "@/hooks/use-queries";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ROLES } from "@/lib/constants";
import { useAuth } from "@/components/providers/auth-provider";
import { canAssignRole } from "@/lib/permissions";
import { isPlatformOwnerEmail } from "@/lib/platform-owner";
import type { CreateUserPayload, UpdateUserPayload, UserRecord } from "@/types/users";

interface UserFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  user?: UserRecord | null;
  isEditing?: boolean;
}

export function UserFormModal({ isOpen, onClose, user, isEditing }: UserFormModalProps) {
  const t = useTranslations("users");
  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser(user?.id || "");
  const { user: authUser } = useAuth();
  const availableRoles = Object.values(ROLES).filter((r) =>
    canAssignRole((authUser as any)?.role, isPlatformOwnerEmail((authUser as any)?.email), r)
  );

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("CLERK");
  const [isActive, setIsActive] = useState(true);
  const [errors, setErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    role?: string;
  }>({});

  useEffect(() => {
    if (user && isOpen) {
      setName(user.name || "");
      setEmail(user.email || "");
      setPassword(""); // Password remains empty on edit unless user wants to change
      setRole(user.role || "CLERK");
      setIsActive(user.isActive !== false);
    } else if (!isOpen) {
      setName("");
      setEmail("");
      setPassword("");
      setRole("CLERK");
      setIsActive(true);
      setErrors({});
    }
  }, [user, isOpen]);

  const validateForm = () => {
    const nextErrors: typeof errors = {};
    const normalizedEmail = email.trim();

    if (!name.trim()) nextErrors.name = "Full name is required";
    if (!normalizedEmail) {
      nextErrors.email = "Email address is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      nextErrors.email = "Enter a valid email address";
    }
    if (!isEditing && !password.trim()) {
      nextErrors.password = "Password is required";
    } else if (password && password.length < 6) {
      nextErrors.password = "Password must be at least 6 characters";
    }
    if (!role.trim()) nextErrors.role = "Role is required";

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error(t("fillRequired"));
      return;
    }

    if (isEditing) {
      const updateData: UpdateUserPayload = {
        name: name.trim(),
        email: email.trim(),
        role,
        isActive,
      };
      if (password) {
        updateData.password = password;
      }
      
      updateMutation.mutate(updateData, {
        onSuccess: () => {
          toast.success(t("userUpdated"));
          onClose();
        },
        onError: (error) => {
          toast.error(error.message || t("userUpdated"));
        },
      });
    } else {
      const createData: CreateUserPayload = {
        name: name.trim(),
        email: email.trim(),
        password,
        role,
        isActive,
      };
      createMutation.mutate(
        createData,
        {
          onSuccess: () => {
            toast.success(t("userCreated"));
            onClose();
          },
          onError: (error) => {
            toast.error(error.message || t("userCreated"));
          },
        }
      );
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <TopSheet
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? "Edit User" : "Create User"}
      description={
        isEditing
          ? "Update the user's details and permissions."
          : "Add a new user to the system."
      }
      maxWidth="2xl"
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
            type="button"
          >
            Cancel
          </Button>
          <Button type="submit" form="user-form" disabled={isLoading}>
            {isLoading ? "Saving..." : isEditing ? "Update" : "Create"}
          </Button>
        </div>
      }
    >
      <form id="user-form" onSubmit={handleSubmit} autoComplete="off" className="space-y-5">
        <ERPFormSection>
          <ERPFormGrid cols={2}>
            <ERPFormField label="Full Name" required error={errors.name} htmlFor="user-name">
              <Input
                id="user-name"
                type="text"
                required
                autoComplete="off"
                placeholder="John Doe"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
                }}
                aria-invalid={Boolean(errors.name)}
              />
            </ERPFormField>

            <ERPFormField label="Email Address" required error={errors.email} htmlFor="user-email">
              <Input
                id="user-email"
                type="email"
                required
                autoComplete="new-email" // non-standard to strictly bypass Chrome autofill overrides
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
                }}
                aria-invalid={Boolean(errors.email)}
              />
            </ERPFormField>

            <ERPFormField label={isEditing ? "New Password" : "Password"} required={!isEditing} error={errors.password} htmlFor="user-password">
              <Input
                id="user-password"
                type="password"
                required={!isEditing}
                autoComplete="new-password"
                placeholder={isEditing ? "Leave blank to keep same" : "••••••••"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
                }}
                minLength={6}
                aria-invalid={Boolean(errors.password)}
              />
            </ERPFormField>

            <ERPFormField label="Role" required error={errors.role}>
              <Select
                value={role}
                onValueChange={(val) => {
                  setRole(val);
                  if (errors.role) setErrors((prev) => ({ ...prev, role: undefined }));
                }}
              >
                <SelectTrigger
                  aria-invalid={Boolean(errors.role)}
                  className={errors.role ? "border-destructive ring-1 ring-destructive" : ""}
                >
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {availableRoles.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </ERPFormField>
          </ERPFormGrid>

          <div className="flex items-start gap-3 p-4 border border-border rounded-lg bg-card">
            <Checkbox
              id="isActive"
              checked={isActive}
              onCheckedChange={(checked) => setIsActive(checked === true)}
              className="mt-0.5 shrink-0"
            />
            <div>
              <label htmlFor="isActive" className="text-sm font-medium text-foreground cursor-pointer block">
                Active Account
              </label>
              <p className="text-xs text-muted-foreground mt-0.5">
                If disabled, this user will not be able to log in to the system.
              </p>
            </div>
          </div>
        </ERPFormSection>
      </form>
    </TopSheet>
  );
}
