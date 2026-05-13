import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { minioClient, BUCKETS, getPublicUrl } from "@/lib/minio";
import { getMediaType } from "@/lib/utils";
import { randomUUID } from "crypto";
import sharp from "sharp";

const ALLOWED_TYPES = [
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "video/mp4", "video/webm", "video/quicktime",
];

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const context = (formData.get("context") as string) || "media";

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "File type not allowed" }, { status: 400 });
    }
    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large (max 50MB)" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    let buffer = Buffer.from(new Uint8Array(bytes));
    const mediaType = getMediaType(file.type);
    const ext = file.name.split(".").pop() || "bin";
    const objectName = `${user.id}/${randomUUID()}.${ext}`;

    let bucket = "media";
    if (context === "avatar") bucket = "avatars";
    if (context === "banner") bucket = "banners";

    // Optimize images (not GIFs/videos)
    if (mediaType === "image") {
      const optimized = await sharp(buffer)
        .resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 85, progressive: true })
        .toBuffer();
      buffer = Buffer.from(new Uint8Array(optimized));
    }

    await minioClient.putObject(bucket, objectName, buffer, buffer.length, {
      "Content-Type": mediaType === "image" ? "image/jpeg" : file.type,
    });

    const url = getPublicUrl(bucket, objectName);
    return NextResponse.json({ data: { url, mediaType, objectName } });
  } catch (err) {
    console.error("[upload]", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
