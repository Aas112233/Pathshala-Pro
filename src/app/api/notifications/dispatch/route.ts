import { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiAccess } from "@/lib/api-auth";
import { badRequest, handleApiError, successResponse } from "@/lib/api-response";
import { dispatchNotification, dispatchToRecipients } from "@/lib/notifications";
import { NOTIFICATION_CHANNELS } from "@/lib/notifications/types";

const schema = z.object({ tenantId: z.string().optional(), event: z.enum(["ABSENCE_ALERT", "FEE_REMINDER", "EXAM_RESULT_PUBLISHED", "EMERGENCY_BROADCAST"]).optional(), channel: z.enum(NOTIFICATION_CHANNELS), recipient: z.object({ phone: z.string().optional(), email: z.string().email().optional(), userId: z.string().optional(), name: z.string().optional() }).optional(), subject: z.string().optional(), body: z.string().min(1), variables: z.record(z.unknown()).optional(), recipients: z.array(z.object({ phone: z.string().optional(), email: z.string().email().optional(), userId: z.string().optional(), name: z.string().optional() })).optional() });

export async function POST(request: NextRequest) {
  try {
    const access = await requireApiAccess(request, { module: "settings", action: "manage" });
    if ("response" in access) return access.response;
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return badRequest("Invalid notification payload");
    const { tenantId: requestedTenant, event, channel, recipient, recipients, subject, body, variables = {} } = parsed.data;
    const tenantId = access.authContext.tenantId;
    if (requestedTenant && requestedTenant !== tenantId) return badRequest("Tenant mismatch");
    if (recipients?.length && event) { await dispatchToRecipients({ tenantId, event, recipients, variables, subject, body, channels: [channel] }); return successResponse({ accepted: recipients.length }, "Notification batch queued"); }
    if (!recipient) return badRequest("Recipient is required for direct notifications");
    return successResponse(await dispatchNotification({ tenantId, event, channel, recipient, subject, body }), "Notification queued");
  } catch (error) { return handleApiError(error); }
}
