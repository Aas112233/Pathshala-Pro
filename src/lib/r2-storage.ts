import { S3Client, PutObjectCommand, CopyObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { signFileAccessToken } from "@/lib/jwt";

export const getR2Client = () => {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("R2 credentials missing in environment variables.");
  }

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
};

export async function uploadToR2(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
  tenantId: string,
  fileType: string = "general"
) {
  try {
    const s3Client = getR2Client();
    const bucketName = process.env.R2_BUCKET_NAME;

    if (!bucketName) {
      throw new Error("R2_BUCKET_NAME is missing in environment variables.");
    }

    // Build the hierarchical object path: Tenant_{ID}/fileType/fileName
    // We sanitize standard tenantId just to be safe
    const safeTenantId = `Tenant_${tenantId.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
    const objectKey = `${safeTenantId}/${fileType}/${fileName}`;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: objectKey,
        Body: fileBuffer,
        ContentType: mimeType,
      })
    );

    // Never expose the R2 bucket or a public CDN URL. The application file
    // endpoint authenticates the caller and enforces the tenant prefix.
    return {
      fileId: objectKey,
      webViewLink: await createR2FileUrl(objectKey, tenantId),
    };
  } catch (error) {
    console.error("Error uploading to Cloudflare R2:", error);
    throw error;
  }
}

export async function createR2FileUrl(objectKey: string, tenantId: string): Promise<string> {
  const token = await signFileAccessToken(objectKey, tenantId);
  return `/api/files?token=${encodeURIComponent(token)}`;
}

export async function renameR2Object(oldKey: string, newKey: string) {
  try {
    const s3Client = getR2Client();
    const bucketName = process.env.R2_BUCKET_NAME;
    if (!bucketName) return;

    // S3/R2 does not have a "Rename" command. We must Copy then Delete.
    await s3Client.send(
      new CopyObjectCommand({
        Bucket: bucketName,
        CopySource: `${bucketName}/${oldKey}`,
        Key: newKey,
      })
    );

    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: bucketName,
        Key: oldKey,
      })
    );

  } catch (error) {
    console.error(`Failed to rename R2 object from ${oldKey} to ${newKey}:`, error);
    throw error; // We throw so the caller knows it failed
  }
}

export async function deleteFromR2(objectKey: string) {
  try {
    const s3Client = getR2Client();
    const bucketName = process.env.R2_BUCKET_NAME;
    if (!bucketName) return;

    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: bucketName,
        Key: objectKey,
      })
    );
  } catch (error) {
    console.error(`Failed to delete R2 object ${objectKey}:`, error);
    throw error;
  }
}
