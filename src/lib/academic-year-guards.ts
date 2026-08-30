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
