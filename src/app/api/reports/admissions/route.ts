import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { requireApiAccess } from "@/lib/api-auth";
import { handleApiError, successResponse } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess(request, {
      permission: "students:read",
    });
    if ("response" in access) return access.response;
    const { user } = access.authContext;
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
      orderBy: { createdAt: "desc" },
    });

    const [classes, assignedUsers, convertedStudents] = await Promise.all([
      prisma.class.findMany({
        where: {
          tenantId: user.tenantId,
          id: { in: enquiries.map((enquiry) => enquiry.classAppliedId).filter((id): id is string => Boolean(id)) },
        },
        select: { id: true, name: true },
      }),
      prisma.user.findMany({
        where: {
          tenantId: user.tenantId,
          id: { in: enquiries.map((enquiry) => enquiry.assignedToId).filter((id): id is string => Boolean(id)) },
        },
        select: { id: true, name: true },
      }),
      prisma.studentProfile.findMany({
        where: {
          tenantId: user.tenantId,
          id: { in: enquiries.map((enquiry) => enquiry.convertedStudentId).filter((id): id is string => Boolean(id)) },
        },
        select: { id: true, studentId: true },
      }),
    ]);
    const classNames = new Map(classes.map((schoolClass) => [schoolClass.id, schoolClass.name]));
    const assignedUserNames = new Map(assignedUsers.map((assignedUser) => [assignedUser.id, assignedUser.name]));
    const convertedStudentIds = new Map(convertedStudents.map((student) => [student.id, student.studentId]));

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
        className: e.classAppliedId ? classNames.get(e.classAppliedId) || "General" : "General",
        source: e.source,
        status: e.status,
        followUpDate: e.followUpDate ? e.followUpDate.toISOString() : null,
        assignedToName: e.assignedToId ? assignedUserNames.get(e.assignedToId) || "Unassigned" : "Unassigned",
        convertedStudentId: e.convertedStudentId ? convertedStudentIds.get(e.convertedStudentId) || null : null,
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
