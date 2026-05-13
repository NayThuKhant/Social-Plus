import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { redis, CACHE_KEYS, TTL } from "@/lib/redis";

export async function GET() {
  try {
    const cached = await redis.get(CACHE_KEYS.trending);
    if (cached) return NextResponse.json({ data: JSON.parse(cached) });
  } catch {}

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const trending = await prisma.postHashtag.groupBy({
    by: ["hashtagId"],
    where: { post: { createdAt: { gte: since }, isDeleted: false } },
    _count: { hashtagId: true },
    orderBy: { _count: { hashtagId: "desc" } },
    take: 10,
  });

  const hashtagIds = trending.map((t) => t.hashtagId);
  const hashtags = await prisma.hashtag.findMany({
    where: { id: { in: hashtagIds } },
  });

  const result = trending.map((t) => {
    const h = hashtags.find((h) => h.id === t.hashtagId);
    return { tag: h?.tag || "", postsCount: t._count.hashtagId };
  });

  try {
    await redis.set(CACHE_KEYS.trending, JSON.stringify(result), "EX", TTL.trending);
  } catch {}

  return NextResponse.json({ data: result });
}
