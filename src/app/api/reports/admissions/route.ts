import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { getAuthContext } from "@/lib/auth";
import { forbidden, handleApiError, successResponse } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

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
    const source = searchParams.get("source");
    const classId = searchParams.get("classId");

    const whereClause: Prisma.EnquiryWhereInput = {
      tenantId: user.tenantId,
    };

    if (fromDate || toDate) {
      const dateFilter: Prisma.DateTimeFilter = {};
      if (fromDate) dateFilter.gte = new Date(fromDate);
      if (toDate) dateFilter.lte = new Date(toDate);
      whereClause.createdAt = dateFilter;
    }

    if (status && status !== "all") {
      whereClause.status = status;
    }
    if (source && source !== "all") {
      whereClause.source = source;
    }
    if (classId && classId !== "all") {
      whereClause.classAppliedId = classId;
    }

    const enquiries = await prisma.enquiry.findMany({
      where: whereClause,
      include: {
        classApplied: {
          select: {
            name: true,
          },
        },
        assignedTo: {
          select: {
            name: true,
          },
        },
        convertedStudent: {
          select: {
            studentId: true,
            rollNumber: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    let admittedCount = 0;
    let pendingFollowups = 0;
    const sourceMap = new Map<string, number>();
    const statusMap = new Map<string, number>();

    const transformedRecords = enquiries.map((e) => {
      if (e.status === "ADMITTED") admittedCount++;
      if (e.followUpDate && new Date(e.followUpDate) >= new Date() && e.status !== "ADMITTED" && e.status !== "REJECTED") {
        pendingFollowups++;
      }

      sourceMap.set(e.source, (sourceMap.get(e.source) || 0) + 1);
      statusMap.set(e.status, (statusMap.get(e.status) || 0) + 1);

      return {
        id: e.id,
        studentName: e.studentName,
        guardianName: e.guardianName,
        phone: e.phone,
        email: e.email || "N/A",
        className: e.classApplied?.name || "General",
        source: e.source,
        status: e.status,
        followUpDate: e.followUpDate ? e.followUpDate.toISOString() : null,
        assignedToName: e.assignedTo?.name || "Unassigned",
        convertedStudentId: e.convertedStudent?.studentId || null,
        createdAt: e.createdAt.toISOString(),
      };
    });

    const totalEnquiries = enquiries.length;
    const conversionRate =
      totalEnquiries > 0 ? Math.round((admittedCount / totalEnquiries) * 100) : 0;

    const sourceBreakdown = Array.from(sourceMap.entries()).map(([sourceName, count]) => ({
      source: sourceName,
      count,
      percentage: totalEnquiries > 0 ? Math.round((count / totalEnquiries) * 100) : 0,
    }));

    const statusBreakdown = Array.from(statusMap.entries()).map(([statusName, count]) => ({
      status: statusName,
      count,
      percentage: totalEnquiries > 0 ? Math.round((count / totalEnquiries) * 100) : 0,
    }));

    return successResponse({
      metrics: {
        totalEnquiries,
        admittedCount,
        conversionRate,
        pendingFollowups,
      },
      sourceBreakdown,
      statusBreakdown,
      records: transformedRecords,
    });
  } catch (error) {
    return handleApiError(error, "Failed to generate admissions report");
  }
}
