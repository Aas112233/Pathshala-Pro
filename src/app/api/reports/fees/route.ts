import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { requireApiAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { addCurrency } from "@/lib/math-utils";
import { hasDateBounds, normalizeDateRange } from "@/lib/date-range-filter";

export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess(request, {
      permission: "fees:read",
    });
    if ("response" in access) return access.response;
    const { user } = access.authContext;

    const searchParams = request.nextUrl.searchParams;
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");
    const status = searchParams.get("status");
    const paymentMethod = searchParams.get("paymentMethod");

    // Build filters with a concrete where clause so Prisma keeps full result typing
    const whereClause: Prisma.FeeVoucherWhereInput = {
      tenantId: user.tenantId,
    };

    // normalizeDateRange keeps the end bound inclusive (T23:59:59.999Z); a bare
    // `new Date(toDate)` is UTC midnight and silently drops the final day.
    const createdAtRange = normalizeDateRange(fromDate, toDate);
    if (hasDateBounds(createdAtRange)) {
      whereClause.createdAt = createdAtRange;
    }

    if (status && status !== "all") {
      whereClause.status = status;
    }

    // The client has always sent paymentMethod and the exported PDF/Excel
    // certify "Applied Filters" including it — honour the filter instead of
    // silently exporting unfiltered totals labelled as method-scoped.
    if (paymentMethod && paymentMethod !== "all") {
      whereClause.transactions = { some: { paymentMethod, isVoided: false } };
    }

    // Fetch vouchers with related data
    const vouchers = await prisma.feeVoucher.findMany({
      where: whereClause,
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
            isVoided: true,
          },
          orderBy: { timestamp: "asc" },
        },
      },
    });

    // Sort newest first (kept out of the query so Prisma retains full include typing)
    vouchers.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Calculate metrics and transform vouchers. All money accumulates through
    // integer cents (addCurrency) — float += over hundreds of rows drifts.
    let totalCollected = 0;
    let totalPending = 0;
    let totalOverdue = 0;
    let cashCollected = 0;
    let digitalCollected = 0;

    const transformedVouchers = vouchers.map((voucher) => {
      const paidAmount = voucher.amountPaid;
      const dueAmount = voucher.balance;
      const totalAmount = voucher.totalDue;

      // Voided receipts are not money — exclude from every metric.
      const liveTransactions = voucher.transactions.filter((tx) => !tx.isVoided);

      // Calculate payment method breakdown from transactions
      liveTransactions.forEach((tx) => {
        if (tx.paymentMethod === "CASH") {
          cashCollected = addCurrency(cashCollected, Number(tx.amountPaid));
        } else {
          digitalCollected = addCurrency(digitalCollected, Number(tx.amountPaid));
        }
      });

      if (voucher.status === "PAID") {
        totalCollected = addCurrency(totalCollected, Number(paidAmount));
      } else if (voucher.status === "PENDING" || voucher.status === "UNPAID" || voucher.status === "PARTIAL") {
        totalPending = addCurrency(totalPending, Number(dueAmount));
      } else if (voucher.status === "OVERDUE") {
        totalOverdue = addCurrency(totalOverdue, Number(dueAmount));
      }

      // Get latest payment method
      const latestPayment = liveTransactions.length > 0
        ? liveTransactions[liveTransactions.length - 1].paymentMethod
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
          (vouchers.filter((v: any) => v.status === "PAID").length / vouchers.length) * 100
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
