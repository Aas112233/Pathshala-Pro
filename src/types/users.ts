import type { UserPermissions } from "@/lib/permissions";

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  role: string;
  accessLevel?: number | null;
  permissions?: UserPermissions | string | null;
  isActive: boolean;
  staffProfileId?: string | null;
  lastLoginAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateUserPayload {
  email: string;
  name: string;
  role: string;
  password: string;
  staffProfileId?: string;
  accessLevel?: number;
  isActive?: boolean;
}

export interface UpdateUserPayload extends Partial<CreateUserPayload> {
  permissions?: UserPermissions;
  accessLevel?: number;
}
