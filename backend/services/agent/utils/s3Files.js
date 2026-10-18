import { getS3 } from "../config/s3.js";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ApiError } from "../../../shared/errors.js";
import { logger } from "../../../shared/logger.js";

export const SIGNED_URL_TTL_SECONDS = Number(process.env.SIGNED_URL_TTL_SECONDS || 600);

export async function uploadToS3(filename, buffer, contentType) {
  try {
    await getS3().send(
      new PutObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Body: buffer,
        Key: filename,
        ContentType: contentType,
        ServerSideEncryption: "AES256",
      }),
    );
    return filename;
  } catch (error) {
    logger.error({ err: error.message, filename }, "S3 upload failed");
    throw new ApiError(503, "File storage is unavailable right now", "STORAGE_UPLOAD_FAILED");
  }
}

/**
 * Files are always delivered through short-lived pre-signed URLs so the bucket
 * itself never has to be public.
 */
export async function getFromS3(filename, expiresIn = SIGNED_URL_TTL_SECONDS) {
  try {
    return await getSignedUrl(
      getS3(),
      new GetObjectCommand({ Bucket: process.env.AWS_BUCKET_NAME, Key: filename }),
      { expiresIn },
    );
  } catch (error) {
    logger.error({ err: error.message, filename }, "S3 signing failed");
    throw new ApiError(503, "File storage is unavailable right now", "STORAGE_SIGN_FAILED");
  }
}
