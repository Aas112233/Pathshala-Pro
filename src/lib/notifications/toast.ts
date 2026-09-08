import { toast as sonnerToast, type ExternalToast } from "sonner";

export function getToastId(type: string, message: unknown) {
  const text = typeof message === "string" ? message : String(message ?? "notification");
  return `app-${type}-${text.trim().toLowerCase().replace(/\s+/g, "-").slice(0, 120)}`;
}

function options(type: string, message: unknown, data?: ExternalToast): ExternalToast {
  return { ...data, id: data?.id ?? getToastId(type, message) };
}

export const appToast = {
  success: (message: Parameters<typeof sonnerToast.success>[0], data?: ExternalToast) =>
    sonnerToast.success(message, options("success", message, data)),
  error: (message: Parameters<typeof sonnerToast.error>[0], data?: ExternalToast) =>
    sonnerToast.error(message, options("error", message, data)),
  info: (message: Parameters<typeof sonnerToast.info>[0], data?: ExternalToast) =>
    sonnerToast.info(message, options("info", message, data)),
  warning: (message: Parameters<typeof sonnerToast.warning>[0], data?: ExternalToast) =>
    sonnerToast.warning(message, options("warning", message, data)),
  loading: (message: Parameters<typeof sonnerToast.loading>[0], data?: ExternalToast) =>
    sonnerToast.loading(message, options("loading", message, data)),
  message: (message: Parameters<typeof sonnerToast.message>[0], data?: ExternalToast) =>
    sonnerToast.message(message, options("message", message, data)),
  dismiss: sonnerToast.dismiss,
};
