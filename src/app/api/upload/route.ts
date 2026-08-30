import { NextRequest } from "next/server";
import { uploadToR2, deleteFromR2 } from "@/lib/r2-storage";
import { requireApiAccess } from "@/lib/api-auth";
import { badRequest, successResponse, handleApiError } from "@/lib/api-response";
import {
  MAX_UPLOAD_SIZE,
  sanitizeUploadType,
  isTenantTemporaryObject,
  validateUpload,
} from "@/lib/upload-security";

export async function POST(request: NextRequest) {
  try {
    const access = await requireApiAccess(request, { module: null, allowUnmapped: true });
    if ("response" in access) return access.response;

    const formData = await request.formData();
    const file = formData.get("file");
    const fileType = sanitizeUploadType(formData.get("fileType") as string | null);

    if (!(file instanceof File)) return badRequest("No file provided");

    const extension = validateUpload(file);
    if (!extension) {
      return badRequest(`Invalid upload. Files must be non-empty, no larger than ${MAX_UPLOAD_SIZE / 1024 / 1024}MB, and use a matching JPG, PNG, WEBP, or PDF extension.`);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const tempFileName = `temp_${crypto.randomUUID()}.${extension}`;

    const result = await uploadToR2(
      buffer,
      tempFileName,
      file.type,
      access.authContext.tenantId,
      fileType
    );

    return successResponse(
      {
        fileId: result.fileId,
        webViewLink: result.webViewLink,
      },
      "File uploaded to Cloudflare R2 successfully",
      201
    );
  } catch (error: any) {
    return handleApiError(error, "Failed to upload file");
  }
}

/**
 * DELETE /api/upload
 * Delete a temporary uploaded file (used when user cancels form)
 */
export async function DELETE(request: NextRequest) {
  try {
    const access = await requireApiAccess(request, { module: null, allowUnmapped: true });
    if ("response" in access) return access.response;

    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get("fileId");
    if (!fileId || !isTenantTemporaryObject(fileId, access.authContext.tenantId)) {
      return badRequest("Only a temporary file belonging to this tenant can be deleted");
    }

    await deleteFromR2(fileId);

    return successResponse(null, "Temporary file deleted successfully");
  } catch (error: any) {
    return handleApiError(error, "Failed to delete temporary file");
  }
}
