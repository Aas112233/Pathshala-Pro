import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { evaluateSubscriptionExpiry, SUBSCRIPTION_TX_OPTIONS } from "@/lib/subscription-service";

/**
 * GET /api/system-admin/subscriptions/run-expiry
 *
 * Auto-expiry engine. Evaluates every active/grace subscription and transitions
 * tenants past their grace window to INACTIVE (mirrored as EXPIRED on Tenant).
 *
 * Intended to be triggered by a Vercel cron (see vercel.json). Guarded by a
 * shared CRON_SECRET header so only the scheduler (or an authorized admin) can
 * invoke it. Non-destructive and idempotent.
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization") || "";
    const cronSecret = process.env.CRON_SECRET;
    const passed = authHeader === `Bearer ${cronSecret}`;

    // A valid CRON_SECRET is required; in non-production it may be unset so the
    // route degrades safely (returns 403) rather than exposing tenant data.
    if (!cronSecret || !passed) {
      return NextResponse.json(
        { error: true, message: "Unauthorized: missing or invalid cron secret" },
        { status: 403 }
      );
    }

    const result = await prisma.$transaction(
      (tx) => evaluateSubscriptionExpiry(tx as any),
      SUBSCRIPTION_TX_OPTIONS
    );

    return NextResponse.json({
      success: true,
      scanned: result.scanned,
      expired: result.expired,
      graceNotified: result.graceNotified,
    });
  } catch (error) {
    return handleApiError(error, "Subscription expiry evaluation failed");
  }
}
