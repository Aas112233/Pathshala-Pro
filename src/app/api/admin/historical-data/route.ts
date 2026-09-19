import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  paginatedResponse,
  badRequest,
  forbidden,
  handleApiError,
  safeParseBody,
} from "@/lib/api-response";
import { requireApiAccess } from "@/lib/api-auth";
import { hasRolePermission, type UserRole } from "@/lib/permissions";
import { MAX_PAGE_SIZE } from "@/lib/constants";
import { calculateGradeFromPercentage } from "@/lib/grading";
import { z } from "zod";

// Strict authorization helper: ONLY School Admin, Platform Owner, or Super Admin
function isSchoolAdminOrPlatform(role: string): boolean {
  return hasRolePermission(role as UserRole, "historical:manage");
}

export type HistoricalDomain = "promotions" | "exam-results" | "attendance" | "fee-vouchers";

/**
 * GET /api/admin/historical-data
 * Retrieve paginated historical relational records across closed sessions.
 */
export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess(request, {
      permission: "historical:manage",
    });
    if ("response" in access) return access.response;

    const { user, tenantId } = access.authContext;
    if (!isSchoolAdminOrPlatform(user.role)) {
      return forbidden("Only School Administrators have access to the Historical Data Override Module.");
    }

    const { searchParams } = new URL(request.url);
    const domain = (searchParams.get("domain") || "promotions") as HistoricalDomain;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(Math.max(1, parseInt(searchParams.get("limit") || "20")), MAX_PAGE_SIZE);
    const search = (searchParams.get("search") || "").trim();
    const academicYearId = searchParams.get("academicYearId") || "";
    const statusFilter = searchParams.get("status") || "ALL"; // ALL | ACTIVE | ARCHIVED

    const skip = (page - 1) * limit;

    switch (domain) {
      case "promotions": {
        const where: any = { tenantId };
        if (academicYearId) {
          where.fromAcademicYearId = academicYearId;
        }
        if (search) {
          where.studentProfile = {
            OR: [
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
              { studentId: { contains: search, mode: "insensitive" } },
              { rollNumber: { contains: search, mode: "insensitive" } },
            ],
          };
        }

        const [totalCount, items] = await Promise.all([
          prisma.classPromotion.count({ where }),
          prisma.classPromotion.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: "desc" },
            include: {
              studentProfile: {
                select: {
                  id: true,
                  studentId: true,
                  rollNumber: true,
                  firstName: true,
                  lastName: true,
                },
              },
              fromAcademicYear: { select: { id: true, label: true, isClosed: true } },
              toAcademicYear: { select: { id: true, label: true, isClosed: true } },
              fromClass: { select: { id: true, name: true } },
              toClass: { select: { id: true, name: true } },
              decidedByUser: { select: { id: true, name: true, email: true } },
            },
          }),
        ]);

        const totalPages = Math.ceil(totalCount / limit) || 1;
        return paginatedResponse(items, {
          totalCount,
          currentPage: page,
          pageSize: limit,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        });
      }

      case "exam-results": {
        const where: any = { tenantId };
        if (academicYearId) {
          where.academicYearId = academicYearId;
        }
        if (search) {
          where.OR = [
            {
              studentProfile: {
                OR: [
                  { firstName: { contains: search, mode: "insensitive" } },
                  { lastName: { contains: search, mode: "insensitive" } },
                  { studentId: { contains: search, mode: "insensitive" } },
                ],
              },
            },
            { exam: { name: { contains: search, mode: "insensitive" } } },
            { subject: { name: { contains: search, mode: "insensitive" } } },
          ];
        }

        const [totalCount, items] = await Promise.all([
          prisma.examResult.count({ where }),
          prisma.examResult.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: "desc" },
            include: {
              studentProfile: {
                select: {
                  id: true,
                  studentId: true,
                  rollNumber: true,
                  firstName: true,
                  lastName: true,
                  class: { select: { id: true, name: true } },
                  section: { select: { id: true, name: true } },
                },
              },
              academicYear: { select: { id: true, label: true, isClosed: true } },
              exam: { select: { id: true, name: true, type: true } },
              subject: { select: { id: true, name: true, code: true } },
            },
          }),
        ]);

        const totalPages = Math.ceil(totalCount / limit) || 1;
        return paginatedResponse(items, {
          totalCount,
          currentPage: page,
          pageSize: limit,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        });
      }

      case "attendance": {
        const where: any = { tenantId };
        if (academicYearId) {
          where.academicYearId = academicYearId;
        }
        if (search) {
          where.studentProfile = {
            OR: [
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
              { studentId: { contains: search, mode: "insensitive" } },
              { rollNumber: { contains: search, mode: "insensitive" } },
            ],
          };
        }

        const [totalCount, items] = await Promise.all([
          prisma.attendance.count({ where }),
          prisma.attendance.findMany({
            where,
            skip,
            take: limit,
            orderBy: { date: "desc" },
            include: {
              studentProfile: {
                select: {
                  id: true,
                  studentId: true,
                  rollNumber: true,
                  firstName: true,
                  lastName: true,
                  class: { select: { id: true, name: true } },
                  section: { select: { id: true, name: true } },
                },
              },
              academicYear: { select: { id: true, label: true, isClosed: true } },
              markedBy: { select: { id: true, name: true, email: true } },
            },
          }),
        ]);

        const totalPages = Math.ceil(totalCount / limit) || 1;
        return paginatedResponse(items, {
          totalCount,
          currentPage: page,
          pageSize: limit,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        });
      }

      case "fee-vouchers": {
        const where: any = { tenantId };
        if (academicYearId) {
          where.academicYearId = academicYearId;
        }
        if (statusFilter === "ACTIVE") {
          where.voidedAt = null;
        } else if (statusFilter === "ARCHIVED") {
          where.voidedAt = { not: null };
        }
        if (search) {
          where.OR = [
            { voucherId: { contains: search, mode: "insensitive" } },
            {
              studentProfile: {
                OR: [
                  { firstName: { contains: search, mode: "insensitive" } },
                  { lastName: { contains: search, mode: "insensitive" } },
                  { studentId: { contains: search, mode: "insensitive" } },
                  { rollNumber: { contains: search, mode: "insensitive" } },
                ],
              },
            },
          ];
        }

        const [totalCount, items] = await Promise.all([
          prisma.feeVoucher.count({ where }),
          prisma.feeVoucher.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: "desc" },
            include: {
              studentProfile: {
                select: {
                  id: true,
                  studentId: true,
                  rollNumber: true,
                  firstName: true,
                  lastName: true,
                  class: { select: { id: true, name: true } },
                  section: { select: { id: true, name: true } },
                },
              },
              academicYear: { select: { id: true, label: true, isClosed: true } },
              transactions: {
                select: {
                  id: true,
                  transactionId: true,
                  amountPaid: true,
                  paymentMethod: true,
                  timestamp: true,
                },
              },
            },
          }),
        ]);

        const totalPages = Math.ceil(totalCount / limit) || 1;
        return paginatedResponse(items, {
          totalCount,
          currentPage: page,
          pageSize: limit,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        });
      }

      default:
        return badRequest("Invalid domain specified.");
    }
  } catch (error) {
    return handleApiError(error);
  }
}

