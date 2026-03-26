import { NextRequest, NextResponse } from "next/server";
import { uploadToR2, deleteFromR2 } from "@/lib/r2-storage";
import { getAuthContext } from "@/lib/auth";
import { unauthorized, errorResponse, successResponse } from "@/lib/api-response";

export async function POST(request: NextRequest) {
  try {
    const authContext = await getAuthContext(request);
    if (!authContext) {
      return unauthorized("Authentication required");
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const fileType = formData.get("fileType") as string || "general";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Input sanitization: ensure it's a valid image or specific document and not too large
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB limit
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File exceeds the 5MB size limit" }, { status: 400 });
    }

    const allowedMimeTypes = [
      "image/jpeg", "image/png", "image/webp", "image/jpg",
      "application/pdf" // For receipt documents etc.
    ];
    if (!allowedMimeTypes.includes(file.type)) {
      return NextResponse.json({ error: "Invalid file type. Only JPG, PNG, WEBP, and PDF are allowed." }, { status: 400 });
    }

    // Convert Next.js Web API File to a Node.js Buffer for S3/R2 AWS SDK
    const buffer = Buffer.from(await file.arrayBuffer());

    // Upload it directly to Cloudflare R2
    // We use Date.now() to ensure the temporary uploaded object has a unique name before renaming it permanently
    const extension = file.name.split(".").pop();
    const tempFileName = `temp_${Date.now()}.${extension}`;

    const result = await uploadToR2(
      buffer,
      tempFileName,
      file.type,
      authContext.tenantId,
      fileType
    );

    return successResponse(
      {
        fileId: result.fileId, // The exact Storage Object Key (used for renaming later)
        webViewLink: result.webViewLink, // The direct HTTP link to give the browser
      },
      "File uploaded to Cloudflare R2 successfully",
      201
    );
  } catch (error: any) {
    console.error("Upload error:", error);
    return errorResponse(error.message || "Failed to upload file", 500);
  }
}

/**
 * DELETE /api/upload
 * Delete a temporary uploaded file (used when user cancels form)
 */
export async function DELETE(request: NextRequest) {
  try {
    const authContext = await getAuthContext(request);
    if (!authContext) {
      return unauthorized("Authentication required");
    }

    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get("fileId");

    if (!fileId) {
      return NextResponse.json({ error: "File ID required" }, { status: 400 });
    }

    // Only allow deleting temp files (files starting with "temp_")
    if (!fileId.includes("temp_")) {
      return NextResponse.json({ error: "Can only delete temporary files" }, { status: 400 });
    }

    await deleteFromR2(fileId);

    return successResponse(null, "Temporary file deleted successfully");
  } catch (error: any) {
    console.error("Delete temp file error:", error);
    return errorResponse(error.message || "Failed to delete temporary file", 500);
  }
}
