import { z } from "zod";

export function isInternalFileUrl(value: string | null | undefined): boolean {
  if (!value || !value.startsWith("/api/files?")) return false;

  try {
    const url = new URL(value, "http://localhost");
    return url.pathname === "/api/files" && !!url.searchParams.get("token") && !url.searchParams.get("key");
  } catch {
    return false;
  }
}

export const internalFileUrlSchema = z.string().refine(
  isInternalFileUrl,
  "Only authenticated internal file URLs are allowed"
);
