import { S3Client } from "@aws-sdk/client-s3";
import { ApiError } from "../../../shared/errors.js";

let client = null;

function credentials() {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_KEY;
  if (!accessKeyId || !secretAccessKey) return undefined; // fall back to the task/instance role
  return { accessKeyId, secretAccessKey };
}

export function getS3() {
  if (client) return client;

  if (!process.env.AWS_BUCKET_NAME) {
    throw new ApiError(503, "File storage is not configured", "STORAGE_NOT_CONFIGURED");
  }

  client = new S3Client({
    region: process.env.AWS_REGION || "ap-south-1",
    credentials: credentials(),
  });
  return client;
}

export default getS3;
