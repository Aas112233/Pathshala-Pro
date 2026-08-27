import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, notFound, validationError, handleApiError, badRequest } from "@/lib/api-response";
import { updateBookSchema } from "@/lib/schemas";
import { requireApiAccess } from "@/lib/api-auth";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;
    const { tenantId } = access.authContext;
    const { id } = await params;
    const existing = await prisma.book.findFirst({ where: { id, tenantId } });
    if (!existing) return notFound("Book not found");

    const body = await request.json();
    const parsed = updateBookSchema.safeParse(body);
    if (!parsed.success) {
      const errors = parsed.error.errors.map((e) => ({ field: e.path.join("."), code: e.code, message: e.message }));
      return validationError(errors);
    }
    const d = parsed.data;

    if (d.accessionNo && d.accessionNo !== existing.accessionNo) {
      const dup = await prisma.book.findFirst({ where: { tenantId, accessionNo: d.accessionNo, id: { not: id } } });
      if (dup) return badRequest("Accession number already exists");
    }
    if (d.isbn && d.isbn !== existing.isbn) {
      const dup = await prisma.book.findFirst({ where: { tenantId, isbn: d.isbn, id: { not: id } } });
      if (dup) return badRequest("ISBN already exists");
    }

    // Keep availableCopies consistent if copies changed
    let availableCopiesUpdate: any = {};
    if (d.copies !== undefined && d.copies !== existing.copies) {
      const diff = d.copies - existing.copies;
      const newAvailable = Math.max(0, existing.availableCopies + diff);
      availableCopiesUpdate = { availableCopies: newAvailable };
    }

    const updated = await prisma.book.update({
      where: { id },
      data: {
        ...(d.title !== undefined && { title: d.title }),
        ...(d.author !== undefined && { author: d.author }),
        ...(d.isbn !== undefined && { isbn: d.isbn || null }),
        ...(d.publisher !== undefined && { publisher: d.publisher || null }),
        ...(d.category !== undefined && { category: d.category }),
        ...(d.accessionNo !== undefined && { accessionNo: d.accessionNo }),
        ...(d.copies !== undefined && { copies: d.copies }),
        ...availableCopiesUpdate,
        ...(d.shelfLocation !== undefined && { shelfLocation: d.shelfLocation || null }),
      },
    });

    return successResponse(updated, "Book updated");
  } catch (error: any) {
    if (error?.code === "P2002") return badRequest("Duplicate entry");
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;
    const { tenantId } = access.authContext;
    const { id } = await params;
    const existing = await prisma.book.findFirst({ where: { id, tenantId } });
    if (!existing) return notFound("Book not found");

    const activeIssues = await prisma.bookIssue.count({ where: { bookId: id, tenantId, status: "ISSUED" } });
    if (activeIssues > 0) return badRequest("Cannot delete book with active issues", [{ field: "bookId", code: "has_active_issues", message: "Return all copies before deleting" }]);

    await prisma.book.delete({ where: { id } });
    return successResponse(null, "Book deleted");
  } catch (error) {
    return handleApiError(error);
  }
}
