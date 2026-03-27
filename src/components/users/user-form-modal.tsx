"use client";

import { useState, useEffect } from "react";
import { AppModal } from "@/components/ui/app-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateUser, useUpdateUser } from "@/hooks/use-queries";
import { toast } from "sonner";
import { ROLES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { CreateUserPayload, UpdateUserPayload, UserRecord } from "@/types/users";

interface UserFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  user?: UserRecord | null;
}

export function UserFormModal({ isOpen, onClose, user }: UserFormModalProps) {
  const isEditing = !!user;
  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser(user?.id || "");

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
      toast.error("Please fill in all required fields.");
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
          toast.success("User updated successfully");
          onClose();
        },
        onError: (error) => {
          toast.error(error.message || "Failed to update user");
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
            toast.success("User created successfully");
            onClose();
          },
          onError: (error) => {
            toast.error(error.message || "Failed to create user");
          },
        }
      );
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;
  const inputClass = "h-10";
  const selectClass = "h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary";
  const errorClass = "mt-1 text-xs text-destructive";

  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? "Edit User" : "Create User"}
      description={
        isEditing
          ? "Update the user's details and permissions."
          : "Add a new user to the system."
      }
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} autoComplete="off" className="space-y-4 pt-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Full Name <span className="text-destructive">*</span>
          </label>
          <Input
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
            className={cn(inputClass)}
          />
          {errors.name && <p className={errorClass}>{errors.name}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Email Address <span className="text-destructive">*</span>
          </label>
          <Input
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
            className={cn(inputClass)}
          />
          {errors.email && <p className={errorClass}>{errors.email}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            {isEditing ? "New Password" : "Password"} {!isEditing && <span className="text-destructive">*</span>}
          </label>
          <Input
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
            className={cn(inputClass)}
          />
          {errors.password && <p className={errorClass}>{errors.password}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Role <span className="text-destructive">*</span>
          </label>
          <select
            value={role}
            onChange={(e) => {
              setRole(e.target.value);
              if (errors.role) setErrors((prev) => ({ ...prev, role: undefined }));
            }}
            aria-invalid={Boolean(errors.role)}
            className={cn(selectClass, errors.role && "border-destructive focus:ring-destructive")}
          >
            {Object.values(ROLES).map((r) => (
              <option key={r} value={r}>
                {r.replace("_", " ")}
              </option>
            ))}
          </select>
          {errors.role && <p className={errorClass}>{errors.role}</p>}
        </div>

        <div className="flex items-start gap-3 mt-4 p-4 border border-border rounded-lg bg-card">
          <input
            type="checkbox"
            id="isActive"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="mt-1 shrink-0 accent-primary"
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

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
            type="button"
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Saving..." : isEditing ? "Update" : "Create"}
          </Button>
        </div>
      </form>
    </AppModal>
  );
}
