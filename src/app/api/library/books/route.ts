import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  paginatedResponse,
  badRequest,
  validationError,
  handleApiError,
} from "@/lib/api-response";
import { createBookSchema } from "@/lib/schemas";
import { requireApiAccess } from "@/lib/api-auth";
import { MAX_PAGE_SIZE } from "@/lib/constants";

export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;
    const { tenantId } = access.authContext;
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const search = searchParams.get("search")?.trim() || "";
    const category = searchParams.get("category") || "";
    const isActive = searchParams.get("isActive");

    const where: any = { tenantId };
    if (category) where.category = category;
    if (isActive !== null && isActive !== "") where.isActive = isActive === "true";
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { author: { contains: search, mode: "insensitive" } },
        { accessionNo: { contains: search, mode: "insensitive" } },
        { isbn: { contains: search, mode: "insensitive" } },
      ];
    }

    const skip = (page - 1) * limit;
    const [totalCount, data] = await Promise.all([
      prisma.book.count({ where }),
      prisma.book.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { issues: true } } },
      }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);
    return paginatedResponse(data, { totalCount, currentPage: page, pageSize: limit, totalPages, hasNextPage: page < totalPages, hasPreviousPage: page > 1 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;
    const { tenantId } = access.authContext;
    const body = await request.json();
    const parsed = createBookSchema.safeParse(body);
    if (!parsed.success) {
      const errors = parsed.error.errors.map((e) => ({ field: e.path.join("."), code: e.code, message: e.message }));
      return validationError(errors);
    }
    const d = parsed.data;

    const dupAcc = await prisma.book.findFirst({ where: { tenantId, accessionNo: d.accessionNo } });
    if (dupAcc) return badRequest("Accession number already exists", [{ field: "accessionNo", code: "duplicate", message: "Accession number already exists" }]);

    if (d.isbn) {
      const dupIsbn = await prisma.book.findFirst({ where: { tenantId, isbn: d.isbn } });
      if (dupIsbn) return badRequest("ISBN already exists", [{ field: "isbn", code: "duplicate", message: "ISBN already exists" }]);
    }

    const book = await prisma.book.create({
      data: {
        tenantId,
        title: d.title,
        author: d.author,
        isbn: d.isbn || null,
        publisher: d.publisher || null,
        category: d.category ?? "GENERAL",
        accessionNo: d.accessionNo,
        copies: d.copies ?? 1,
        availableCopies: d.copies ?? 1,
        shelfLocation: d.shelfLocation || null,
      },
    });

    return successResponse(book, "Book created", 201);
  } catch (error: any) {
    if (error?.code === "P2002") return badRequest("Duplicate book entry");
    return handleApiError(error);
  }
}
