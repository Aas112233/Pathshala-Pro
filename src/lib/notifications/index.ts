import { prisma } from "@/lib/prisma";
import { DEFAULT_NOTIFICATION_SETTINGS, DEFAULT_NOTIFICATION_TEMPLATES, type NotificationAdapter, type NotificationChannel, type NotificationEvent, type NotificationMessage, type NotificationRecipient, type NotificationSettings, type NotificationTemplate } from "./types";
import { MockNotificationAdapter } from "./adapters/mock-adapter";
import { ResendEmailAdapter } from "./adapters/resend-email-adapter";
import { WhatsAppCloudAdapter } from "./adapters/whatsapp-cloud-adapter";
import { SmsAdapter } from "./adapters/sms-adapter";

type StoredNotificationConfig = { settings?: Partial<NotificationSettings>; templates?: NotificationTemplate[] };
const configOf = (flags: unknown): StoredNotificationConfig => {
  if (!flags || typeof flags !== "object") return {};
  const value = (flags as Record<string, unknown>).notifications;
  return value && typeof value === "object" ? value as StoredNotificationConfig : {};
};

export async function getNotificationConfig(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({ where: { tenantId }, select: { name: true, featureFlags: true } });
  if (!tenant) throw new Error("Tenant not found");
  const stored = configOf(tenant.featureFlags);
  const settings: NotificationSettings = { ...DEFAULT_NOTIFICATION_SETTINGS, ...stored.settings, events: { ...DEFAULT_NOTIFICATION_SETTINGS.events, ...stored.settings?.events } };
  const templates = (stored.templates?.length ? stored.templates : DEFAULT_NOTIFICATION_TEMPLATES).map((template) => ({ ...template, tenantId, createdAt: template.createdAt || new Date().toISOString(), updatedAt: template.updatedAt || new Date().toISOString() }));
  return { tenantName: tenant.name, settings, templates, flags: (tenant.featureFlags as Record<string, unknown> | null) || {} };
}

export function renderTemplate(template: string, variables: Record<string, unknown>) {
  return template.replace(/{{\s*([\w.]+)\s*}}/g, (_, key: string) => String(variables[key] ?? ""));
}

function adapterFor(channel: NotificationChannel, settings: NotificationSettings): NotificationAdapter {
  if (channel === "EMAIL" && settings.resendApiKey) return new ResendEmailAdapter(settings.resendApiKey, `${settings.fromName || "School"} <${settings.fromEmail || "notifications@example.com"}>`);
  if (channel === "WHATSAPP" && settings.whatsappAccessToken && settings.whatsappPhoneNumberId) return new WhatsAppCloudAdapter(settings.whatsappAccessToken, settings.whatsappPhoneNumberId);
  if (channel === "SMS" && settings.smsApiUrl && settings.smsApiKey) return new SmsAdapter(settings.smsApiUrl, settings.smsApiKey, settings.smsFrom);
  return new MockNotificationAdapter(channel);
}

export async function dispatchNotification(message: NotificationMessage) {
  try {
    const { settings } = await getNotificationConfig(message.tenantId);
    if (!settings.enabled || !settings.channels.includes(message.channel) || (message.event && settings.events[message.event] === false)) return { accepted: false, skipped: true };
    return await adapterFor(message.channel, settings).send(message);
  } catch (error) {
    console.error("Notification dispatch failed", { tenantId: message.tenantId, channel: message.channel, error });
    return { accepted: false, error: error instanceof Error ? error.message : "Unknown notification failure" };
  }
}

export async function dispatchToRecipients(input: { tenantId: string; event: NotificationEvent; recipients: NotificationRecipient[]; variables: Record<string, unknown>; subject?: string; body?: string; channels?: NotificationChannel[] }) {
  const config = await getNotificationConfig(input.tenantId);
  const templates = config.templates.filter((t) => t.event === input.event && t.enabled);
  const channels = input.channels || config.settings.channels;
  const jobs: Promise<unknown>[] = [];
  for (const recipient of input.recipients) for (const channel of channels) {
    const template = templates.find((t) => t.channel === channel);
    const body = renderTemplate(input.body || template?.body || "{{message}}", { schoolName: config.tenantName, ...input.variables });
    jobs.push(dispatchNotification({ tenantId: input.tenantId, event: input.event, channel, recipient, subject: renderTemplate(input.subject || template?.subject || "School notification", input.variables), body }));
  }
  await Promise.allSettled(jobs);
}

export async function saveNotificationConfig(tenantId: string, patch: Partial<StoredNotificationConfig>) {
  const current = await prisma.tenant.findUnique({ where: { tenantId }, select: { featureFlags: true } });
  if (!current) throw new Error("Tenant not found");
  const flags = (current.featureFlags as Record<string, unknown> | null) || {};
  const existing = configOf(flags);
  const next = { ...flags, notifications: { ...existing, ...patch, settings: { ...existing.settings, ...patch.settings } } };
  return prisma.tenant.update({ where: { tenantId }, data: { featureFlags: next as any }, select: { tenantId: true, featureFlags: true } });
}

export type { NotificationChannel, NotificationEvent, NotificationMessage, NotificationRecipient, NotificationSettings, NotificationTemplate } from "./types";
