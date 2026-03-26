import { NextRequest } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getAuthContext } from "@/lib/auth";
import { forbidden } from "next/navigation";

const prisma = new PrismaClient();

export const runtime = 'edge';

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
    const classId = searchParams.get("classId");
    const sectionId = searchParams.get("sectionId");
    const status = searchParams.get("status");

    // Build date filter for admission date
    const dateFilter: any = {};
    if (fromDate) {
      dateFilter.gte = new Date(fromDate);
    }
    if (toDate) {
      dateFilter.lte = new Date(toDate);
    }

    // Build class/section filter
    const classFilter: any = {};
    if (classId && classId !== "all") {
      classFilter.classId = classId;
    }
    if (sectionId && sectionId !== "all") {
      classFilter.sectionId = sectionId;
    }

    // Build status filter
    const statusFilter: any = {};
    if (status && status !== "all") {
      statusFilter.status = status;
    }

    // Fetch students with related data
    const students = await prisma.studentProfile.findMany({
      where: {
        tenantId: user.tenantId,
        ...(Object.keys(dateFilter).length > 0 && {
          admissionDate: dateFilter,
        }),
        ...(Object.keys(classFilter).length > 0 && classFilter),
        ...(Object.keys(statusFilter).length > 0 && statusFilter),
      },
      include: {
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
      orderBy: {
        createdAt: "desc",
      },
    });

    // Calculate metrics
    const totalStudents = students.length;
    const activeStudents = students.filter((s) => s.status === "ACTIVE").length;
    const newAdmissions = students.filter(
      (s) =>
        fromDate && toDate
          ? s.admissionDate >= new Date(fromDate) && s.admissionDate <= new Date(toDate)
          : true
    ).length;
    const transferredOut = students.filter((s) => s.status === "TRANSFERRED").length;
    const graduated = students.filter((s) => s.status === "GRADUATED").length;

    // Gender distribution
    const maleCount = students.filter((s) => s.gender === "MALE").length;
    const femaleCount = students.filter((s) => s.gender === "FEMALE").length;
    const otherCount = students.filter((s) => s.gender === "OTHER" || !s.gender).length;

    // Class-wise strength
    const classWiseMap = new Map<string, number>();
    students.forEach((student) => {
      const className = student.class?.name || "N/A";
      classWiseMap.set(className, (classWiseMap.get(className) || 0) + 1);
    });

    const classWiseData = Array.from(classWiseMap.entries()).map(([className, count]) => ({
      className,
      count,
    }));

    // Admission trend (monthly)
    const monthlyMap = new Map<string, number>();
    students.forEach((student) => {
      const month = student.admissionDate.toLocaleString("default", { month: "short" });
      monthlyMap.set(month, (monthlyMap.get(month) || 0) + 1);
    });

    const admissionTrendData = Array.from(monthlyMap.entries()).map(([month, count]) => ({
      month,
      count,
    }));

    // Transform students for response
    const transformedStudents = students.map((student) => ({
      id: student.id,
      studentName: `${student.firstName} ${student.lastName}`,
      className: student.class?.name || "N/A",
      section: student.section?.name || "N/A",
      rollNumber: student.rollNumber,
      admissionNumber: student.studentId,
      gender: student.gender || "OTHER",
      status: student.status as "ACTIVE" | "INACTIVE" | "GRADUATED" | "TRANSFERRED",
      admissionDate: student.admissionDate.toISOString().split("T")[0],
      dateOfBirth: student.dateOfBirth?.toISOString().split("T")[0] || null,
      guardianName: student.guardianName,
      contactNumber: student.guardianContact,
    }));

    return Response.json({
      success: true,
      data: {
        metrics: {
          totalStudents,
          activeStudents,
          newAdmissions,
          transferredOut,
          graduated,
        },
        genderDistribution: {
          male: maleCount,
          female: femaleCount,
          other: otherCount,
        },
        classWise: classWiseData,
        admissionTrend: admissionTrendData,
        students: transformedStudents,
      },
    });
  } catch (error) {
    console.error("Student report error:", error);
    return Response.json(
      {
        success: false,
        message: "Failed to generate student report",
      },
      { status: 500 }
    );
  }
}
