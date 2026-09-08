import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  errorResponse,
  unauthorized,
  badRequest,
  handleApiError,
} from "@/lib/api-response";
import { requireApiAccess } from "@/lib/api-auth";
import { DEFAULT_PAYMENT_METHODS } from "@/lib/tenant-settings";
import { z } from "zod";

/**
 * Custom payment methods are load-bearing for the general ledger:
 * fee-service resolves the deposit account via `find(m => m.code ===
 * paymentMethod)?.accountCode`, and the first match wins. A duplicate or
 * colliding code silently posts tenant B's payments to tenant A's bank
 * account, so the whole array is validated server-side — the client's
 * auto-generated code is not a trust boundary.
 */
const paymentMethodEntrySchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(100),
  code: z.string().regex(/^[A-Z0-9_]{1,30}$/, "code must be uppercase letters, digits or _ (max 30)"),
  type: z.enum(["CASH", "BANK", "DIGITAL", "CHEQUE", "OTHER"]),
  accountCode: z.string().regex(/^\d{1,6}$/, "accountCode must be a numeric account code").optional(),
  isActive: z.boolean(),
  isDefault: z.boolean().optional(),
  instructions: z.string().max(300).optional(),
});
const paymentMethodsSchema = z
  .array(paymentMethodEntrySchema)
  .max(50, "Too many payment methods")
  .superRefine((methods, ctx) => {
    const ids = new Set<string>();
    const codes = new Set<string>();
    for (const m of methods) {
      if (ids.has(m.id)) {
        ctx.addIssue({ code: "custom", message: `Duplicate payment method id: ${m.id}`, path: ["id"] });
      }
      if (codes.has(m.code)) {
        // Duplicate codes break GL routing (first match wins) — reject.
        ctx.addIssue({ code: "custom", message: `Duplicate payment method code: ${m.code}`, path: ["code"] });
      }
      ids.add(m.id);
      codes.add(m.code);
    }
    if (methods.filter((m) => m.isDefault).length > 1) {
      ctx.addIssue({ code: "custom", message: "At most one payment method can be the default", path: ["isDefault"] });
    }
  });

/**
 * GET /api/settings
 * Get current tenant settings
 */
export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;

    const tenant = await prisma.tenant.findUnique({
      where: { tenantId },
      select: {
        id: true,
        tenantId: true,
        name: true,
        address: true,
        phone: true,
        email: true,
        logoUrl: true,
        schoolCode: true,
        establishedYear: true,
        motto: true,
        website: true,
        currency: true,
        currencySymbol: true,
        taxRate: true,
        dateFormat: true,
        timeFormat: true,
        timezone: true,
        firstDayOfWeek: true,
        academicYearStart: true,
        gradingSystem: true,
        featureFlags: true,
      },
    });

    if (!tenant) {
      return badRequest("Tenant not found");
    }

    const flags = (tenant.featureFlags as any) || {};
    const paymentMethods = Array.isArray(flags.paymentMethods)
      ? flags.paymentMethods
      : DEFAULT_PAYMENT_METHODS;

    const { featureFlags, ...tenantWithoutFlags } = tenant;

    return successResponse(
      {
        ...tenantWithoutFlags,
        paymentMethods,
      },
      "Settings retrieved successfully"
    );
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PUT /api/settings
 * Update tenant settings
 */
export async function PUT(request: NextRequest) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;
    const body = await request.json();

    const updateData: any = {};

    // School Profile
    if (body.name !== undefined) updateData.name = body.name;
    if (body.address !== undefined) updateData.address = body.address;
    if (body.phone !== undefined) updateData.phone = body.phone;
    if (body.email !== undefined) updateData.email = body.email;
    if (body.logoUrl !== undefined) updateData.logoUrl = body.logoUrl;
    if (body.schoolCode !== undefined) updateData.schoolCode = body.schoolCode;
    if (body.establishedYear !== undefined) updateData.establishedYear = body.establishedYear;
    if (body.motto !== undefined) updateData.motto = body.motto;
    if (body.website !== undefined) updateData.website = body.website;

    // Financial Settings
    if (body.currency !== undefined) updateData.currency = body.currency;
    if (body.currencySymbol !== undefined) updateData.currencySymbol = body.currencySymbol;
    if (body.taxRate !== undefined) updateData.taxRate = body.taxRate;

    // Date & Time Settings
    if (body.dateFormat !== undefined) updateData.dateFormat = body.dateFormat;
    if (body.timeFormat !== undefined) updateData.timeFormat = body.timeFormat;
    if (body.timezone !== undefined) updateData.timezone = body.timezone;
    if (body.firstDayOfWeek !== undefined) updateData.firstDayOfWeek = body.firstDayOfWeek;

    // Academic Settings
    if (body.academicYearStart !== undefined) updateData.academicYearStart = body.academicYearStart;
    if (body.gradingSystem !== undefined) updateData.gradingSystem = body.gradingSystem;

    // Payment Methods — validated, then merged under a row lock. featureFlags
    // is a shared JSON column also written by the system-admin flags route and
    // the notification settings; without a transaction this read-merge-write
    // loses the other writer's keys wholesale.
    let validatedPaymentMethods: z.infer<typeof paymentMethodsSchema> | null = null;
    if (body.paymentMethods !== undefined) {
      const parsed = paymentMethodsSchema.safeParse(body.paymentMethods);
      if (!parsed.success) {
        return badRequest(
          parsed.error.issues.map((i) => i.message).join("; ") || "Invalid payment methods",
        );
      }
      validatedPaymentMethods = parsed.data;
    }

    const tenant = await prisma.$transaction(async (tx) => {
      if (validatedPaymentMethods) {
        await tx.$queryRaw`SELECT "id" FROM "Tenant" WHERE "tenantId" = ${tenantId} FOR UPDATE`;
        const fresh = await tx.tenant.findUnique({
          where: { tenantId },
          select: { featureFlags: true },
        });
        const currentFlags = (fresh?.featureFlags as any) || {};
        updateData.featureFlags = {
          ...currentFlags,
          paymentMethods: validatedPaymentMethods,
        };
      }

      return tx.tenant.update({
        where: { tenantId },
        data: updateData,
        select: {
          id: true,
          tenantId: true,
          name: true,
          address: true,
          phone: true,
          email: true,
          logoUrl: true,
          schoolCode: true,
          establishedYear: true,
          motto: true,
          website: true,
          currency: true,
          currencySymbol: true,
          taxRate: true,
          dateFormat: true,
          timeFormat: true,
          timezone: true,
          firstDayOfWeek: true,
          academicYearStart: true,
          gradingSystem: true,
          featureFlags: true,
        },
      });
    });

    const flags = (tenant.featureFlags as any) || {};
    const paymentMethods = Array.isArray(flags.paymentMethods)
      ? flags.paymentMethods
      : DEFAULT_PAYMENT_METHODS;
    const { featureFlags, ...tenantWithoutFlags } = tenant;

    return successResponse(
      {
        ...tenantWithoutFlags,
        paymentMethods,
      },
      "Settings updated successfully"
    );
  } catch (error) {
    return handleApiError(error);
  }
}
