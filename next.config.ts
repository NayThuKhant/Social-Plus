import type { NextConfig } from "next";

function parseMinioPattern(urlStr: string) {
  try {
    const u = new URL(urlStr);
    return {
      protocol: u.protocol.replace(":", "") as "http" | "https",
      hostname: u.hostname,
      ...(u.port ? { port: u.port } : {}),
    };
  } catch {
    return { protocol: "http" as const, hostname: "localhost", port: "9000" };
  }
}

const minioPublicUrl =
  process.env.NEXT_PUBLIC_MINIO_PUBLIC_URL ||
  process.env.MINIO_PUBLIC_URL ||
  "http://localhost:9000";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      parseMinioPattern(minioPublicUrl),
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;
