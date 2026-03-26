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
    const examType = searchParams.get("examType");

    // Build date filter
    const dateFilter: any = {};
    if (fromDate) {
      dateFilter.gte = new Date(fromDate);
    }
    if (toDate) {
      dateFilter.lte = new Date(toDate);
    }

    // Build exam type filter
    const examTypeFilter: any = {};
    if (examType && examType !== "all") {
      examTypeFilter.type = examType;
    }

    // Fetch exam results with related data
    const results = await prisma.examResult.findMany({
      where: {
        tenantId: user.tenantId,
        exam: {
          ...(Object.keys(dateFilter).length > 0 && {
            startDate: dateFilter,
          }),
          ...(Object.keys(examTypeFilter).length > 0 && examTypeFilter),
        },
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
        exam: {
          select: {
            name: true,
            type: true,
          },
        },
        subject: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Transform results
    const transformedResults = results.map((result) => ({
      id: result.id,
      studentName: `${result.studentProfile.firstName} ${result.studentProfile.lastName}`,
      className: result.studentProfile.class?.name || "N/A",
      section: result.studentProfile.section?.name || "N/A",
      rollNumber: result.studentProfile.rollNumber,
      examName: result.exam.name,
      examType: result.exam.type as "MID_TERM" | "FINAL" | "UNIT_TEST" | "QUARTERLY" | "ANNUAL",
      subject: result.subject.name,
      marksObtained: result.obtainedMarks,
      maxMarks: result.maxMarks,
      percentage: Math.round(result.percentage),
      grade: result.grade as "A+" | "A" | "B" | "C" | "D" | "F",
      status: result.status as "PASS" | "FAIL",
    }));

    // Calculate metrics
    const totalExams = new Set(results.map((r) => r.examId)).size;
    const passCount = transformedResults.filter((r) => r.status === "PASS").length;
    const failCount = transformedResults.filter((r) => r.status === "FAIL").length;
    const passPercentage =
      transformedResults.length > 0
        ? Math.round((passCount / transformedResults.length) * 100)
        : 0;

    const averageMarks =
      transformedResults.length > 0
        ? Math.round(
            transformedResults.reduce((sum, r) => sum + r.percentage, 0) /
              transformedResults.length
          )
        : 0;

    const topPerformers = transformedResults.filter((r) => r.percentage >= 90).length;

    // Grade distribution
    const gradeCounts = {
      "A+": transformedResults.filter((r) => r.grade === "A+").length,
      A: transformedResults.filter((r) => r.grade === "A").length,
      B: transformedResults.filter((r) => r.grade === "B").length,
      C: transformedResults.filter((r) => r.grade === "C").length,
      D: transformedResults.filter((r) => r.grade === "D").length,
      F: transformedResults.filter((r) => r.grade === "F").length,
    };

    // Subject-wise analysis
    const subjectWiseMap = new Map<string, { total: number; sum: number }>();
    transformedResults.forEach((result) => {
      if (!subjectWiseMap.has(result.subject)) {
        subjectWiseMap.set(result.subject, { total: 0, sum: 0 });
      }
      const subjectData = subjectWiseMap.get(result.subject)!;
      subjectData.total += 1;
      subjectData.sum += result.percentage;
    });

    const subjectWiseData = Array.from(subjectWiseMap.entries()).map(([subject, data]) => ({
      subject,
      averagePercentage: Math.round(data.sum / data.total),
    }));

    // Class-wise results
    const classWiseMap = new Map<string, { total: number; sum: number }>();
    transformedResults.forEach((result) => {
      if (!classWiseMap.has(result.className)) {
        classWiseMap.set(result.className, { total: 0, sum: 0 });
      }
      const classData = classWiseMap.get(result.className)!;
      classData.total += 1;
      classData.sum += result.percentage;
    });

    const classWiseData = Array.from(classWiseMap.entries()).map(([className, data]) => ({
      className,
      averagePercentage: Math.round(data.sum / data.total),
    }));

    // Failed students
    const failedStudents = transformedResults.filter((r) => r.status === "FAIL");

    return Response.json({
      success: true,
      data: {
        metrics: {
          totalExams,
          passPercentage,
          averageMarks,
          topPerformers,
          totalResults: transformedResults.length,
          passCount,
          failCount,
        },
        gradeDistribution: gradeCounts,
        subjectWise: subjectWiseData,
        classWise: classWiseData,
        failedStudents,
        results: transformedResults,
      },
    });
  } catch (error) {
    console.error("Exam report error:", error);
    return Response.json(
      {
        success: false,
        message: "Failed to generate exam report",
      },
      { status: 500 }
    );
  }
}
