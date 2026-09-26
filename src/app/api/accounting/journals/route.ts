import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  paginatedResponse,
  badRequest,
  handleApiError,
  safeParseBody,
} from "@/lib/api-response";
import { requireApiAccess } from "@/lib/api-auth";
import { postDoubleEntryJournal, JournalSide } from "@/lib/accounting-engine";
import { MAX_PAGE_SIZE } from "@/lib/constants";
import { Prisma } from "@prisma/client";
import { z } from "zod";

const journalLineSchema = z.object({
  accountCode: z.string().min(1, "Account code is required"),
  side: z.enum(["DEBIT", "CREDIT"]),
  amount: z.number().positive("Amount must be greater than zero"),
  narration: z.string().max(500).optional(),
  studentId: z.string().optional(),
  staffId: z.string().optional(),
});

const createJournalSchema = z.object({
  voucherType: z.enum([
    "JOURNAL",
    "PAYMENT",
    "RECEIPT",
    "SALES_FEE",
    "SALARY",
    "PURCHASE",
    "CONTRA",
    "CLOSING",
  ]).default("JOURNAL"),
  postingDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional(),
  reference: z.string().max(100).optional(),
  narration: z.string().min(3, "Narration must be at least 3 characters").max(1000),
  lines: z.array(journalLineSchema).min(2, "Journal entry requires at least two lines"),
  idempotencyKey: z.string().max(100).optional(),
});

/**
 * GET /api/accounting/journals
 * List posted journal entries with filtering, pagination, line items, and period relations
 */
export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;
    const { tenantId } = access.authContext;

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(Math.max(1, parseInt(searchParams.get("limit") || "20", 10)), MAX_PAGE_SIZE);
    const voucherType = searchParams.get("voucherType");
    const postingStatus = searchParams.get("postingStatus");
    const search = searchParams.get("search");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const accountCode = searchParams.get("accountCode");

    const where: any = { tenantId };

    if (voucherType) where.voucherType = voucherType;
    if (postingStatus) where.postingStatus = postingStatus;

    if (startDate || endDate) {
      where.postingDate = {
        ...(startDate ? { gte: new Date(startDate) } : {}),
        ...(endDate ? { lte: new Date(endDate) } : {}),
      };
    }

    if (accountCode) {
      where.lineItems = {
        some: {
          account: { code: accountCode },
        },
      };
    }

    if (search) {
      where.OR = [
        { entryNumber: { contains: search, mode: "insensitive" } },
        { reference: { contains: search, mode: "insensitive" } },
        { narration: { contains: search, mode: "insensitive" } },
      ];
    }

    const [totalCount, entries] = await Promise.all([
      prisma.journalEntry.count({ where }),
      prisma.journalEntry.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { postingDate: "desc" },
        include: {
          lineItems: {
            include: {
              account: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  accountType: true,
                  normalBalance: true,
                },
              },
            },
          },
          fiscalYear: {
            select: { id: true, name: true, isClosed: true },
          },
          financialPeriod: {
            select: { id: true, name: true, isClosed: true },
          },
        },
      }),
    ]);

    return paginatedResponse(entries, {
      totalCount,
      currentPage: page,
      pageSize: limit,
      totalPages: Math.ceil(totalCount / limit),
      hasNextPage: page * limit < totalCount,
      hasPreviousPage: page > 1,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/accounting/journals
 * Create a manual or system double-entry journal entry (JV)
 */
export async function POST(request: NextRequest) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;
    const { user, tenantId } = access.authContext;

    const bodyResult = await safeParseBody(request, createJournalSchema);
    if (!bodyResult.success) return bodyResult.errorResponse;
    const data = bodyResult.data;

    const postingDate = data.postingDate ? new Date(data.postingDate) : new Date();

    const lines = data.lines.map((l) => ({
      accountCode: l.accountCode,
      side: l.side as JournalSide,
      amount: new Prisma.Decimal(l.amount),
      narration: l.narration,
      studentId: l.studentId,
      staffId: l.staffId,
    }));

    const result = await prisma.$transaction(async (tx) =>
      postDoubleEntryJournal(tx, {
        tenantId,
        voucherType: data.voucherType ?? "JOURNAL",
        reference: data.reference ?? `JV-MANUAL-${Date.now()}`,
        narration: data.narration,
        postingDate,
        createdById: user.id,
        lines,
        idempotencyKey: data.idempotencyKey,
      })
    );

    return successResponse(result, "Journal entry posted successfully", 201);
  } catch (error) {
    if (error instanceof Error && /Double-entry imbalance|requires at least|closed|configured/i.test(error.message)) {
      return badRequest(error.message);
    }
    return handleApiError(error);
  }
}