const patchSchema = z.object({
  domain: z.enum(["promotions", "exam-results", "attendance", "fee-vouchers"]),
  recordId: z.string().min(1, "Record ID is required"),
  reason: z.string().min(5, "A justification reason of at least 5 characters is required"),
  changes: z.record(z.any()),
});

/**
 * PATCH /api/admin/historical-data
 * Perform safe historical override with mandatory audit logging.
 */
export async function PATCH(request: NextRequest) {
  try {
    const access = await requireApiAccess(request, {
      permission: "historical:manage",
    });
    if ("response" in access) return access.response;

    const { user, tenantId } = access.authContext;
    if (!isSchoolAdminOrPlatform(user.role)) {
      return forbidden("Only School Administrators have access to modify Historical Data.");
    }

    const parseResult = await safeParseBody(request, patchSchema);
    if (!parseResult.success) return parseResult.errorResponse;

    const { domain, recordId, reason, changes } = parseResult.data;

    const result = await prisma.$transaction(async (tx) => {
      let previousRecord: any = null;
      let updatedRecord: any = null;

      switch (domain) {
        case "promotions": {
          previousRecord = await tx.classPromotion.findFirst({
            where: { id: recordId, tenantId },
          });
          if (!previousRecord) {
            throw new Error("Promotion record not found");
          }

          const updateData: any = {};
          if (changes.status) updateData.status = changes.status;
          if (changes.reason !== undefined) updateData.reason = changes.reason;
          if (changes.toClassId) updateData.toClassId = changes.toClassId;
          if (changes.reExamRequired !== undefined) updateData.reExamRequired = Boolean(changes.reExamRequired);
          if (changes.reExamCompleted !== undefined) updateData.reExamCompleted = Boolean(changes.reExamCompleted);
          if (changes.reExamPassed !== undefined) updateData.reExamPassed = changes.reExamPassed;

          updatedRecord = await tx.classPromotion.update({
            where: { id: recordId },
            data: updateData,
          });
          break;
        }

        case "exam-results": {
          previousRecord = await tx.examResult.findFirst({
            where: { id: recordId, tenantId },
          });
          if (!previousRecord) {
            throw new Error("Exam result record not found");
          }

          const updateData: any = {};
          const newObtained = changes.obtainedMarks !== undefined ? Number(changes.obtainedMarks) : previousRecord.obtainedMarks;
          const maxMarks = previousRecord.maxMarks || 100;

          if (changes.obtainedMarks !== undefined) {
            if (newObtained < 0 || newObtained > maxMarks) {
              throw new Error(`Obtained marks must be between 0 and ${maxMarks}`);
            }
            updateData.obtainedMarks = newObtained;
            const percentage = (newObtained / maxMarks) * 100;
            updateData.percentage = percentage;

            const grading = calculateGradeFromPercentage(percentage);
            updateData.grade = grading.letterGrade;
            updateData.gradePoint = grading.gpa;
            updateData.status = percentage >= 33 ? "PASS" : "FAIL";
          }

          if (changes.status) updateData.status = changes.status;
          if (changes.remarks !== undefined) updateData.remarks = changes.remarks;
          if (changes.isLocked !== undefined) updateData.isLocked = Boolean(changes.isLocked);

          updatedRecord = await tx.examResult.update({
            where: { id: recordId },
            data: updateData,
          });
          break;
        }

        case "attendance": {
          previousRecord = await tx.attendance.findFirst({
            where: { id: recordId, tenantId },
          });
          if (!previousRecord) {
            throw new Error("Attendance record not found");
          }

          const updateData: any = {};
          if (changes.status) updateData.status = changes.status;
          if (changes.lateMinutes !== undefined) updateData.lateMinutes = Number(changes.lateMinutes);
          if (changes.earlyDepartureMinutes !== undefined) updateData.earlyDepartureMinutes = Number(changes.earlyDepartureMinutes);
          if (changes.note !== undefined) updateData.note = changes.note;

          updatedRecord = await tx.attendance.update({
            where: { id: recordId },
            data: updateData,
          });
          break;
        }

        case "fee-vouchers": {
          previousRecord = await tx.feeVoucher.findFirst({
            where: { id: recordId, tenantId },
          });
          if (!previousRecord) {
            throw new Error("Fee voucher not found");
          }

          const updateData: any = {};
          if (changes.dueDate) updateData.dueDate = new Date(changes.dueDate);
          if (changes.status) updateData.status = changes.status;

          updatedRecord = await tx.feeVoucher.update({
            where: { id: recordId },
            data: updateData,
          });
          break;
        }
      }

      // Record immutable Audit Log
      await tx.auditLog.create({
        data: {
          tenantId,
          userId: user.id,
          userEmail: user.email,
          action: `HISTORICAL_OVERRIDE_${domain.toUpperCase().replace("-", "_")}`,
          entity: domain,
          entityId: recordId,
          details: {
            reason,
            previous: previousRecord,
            updated: updatedRecord,
            appliedChanges: changes,
          },
        },
      });

      return updatedRecord;
    });

    return successResponse(result, "Historical record corrected successfully.");
  } catch (error) {
    return handleApiError(error);
  }
}

