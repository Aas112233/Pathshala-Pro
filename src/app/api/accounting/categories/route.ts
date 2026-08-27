import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  badRequest,
  handleApiError,
  safeParseBody,
} from "@/lib/api-response";
import { createExpenseCategorySchema } from "@/lib/schemas";
import { requireApiAccess } from "@/lib/api-auth";

const DEFAULT_EXPENSE_CATEGORIES = [
  { name: "Utilities & Electricity Bills", code: "UTILITIES", description: "Electricity, water, internet, and gas connections" },
  { name: "Building & Campus Rent", code: "BUILDING_RENT", description: "Campus lease and facility rent" },
  { name: "Campus Repair & Maintenance", code: "MAINTENANCE", description: "Plumbing, electrical repairs, painting, and civil works" },
  { name: "Stationery & Exam Paper Printing", code: "STATIONERY_PRINTING", description: "Printing registers, examination papers, and office stationery" },
  { name: "Transport Fuel & Van Maintenance", code: "TRANSPORT_FUEL", description: "Diesel, petrol, vehicle insurance, and bus repairs" },
  { name: "Science & Computer Lab Supplies", code: "LAB_SUPPLIES", description: "Chemicals, lab apparatus, and IT peripherals" },
  { name: "Events, Sports & Functions", code: "EVENTS_SPORTS", description: "Annual sports day, graduation ceremonies, and competitions" },
  { name: "Office Hospitality & Refreshments", code: "HOSPITALITY", description: "Staff tea, meetings, and guest hospitality" },
  { name: "General Miscellaneous", code: "MISCELLANEOUS", description: "Sundry institutional operational expenses" },
];

/**
 * GET /api/accounting/categories
 * Returns expense categories, auto-seeding defaults if tenant is new
 */
export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;

    let categories = await prisma.expenseCategory.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { expenses: true },
        },
      },
    });

    // Auto-seed defaults if tenant has no categories yet
    if (categories.length === 0) {
      await prisma.$transaction(
        DEFAULT_EXPENSE_CATEGORIES.map((cat) =>
          prisma.expenseCategory.create({
            data: {
              tenantId,
              name: cat.name,
              code: cat.code,
              description: cat.description,
              isActive: true,
            },
          })
        )
      );

      categories = await prisma.expenseCategory.findMany({
        where: { tenantId, isActive: true },
        orderBy: { name: "asc" },
        include: {
          _count: {
            select: { expenses: true },
          },
        },
      });
    }

    return successResponse(categories, "Expense categories retrieved successfully");
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/accounting/categories
 * Create a custom expense category
 */
export async function POST(request: NextRequest) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;

    const bodyResult = await safeParseBody(request, createExpenseCategorySchema);
    if (!bodyResult.success) return bodyResult.errorResponse;
    const data = bodyResult.data;

    // Check duplicate code
    const existing = await prisma.expenseCategory.findUnique({
      where: {
        tenantId_code: { tenantId, code: data.code },
      },
    });

    if (existing) {
      return badRequest(`Category code ${data.code} already exists.`);
    }

    const category = await prisma.expenseCategory.create({
      data: {
        tenantId,
        name: data.name,
        code: data.code,
        description: data.description,
        isActive: data.isActive ?? true,
      },
    });

    return successResponse(category, "Expense category created successfully", 201);
  } catch (error) {
    return handleApiError(error);
  }
}
