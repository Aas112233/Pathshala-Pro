import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  badRequest,
  validationError,
  handleApiError,
} from "@/lib/api-response";
import { bulkIssueCertificatesSchema } from "@/lib/schemas";
import { requireApiAccess } from "@/lib/api-auth";
import { logAuditEvent } from "@/lib/audit-logger";
import {
  ACTIVE_CERTIFICATE_STATUSES,
  isSingleActiveCertificateType,
  allocateCertificateNumbers,
} from "@/lib/certificate-numbering";

/**
 * POST /api/certificates/bulk
 *
 * Issue one certificate per student, atomically.
 *
 * This exists because issuing a year-end batch of transfer certificates through
 * the single-issue route means N round-trips, and each of those would read the
 * same "latest certificate number" row and allocate the same sequence. One
 * request, one transaction, one numbering run.
 *
 * Students who already hold an active certificate of a single-active type (see
 * `SINGLE_ACTIVE_CERTIFICATE_TYPES`) are reported as skipped rather than
 * silently duplicated or failing the whole batch: a school issuing 60 transfer
 * certificates should not lose 59 of them because one student was already
 * processed.
 *
 * Permission is enforced by the API path → module mapping (`certificates`,
 * action `write`), which requires more than the read grant parents and students
 * hold.
 */
