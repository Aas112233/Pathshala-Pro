import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { ApiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";

/**
 * Resolve a tenant-owned academic year and enforce that it is writable.
 * Keep this check close to every write boundary; UI-selected years are not
 * trusted and a fiscal-year lock does not imply an academic-year lock.
 */
export async function assertAcademicYearOpen(
  tenantId: string,
  academicYearId: string,
  label = "Academic year"
) {
  const academicYear = await prisma.academicYear.findFirst({
    where: { id: academicYearId, tenantId },
    select: { id: true, tenantId: true, yearId: true, label: true, isClosed: true },
  });

  if (!academicYear) {
    throw ApiError.notFound(`${label} not found`);
  }

  if (academicYear.isClosed) {
    throw ApiError.conflict(`${label} '${academicYear.label}' is closed and read-only`, [
      { field: "academicYearId", code: "ACADEMIC_YEAR_CLOSED", message: "Mutations are not allowed for a closed academic year." },
    ]);
  }

  return academicYear;
}

export async function assertAcademicYearsOpen(
  tenantId: string,
  academicYearIds: string[]
) {
  const uniqueIds = [...new Set(academicYearIds)];
  const years = await prisma.academicYear.findMany({
    where: { tenantId, id: { in: uniqueIds } },
    select: { id: true, label: true, isClosed: true },
  });

  if (years.length !== uniqueIds.length) {
    throw ApiError.notFound("One or more academic years were not found");
  }

  const closed = years.find((year) => year.isClosed);
  if (closed) {
    throw ApiError.conflict(`Academic year '${closed.label}' is closed and read-only`, [
      { field: "academicYearId", code: "ACADEMIC_YEAR_CLOSED", message: "Mutations are not allowed for a closed academic year." },
    ]);
  }

  return years;
}

/**
 * Resolve the applicable academic year for a request.
 * Hierarchy:
 * 1. Explicit query parameter `academicYearId`
 * 2. Request header `x-academic-year-id`
 * 3. Cookie `pathshala_academic_year`
 * 4. Current active open academic year (by date range or latest non-closed)
 * 5. Latest academic year by start date
 */
export const defaultAcademicYearCache = new Map<string, { yearId: string; expiresAt: number }>();

export function clearAcademicYearCache(): void {
  defaultAcademicYearCache.clear();
}

export async function resolveRequestAcademicYearId(
  request: NextRequest,
  tenantId: string
): Promise<string> {
  const paramYear = request.nextUrl.searchParams.get("academicYearId")?.trim();
  if (paramYear) return paramYear;

  const headerYear = request.headers.get("x-academic-year-id")?.trim();
  if (headerYear) return headerYear;

  const cookieYear = request.cookies.get("pathshala_academic_year")?.value?.trim();
  if (cookieYear) return cookieYear;

  const nowMs = Date.now();
  if (process.env.NODE_ENV !== "test") {
    const cached = defaultAcademicYearCache.get(tenantId);
    if (cached && cached.expiresAt > nowMs) {
      return cached.yearId;
    }
  }

  const now = new Date();
  const currentByDate = await prisma.academicYear.findFirst({
    where: {
      tenantId,
      isClosed: false,
      startDate: { lte: now },
      endDate: { gte: now },
    },
    select: { id: true },
  });
  if (currentByDate) {
    defaultAcademicYearCache.set(tenantId, { yearId: currentByDate.id, expiresAt: nowMs + 60000 });
    return currentByDate.id;
  }

  const latestOpen = await prisma.academicYear.findFirst({
    where: { tenantId, isClosed: false },
    orderBy: { startDate: "desc" },
    select: { id: true },
  });
  if (latestOpen) {
    defaultAcademicYearCache.set(tenantId, { yearId: latestOpen.id, expiresAt: nowMs + 60000 });
    return latestOpen.id;
  }

  const latestAny = await prisma.academicYear.findFirst({
    where: { tenantId },
    orderBy: { startDate: "desc" },
    select: { id: true },
  });
  const yearId = latestAny?.id || "";
  defaultAcademicYearCache.set(tenantId, { yearId, expiresAt: nowMs + 60000 });
  return yearId;
}

/**
 * Atomically ensure that a StudentAcademicSession exists for a student in the given academic year.
 * If already present, updates the active enrollment fields (class, section, group, rollNumber).
 */
export async function ensureStudentAcademicSession(
  tx: Prisma.TransactionClient,
  params: {
    tenantId: string;
    studentProfileId: string;
    academicYearId: string;
    classId: string;
    sectionId?: string | null;
    groupId?: string | null;
    rollNumber: string;
    classNumber?: number;
  }
) {
  const {
    tenantId,
    studentProfileId,
    academicYearId,
    classId,
    sectionId,
    groupId,
    rollNumber,
    classNumber = 0,
  } = params;

  if (!academicYearId || !classId) return null;

  const existing = await tx.studentAcademicSession.findUnique({
    where: {
      tenantId_studentProfileId_academicYearId: {
        tenantId,
        studentProfileId,
        academicYearId,
      },
    },
  });

  if (existing) {
    return tx.studentAcademicSession.update({
      where: { id: existing.id },
      data: {
        classId,
        sectionId: sectionId ?? null,
        groupId: groupId ?? null,
        rollNumber,
        classNumber,
      },
    });
  }

  return tx.studentAcademicSession.create({
    data: {
      tenantId,
      studentProfileId,
      academicYearId,
      classId,
      sectionId: sectionId ?? null,
      groupId: groupId ?? null,
      rollNumber,
      classNumber,
      totalMarks: 0,
      obtainedMarks: 0,
      promotionStatus: "ENROLLED",
    },
  });
}

