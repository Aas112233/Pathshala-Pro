import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAccess } from "@/lib/api-auth";
import { errorResponse, successResponse } from "@/lib/api-response";
import { calculateClassMeritRankings, calculateGradeFromPercentage } from "@/lib/grading";
import { calculateAttendancePercentage, safePercentage } from "@/lib/math-utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) {
      return access.response;
    }

    const { tenantId } = access.authContext;
    const { id: examId } = await params;
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get("classId");
    const sectionId = searchParams.get("sectionId");

    if (!classId) {
      return errorResponse("classId is required to generate class batch report cards", 400);
    }

    // 1. Fetch Exam & Academic Year
    const exam = await prisma.exam.findFirst({
      where: {
        id: examId,
        tenantId,
      },
      include: {
        academicYear: true,
        subjects: {
          include: {
            subject: true,
          },
        },
      },
    });

    if (!exam) {
      return errorResponse("Exam not found", 404);
    }

    // 2. Fetch Tenant / School Info
    const tenant = await prisma.tenant.findUnique({
      where: { tenantId },
    });

    // 3. Fetch Class & Section Details
    const targetClass = await prisma.class.findFirst({
      where: { id: classId, tenantId },
    });

    if (!targetClass) {
      return errorResponse("Class not found", 404);
    }

    // 4. Fetch Students in Class
    const studentWhere = {
      tenantId,
      classId,
      status: "ACTIVE",
      ...(sectionId && sectionId !== "all" ? { sectionId } : {}),
    };

    const students = await prisma.studentProfile.findMany({
      where: studentWhere,
      orderBy: [{ rollNumber: "asc" }, { firstName: "asc" }],
    });

    if (students.length === 0) {
      return successResponse({
        school: {
          name: tenant?.name || "Pathshala Pro School",
          address: tenant?.address || "Main Campus",
          phone: tenant?.phone || "",
          email: tenant?.email || "",
        },
        exam: {
          id: exam.id,
          name: exam.name,
          academicYear: exam.academicYear?.label || "",
        },
        class: {
          id: targetClass.id,
          name: targetClass.name,
        },
        statistics: {
          totalStudents: 0,
          classAverage: 0,
          passCount: 0,
          failCount: 0,
        },
        students: [],
      });
    }

    const studentIds = students.map((s) => s.id);
    const sections = await prisma.section.findMany({
      where: {
        tenantId,
        id: { in: students.map((student) => student.sectionId).filter((id): id is string => Boolean(id)) },
      },
      select: { id: true, name: true },
    });
    const sectionNames = new Map(sections.map((section) => [section.id, section.name]));

    // 5. Fetch Exam Results for cohort
    const results = await prisma.examResult.findMany({
      where: {
        tenantId,
        examId,
        studentProfileId: { in: studentIds },
      },
      include: {
        subject: true,
      },
    });

    // 6. Fetch Attendance Records for students
    const attendanceRecords = await prisma.attendance.findMany({
      where: {
        tenantId,
        studentProfileId: { in: studentIds },
        academicYearId: exam.academicYearId,
      },
    });

    // Group attendance by student
    const attendanceMap = new Map<string, { present: number; halfDays: number; total: number }>();
    for (const att of attendanceRecords) {
      if (!att.studentProfileId) continue;
      const curr = attendanceMap.get(att.studentProfileId) || { present: 0, halfDays: 0, total: 0 };
      curr.total += 1;
      if (att.status === "PRESENT" || att.status === "LATE") {
        curr.present += 1;
      } else if (att.status === "HALF_DAY") {
        curr.halfDays += 1;
      }
      attendanceMap.set(att.studentProfileId, curr);
    }

    // Group exam results by student
    const resultsMap = new Map<string, typeof results>();
    for (const r of results) {
      const list = resultsMap.get(r.studentProfileId) || [];
      list.push(r);
      resultsMap.set(r.studentProfileId, list);
    }

    // 7. Format raw student data for ranking
    const cohortData = students.map((st) => {
      const stResults = resultsMap.get(st.id) || [];
      const formattedResults = stResults.map((r) => ({
        subjectName: r.subject?.name || "Subject",
        subjectCode: r.subject?.code || "SUB",
        maxMarks: r.maxMarks,
        passMarks: (exam.subjects.find((es) => es.subjectId === r.subjectId)?.passMarks) || (r.maxMarks * 0.33),
        obtainedMarks: r.obtainedMarks,
        grade: r.grade,
        gradePoint: r.gradePoint,
        remarks: r.remarks || undefined,
      }));

      return {
        studentProfileId: st.id,
        studentName: `${st.firstName} ${st.lastName}`.trim(),
        rollNumber: st.rollNumber || "—",
        results: formattedResults,
      };
    });

    // 8. Compute Merit Rankings
    const rankedCohort = calculateClassMeritRankings(cohortData);
    const rankMap = new Map<string, (typeof rankedCohort)[0]>();
    for (const r of rankedCohort) {
      rankMap.set(r.studentProfileId, r);
    }

    // 9. Build Batch Report Card payload
    let totalCohortPercentage = 0;
    let passedCount = 0;

    const formattedStudents = students.map((st) => {
      const rankInfo = rankMap.get(st.id);
      const stResults = resultsMap.get(st.id) || [];
      const att = attendanceMap.get(st.id) || { present: 0, halfDays: 0, total: 0 };
      const attPercentage = calculateAttendancePercentage({ presentDays: att.present, halfDays: att.halfDays, totalDays: att.total });

      const subjects = exam.subjects.map((es) => {
        const found = stResults.find((r) => r.subjectId === es.subjectId);
        const maxMarks = es.maxMarks || 100;
        const passMarks = es.passMarks || 33;
        const obtained = found ? found.obtainedMarks : 0;
        const subPercentage = safePercentage(obtained, maxMarks);
        const { letterGrade, gpa } = calculateGradeFromPercentage(subPercentage);

        return {
          subjectName: es.subject?.name || "Subject",
          subjectCode: es.subject?.code || "SUB",
          maxMarks,
          passMarks,
          obtainedMarks: obtained,
          grade: found?.grade || letterGrade,
          gradePoint: found?.gradePoint || gpa,
          remarks: found?.remarks || (obtained >= passMarks ? "Pass" : "Fail"),
        };
      });

      const totalMax = subjects.reduce((sum, s) => sum + s.maxMarks, 0);
      const totalObtained = subjects.reduce((sum, s) => sum + s.obtainedMarks, 0);
      const percentage = totalMax > 0 ? Number(((totalObtained / totalMax) * 100).toFixed(2)) : 0;
      const { letterGrade, gpa } = calculateGradeFromPercentage(percentage);
      const passed = !subjects.some((s) => s.obtainedMarks < s.passMarks);

      if (passed) passedCount += 1;
      totalCohortPercentage += percentage;

      return {
        student: {
          id: st.id,
          name: `${st.firstName} ${st.lastName}`.trim(),
          admissionNumber: st.studentId,
          rollNumber: st.rollNumber || "—",
          className: targetClass.name,
          section: st.sectionId ? sectionNames.get(st.sectionId) || "" : "",
          guardianName: st.guardianName,
          guardianContact: st.guardianContact,
        },
        examName: exam.name,
        academicYear: exam.academicYear?.label || "Current Session",
        subjects,
        totalMaxMarks: totalMax,
        totalObtainedMarks: totalObtained,
        percentage,
        gpa,
        letterGrade,
        rank: rankInfo?.rank || 1,
        rankLabel: rankInfo?.rankLabel || "1st",
        totalStudentsInClass: students.length,
        passed,
        attendance: {
          present: att.present,
          total: att.total,
          percentage: attPercentage,
        },
      };
    });

    const classAverage = students.length > 0 ? Number((totalCohortPercentage / students.length).toFixed(1)) : 0;

    return successResponse({
      school: {
        name: tenant?.name || "Pathshala Pro School",
        address: tenant?.address || "Main Campus",
        phone: tenant?.phone || "",
        email: tenant?.email || "",
      },
      exam: {
        id: exam.id,
        name: exam.name,
        academicYear: exam.academicYear?.label || "",
      },
      class: {
        id: targetClass.id,
        name: targetClass.name,
      },
      statistics: {
        totalStudents: students.length,
        classAverage,
        passCount: passedCount,
        failCount: students.length - passedCount,
        passRate: students.length > 0 ? Math.round((passedCount / students.length) * 100) : 0,
      },
      students: formattedStudents,
    });
  } catch (error) {
    console.error("Batch report cards error:", error);
    return errorResponse("Failed to generate batch report cards", 500);
  }
}