export async function POST(request: NextRequest) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { tenantId, user } = access.authContext;

    const body = await request.json().catch(() => null);
    if (!body) return badRequest("A JSON request body is required.");

    const parsed = bulkIssueCertificatesSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(
        parsed.error.errors.map((error) => ({
          field: error.path.join("."),
          code: error.code,
          message: error.message,
        }))
      );
    }

    const input = parsed.data;

    // A repeated id would attempt a second certificate for one student. The
    // single-active guard only inspects pre-existing rows, so the duplicate has
    // to be removed here rather than relied on to be caught later.
    const studentProfileIds = [...new Set(input.studentProfileIds)];

    if (studentProfileIds.length !== input.studentProfileIds.length) {
      return badRequest(
        "The same student appears more than once in this batch.",
        [
          {
            field: "studentProfileIds",
            code: "DUPLICATE_STUDENT",
            message: "Deduplicate the selection before issuing certificates.",
          },
        ]
      );
    }

    let issueDate = new Date();
    if (input.issueDate) {
      issueDate = new Date(input.issueDate);
      if (Number.isNaN(issueDate.getTime())) {
        return badRequest("The issue date is not a valid date.", [
          {
            field: "issueDate",
            code: "INVALID_DATE",
            message: "Provide a valid issue date.",
          },
        ]);
      }
    }

    let validUntil: Date | null = null;
    if (input.validUntil) {
      validUntil = new Date(input.validUntil);
      if (Number.isNaN(validUntil.getTime())) {
        return badRequest("The valid-until date is not a valid date.", [
          {
            field: "validUntil",
            code: "INVALID_DATE",
            message: "Provide a valid expiry date, or leave it empty.",
          },
        ]);
      }
    }

    const certificateType = input.certificateType;

    // Fail closed: every requested student must belong to this tenant. Silently
    // dropping unknown ids would make a typo look like a successful batch.
    const students = await prisma.studentProfile.findMany({
      where: { tenantId, id: { in: studentProfileIds } },
      select: {
        id: true,
        studentId: true,
        firstName: true,
        lastName: true,
        rollNumber: true,
        fatherName: true,
        guardianName: true,
        dateOfBirth: true,
        admissionDate: true,
        class: { select: { name: true } },
        section: { select: { name: true } },
      },
    });

    const studentById = new Map(students.map((student) => [student.id, student]));
    const missing = studentProfileIds.filter((id) => !studentById.has(id));
    if (missing.length > 0) {
      return badRequest(
        "Some selected students could not be found for this institute.",
        missing.map((id) => ({
          field: "studentProfileIds",
          code: "STUDENT_NOT_FOUND",
          message: `Student ${id} does not exist for this tenant.`,
        }))
      );
    }

    // Students who already hold an active certificate of a single-active type
    // are skipped, not failed and not duplicated.
    const alreadyActive = new Set<string>();
    if (isSingleActiveCertificateType(certificateType)) {
      const existing = await prisma.certificate.findMany({
        where: {
          tenantId,
          studentProfileId: { in: studentProfileIds },
          certificateType,
          status: { in: [...ACTIVE_CERTIFICATE_STATUSES] },
        },
        select: { studentProfileId: true, certificateNumber: true },
      });
      for (const row of existing) alreadyActive.add(row.studentProfileId);
    }

    const toIssue = studentProfileIds.filter((id) => !alreadyActive.has(id));

    const skipped = studentProfileIds
      .filter((id) => alreadyActive.has(id))
      .map((id) => {
        const student = studentById.get(id)!;
        return {
          studentProfileId: id,
          studentName: `${student.firstName} ${student.lastName}`.trim(),
          code: "CERTIFICATE_ALREADY_ACTIVE" as const,
          message: `An active ${certificateType} certificate already exists for this student.`,
        };
      });

    if (toIssue.length === 0) {
      return successResponse(
        {
          certificateType,
          issueDate: issueDate.toISOString(),
          issued: [],
          skipped,
        },
        "No certificates were issued: every selected student already holds an active certificate of this type.",
        200
      );
    }

    const outcome = await prisma.$transaction(
      async (tx) => {
        // Numbers are allocated from one read of the current high-water mark, so
        // the batch produces a contiguous run instead of N independent probes.
        const numbers = await allocateCertificateNumbers(
          tx,
          tenantId,
          certificateType,
          toIssue.length,
          issueDate
        );

        const created: Array<{
          id: string;
          certificateNumber: string;
          certificateType: string;
          issueDate: Date;
          validUntil: Date | null;
          purpose: string | null;
          status: string;
          studentProfileId: string;
        }> = [];

        for (let i = 0; i < toIssue.length; i++) {
          const studentProfileId = toIssue[i];
          const certificate = await tx.certificate.create({
            data: {
              tenantId,
              studentProfileId,
              certificateType,
              certificateNumber: numbers[i],
              issueDate,
              validUntil,
              purpose: input.purpose || null,
              remarks: input.remarks || null,
              issuedById: user.id,
              status: "ISSUED",
            },
            select: {
              id: true,
              certificateNumber: true,
              certificateType: true,
              issueDate: true,
              validUntil: true,
              purpose: true,
              status: true,
              studentProfileId: true,
            },
          });
          created.push(certificate);
        }

        // Issuing a batch of certificates is a document-generating act against
        // real students; the entry belongs in the same transaction as the rows.
        await logAuditEvent(
          {
            tenantId,
            userId: user.id,
            userEmail: user.email,
            action: "ISSUE",
            entity: "Certificate",
            details: {
              certificateType,
              issueDate: issueDate.toISOString(),
              issuedCount: created.length,
              skippedCount: skipped.length,
              certificateNumbers: created.map((certificate) => certificate.certificateNumber),
              studentProfileIds: created.map((certificate) => certificate.studentProfileId),
            },
          },
          tx
        );

        return created;
      },
      { timeout: 120_000, maxWait: 15_000 }
    );

    // The print surface needs the student's identifying details, and it already
    // has them: re-fetching per certificate would be N more round-trips for
    // data this route just read.
    const issued = outcome.map((certificate) => {
      const student = studentById.get(certificate.studentProfileId)!;
      return {
        id: certificate.id,
        certificateNumber: certificate.certificateNumber,
        certificateType: certificate.certificateType,
        issueDate: certificate.issueDate.toISOString(),
        validUntil: certificate.validUntil ? certificate.validUntil.toISOString() : null,
        purpose: certificate.purpose,
        status: certificate.status,
        studentProfileId: certificate.studentProfileId,
        student: {
          id: student.id,
          studentId: student.studentId,
          firstName: student.firstName,
          lastName: student.lastName,
          rollNumber: student.rollNumber,
          fatherName: student.fatherName,
          guardianName: student.guardianName,
          dateOfBirth: student.dateOfBirth ? student.dateOfBirth.toISOString() : null,
          admissionDate: student.admissionDate ? student.admissionDate.toISOString() : null,
          className: student.class?.name ?? null,
          sectionName: student.section?.name ?? null,
        },
      };
    });

    const skippedNote = skipped.length ? `, ${skipped.length} skipped` : "";

    return successResponse(
      {
        certificateType,
        issueDate: issueDate.toISOString(),
        issued,
        skipped,
      },
      `Issued ${issued.length} ${certificateType} certificate(s)${skippedNote}.`,
      201
    );
  } catch (error) {
    return handleApiError(error);
  }
}
