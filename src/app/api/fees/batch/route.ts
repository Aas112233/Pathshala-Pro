import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  badRequest,
  handleApiError,
  safeParseBody,
} from "@/lib/api-response";
import { batchFeeInvoicingSchema } from "@/lib/schemas";
import { requireApiAccess } from "@/lib/api-auth";

/**
 * POST /api/fees/batch
 * Generate batch fee invoices across entire classes or schools
 * with automated arrears rollover and sequential voucher IDs.
 */
export async function POST(request: NextRequest) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;

    const bodyResult = await safeParseBody(request, batchFeeInvoicingSchema);
    if (!bodyResult.success) return bodyResult.errorResponse;
    const data = bodyResult.data;

    // Verify Academic Year exists
    const academicYear = await prisma.academicYear.findUnique({
      where: { id: data.academicYearId, tenantId },
    });

    if (!academicYear) {
      return badRequest("Selected Academic Year was not found.");
    }

    // Build target student query filter
    const studentWhere: any = {
      tenantId,
      status: "ACTIVE",
    };

    if (data.target === "CLASS" && data.classId) {
      studentWhere.classId = data.classId;
    } else if (data.target === "SECTION" && data.sectionId) {
      studentWhere.sectionId = data.sectionId;
    }

    const students = await prisma.studentProfile.findMany({
      where: studentWhere,
      select: {
        id: true,
        studentId: true,
        rollNumber: true,
        firstName: true,
        lastName: true,
        classId: true,
        sectionId: true,
      },
    });

    if (students.length === 0) {
      return badRequest("No active students found matching the selected target criteria.");
    }

    // Fetch class fee structures for this academic year if using structure
    const feeStructures = await prisma.classFeeStructure.findMany({
      where: {
        tenantId,
        academicYearId: data.academicYearId,
        isActive: true,
      },
    });
    const structureMap = new Map(feeStructures.map((s) => [s.classId, s]));

    // Fetch student concessions for all matching students
    const studentIds = students.map((s) => s.id);
    const concessions = await prisma.studentFeeConcession.findMany({
      where: {
        tenantId,
        studentProfileId: { in: studentIds },
        isActive: true,
      },
    });
    const concessionMap = new Map(concessions.map((c) => [c.studentProfileId, c]));

    // Find starting sequence number for this year's vouchers
    const currentYear = data.year || new Date().getFullYear();
    const latestVoucher = await prisma.feeVoucher.findFirst({
      where: {
        tenantId,
        voucherId: { startsWith: `VCH-${currentYear}-` },
      },
      orderBy: { createdAt: "desc" },
    });

    let nextSequence = 1;
    if (latestVoucher) {
      const parts = latestVoucher.voucherId.split("-");
      const lastNum = parseInt(parts[2], 10);
      if (!isNaN(lastNum)) {
        nextSequence = lastNum + 1;
      }
    }

    const dueDate = new Date(data.dueDate);

    // Calculate vouchers payload
    let totalGeneratedDue = 0;
    let totalArrearsRolled = 0;
    let totalConcessionsApplied = 0;
    const vouchersToCreate: any[] = [];

    for (const student of students) {
      let arrears = 0;

      if (data.carryForwardArrears) {
        // Sum any unpaid balances from prior pending or partial vouchers
        const unpaidVouchers = await prisma.feeVoucher.findMany({
          where: {
            tenantId,
            studentProfileId: student.id,
            status: { in: ["PENDING", "PARTIAL", "OVERDUE"] },
          },
          select: { balance: true },
        });

        arrears = unpaidVouchers.reduce((acc, v) => acc + (v.balance || 0), 0);
        totalArrearsRolled += arrears;
      }

      // Determine base fee from class structure or fallback
      let baseAmount = data.baseAmount || 0;
      if (data.useClassFeeStructure !== false && student.classId && structureMap.has(student.classId)) {
        const struct = structureMap.get(student.classId)!;
        baseAmount = struct.totalMonthlyFee || struct.tuitionFee || data.baseAmount || 0;
      }

      // Determine concession/discount
      let discountAmount = 0;
      if (concessionMap.has(student.id)) {
        const conc = concessionMap.get(student.id)!;
        if (conc.discountType === "PERCENTAGE") {
          discountAmount = Math.round(((baseAmount * conc.discountValue) / 100) * 100) / 100;
        } else {
          discountAmount = Math.min(conc.discountValue, baseAmount);
        }
      }
      totalConcessionsApplied += discountAmount;

      const netBase = Math.max(0, baseAmount - discountAmount);
      const totalDue = netBase + arrears;
      totalGeneratedDue += totalDue;

      const voucherId = `VCH-${currentYear}-${nextSequence.toString().padStart(5, "0")}`;
      nextSequence++;

      vouchersToCreate.push({
        tenantId,
        voucherId,
        studentProfileId: student.id,
        academicYearId: data.academicYearId,
        feeType: data.feeType,
        baseAmount,
        discountAmount,
        arrears,
        totalDue,
        amountPaid: 0,
        balance: totalDue,
        dueDate,
        status: "PENDING",
      });
    }

    // Batch creation in atomic transaction
    await prisma.$transaction(
      vouchersToCreate.map((voucherData) =>
        prisma.feeVoucher.create({
          data: voucherData,
        })
      )
    );

    return successResponse(
      {
        totalVouchersCreated: vouchersToCreate.length,
        totalInvoiceAmount: totalGeneratedDue,
        totalArrearsIncluded: totalArrearsRolled,
        totalConcessionsApplied,
        dueDate: data.dueDate,
        target: data.target,
      },
      `Successfully generated ${vouchersToCreate.length} individualized fee vouchers!`,
      201
    );
  } catch (error) {
    return handleApiError(error, "Failed to generate batch fee invoices");
  }
}
