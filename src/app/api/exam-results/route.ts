import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  paginatedResponse,
  badRequest,
  validationError,
  handleApiError,
} from "@/lib/api-response";
import { createExamResultNewSchema } from "@/lib/schemas";
import { requireApiAccess } from "@/lib/api-auth";
import { validateExamResultBatch } from "@/lib/exam-result-service";

/**
 * GET /api/exam-results
 * Get exam results with pagination, search, and filters
 */
export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;
    const { searchParams } = new URL(request.url);

    // Pagination params — the ceiling accommodates marks-entry hydration for
    // a full class roster in one request (the form refetches everything).
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(500, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const skip = (page - 1) * limit;

    // Filter params
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status");
    const examId = searchParams.get("examId");
    const subjectId = searchParams.get("subjectId");
    const studentProfileId = searchParams.get("studentProfileId");
    const academicYearId = searchParams.get("academicYearId");
    const classId = searchParams.get("classId");

    const where: any = { tenantId };

    if (examId) where.examId = examId;
    if (subjectId) where.subjectId = subjectId;
    if (studentProfileId) where.studentProfileId = studentProfileId;
    if (academicYearId) where.academicYearId = academicYearId;
    if (status) where.status = status;

    if (classId) {
      where.studentProfile = {
        classId,
      };
    }

    // Text search on student name / studentId
    if (search && search.trim()) {
      where.studentProfile = {
        ...(where.studentProfile || {}),
        OR: [
          { firstName: { contains: search.trim(), mode: "insensitive" } },
          { lastName: { contains: search.trim(), mode: "insensitive" } },
          { firstNameBn: { contains: search.trim(), mode: "insensitive" } },
          { lastNameBn: { contains: search.trim(), mode: "insensitive" } },
          { studentId: { contains: search.trim(), mode: "insensitive" } },
        ],
      };
    }

    const [results, totalCount] = await Promise.all([
      prisma.examResult.findMany({
        where,
        include: {
          studentProfile: {
            select: {
              studentId: true,
              firstName: true,
              lastName: true,
              firstNameBn: true,
              lastNameBn: true,
              rollNumber: true,
              classId: true,
              class: {
                select: {
                  id: true,
                  name: true,
                  classId: true,
                },
              },
            },
          },
          exam: {
            select: {
              id: true,
              examId: true,
              name: true,
              type: true,
            },
          },
          subject: {
            select: {
              id: true,
              subjectId: true,
              name: true,
              code: true,
            },
          },
          academicYear: {
            select: {
              yearId: true,
              label: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.examResult.count({ where }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return paginatedResponse(results, {
      totalCount,
      currentPage: page,
      pageSize: limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Parse the request body into schema-valid rows, collecting field-level
 * errors per row. Shared by POST and PUT.
 */
async function parseResultRows(body: unknown) {
  const resultsData = Array.isArray(body) ? body : [body];
  if (resultsData.length === 0) {
    return { parseError: badRequest("No results provided"), rows: [] as ParsedResultRow[] };
  }

  const rows: ParsedResultRow[] = [];
  const errors: Array<{ field?: string; code: string; message: string }> = [];

  for (const [index, resultData] of resultsData.entries()) {
    const validation = createExamResultNewSchema.safeParse(resultData);
    if (!validation.success) {
      errors.push(
        ...validation.error.errors.map((err) => ({
          field: `results[${index}].${err.path.join(".")}`,
          code: err.code,
          message: err.message,
        }))
      );
      continue;
    }
    rows.push(validation.data);
  }

  if (errors.length > 0) {
    return { parseError: validationError(errors), rows: [] as ParsedResultRow[] };
  }
  return { parseError: null, rows };
}

type ParsedResultRow = ReturnType<typeof createExamResultNewSchema.parse>;

/** Map a race with the unique constraint to the standard duplicate error shape. */
function duplicateConstraintError(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  ) {
    return validationError([
      {
        field: "results",
        code: "duplicate",
        message: "Result already exists for this student, exam, and subject combination",
      },
    ]);
  }
  return null;
}

/** Response include shared by POST and PUT writes. */
const resultWriteInclude = {
  studentProfile: {
    select: {
      studentId: true,
      firstName: true,
      lastName: true,
      rollNumber: true,
      classId: true,
    },
  },
  subject: {
    select: {
      name: true,
      code: true,
    },
  },
} as const;

/**
 * POST /api/exam-results
 * Create exam result(s) — supports bulk creation.
 *
 * The whole batch is validated and written inside a single transaction, so a
 * failure on any row rolls back every row: there are never partial saves, and
 * concurrent submissions race only against the unique constraint (mapped to a
 * clean duplicate error).
 */
export async function POST(request: NextRequest) {
  try {
    const access = await requireApiAccess(request, { permission: "exams:marks:write" });
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;
    const body = await request.json().catch(() => null);
    const { parseError, rows } = await parseResultRows(body);
    if (parseError) return parseError;

    try {
      const createdResults = await prisma.$transaction(async (tx) => {
        const { validRows, errors } = await validateExamResultBatch(tx, tenantId, rows, "create");
        if (errors.length > 0) {
          return validationError(errors) as never;
        }
        return Promise.all(
          validRows.map((row) =>
            tx.examResult.create({
              data: {
                tenantId,
                studentProfileId: row.studentProfileId,
                academicYearId: row.academicYearId,
                examId: row.examId,
                subjectId: row.subjectId,
                maxMarks: row.maxMarks,
                obtainedMarks: row.obtainedMarks,
                percentage: row.percentage,
                grade: row.grade,
                gradePoint: row.gradePoint,
                status: row.status,
                reExamAllowed: row.reExamAllowed,
              },
              include: resultWriteInclude,
            })
          )
        );
      });

      return successResponse(
        createdResults,
        `Successfully created ${createdResults.length} exam result(s)`,
        201
      );
    } catch (error) {
      const mapped = duplicateConstraintError(error);
      if (mapped) return mapped;
      throw error;
    }
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PUT /api/exam-results
 * Bulk upsert exam results — create new rows or update existing ones.
 *
 * Same transactional guarantee as POST: validation + writes are atomic, and
 * published exams / promoted students / locked rows are rejected before any
 * write happens (all-or-nothing, no partial saves).
 */
export async function PUT(request: NextRequest) {
  try {
    const access = await requireApiAccess(request, { permission: "exams:marks:write" });
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;
    const body = await request.json().catch(() => null);
    const { parseError, rows } = await parseResultRows(body);
    if (parseError) return parseError;

    try {
      const upsertedResults = await prisma.$transaction(async (tx) => {
        const { validRows, errors } = await validateExamResultBatch(tx, tenantId, rows, "upsert");
        if (errors.length > 0) {
          return validationError(errors) as never;
        }
        return Promise.all(
          validRows.map((row) => {
            const data = {
              maxMarks: row.maxMarks,
              obtainedMarks: row.obtainedMarks,
              percentage: row.percentage,
              grade: row.grade,
              gradePoint: row.gradePoint,
              status: row.status,
              reExamAllowed: row.reExamAllowed,
            };
            if (row.existingResultId) {
              return tx.examResult.update({
                where: { id: row.existingResultId },
                data,
                include: resultWriteInclude,
              });
            }
            return tx.examResult.create({
              data: {
                tenantId,
                studentProfileId: row.studentProfileId,
                academicYearId: row.academicYearId,
                examId: row.examId,
                subjectId: row.subjectId,
                ...data,
              },
              include: resultWriteInclude,
            });
          })
        );
      });

      return successResponse(
        upsertedResults,
        `Successfully saved ${upsertedResults.length} exam result(s)`
      );
    } catch (error) {
      const mapped = duplicateConstraintError(error);
      if (mapped) return mapped;
      throw error;
    }
  } catch (error) {
    return handleApiError(error);
  }
}