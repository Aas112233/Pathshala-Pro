import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  paginatedResponse,
  badRequest,
  validationError,
  handleApiError,
} from "@/lib/api-response";
import { createBookIssueSchema } from "@/lib/schemas";
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
    const status = searchParams.get("status") || "";
    const bookId = searchParams.get("bookId") || "";

    const where: any = { tenantId };
    if (status) where.status = status;
    if (bookId) where.bookId = bookId;
    if (search) {
      where.OR = [
        { borrowerName: { contains: search, mode: "insensitive" } },
        { borrowerIdNo: { contains: search, mode: "insensitive" } },
        { book: { title: { contains: search, mode: "insensitive" } } },
      ];
    }

    const skip = (page - 1) * limit;
    const [totalCount, data] = await Promise.all([
      prisma.bookIssue.count({ where }),
      prisma.bookIssue.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          book: { select: { id: true, title: true, author: true, accessionNo: true } },
          studentProfile: { select: { id: true, firstName: true, lastName: true } },
          staffProfile: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
    ]);

    // Mark overdue inline (dueDate < now and still ISSUED)
    const now = new Date();
    const withOverdue = data.map((r: any) => ({
      ...r,
      computedStatus: r.status === "ISSUED" && new Date(r.dueDate) < now ? "OVERDUE" : r.status,
    }));

    const totalPages = Math.ceil(totalCount / limit);
    return paginatedResponse(withOverdue, {
      totalCount,
      currentPage: page,
      pageSize: limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;
    const { tenantId, user } = access.authContext as any;
    const body = await request.json();
    const parsed = createBookIssueSchema.safeParse(body);
    if (!parsed.success) {
      const errors = parsed.error.errors.map((e) => ({ field: e.path.join("."), code: e.code, message: e.message }));
      return validationError(errors);
    }
    const d = parsed.data;

    const book = await prisma.book.findFirst({ where: { id: d.bookId, tenantId } });
    if (!book) return badRequest("Book not found");
    if (book.availableCopies <= 0) return badRequest("No copies available", [{ field: "bookId", code: "out_of_stock", message: "No copies available" }]);

    // Prevent duplicate active issue for same borrower + same book
    const dupWhere: any = { tenantId, bookId: d.bookId, status: "ISSUED" };
    if (d.borrowerType === "STUDENT" && d.studentProfileId) dupWhere.studentProfileId = d.studentProfileId;
    else if (d.borrowerType === "STAFF" && d.staffProfileId) dupWhere.staffProfileId = d.staffProfileId;
    else dupWhere.borrowerIdNo = d.borrowerIdNo;

    const dup = await prisma.bookIssue.findFirst({ where: dupWhere });
    if (dup) return badRequest("Borrower already has this book issued", [{ field: "bookId", code: "already_issued", message: "Already issued to this borrower" }]);

    const dueDate = new Date(d.dueDate);

    const [issue] = await prisma.$transaction([
      prisma.bookIssue.create({
        data: {
          tenantId,
          bookId: d.bookId,
          borrowerType: d.borrowerType ?? "STUDENT",
          studentProfileId: d.studentProfileId || null,
          staffProfileId: d.staffProfileId || null,
          borrowerName: d.borrowerName,
          borrowerIdNo: d.borrowerIdNo,
          dueDate,
          status: "ISSUED",
          issuedById: user.id,
        },
        include: { book: { select: { title: true } } },
      }),
      prisma.book.update({ where: { id: d.bookId }, data: { availableCopies: { decrement: 1 } } }),
    ]);

    return successResponse(issue, "Book issued", 201);
  } catch (error: any) {
    if (error?.code === "P2002") return badRequest("Duplicate issue");
    return handleApiError(error);
  }
}
