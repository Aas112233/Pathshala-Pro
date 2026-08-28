/**
 * Platform Owner / SuperAdmin resolution helper.
 * Reads PLATFORM_OWNER_EMAILS environment variable to provide deterministic,
 * infrastructure-level superadmin authorization.
 */

export function isPlatformOwnerEmail(email?: string | null): boolean {
  if (!email || typeof email !== "string") return false;
  const envEmails = (process.env.PLATFORM_OWNER_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  return envEmails.includes(email.trim().toLowerCase());
}
