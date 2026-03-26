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

    // Build date filter
    const dateFilter: any = {};
    if (fromDate) {
      dateFilter.gte = new Date(fromDate);
    }
    if (toDate) {
      dateFilter.lte = new Date(toDate);
    }

    // Fetch attendances with related data
    const attendances = await prisma.attendance.findMany({
      where: {
        tenantId: user.tenantId,
        ...(Object.keys(dateFilter).length > 0 && {
          date: dateFilter,
        }),
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
      },
    });

    // Group by student and calculate attendance stats
    const studentAttendanceMap = new Map<string, any>();

    attendances.forEach((attendance) => {
      if (!attendance.studentProfileId || !attendance.studentProfile) return;

      const studentId = attendance.studentProfileId;
      if (!studentAttendanceMap.has(studentId)) {
        studentAttendanceMap.set(studentId, {
          studentId,
          studentName: `${attendance.studentProfile.firstName} ${attendance.studentProfile.lastName}`,
          className: attendance.studentProfile.class?.name || "N/A",
          section: attendance.studentProfile.section?.name || "N/A",
          rollNumber: attendance.studentProfile.rollNumber,
          presentDays: 0,
          absentDays: 0,
          totalDays: 0,
        });
      }

      const studentData = studentAttendanceMap.get(studentId);
      studentData.totalDays += 1;
      
      // Check attendance status
      if (attendance.status === "PRESENT") {
        studentData.presentDays += 1;
      } else {
        studentData.absentDays += 1;
      }
    });

    // Calculate attendance percentage and status
    const attendanceRecords = Array.from(studentAttendanceMap.values()).map((data) => {
      const attendancePercentage =
        data.totalDays > 0 ? Math.round((data.presentDays / data.totalDays) * 100) : 0;

      let status: "GOOD" | "AVERAGE" | "DEFICIT" = "GOOD";
      if (attendancePercentage < 75) {
        status = "DEFICIT";
      } else if (attendancePercentage < 85) {
        status = "AVERAGE";
      }

      return {
        ...data,
        attendancePercentage,
        status,
      };
    });

    // Calculate metrics
    const averageAttendance =
      attendanceRecords.length > 0
        ? Math.round(
            attendanceRecords.reduce((sum, r) => sum + r.attendancePercentage, 0) /
              attendanceRecords.length
          )
        : 0;

    const totalPresent = attendanceRecords.reduce((sum, r) => sum + r.presentDays, 0);
    const totalAbsent = attendanceRecords.reduce((sum, r) => sum + r.absentDays, 0);
    const defaulterCount = attendanceRecords.filter((r) => r.status === "DEFICIT").length;

    // Class-wise attendance
    const classWiseMap = new Map<string, { total: number; sum: number }>();
    attendanceRecords.forEach((record) => {
      if (!classWiseMap.has(record.className)) {
        classWiseMap.set(record.className, { total: 0, sum: 0 });
      }
      const classData = classWiseMap.get(record.className)!;
      classData.total += 1;
      classData.sum += record.attendancePercentage;
    });

    const classWiseData = Array.from(classWiseMap.entries()).map(([className, data]) => ({
      className,
      averagePercentage: Math.round(data.sum / data.total),
    }));

    return Response.json({
      success: true,
      data: {
        metrics: {
          averageAttendance,
          totalPresent,
          totalAbsent,
          defaulterCount,
          totalStudents: attendanceRecords.length,
        },
        records: attendanceRecords,
        classWise: classWiseData,
      },
    });
  } catch (error) {
    console.error("Attendance report error:", error);
    return Response.json(
      {
        success: false,
        message: "Failed to generate attendance report",
      },
      { status: 500 }
    );
  }
}
