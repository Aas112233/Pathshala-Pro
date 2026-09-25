import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { successResponse, badRequest, notFound, handleApiError } from "@/lib/api-response";
import { requireApiAccess } from "@/lib/api-auth";
import { resolveRequestAcademicYearId } from "@/lib/academic-year-guards";
import { computeExamFeeDue } from "@/lib/exam-fee-service";

/**
 * GET /api/exam-fees/due
 *
 * Per-student exam-fee position for one exam, optionally narrowed to a class
 * and/or section. This is the read model behind both the single-student POS
 * desk and the class x section bulk grid, so the two can never disagree about
 * who owes what.
 *
 * All money maths happens server-side (AGENTS rule 6); this route only shapes
 * the response.
 */
export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess(request, { module: "fees", action: "read" });
    if ("response" in access) return access.response;
    const { tenantId } = access.authContext;

    const { searchParams } = new URL(request.url);
    const examId = searchParams.get("examId")?.trim();
    const classId = searchParams.get("classId")?.trim() || undefined;
    const sectionId = searchParams.get("sectionId")?.trim() || undefined;
    const search = searchParams.get("search")?.trim();

    if (!examId) {
      return badRequest("examId is required", [
        { field: "examId", code: "required", message: "Select an exam first." },
      ]);
    }

    const exam = await prisma.exam.findFirst({
      where: { id: examId, tenantId },
      select: { id: true, examId: true, name: true, type: true, academicYearId: true, startDate: true, endDate: true },
    });
    if (!exam) {
      return notFound("Exam not found");
    }

    // The exam's own academic year is authoritative for its fees. Honouring a
    // different selected year here would let a cashier bill last year's exam
    // into this year's ledger.
    const requestedYearId = await resolveRequestAcademicYearId(request, tenantId);

    const rows = await computeExamFeeDue(prisma as any, {
      tenantId,
      examId,
      classId,
      sectionId,
      academicYearId: exam.academicYearId,
    });

    const studentIds = rows.map((r) => r.studentProfileId);
    const students = studentIds.length
      ? await prisma.studentProfile.findMany({
          where: { tenantId, id: { in: studentIds } },
          select: {
            id: true,
            studentId: true,
            rollNumber: true,
            firstName: true,
            lastName: true,
            firstNameBn: true,
            lastNameBn: true,
            classId: true,
            sectionId: true,
            class: { select: { id: true, name: true, classId: true } },
            section: { select: { id: true, name: true } },
          },
        })
      : [];
    const studentMap = new Map(students.map((s) => [s.id, s]));

    const shaped = rows
      .map((row) => {
        const student = studentMap.get(row.studentProfileId);
        if (!student) return null;
        return {
          studentProfileId: row.studentProfileId,
          studentId: student.studentId,
          rollNumber: student.rollNumber,
          name: `${student.firstName ?? ""} ${student.lastName ?? ""}`.trim(),
          nameBn: student.firstNameBn || student.lastNameBn
            ? `${student.firstNameBn ?? ""} ${student.lastNameBn ?? ""}`.trim()
            : null,
          classId: student.classId,
          className: student.class?.name ?? "",
          sectionId: student.sectionId,
          sectionName: student.section?.name ?? null,
          grossAmount: row.grossAmount.toFixed(2),
          discountAmount: row.discountAmount.toFixed(2),
          netPayable: row.netPayable.toFixed(2),
          outstanding: row.outstanding.toFixed(2),
          isPaid: row.isPaid,
          existingVoucherId: row.existingVoucherId,
          existingVoucherStatus: row.existingVoucherStatus,
        };
      })
      .filter(Boolean) as any[];

    const filtered = search
      ? shaped.filter((r) =>
          `${r.name} ${r.studentId} ${r.rollNumber ?? ""}`.toLowerCase().includes(search.toLowerCase())
        )
      : shaped;

    const zero = () => new Prisma.Decimal(0);
    const totals = filtered.reduce(
      (acc, r) => {
        acc.gross = acc.gross.plus(r.grossAmount);
        acc.discount = acc.discount.plus(r.discountAmount);
        acc.net = acc.net.plus(r.netPayable);
        acc.outstanding = acc.outstanding.plus(r.outstanding);
        if (r.isPaid) acc.paidCount += 1;
        else acc.unpaidCount += 1;
        return acc;
      },
      {
        gross: zero(),
        discount: zero(),
        net: zero(),
        outstanding: zero(),
        paidCount: 0,
        unpaidCount: 0,
      }
    );

    // Which classes on this exam carry a charge at all. A class listed without
    // a fee is reported as notChargeable so the UI can grey it out instead of
    // showing an all-zero grid that reads like "everyone is settled".
    const examClasses = await prisma.examClass.findMany({
      where: { tenantId, examId },
      select: { classId: true, feeAmount: true, isFeeApplicable: true, class: { select: { id: true, name: true } } },
      orderBy: { class: { name: "asc" } },
    });

    return successResponse(
      {
        exam: {
          id: exam.id,
          examId: exam.examId,
          name: exam.name,
          type: exam.type,
          startDate: exam.startDate,
          endDate: exam.endDate,
          academicYearId: exam.academicYearId,
          academicYearMatchesSelection: requestedYearId === exam.academicYearId,
        },
        classes: examClasses.map((c) => {
          const amount = new Prisma.Decimal(c.feeAmount);
          return {
            classId: c.classId,
            className: c.class?.name ?? "",
            feeAmount: amount.toFixed(2),
            isFeeApplicable: c.isFeeApplicable,
            isChargeable: c.isFeeApplicable && amount.greaterThan(0),
          };
        }),
        students: filtered,
        totals: {
          grossAmount: totals.gross.toFixed(2),
          discountAmount: totals.discount.toFixed(2),
          netPayable: totals.net.toFixed(2),
          outstandingAmount: totals.outstanding.toFixed(2),
          paidCount: totals.paidCount,
          unpaidCount: totals.unpaidCount,
          studentCount: filtered.length,
        },
      },
      "Exam fee position retrieved"
    );
  } catch (error) {
    return handleApiError(error);
  }
}
