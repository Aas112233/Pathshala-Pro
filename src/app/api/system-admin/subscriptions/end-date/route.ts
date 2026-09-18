import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  unauthorized,
  badRequest,
  handleApiError,
} from "@/lib/api-response";
import { requireApiAccess } from "@/lib/api-auth";
import { isPlatformOwnerEmail } from "@/lib/platform-owner";
import { setSubscriptionEndDateTime, SUBSCRIPTION_TX_OPTIONS } from "@/lib/subscription-service";
import { isValidDateInput } from "@/lib/date-validation";

/**
 * Accept a native `<input type="datetime-local">` value (YYYY-MM-DDTHH:mm[:ss],
 * no timezone) as well as timezone-qualified ISO strings. Validates the
 * calendar/time components so impossible dates (e.g. Feb 30) are rejected even
 * though `new Date()` would silently roll them over.
 */
function isValidSubscriptionEndInput(value: string): boolean {
  const local = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!local) return isValidDateInput(value);

  const year = Number(local[1]);
  const month = Number(local[2]);
  const day = Number(local[3]);
  const hour = Number(local[4]);
  const minute = Number(local[5]);
  const second = Number(local[6] || 0);

  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth[month - 1]) return false;
  if (hour > 23 || minute > 59 || second > 59) return false;
  return Number.isFinite(new Date(value).getTime());
}

/**
 * POST /api/system-admin/subscriptions/end-date
 *
 * System-admin override of a tenant's subscription end date-time.
 * Delegates to the subscription lifecycle engine (setSubscriptionEndDateTime)
 * so the grace window, denormalized Tenant status mirror, change log, super
 * admin audit trail, and tenant notification all stay consistent.
 */
export async function POST(request: NextRequest) {
  try {
    const access = await requireApiAccess(request, {
      allowSystemAdmin: true,
    });
    if ("response" in access) return access.response;

    const { user } = access.authContext;
    if (user.role !== "SYSTEM_ADMIN" && !isPlatformOwnerEmail(user.email) && !access.authContext.isImpersonated) {
      return unauthorized("Only platform system administrators can modify subscription end dates.");
    }

    const body = await request.json();
    const { tenantId, subscriptionEndAt, gracePeriodDays } = body;

    if (!tenantId || typeof tenantId !== "string") {
      return badRequest("tenantId is required");
    }
    if (!subscriptionEndAt || typeof subscriptionEndAt !== "string" || !isValidSubscriptionEndInput(subscriptionEndAt)) {
      return badRequest("subscriptionEndAt must be a valid date-time (YYYY-MM-DDTHH:mm or ISO)");
    }
    if (gracePeriodDays !== undefined && (typeof gracePeriodDays !== "number" || !Number.isInteger(gracePeriodDays) || gracePeriodDays < 0 || gracePeriodDays > 3650)) {
      return badRequest("gracePeriodDays must be an integer between 0 and 3650");
    }

    const subscription = await prisma.$transaction(
      (tx) =>
        setSubscriptionEndDateTime(tx as any, {
          tenantId,
          subscriptionEndAt: new Date(subscriptionEndAt),
          ...(gracePeriodDays !== undefined ? { gracePeriodDays } : {}),
          changedById: user.id,
          changedByEmail: user.email,
        }),
      SUBSCRIPTION_TX_OPTIONS
    );

    return successResponse(subscription, "Subscription end date updated.");
  } catch (error) {
    return handleApiError(error, "Failed to update subscription end date");
  }
}
