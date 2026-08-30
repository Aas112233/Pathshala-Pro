import type { NotificationAdapter, NotificationMessage } from "../types";

export class ResendEmailAdapter implements NotificationAdapter {
  readonly channel = "EMAIL" as const;
  constructor(private readonly apiKey: string, private readonly from: string) {}
  async send(message: NotificationMessage) {
    if (!message.recipient.email) throw new Error("Email recipient is required");
    const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: this.from, to: [message.recipient.email], subject: message.subject || "School notification", text: message.body }) });
    if (!response.ok) throw new Error(`Resend request failed (${response.status})`);
    const data = await response.json() as { id?: string };
    return { accepted: true, id: data.id };
  }
}
