import { NextResponse } from "next/server";
import { badRequest } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

type IntegrityDetail = {
  field?: string;
  code: string;
  message: string;
};

type UsageCounts = Record<string, number>;

function usageMessage(label: string, counts: UsageCounts) {
  const active = Object.entries(counts)
    .filter(([, count]) => count > 0)
    .map(([name, count]) => `${count} ${name}`);

  if (active.length === 0) {
    return label;
  }

  return `${label}: ${active.join(", ")}.`;
}

export function integrityViolation(
  message: string,
  details: IntegrityDetail[]
): NextResponse {
  return badRequest(message, details);
}

export function buildLockedFieldsDetails(
  fields: string[],
  reason: string
): IntegrityDetail[] {
  return fields.map((field) => ({
    field,
    code: "locked",
    message: `${field} cannot be changed because ${reason}.`,
  }));
}

export async function getStudentUsageCounts(tenantId: string, studentId: string) {
  const [feeVouchers, attendances, examResults, promotions] = await Promise.all([
    prisma.feeVoucher.count({ where: { tenantId, studentProfileId: studentId } }),
    prisma.attendance.count({ where: { tenantId, studentProfileId: studentId } }),
    prisma.examResult.count({ where: { tenantId, studentProfileId: studentId } }),
    prisma.classPromotion.count({ where: { tenantId, studentProfileId: studentId } }),
  ]);

  return { feeVouchers, attendances, examResults, promotions };
}

export async function getExamUsageCounts(tenantId: string, examId: string) {
  const [results, subjects] = await Promise.all([
    prisma.examResult.count({ where: { tenantId, examId } }),
    prisma.examSubject.count({ where: { tenantId, examId } }),
  ]);

  return { results, subjects };
}

export async function getSubjectUsageCounts(tenantId: string, subjectId: string) {
  const [examResults, examMappings, classMappings] = await Promise.all([
    prisma.examResult.count({ where: { tenantId, subjectId } }),
    prisma.examSubject.count({ where: { tenantId, subjectId } }),
    prisma.classSubject.count({ where: { tenantId, subjectId } }),
  ]);

  return { examResults, examMappings, classMappings };
}

export async function getAcademicYearUsageCounts(tenantId: string, academicYearId: string) {
  const [feeVouchers, salaryLedgers, examResults, exams, promotionRules, fromPromotions, toPromotions] =
    await Promise.all([
      prisma.feeVoucher.count({ where: { tenantId, academicYearId } }),
      prisma.salaryLedger.count({ where: { tenantId, academicYearId } }),
      prisma.examResult.count({ where: { tenantId, academicYearId } }),
      prisma.exam.count({ where: { tenantId, academicYearId } }),
      prisma.promotionRule.count({ where: { tenantId, academicYearId } }),
      prisma.classPromotion.count({ where: { tenantId, fromAcademicYearId: academicYearId } }),
      prisma.classPromotion.count({ where: { tenantId, toAcademicYearId: academicYearId } }),
    ]);

  return {
    feeVouchers,
    salaryLedgers,
    examResults,
    exams,
    promotionRules,
    promotions: fromPromotions + toPromotions,
  };
}

export async function getClassUsageCounts(tenantId: string, classId: string) {
  const [students, groups, sections, classSubjects, promotionRules, fromPromotions, toPromotions] =
    await Promise.all([
      prisma.studentProfile.count({ where: { tenantId, classId } }),
      prisma.group.count({ where: { tenantId, classId } }),
      prisma.section.count({ where: { tenantId, classId } }),
      prisma.classSubject.count({ where: { tenantId, classId } }),
      prisma.promotionRule.count({ where: { tenantId, classId } }),
      prisma.classPromotion.count({ where: { tenantId, fromClassId: classId } }),
      prisma.classPromotion.count({ where: { tenantId, toClassId: classId } }),
    ]);

  return {
    students,
    groups,
    sections,
    classSubjects,
    promotionRules,
    promotions: fromPromotions + toPromotions,
  };
}

export async function getGroupUsageCounts(tenantId: string, groupId: string) {
  const [students, sections] = await Promise.all([
    prisma.studentProfile.count({ where: { tenantId, groupId } }),
    prisma.section.count({ where: { tenantId, groupId } }),
  ]);

  return { students, sections };
}

export async function getSectionUsageCounts(tenantId: string, sectionId: string) {
  const students = await prisma.studentProfile.count({ where: { tenantId, sectionId } });
  return { students };
}

export async function getStaffUsageCounts(tenantId: string, staffId: string) {
  const [salaryLedgers, attendances, linkedUsers] = await Promise.all([
    prisma.salaryLedger.count({ where: { tenantId, staffProfileId: staffId } }),
    prisma.attendance.count({ where: { tenantId, staffProfileId: staffId } }),
    prisma.user.count({ where: { tenantId, staffProfileId: staffId } }),
  ]);

  return { salaryLedgers, attendances, linkedUsers };
}

export async function getUserUsageCounts(tenantId: string, userId: string) {
  const [transactions, attendances, promotions] = await Promise.all([
    prisma.transaction.count({ where: { tenantId, collectedById: userId } }),
    prisma.attendance.count({ where: { tenantId, markedById: userId } }),
    prisma.classPromotion.count({ where: { tenantId, decidedBy: userId } }),
  ]);

  return { transactions, attendances, promotions };
}

export function lockedDeleteMessage(entity: string, counts: UsageCounts) {
  return `${entity} cannot be deleted because it is already referenced by historical records. ${usageMessage(
    "Dependencies found",
    counts
  )}`;
}

export function lockedUpdateMessage(entity: string, reason: string) {
  return `${entity} cannot be edited because ${reason}.`;
}
