import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, notFound, handleApiError } from "@/lib/api-response";
import { requireApiAccess } from "@/lib/api-auth";
import {
  buildRolloverVerification,
  type RolloverVerificationInput,
} from "@/lib/rollover-verification";
import { readWorkingDayPolicy } from "@/lib/working-days";

/**
 * GET /api/academic-years/[id]/rollover-verification
 *
 * Roadmap item 25 — the post-rollover verification checklist.
 *
 * Read-only, because a checklist that can be "completed" is a checklist that
 * can be completed without being read. The operator walks it; nothing here
 * flips a flag to say they did.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;
    const { tenantId } = access.authContext;
    const { id } = await params;

    const year = await prisma.academicYear.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        label: true,
        isClosed: true,
        nonWorkingWeekdays: true,
        feeBalancePolicy: true,
        isCurrent: true,
      },
    });
    if (!year) return notFound("Academic year not found");

    const [
      mostRecentRollover,
      rules,
      feeStructures,
      timetableSlots,
      timetableNeedingReview,
      enrolledStudents,
    ] = await Promise.all([
      prisma.academicYearRollover.findFirst({
        where: { tenantId, targetAcademicYearId: id },
        orderBy: { performedAt: "desc" },
        select: {
          mode: true,
          copyPromotionRules: true,
          copyFeeStructures: true,
          copyTimetables: true,
          feeBalancePolicy: true,
          workingDayPolicyCarried: true,
        },
      }),
      prisma.promotionRule.groupBy({
        by: ["isActive"],
        where: { tenantId, academicYearId: id },
        _count: { _all: true },
      }),
      prisma.classFeeStructure.count({ where: { tenantId, academicYearId: id } }),
      prisma.timetable.count({
        where: { tenantId, academicYearId: id, needsReview: false },
      }),
      prisma.timetable.count({
        where: { tenantId, academicYearId: id, needsReview: true },
      }),
      prisma.studentAcademicSession.count({ where: { tenantId, academicYearId: id } }),
    ]);

    const activeRules =
      rules.find((group) => group.isActive)?._count._all ?? 0;
    const totalRules = rules.reduce((sum, group) => sum + group._count._all, 0);

    const input: RolloverVerificationInput = {
      rollover: mostRecentRollover ?? null,
      target: {
        label: year.label,
        activePromotionRules: activeRules,
        promotionRules: totalRules,
        feeStructures,
        timetableSlots: timetableSlots + timetableNeedingReview,
        timetableSlotsNeedingReview: timetableNeedingReview,
        enrolledStudents,
        // SQL NULL means undeclared; reading it through the one function that
        // owns that meaning rather than testing the Json for null here.
        workingDayPolicyDeclared:
          readWorkingDayPolicy(year.nonWorkingWeekdays) !== null,
        feeBalancePolicy: year.feeBalancePolicy,
        isCurrent: year.isCurrent,
      },
    };

    return successResponse({
      isClosed: year.isClosed,
      verification: buildRolloverVerification(input),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
