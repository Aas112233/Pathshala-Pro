import type { NotificationAdapter, NotificationMessage } from "../types";

export class MockNotificationAdapter implements NotificationAdapter {
  constructor(public readonly channel: NotificationMessage["channel"], private readonly sink: NotificationMessage[] = []) {}
  async send(message: NotificationMessage) {
    this.sink.push(message);
    if (process.env.NODE_ENV !== "test") console.info(`[notification:${this.channel}] accepted`, { tenantId: message.tenantId, recipient: message.recipient });
    return { accepted: true, id: `mock-${Date.now()}` };
  }
  get messages() { return this.sink; }
}
