import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, paginatedResponse, badRequest, handleApiError } from "@/lib/api-response";
import { requireApiAccess } from "@/lib/api-auth";
import { z } from "zod";

const upsertSchema = z.object({
  classId: z.string().min(1),
  subjectId: z.string().min(1),
  weights: z.array(z.object({ chapter: z.string().min(1), weight: z.number().min(0).max(100) })).min(1),
});

/**
 * GET /api/syllabus-weights?classId=&subjectId=
 * List chapter weights for a class/subject
 */
export async function GET(req: NextRequest) {
  try {
    const access = await requireApiAccess(req);
    if ("response" in access) return access.response;
    const { tenantId } = access.authContext;
    const { searchParams } = new URL(req.url);
    const classId = searchParams.get("classId") || undefined;
    const subjectId = searchParams.get("subjectId") || undefined;
    const where: any = { tenantId };
    if (classId) where.classId = classId;
    if (subjectId) where.subjectId = subjectId;
    const data = await (prisma as any).syllabusWeight?.findMany?.({ where, orderBy: { chapter: "asc" } }) || [];
    return successResponse(data);
  } catch (e) { return handleApiError(e); }
}

/**
 * POST /api/syllabus-weights
 * Upsert chapter weights (replace all for class/subject)
 */
export async function POST(req: NextRequest) {
  try {
    const access = await requireApiAccess(req);
    if ("response" in access) return access.response;
    const { tenantId } = access.authContext;
    const body = await req.json();
    const parsed = upsertSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.errors[0].message);
    const { classId, subjectId, weights } = parsed.data;
    const sum = weights.reduce((s, w) => s + w.weight, 0);
    if (Math.abs(sum - 100) > 0.01) return badRequest(`Weights must sum to 100 (got ${sum})`);
    // Replace
    await (prisma as any).syllabusWeight?.deleteMany?.({ where: { tenantId, classId, subjectId } });
    const created = await Promise.all(weights.map((w) => (prisma as any).syllabusWeight.create({ data: { tenantId, classId, subjectId, chapter: w.chapter.trim(), weight: w.weight } })));
    return successResponse(created, "Syllabus weights saved");
  } catch (e) { return handleApiError(e); }
}
