import type { NotificationAdapter, NotificationMessage } from "../types";

export class WhatsAppCloudAdapter implements NotificationAdapter {
  readonly channel = "WHATSAPP" as const;
  constructor(private readonly accessToken: string, private readonly phoneNumberId: string) {}
  async send(message: NotificationMessage) {
    if (!message.recipient.phone) throw new Error("WhatsApp recipient is required");
    const response = await fetch(`https://graph.facebook.com/v21.0/${this.phoneNumberId}/messages`, { method: "POST", headers: { Authorization: `Bearer ${this.accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ messaging_product: "whatsapp", to: message.recipient.phone, type: "text", text: { body: message.body } }) });
    if (!response.ok) throw new Error(`WhatsApp request failed (${response.status})`);
    const data = await response.json() as { messages?: Array<{ id?: string }> };
    return { accepted: true, id: data.messages?.[0]?.id };
  }
}
