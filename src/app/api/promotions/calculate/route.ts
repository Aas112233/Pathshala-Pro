import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  errorResponse,
  unauthorized,
  notFound,
  badRequest,
} from "@/lib/api-response";
import { requireApiAccess } from "@/lib/api-auth";
import type { StudentProfile as BaseStudentProfile } from "@/types/entities";
import type { ExamResult as PrismaExamResult, Subject, Class } from "@prisma/client";

interface StudentProfileWithClass extends BaseStudentProfile {
  class?: { classId: string; name: string; classNumber: number } | null;
}

interface ExamResultWithRelations extends PrismaExamResult {
  exam: { name: string; type: string };
  subject: Subject;
}

/**
 * GET /api/promotions/calculate
 * Calculate promotion eligibility for all students in a class
 */
export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get("classId");
    const academicYearId = searchParams.get("academicYearId");

    if (!classId || !academicYearId) {
      return badRequest("classId and academicYearId are required");
    }

    // Get promotion rule for this class
    const promotionRule = await prisma.promotionRule.findFirst({
      where: {
        tenantId,
        classId,
        academicYearId,
        isActive: true,
      },
      include: {
        class: {
          select: {
            classId: true,
            name: true,
            classNumber: true,
          },
        },
      },
    });

    if (!promotionRule) {
      return notFound("Promotion rule not found for this class and academic year");
    }

    // Get all students in this class
    const students = await prisma.studentProfile.findMany({
      where: {
        tenantId,
        classId,
        status: "ACTIVE",
      },
      include: {
        class: {
          select: {
            classId: true,
            name: true,
            classNumber: true,
          },
        },
      },
    }) as StudentProfileWithClass[];

    const promotionEligibility = await Promise.all(
      students.map(async (student: StudentProfileWithClass) => {
        // Get all exam results for this student in the academic year
        const results = await prisma.examResult.findMany({
          where: {
            tenantId,
            studentProfileId: student.id,
            academicYearId,
          },
          include: {
            exam: {
              select: {
                name: true,
                type: true,
              },
            },
            subject: {
              select: {
                name: true,
                code: true,
              },
            },
          },
        });

        // Group results by exam
        const examGroups = results.reduce((acc: Record<string, ExamResultWithRelations[]>, result: ExamResultWithRelations) => {
          if (!acc[result.examId]) {
            acc[result.examId] = [];
          }
          acc[result.examId].push(result);
          return acc;
        }, {} as Record<string, ExamResultWithRelations[]>);

        // Calculate overall performance (use final exam or average all)
        let totalPercentage = 0;
        let totalSubjects = 0;
        const failedSubjects: string[] = [];
        const subjectDetails: Array<{
          subjectName: string;
          percentage: number;
          status: string;
          grade: string;
        }> = [];

        // Use the most recent exam results for each subject
        const latestResults = new Map<string, ExamResultWithRelations>();
        results.forEach((result: ExamResultWithRelations) => {
          const existing = latestResults.get(result.subjectId);
          if (!existing || new Date(result.createdAt) > new Date(existing.createdAt)) {
            latestResults.set(result.subjectId, result);
          }
        });

        latestResults.forEach((result) => {
          totalPercentage += result.percentage;
          totalSubjects++;
          subjectDetails.push({
            subjectName: result.subject.name,
            percentage: result.percentage,
            status: result.status,
            grade: result.grade,
          });

          if (result.status === "FAIL") {
            failedSubjects.push(result.subject.name);
          }
        });

        const overallPercentage = totalSubjects > 0 ? totalPercentage / totalSubjects : 0;

        // Determine eligibility
        let eligible = true;
        let action: "PROMOTED" | "RETAINED" | "CONDITIONAL_PROMOTED" = "PROMOTED";
        const reasons: string[] = [];

        // Check failed subjects
        if (failedSubjects.length > promotionRule.maxFailedSubjects) {
          eligible = false;
          action = "RETAINED";
          reasons.push(`Failed in ${failedSubjects.length} subject(s): ${failedSubjects.join(", ")}`);

          // Check if conditional promotion is allowed
          if (
            promotionRule.allowConditionalPromotion &&
            failedSubjects.length <= 2 &&
            overallPercentage >= 30
          ) {
            action = "CONDITIONAL_PROMOTED";
            reasons.push("Eligible for conditional promotion with re-exam");
          }
        }

        // Check overall percentage
        if (overallPercentage < promotionRule.minimumOverallPercentage) {
          eligible = false;
          if (action !== "CONDITIONAL_PROMOTED") {
            action = "RETAINED";
          }
          reasons.push(`Low overall percentage: ${overallPercentage.toFixed(2)}% (Required: ${promotionRule.minimumOverallPercentage}%)`);
        }

        // If no next class ID (final year), mark as graduated
        const isFinalClass = !promotionRule.nextClassId;
        if (isFinalClass) {
          action = "RETAINED";
          reasons.push("Final class - No promotion needed");
        }

        return {
          studentId: student.studentId,
          studentName: `${student.firstName} ${student.lastName}`,
          rollNumber: student.rollNumber,
          currentClass: student.class?.name || "Unknown",
          eligible,
          action,
          reasons,
          metrics: {
            overallPercentage: overallPercentage.toFixed(2),
            totalSubjects,
            failedSubjectsCount: failedSubjects.length,
            failedSubjects,
          },
          subjectDetails,
          suggestedNextClassId: promotionRule.nextClassId,
          reExamAllowed: action === "CONDITIONAL_PROMOTED" && !isFinalClass,
        };
      })
    );

    return successResponse(
      {
        class: promotionRule.class,
        academicYearId,
        promotionRule: {
          minimumAttendance: promotionRule.minimumAttendance,
          minimumOverallPercentage: promotionRule.minimumOverallPercentage,
          minimumPerSubject: promotionRule.minimumPerSubject,
          maxFailedSubjects: promotionRule.maxFailedSubjects,
          allowConditionalPromotion: promotionRule.allowConditionalPromotion,
        },
        totalStudents: students.length,
        eligibleCount: promotionEligibility.filter((e) => e.eligible && e.action === "PROMOTED").length,
        retainedCount: promotionEligibility.filter((e) => e.action === "RETAINED").length,
        conditionalCount: promotionEligibility.filter((e) => e.action === "CONDITIONAL_PROMOTED").length,
        students: promotionEligibility,
      },
      "Promotion eligibility calculated successfully"
    );
  } catch (error) {
    console.error("Calculate promotions error:", error);
    return errorResponse("Internal server error", 500);
  }
}
