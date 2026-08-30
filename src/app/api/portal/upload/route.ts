import { NextRequest } from "next/server";
import { uploadToR2 } from "@/lib/r2-storage";
import { badRequest, successResponse, handleApiError } from "@/lib/api-response";
import { validateUpload } from "@/lib/upload-security";
import { requirePortalAccess } from "@/lib/portal-auth";

export async function POST(request: NextRequest) {
  try {
    const access = await requirePortalAccess(request, "STUDENT");
    if ("response" in access) return access.response;
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return badRequest("No file provided");
    const extension = validateUpload(file);
    if (!extension) return badRequest("Invalid upload. Use a non-empty JPG, PNG, WEBP, or PDF file no larger than 5MB.");
    const result = await uploadToR2(Buffer.from(await file.arrayBuffer()), `temp_${crypto.randomUUID()}.${extension}`, file.type, access.authContext.tenantId, "homework");
    return successResponse({ webViewLink: result.webViewLink, fileId: result.fileId }, "File uploaded", 201);
  } catch (error) {
    return handleApiError(error, "File upload failed");
  }
}
