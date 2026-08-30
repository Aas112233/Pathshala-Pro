import { verifyFileAccessToken } from "@/lib/jwt";
import { isInternalFileUrl } from "@/lib/file-url";

export { isInternalFileUrl } from "@/lib/file-url";

export const MAX_UPLOAD_SIZE = 5 * 1024 * 1024;

export const ALLOWED_UPLOAD_TYPES: Readonly<Record<string, string>> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

export function sanitizeUploadType(value: string | null | undefined): string {
  const normalized = (value || "general").toLowerCase().replace(/[^a-z0-9_-]/g, "_");
  return normalized.slice(0, 40) || "general";
}

export function getValidatedUploadExtension(file: File): string | null {
  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  const expected = ALLOWED_UPLOAD_TYPES[file.type];
  return expected && extension === expected ? expected : null;
}

export function validateUpload(file: File): string | null {
  if (file.size <= 0 || file.size > MAX_UPLOAD_SIZE) return null;
  if (!ALLOWED_UPLOAD_TYPES[file.type]) return null;
  return getValidatedUploadExtension(file);
}

export function tenantStoragePrefix(tenantId: string): string {
  return `Tenant_${tenantId.replace(/[^a-zA-Z0-9_-]/g, "_")}/`;
}

export async function verifyInternalFileUrl(value: string | null | undefined, tenantId: string): Promise<boolean> {
  if (!isInternalFileUrl(value)) return false;
  const token = new URL(value!, "http://localhost").searchParams.get("token");
  return !!token && !!(await verifyFileAccessToken(token, tenantId));
}

export function isTenantTemporaryObject(objectKey: string, tenantId: string): boolean {
  const prefix = tenantStoragePrefix(tenantId);
  if (!objectKey.startsWith(prefix) || objectKey.includes("..")) return false;
  const relative = objectKey.slice(prefix.length);
  const lastSegment = relative.split("/").pop() || "";
  return relative.includes("/") && /^temp_[a-zA-Z0-9-]+\.(jpg|png|webp|pdf)$/.test(lastSegment);
}
