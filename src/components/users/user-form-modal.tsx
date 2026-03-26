"use client";

import { useState, useEffect } from "react";
import { AppModal } from "@/components/ui/app-modal";
import { Button } from "@/components/ui/button";
import { useCreateUser, useUpdateUser } from "@/hooks/use-queries";
import { toast } from "sonner";
import { ROLES } from "@/lib/constants";

interface UserFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  user?: any | null;
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
    }
  }, [user, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !email || (!isEditing && !password)) {
      toast.error("Please fill in all required fields.");
      return;
    }

    if (isEditing) {
      const updateData: any = { name, email, role, isActive };
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
      createMutation.mutate(
        { name, email, password, role, isActive },
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
          <input
            type="text"
            required
            autoComplete="off"
            placeholder="John Doe"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-input bg-background pl-3 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Email Address <span className="text-destructive">*</span>
          </label>
          <input
            type="email"
            required
            autoComplete="new-email" // non-standard to strictly bypass Chrome autofill overrides
            placeholder="admin@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-input bg-background pl-3 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            {isEditing ? "New Password" : "Password"} {!isEditing && <span className="text-destructive">*</span>}
          </label>
          <input
            type={isEditing ? "text" : "password"}
            required={!isEditing}
            autoComplete="new-password"
            placeholder={isEditing ? "Leave blank to keep same" : "••••••••"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            className="w-full rounded-md border border-input bg-background pl-3 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Role <span className="text-destructive">*</span>
          </label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary"
          >
            {Object.values(ROLES).map((r) => (
              <option key={r} value={r}>
                {r.replace("_", " ")}
              </option>
            ))}
          </select>
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
