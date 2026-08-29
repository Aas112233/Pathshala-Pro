import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  badRequest,
  handleApiError,
  safeParseBody,
} from "@/lib/api-response";
import { requireApiAccess } from "@/lib/api-auth";
import { z } from "zod";
import { paymentMethodSchema } from "@/lib/schemas";
import {
  postLegacyFeeInvoiceAccrual,
  postLegacyFeePaymentJournal,
} from "@/lib/fee-service";

const directFeeCollectionSchema = z.object({
  studentProfileId: z.string().min(1, "Student ID is required"),
  amountPaid: z.number().positive("Payment amount must be greater than 0"),
  paymentMethod: paymentMethodSchema.default("CASH"),
  receiptNumber: z.string().optional(),
  note: z.string().optional(),
  academicYearId: z.string().optional(),
  feeVoucherId: z.string().optional(),
});

/**
 * POST /api/fees/collect-direct
 * 12-Month Annual Academic Year Direct Fee Collection.
 * Tracks 12-month annual tuition ledger, records payments, decrements balance, and generates instant receipt.
 */
export async function POST(request: NextRequest) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { user, tenantId } = access.authContext;

    const bodyResult = await safeParseBody(request, directFeeCollectionSchema);
    if (!bodyResult.success) return bodyResult.errorResponse;
    const data = bodyResult.data;

    // Fetch Student Profile
    const student = await prisma.studentProfile.findUnique({
      where: { id: data.studentProfileId, tenantId },
      include: { class: true, section: true },
    });

    if (!student) {
      return badRequest("Student profile not found");
    }

    // Resolve Academic Year
    let academicYearId = data.academicYearId;
    if (!academicYearId) {
      const activeAy = await prisma.academicYear.findFirst({
        where: { tenantId, isClosed: false },
        orderBy: { createdAt: "desc" },
      });
      academicYearId = activeAy?.id;
    }
    if (!academicYearId) {
      const anyAy = await prisma.academicYear.findFirst({
        where: { tenantId },
      });
      academicYearId = anyAy?.id;
    }
    if (!academicYearId) {
      return badRequest("No active academic year found in the system.");
    }

    // Check if an existing Annual Fee Voucher exists for this student & academic year
    const targetVoucher = data.feeVoucherId
      ? await prisma.feeVoucher.findUnique({
          where: { id: data.feeVoucherId, tenantId },
        })
      : await prisma.feeVoucher.findFirst({
          where: {
            tenantId,
            studentProfileId: student.id,
            academicYearId: academicYearId!,
          },
          orderBy: { createdAt: "desc" },
        });

    const receiptNumber =
      data.receiptNumber || `REC-${Date.now().toString().slice(-6)}`;
    const transactionId = `TXN-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // 1. If voucher exists, accumulate payment
    if (targetVoucher) {
      const newAmountPaid = (targetVoucher.amountPaid || 0) + data.amountPaid;
      const newBalance = Math.max(0, targetVoucher.totalDue - newAmountPaid);
      const newStatus = newBalance === 0 ? "PAID" : "PARTIAL";

      const appliedToInvoice = Math.min(
        data.amountPaid,
        Math.max(0, targetVoucher.totalDue - (targetVoucher.amountPaid || 0))
      );
      const excessToWallet = data.amountPaid - appliedToInvoice;
      const [transaction, updatedVoucher] = await prisma.$transaction(async (tx) => {
        const transaction = await tx.transaction.create({
          data: {
            tenantId,
            transactionId,
            feeVoucherId: targetVoucher.id,
            amountPaid: data.amountPaid,
            paymentMethod: data.paymentMethod || "CASH",
            receiptNumber,
            collectedById: user.id,
            note:
              data.note ||
              `Annual Fee Payment (${data.paymentMethod || "CASH"}) - Total Paid: ${newAmountPaid}/${targetVoucher.totalDue}`,
          },
          include: {
            feeVoucher: {
              select: {
                voucherId: true,
                feeType: true,
                studentProfile: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    studentId: true,
                    rollNumber: true,
                    class: { select: { name: true } },
                    section: { select: { name: true } },
                  },
                },
              },
            },
          },
        });
        const updatedVoucher = await tx.feeVoucher.update({
          where: { id: targetVoucher.id },
          data: { amountPaid: newAmountPaid, balance: newBalance, status: newStatus },
        });
        await postLegacyFeePaymentJournal(tx, {
          tenantId,
          studentProfileId: student.id,
          feeVoucherId: targetVoucher.id,
          amount: data.amountPaid,
          appliedToInvoice,
          excessToWallet,
          paymentMethod: data.paymentMethod || "CASH",
          receiptNumber,
          executedById: user.id,
          note: data.note,
        });
        return [transaction, updatedVoucher] as const;
      });

      return successResponse(
        { transaction, voucher: updatedVoucher },
        "Fee payment collected successfully",
        201
      );
    }

    // 2. No voucher yet: Initialize 12-Month Annual Fee Voucher for the Student
    let monthlyBaseFee = data.amountPaid;
    if (student.classId) {
      const classStructure = await prisma.classFeeStructure.findFirst({
        where: {
          tenantId,
          classId: student.classId,
          academicYearId,
          isActive: true,
        },
      });
      if (classStructure) {
        monthlyBaseFee =
          classStructure.totalMonthlyFee ||
          classStructure.tuitionFee ||
          data.amountPaid;
      }
    }

    // Check Concession
    let monthlyDiscount = 0;
    const concession = await prisma.studentFeeConcession.findFirst({
      where: {
        tenantId,
        studentProfileId: student.id,
        isActive: true,
      },
    });

    if (concession) {
      if (concession.discountType === "PERCENTAGE") {
        monthlyDiscount =
          Math.round(((monthlyBaseFee * concession.discountValue) / 100) * 100) /
          100;
      } else {
        monthlyDiscount = Math.min(concession.discountValue, monthlyBaseFee);
      }
    }

    // 12 Months Annual Calculation
    const annualBase = monthlyBaseFee * 12;
    const annualDiscount = monthlyDiscount * 12;
    const netAnnualDue = Math.max(0, annualBase - annualDiscount);
    const totalDue = netAnnualDue;
    const balance = Math.max(0, totalDue - data.amountPaid);
    const status = balance === 0 ? "PAID" : "PARTIAL";

    const currentYear = new Date().getFullYear();
    const voucherId = `VCH-${currentYear}-${Date.now().toString().slice(-6)}`;

    const [newVoucher, transaction] = await prisma.$transaction(async (tx) => {
      const v = await tx.feeVoucher.create({
        data: {
          tenantId,
          voucherId,
          studentProfileId: student.id,
          academicYearId: academicYearId!,
          feeType: "Annual Tuition (12 Months)",
          baseAmount: annualBase,
          discountAmount: annualDiscount,
          arrears: 0,
          totalDue,
          amountPaid: data.amountPaid,
          balance,
          dueDate: new Date(Date.now() + 30 * 86400000),
          status,
        },
      });

      await postLegacyFeeInvoiceAccrual(tx, {
        tenantId,
        studentProfileId: student.id,
        feeHeadCode: "TUITION",
        amount: annualBase,
        discountAmount: annualDiscount,
        executedById: user.id,
        reference: voucherId,
      });
      const t = await tx.transaction.create({
        data: {
          tenantId,
          transactionId,
          feeVoucherId: v.id,
          amountPaid: data.amountPaid,
          paymentMethod: data.paymentMethod || "CASH",
          receiptNumber,
          collectedById: user.id,
          note:
            data.note ||
            `Counter Collection (${data.paymentMethod || "CASH"}) - 12 Months Annual Ledger`,
        },
        include: {
          feeVoucher: {
            select: {
              voucherId: true,
              feeType: true,
              studentProfile: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  studentId: true,
                  rollNumber: true,
                  class: { select: { name: true } },
                  section: { select: { name: true } },
                },
              },
            },
          },
        },
      });

      const appliedToInvoice = Math.min(data.amountPaid, totalDue);
      await postLegacyFeePaymentJournal(tx, {
        tenantId,
        studentProfileId: student.id,
        feeVoucherId: v.id,
        amount: data.amountPaid,
        appliedToInvoice,
        excessToWallet: data.amountPaid - appliedToInvoice,
        paymentMethod: data.paymentMethod || "CASH",
        receiptNumber,
        executedById: user.id,
        note: data.note,
      });

      return [v, t];
    });

    return successResponse(
      { transaction, voucher: newVoucher },
      "Fee payment collected successfully",
      201
    );
  } catch (error) {
    return handleApiError(error);
  }
}