const actionSchema = z.object({
  domain: z.enum(["promotions", "exam-results", "attendance", "fee-vouchers"]),
  recordId: z.string().min(1, "Record ID is required"),
  action: z.enum(["archive", "restore"]),
  reason: z.string().min(5, "A justification reason of at least 5 characters is required"),
});

/**
 * POST /api/admin/historical-data
 * Archive or Restore a historical record safely.
 */
export async function POST(request: NextRequest) {
  try {
    const access = await requireApiAccess(request, {
      permission: "historical:manage",
    });
    if ("response" in access) return access.response;

    const { user, tenantId } = access.authContext;
    if (!isSchoolAdminOrPlatform(user.role)) {
      return forbidden("Only School Administrators have access to archive historical records.");
    }

    const parseResult = await safeParseBody(request, actionSchema);
    if (!parseResult.success) return parseResult.errorResponse;

    const { domain, recordId, action, reason } = parseResult.data;

    const result = await prisma.$transaction(async (tx) => {
      let previousRecord: any = null;
      let updatedRecord: any = null;

      switch (domain) {
        case "fee-vouchers": {
          previousRecord = await tx.feeVoucher.findFirst({
            where: { id: recordId, tenantId },
          });
          if (!previousRecord) throw new Error("Fee voucher not found");

          updatedRecord = await tx.feeVoucher.update({
            where: { id: recordId },
            data: {
              voidedAt: action === "archive" ? new Date() : null,
              voidedById: action === "archive" ? user.id : null,
              status: action === "archive" ? "VOIDED" : "PENDING",
            },
          });
          break;
        }

        case "exam-results": {
          previousRecord = await tx.examResult.findFirst({
            where: { id: recordId, tenantId },
          });
          if (!previousRecord) throw new Error("Exam result record not found");

          updatedRecord = await tx.examResult.update({
            where: { id: recordId },
            data: {
              isLocked: action === "archive",
              remarks: action === "archive"
                ? `[ARCHIVED] ${reason}`
                : (previousRecord.remarks || "").replace(/^\[ARCHIVED\]\s*/, ""),
            },
          });
          break;
        }

        case "promotions": {
          previousRecord = await tx.classPromotion.findFirst({
            where: { id: recordId, tenantId },
          });
          if (!previousRecord) throw new Error("Promotion record not found");

          updatedRecord = await tx.classPromotion.update({
            where: { id: recordId },
            data: {
              reason: action === "archive"
                ? `[ARCHIVED] ${reason}`
                : (previousRecord.reason || "").replace(/^\[ARCHIVED\]\s*/, ""),
            },
          });
          break;
        }

        case "attendance": {
          previousRecord = await tx.attendance.findFirst({
            where: { id: recordId, tenantId },
          });
          if (!previousRecord) throw new Error("Attendance record not found");

          updatedRecord = await tx.attendance.update({
            where: { id: recordId },
            data: {
              note: action === "archive"
                ? `[ARCHIVED] ${reason}`
                : (previousRecord.note || "").replace(/^\[ARCHIVED\]\s*/, ""),
            },
          });
          break;
        }
      }

      await tx.auditLog.create({
        data: {
          tenantId,
          userId: user.id,
          userEmail: user.email,
          action: `HISTORICAL_${action.toUpperCase()}_${domain.toUpperCase().replace("-", "_")}`,
          entity: domain,
          entityId: recordId,
          details: {
            reason,
            action,
            previous: previousRecord,
            updated: updatedRecord,
          },
        },
      });

      return updatedRecord;
    });

    const msg = action === "archive" ? "Record archived successfully." : "Record restored successfully.";
    return successResponse(result, msg);
  } catch (error) {
    return handleApiError(error);
  }
}
