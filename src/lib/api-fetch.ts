/**
 * Universal minimal fetch wrapper for client viewmodels.
 * Automatically handles credentials, JSON parsing, and field/code-aware exact error messages.
 */

export interface ApiErrorDetail {
  field?: string;
  code?: string;
  message: string;
}

export interface ApiErrorWithDetails extends Error {
  details?: ApiErrorDetail[];
  status?: number;
  code?: string;
  raw?: any;
}

export function formatErrorDetail(d: { field?: string; code?: string; message?: string }): string {
  const fieldStr = d.field ? `Field '${d.field}'` : "";
  const codeStr = d.code ? `Code: ${d.code}` : "";
  const meta = [fieldStr, codeStr].filter(Boolean).join(", ");
  const tag = meta ? `[${meta}] ` : "";
  const msg = d.message || "Invalid value";
  return `${tag}${msg}`;
}

export async function apiFetch<T = any>(
  url: string,
  options: RequestInit & { bodyData?: any } = {}
): Promise<T> {
  const { bodyData, headers, ...rest } = options;
  const isJson = bodyData !== undefined;

  const res = await fetch(url, {
    credentials: "include",
    headers: {
      ...(isJson ? { "Content-Type": "application/json" } : {}),
      ...(headers as Record<string, string>),
    },
    body: isJson ? JSON.stringify(bodyData) : undefined,
    ...rest,
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    let cleanMessage = json.message || `Request failed with status ${res.status}`;
    
    if (Array.isArray(json.details) && json.details.length > 0) {
      cleanMessage = json.details
        .map(formatErrorDetail)
        .filter(Boolean)
        .join(" | ");
    } else if (typeof cleanMessage === "string" && cleanMessage.startsWith("Validation failed:")) {
      cleanMessage = cleanMessage.replace(/^Validation failed:\s*/i, "");
    }

    if (json.code && !cleanMessage.includes(json.code)) {
      cleanMessage = `${cleanMessage} [Code: ${json.code}]`;
    }

    const err: ApiErrorWithDetails = new Error(cleanMessage);
    err.details = json.details;
    err.status = res.status;
    err.code = json.code;
    err.raw = json;
    throw err;
  }

  return json.data ?? json;
}

export const apiGet = <T = any>(url: string) => apiFetch<T>(url, { method: "GET" });
export const apiPost = <T = any>(url: string, bodyData?: any) => apiFetch<T>(url, { method: "POST", bodyData });
export const apiPut = <T = any>(url: string, bodyData?: any) => apiFetch<T>(url, { method: "PUT", bodyData });
export const apiDelete = <T = any>(url: string) => apiFetch<T>(url, { method: "DELETE" });
