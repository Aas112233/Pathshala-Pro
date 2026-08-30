import { describe, expect, it } from "vitest";
import { MockNotificationAdapter } from "./notifications/adapters/mock-adapter";
import { renderTemplate } from "./notifications";
import { DEFAULT_NOTIFICATION_SETTINGS, DEFAULT_NOTIFICATION_TEMPLATES } from "./notifications/types";

describe("notification engine", () => {
  it("renders merge variables and leaves missing values empty", () => {
    expect(renderTemplate("Hi {{ studentName }}, fee {{dueAmount}} on {{dueDate}} {{unknown}}", { studentName: "Amina", dueAmount: 1200, dueDate: "2026-09-01" })).toBe("Hi Amina, fee 1200 on 2026-09-01 ");
  });
  it("provides safe defaults for tenant notification configuration", () => {
    expect(DEFAULT_NOTIFICATION_SETTINGS.enabled).toBe(false);
    expect(DEFAULT_NOTIFICATION_SETTINGS.channels).toContain("IN_APP");
    expect(DEFAULT_NOTIFICATION_TEMPLATES.map((template) => template.event)).toEqual(expect.arrayContaining(["ABSENCE_ALERT", "FEE_REMINDER", "EXAM_RESULT_PUBLISHED", "EMERGENCY_BROADCAST"]));
  });
  it("accepts messages through the local mock adapter", async () => {
    const adapter = new MockNotificationAdapter("SMS");
    const result = await adapter.send({ tenantId: "tenant-a", channel: "SMS", recipient: { phone: "+8801000000000" }, body: "Absent", event: "ABSENCE_ALERT" });
    expect(result.accepted).toBe(true);
    expect(adapter.messages[0].tenantId).toBe("tenant-a");
  });
});
