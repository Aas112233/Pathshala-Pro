export const NOTIFICATION_CHANNELS = ["SMS", "WHATSAPP", "EMAIL", "IN_APP"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export type NotificationEvent = "ABSENCE_ALERT" | "FEE_REMINDER" | "EXAM_RESULT_PUBLISHED" | "EMERGENCY_BROADCAST";

export interface NotificationRecipient {
  phone?: string | null;
  email?: string | null;
  userId?: string;
  name?: string;
}

export interface NotificationMessage {
  tenantId: string;
  channel: NotificationChannel;
  recipient: NotificationRecipient;
  subject?: string;
  body: string;
  event?: NotificationEvent;
  metadata?: Record<string, unknown>;
}

export interface NotificationAdapter {
  readonly channel: NotificationChannel;
  send(message: NotificationMessage): Promise<{ id?: string; accepted: boolean }>;
}

export interface NotificationTemplate {
  id: string;
  tenantId: string;
  event: NotificationEvent;
  channel: NotificationChannel;
  subject?: string;
  body: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationSettings {
  enabled: boolean;
  events: Record<NotificationEvent, boolean>;
  channels: NotificationChannel[];
  fromEmail?: string;
  fromName?: string;
  resendApiKey?: string;
  whatsappAccessToken?: string;
  whatsappPhoneNumberId?: string;
  smsApiUrl?: string;
  smsApiKey?: string;
  smsFrom?: string;
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabled: false,
  events: {
    ABSENCE_ALERT: true,
    FEE_REMINDER: true,
    EXAM_RESULT_PUBLISHED: true,
    EMERGENCY_BROADCAST: true,
  },
  channels: ["IN_APP"],
};

export const DEFAULT_NOTIFICATION_TEMPLATES: NotificationTemplate[] = [
  { id: "absence-alert", tenantId: "", event: "ABSENCE_ALERT", channel: "SMS", body: "{{studentName}} was marked absent today at {{schoolName}}.", enabled: true, createdAt: "", updatedAt: "" },
  { id: "fee-reminder", tenantId: "", event: "FEE_REMINDER", channel: "SMS", body: "Fee reminder for {{studentName}}: {{dueAmount}} is due on {{dueDate}}.", enabled: true, createdAt: "", updatedAt: "" },
  { id: "exam-result", tenantId: "", event: "EXAM_RESULT_PUBLISHED", channel: "EMAIL", subject: "Exam results published", body: "Results for {{examName}} are now available for {{studentName}}.", enabled: true, createdAt: "", updatedAt: "" },
  { id: "emergency-broadcast", tenantId: "", event: "EMERGENCY_BROADCAST", channel: "SMS", body: "Emergency notice from {{schoolName}}: {{message}}", enabled: true, createdAt: "", updatedAt: "" },
];
