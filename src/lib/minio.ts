import * as Minio from "minio";

const globalForMinio = globalThis as unknown as {
  minio: Minio.Client | undefined;
};

export const minioClient =
  globalForMinio.minio ??
  new Minio.Client({
    endPoint: process.env.MINIO_ENDPOINT || "localhost",
    port: parseInt(process.env.MINIO_PORT || "9000"),
    useSSL: process.env.MINIO_USE_SSL === "true",
    accessKey: process.env.MINIO_ACCESS_KEY || "minioadmin",
    secretKey: process.env.MINIO_SECRET_KEY || "minioadmin",
  });

if (process.env.NODE_ENV !== "production") globalForMinio.minio = minioClient;

export const BUCKETS: Record<string, string> = {
  MEDIA: "media",
  AVATARS: "avatars",
  BANNERS: "banners",
};

export function getPublicUrl(bucket: string, objectName: string): string {
  const base = process.env.MINIO_PUBLIC_URL || "http://localhost:9000";
  return `${base}/${bucket}/${objectName}`;
}

export async function uploadFile(
  bucket: string,
  objectName: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  await minioClient.putObject(bucket, objectName, buffer, buffer.length, {
    "Content-Type": contentType,
  });
  return getPublicUrl(bucket, objectName);
}

export async function deleteFile(
  bucket: string,
  objectName: string
): Promise<void> {
  await minioClient.removeObject(bucket, objectName);
}
