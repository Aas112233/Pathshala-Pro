import { GetObjectCommand } from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";
import { requireApiAccess } from "@/lib/api-auth";
import { badRequest, notFound, handleApiError } from "@/lib/api-response";
import { getR2Client } from "@/lib/r2-storage";
import { tenantStoragePrefix } from "@/lib/upload-security";
import { verifyFileAccessToken } from "@/lib/jwt";

export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess(request, { module: null, allowUnmapped: true });
    if ("response" in access) return access.response;

    const token = new URL(request.url).searchParams.get("token");
    const key = token ? await verifyFileAccessToken(token, access.authContext.tenantId) : null;
    const prefix = tenantStoragePrefix(access.authContext.tenantId);
    if (!key || !key.startsWith(prefix) || key.includes("..") || key.includes("\\")) {
      return badRequest("Invalid or expired file token");
    }

    const bucket = process.env.R2_BUCKET_NAME;
    if (!bucket) throw new Error("R2_BUCKET_NAME is missing in environment variables.");

    const result = await getR2Client().send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    if (!result.Body) return notFound("File not found");

    const bytes = await result.Body.transformToByteArray();
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": result.ContentType || "application/octet-stream",
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
        ...(result.ETag ? { ETag: result.ETag } : {}),
      },
    });
  } catch (error: any) {
    if (error?.name === "NoSuchKey" || error?.$metadata?.httpStatusCode === 404) {
      return notFound("File not found");
    }
    return handleApiError(error, "Failed to retrieve file");
  }
}
