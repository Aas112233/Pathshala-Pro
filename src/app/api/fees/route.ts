import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  paginatedResponse,
  errorResponse,
  badRequest,
  unauthorized,
  validationError,
} from "@/lib/api-response";
import { createFeeVoucherSchema, updateFeeVoucherSchema } from "@/lib/schemas";
import { getAuthContext } from "@/lib/auth";
import { MAX_PAGE_SIZE } from "@/lib/constants";

/**
 * GET /api/fees
 * Get all fee vouchers with pagination
 */
export async function GET(request: NextRequest) {
  try {
    const authContext = await getAuthContext(request);
    if (!authContext) {
      return unauthorized("Authentication required");
    }

    const { tenantId } = authContext;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), MAX_PAGE_SIZE);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const studentId = searchParams.get("studentId") || "";

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = { tenantId };

    if (search) {
      where.OR = [
        { voucherId: { contains: search, mode: "insensitive" } },
        { feeType: { contains: search, mode: "insensitive" } },
        { studentProfile: { firstName: { contains: search, mode: "insensitive" } } },
        { studentProfile: { lastName: { contains: search, mode: "insensitive" } } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (studentId) {
      where.studentProfileId = studentId;
    }

    // Get total count
    const totalCount = await prisma.feeVoucher.count({ where });

    // Get fee vouchers
    const feeVouchers = await prisma.feeVoucher.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        studentProfile: {
          select: {
            id: true,
            studentId: true,
            firstName: true,
            lastName: true,
            rollNumber: true,
          },
        },
        academicYear: {
          select: {
            yearId: true,
            label: true,
          },
        },
        _count: {
          select: { transactions: true },
        },
      },
    });

    const totalPages = Math.ceil(totalCount / limit);

    return paginatedResponse(feeVouchers, {
      totalCount,
      currentPage: page,
      pageSize: limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    });
  } catch (error) {
    console.error("Get fees error:", error);
    return errorResponse("Internal server error", 500);
  }
}

/**
 * POST /api/fees
 * Create a new fee voucher
 */
export async function POST(request: NextRequest) {
  try {
    const authContext = await getAuthContext(request);
    if (!authContext) {
      return unauthorized("Authentication required");
    }

    const { tenantId } = authContext;

    const body = await request.json();
    const validation = createFeeVoucherSchema.safeParse(body);

    if (!validation.success) {
      const errors = validation.error.errors.map((err) => ({
        field: err.path.join("."),
        code: err.code,
        message: err.message,
      }));
      return validationError(errors);
    }

    const data = validation.data;

    // Check if voucher ID already exists
    const existingVoucher = await prisma.feeVoucher.findFirst({
      where: { tenantId, voucherId: data.voucherId },
    });

    if (existingVoucher) {
      return badRequest("Fee voucher already exists", [
        { field: "voucherId", code: "duplicate", message: "Voucher ID already exists" },
      ]);
    }

    // Verify student exists
    const student = await prisma.studentProfile.findUnique({
      where: { id: data.studentProfileId, tenantId },
    });

    if (!student) {
      return badRequest("Student not found");
    }

    // Verify academic year exists
    const academicYear = await prisma.academicYear.findUnique({
      where: { id: data.academicYearId, tenantId },
    });

    if (!academicYear) {
      return badRequest("Academic year not found");
    }

    // Calculate total due
    const totalDue = data.baseAmount - data.discountAmount + data.arrears;

    // Create fee voucher
    const feeVoucher = await prisma.feeVoucher.create({
      data: {
        tenantId,
        ...data,
        totalDue,
        balance: totalDue, // Initially, balance equals total due
      },
      include: {
        studentProfile: {
          select: {
            studentId: true,
            firstName: true,
            lastName: true,
            rollNumber: true,
          },
        },
        academicYear: {
          select: {
            yearId: true,
            label: true,
          },
        },
      },
    });

    return successResponse(feeVoucher, "Fee voucher created successfully", 201);
  } catch (error) {
    console.error("Create fee voucher error:", error);
    return errorResponse("Internal server error", 500);
  }
}
