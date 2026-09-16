import { NextRequest, NextResponse } from "next/server";
import { requireApiAccess } from "@/lib/api-auth";
import { badRequest, handleApiError } from "@/lib/api-response";
import { exportAcademicTabulationSheetToExcel } from "@/lib/excel/export-service";

/**
 * GET /api/exams/tabulation-sheet
 *
 * Streams the Master Academic Tabulation Sheet for a class (optionally scoped
 * to a single exam) as a real .xlsx workbook. Built server-side from Prisma so
 * the sheet contains every student in the class, not just the loaded page.
 */
export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess(request, { permission: "exams:read" });
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get("classId");
    const examId = searchParams.get("examId") || undefined;

    if (!classId) {
      return badRequest("A class must be selected to export the tabulation sheet.");
    }

    const buffer = await exportAcademicTabulationSheetToExcel(tenantId, classId, examId);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="tabulation-sheet_${classId}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleApiError(error, "Failed to export the tabulation sheet");
  }
}
