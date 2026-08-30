import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { badRequest, forbidden, notFound, successResponse, handleApiError } from "@/lib/api-response";
import { requirePortalAccess } from "@/lib/portal-auth";

function dayName(date: Date) {
  return ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"][date.getDay()];
}

async function getStudentId(tenantId: string, userId: string, role: string, requestedId: string | null) {
  if (role === "STUDENT") {
    const profile = await prisma.studentProfile.findFirst({
      where: { tenantId, linkedUser: { id: userId } },
      select: { id: true },
    });
    if (!profile) return null;
    if (requestedId && requestedId !== profile.id) return null;
    return profile.id;
  }

  if (!requestedId) {
    const first = await prisma.parentStudentLink.findFirst({
      where: { tenantId, parentUserId: userId },
      select: { studentProfileId: true },
      orderBy: { createdAt: "asc" },
    });
    return first?.studentProfileId ?? null;
  }

  const link = await prisma.parentStudentLink.findFirst({
    where: { tenantId, parentUserId: userId, studentProfileId: requestedId },
    select: { studentProfileId: true },
  });
  return link?.studentProfileId ?? null;
}

export async function GET(request: NextRequest) {
  try {
    const access = await requirePortalAccess(request);
    if ("response" in access) return access.response;
    const { tenantId, user } = access.authContext;
    const requestedId = new URL(request.url).searchParams.get("studentId");
    const studentId = await getStudentId(tenantId, user.id, user.role, requestedId);

    if (!studentId) {
      return user.role === "PARENT"
        ? notFound("No linked student was found")
        : forbidden("Your student profile is not linked to this account");
    }

    const student = await prisma.studentProfile.findFirst({
      where: { id: studentId, tenantId },
      include: {
        class: { select: { id: true, name: true, studentAppEnabled: true, parentAppEnabled: true } },
        section: { select: { id: true, name: true } },
      },
    });
    if (!student) return notFound("Student profile not found");
    if (user.role === "STUDENT" && !student.class?.studentAppEnabled) return forbidden("Student portal access is disabled for this class");
    if (user.role === "PARENT" && !student.class?.parentAppEnabled) return forbidden("Parent portal access is disabled for this class");

    const now = new Date();
    const attendanceSince = new Date(now);
    attendanceSince.setDate(attendanceSince.getDate() - 90);
    const [tenant, timetable, homework, exams, attendance, fees, results] = await Promise.all([
      prisma.tenant.findUnique({ where: { tenantId }, select: { name: true, logoUrl: true, currencySymbol: true } }),
      prisma.timetable.findMany({
        where: { tenantId, classId: student.classId ?? "", OR: [{ sectionId: student.sectionId }, { sectionId: null }] },
        include: { subject: { select: { id: true, name: true, code: true } }, staffProfile: { select: { firstName: true, lastName: true } } },
        orderBy: [{ dayOfWeek: "asc" }, { periodNumber: "asc" }],
      }),
      prisma.homework.findMany({
        where: { tenantId, classId: student.classId ?? "", OR: [{ sectionId: student.sectionId }, { sectionId: null }] },
        include: { subject: { select: { id: true, name: true, code: true } }, submissions: { where: { studentProfileId: student.id }, select: { id: true, status: true, grade: true, remarks: true, attachmentUrl: true, submittedAt: true } } },
        orderBy: { dueDate: "asc" }, take: 30,
      }),
      prisma.exam.findMany({ where: { tenantId, isPublished: true, startDate: { gte: now } }, include: { academicYear: { select: { label: true } } }, orderBy: { startDate: "asc" }, take: 10 }),
      prisma.attendance.findMany({ where: { tenantId, studentProfileId: student.id, date: { gte: attendanceSince } }, select: { id: true, date: true, status: true }, orderBy: { date: "desc" }, take: 100 }),
      prisma.feeVoucher.findMany({ where: { tenantId, studentProfileId: student.id }, include: { academicYear: { select: { label: true } }, transactions: { select: { id: true, amountPaid: true, paymentMethod: true, receiptNumber: true, timestamp: true }, orderBy: { timestamp: "desc" } } }, orderBy: { dueDate: "desc" }, take: 50 }),
      prisma.examResult.findMany({ where: { tenantId, studentProfileId: student.id, exam: { isPublished: true } }, include: { exam: { select: { id: true, name: true, type: true, startDate: true, academicYearId: true } }, subject: { select: { id: true, name: true, code: true } }, academicYear: { select: { id: true, label: true } } }, orderBy: [{ exam: { startDate: "desc" } }, { subject: { name: "asc" } }], take: 200 }),
    ]);

    const attended = attendance.filter((item) => ["PRESENT", "LATE", "HALF_DAY"].includes(item.status));
    const attendancePercentage = attendance.length ? Math.round((attended.length / attendance.length) * 1000) / 10 : null;
    const today = dayName(now);
    const totalDue = fees.reduce((sum, fee) => sum + fee.balance, 0);

    return successResponse({
      role: user.role,
      school: tenant,
      student,
      timetable,
      today,
      homework,
      exams,
      attendance: { records: attendance, percentage: attendancePercentage },
      fees,
      totalDue,
      transactions: fees.flatMap((fee) => fee.transactions.map((transaction) => ({ ...transaction, voucherId: fee.voucherId, feeType: fee.feeType }))).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 30),
      results,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
