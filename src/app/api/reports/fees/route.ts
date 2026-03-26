import { NextRequest } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getAuthContext } from "@/lib/auth";
import { forbidden } from "next/navigation";

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const authContext = await getAuthContext(request);
    if (!authContext) {
      return forbidden();
    }

    const { user } = authContext;

    const searchParams = request.nextUrl.searchParams;
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");
    const status = searchParams.get("status");

    // Build date filter
    const dateFilter: any = {};
    if (fromDate) {
      dateFilter.gte = new Date(fromDate);
    }
    if (toDate) {
      dateFilter.lte = new Date(toDate);
    }

    // Build status filter
    const statusFilter: any = {};
    if (status && status !== "all") {
      statusFilter.status = status;
    }

    // Fetch vouchers with related data
    const vouchers = await prisma.feeVoucher.findMany({
      where: {
        tenantId: user.tenantId,
        ...(Object.keys(dateFilter).length > 0 && {
          createdAt: dateFilter,
        }),
        ...(Object.keys(statusFilter).length > 0 && statusFilter),
      },
      include: {
        studentProfile: {
          select: {
            firstName: true,
            lastName: true,
            rollNumber: true,
            class: {
              select: {
                name: true,
              },
            },
            section: {
              select: {
                name: true,
              },
            },
          },
        },
        transactions: {
          select: {
            amountPaid: true,
            paymentMethod: true,
            timestamp: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Calculate metrics and transform vouchers
    let totalCollected = 0;
    let totalPending = 0;
    let totalOverdue = 0;
    let cashCollected = 0;
    let digitalCollected = 0;

    const transformedVouchers = vouchers.map((voucher) => {
      const paidAmount = voucher.amountPaid;
      const dueAmount = voucher.balance;
      const totalAmount = voucher.totalDue;

      // Calculate payment method breakdown from transactions
      voucher.transactions.forEach((tx) => {
        if (tx.paymentMethod === "CASH") {
          cashCollected += tx.amountPaid;
        } else if (tx.paymentMethod === "DIGITAL") {
          digitalCollected += tx.amountPaid;
        }
      });

      if (voucher.status === "PAID") {
        totalCollected += paidAmount;
      } else if (voucher.status === "PENDING" || voucher.status === "PARTIAL") {
        totalPending += dueAmount;
      } else if (voucher.status === "OVERDUE") {
        totalOverdue += dueAmount;
      }

      // Get latest payment method
      const latestPayment = voucher.transactions.length > 0 
        ? voucher.transactions[voucher.transactions.length - 1].paymentMethod 
        : "CASH";

      return {
        id: voucher.id,
        voucherNumber: voucher.voucherId,
        studentName: `${voucher.studentProfile.firstName} ${voucher.studentProfile.lastName}`,
        className: voucher.studentProfile.class?.name || "N/A",
        section: voucher.studentProfile.section?.name || "N/A",
        amount: totalAmount,
        paidAmount: paidAmount,
        dueAmount: dueAmount,
        status: voucher.status as "PENDING" | "PAID" | "PARTIAL" | "OVERDUE",
        paymentMethod: latestPayment as "CASH" | "DIGITAL",
        date: voucher.createdAt.toISOString().split("T")[0],
      };
    });

    const collectionRate =
      vouchers.length > 0
        ? Math.round(
            (vouchers.filter((v) => v.status === "PAID").length / vouchers.length) * 100
          )
        : 0;

    return Response.json({
      success: true,
      data: {
        metrics: {
          totalCollected,
          totalPending,
          totalOverdue,
          collectionRate,
          cashCollected,
          digitalCollected,
          totalVouchers: vouchers.length,
        },
        vouchers: transformedVouchers,
      },
    });
  } catch (error) {
    console.error("Fee report error:", error);
    return Response.json(
      {
        success: false,
        message: "Failed to generate fee report",
      },
      { status: 500 }
    );
  }
}
