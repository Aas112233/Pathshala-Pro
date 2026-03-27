import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  errorResponse,
  unauthorized,
  badRequest,
} from "@/lib/api-response";
import { requireApiAccess } from "@/lib/api-auth";

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
      },
    });

    if (!tenant) {
      return badRequest("Tenant not found");
    }

    return successResponse(tenant, "Settings retrieved successfully");
  } catch (error) {
    console.error("Get settings error:", error);
    return errorResponse("Internal server error", 500);
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

    const tenant = await prisma.tenant.update({
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
      },
    });

    return successResponse(tenant, "Settings updated successfully");
  } catch (error) {
    console.error("Update settings error:", error);
    return errorResponse("Internal server error", 500);
  }
}
