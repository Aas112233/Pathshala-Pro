import type { NotificationAdapter, NotificationMessage } from "../types";

export class SmsAdapter implements NotificationAdapter {
  readonly channel = "SMS" as const;
  constructor(private readonly apiUrl: string, private readonly apiKey: string, private readonly from?: string) {}
  async send(message: NotificationMessage) {
    if (!message.recipient.phone) throw new Error("SMS recipient is required");
    const response = await fetch(this.apiUrl, { method: "POST", headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ to: message.recipient.phone, from: this.from, body: message.body, message: message.body }) });
    if (!response.ok) throw new Error(`SMS request failed (${response.status})`);
    const data = await response.json().catch(() => ({})) as { id?: string; sid?: string };
    return { accepted: true, id: data.id || data.sid };
  }
}
