/**
 * Universal minimal fetch wrapper for client viewmodels.
 * Automatically handles credentials, JSON parsing, and field-aware error messages.
 */

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
    const errorMsg =
      json.message ||
      (json.details?.[0] ? `${json.details[0].field || "Field"}: ${json.details[0].message}` : null) ||
      `Request failed with status ${res.status}`;
    throw new Error(errorMsg);
  }

  return json.data ?? json;
}

export const apiGet = <T = any>(url: string) => apiFetch<T>(url, { method: "GET" });
export const apiPost = <T = any>(url: string, bodyData?: any) => apiFetch<T>(url, { method: "POST", bodyData });
export const apiPut = <T = any>(url: string, bodyData?: any) => apiFetch<T>(url, { method: "PUT", bodyData });
export const apiDelete = <T = any>(url: string) => apiFetch<T>(url, { method: "DELETE" });
