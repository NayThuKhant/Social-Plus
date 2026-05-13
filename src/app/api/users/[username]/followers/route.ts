import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const url = new URL(req.url);
  const cursor = url.searchParams.get("cursor");
  const limit = 20;

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const follows = await prisma.follow.findMany({
    where: { followingId: user.id },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    cursor: cursor ? { followerId_followingId: { followerId: cursor, followingId: user.id } } : undefined,
    include: { follower: { select: { id: true, username: true, displayName: true, avatarUrl: true, bio: true, verified: true, followersCount: true } } },
  });

  const hasMore = follows.length > limit;
  const items = (hasMore ? follows.slice(0, limit) : follows).map((f) => f.follower);

  return NextResponse.json({
    data: { items, nextCursor: hasMore ? items[items.length - 1].id : null, hasMore },
  });
}
