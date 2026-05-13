import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getBlockedIds } from "@/lib/blocks";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() || "";
  const type = url.searchParams.get("type") || "all"; // all | posts | users | hashtags
  const mutual = url.searchParams.get("mutual") === "true";
  const cursor = url.searchParams.get("cursor");
  const limit = 20;

  if (!q) return NextResponse.json({ data: { posts: [], users: [], hashtags: [] } });

  const viewer = await getCurrentUser();
  const blockedIds = viewer ? await getBlockedIds(viewer.id) : [];

  const results: Record<string, unknown> = {};

  if (type === "all" || type === "users") {
    let mutualIds: string[] | null = null;
    if (mutual && viewer) {
      const [following, followers] = await Promise.all([
        prisma.follow.findMany({ where: { followerId: viewer.id }, select: { followingId: true } }),
        prisma.follow.findMany({ where: { followingId: viewer.id }, select: { followerId: true } }),
      ]);
      const followingSet = new Set(following.map((f) => f.followingId));
      const followerSet = new Set(followers.map((f) => f.followerId));
      mutualIds = [...followingSet].filter((id) => followerSet.has(id));
    }

    results.users = await prisma.user.findMany({
      where: {
        id: {
          ...(blockedIds.length ? { notIn: blockedIds } : {}),
          ...(mutualIds ? { in: mutualIds } : {}),
        },
        OR: [
          { username: { contains: q, mode: "insensitive" } },
          { displayName: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 5,
      select: { id: true, username: true, displayName: true, avatarUrl: true, bio: true, verified: true, followersCount: true },
    });
  }

  if (type === "all" || type === "hashtags") {
    results.hashtags = await prisma.hashtag.findMany({
      where: { tag: { contains: q.replace(/^#/, ""), mode: "insensitive" } },
      orderBy: { postsCount: "desc" },
      take: 5,
    });
  }

  if (type === "all" || type === "posts") {
    // Determine which private-account IDs the viewer can see (own + followed)
    let visiblePrivateIds: string[] | null = null;
    if (viewer) {
      const following = await prisma.follow.findMany({
        where: { followerId: viewer.id },
        select: { followingId: true },
      });
      visiblePrivateIds = [viewer.id, ...following.map((f) => f.followingId)];
    }

    const posts = await prisma.post.findMany({
      where: {
        isDeleted: false,
        userId: blockedIds.length ? { notIn: blockedIds } : undefined,
        content: { contains: q, mode: "insensitive" },
        OR: [{ scheduledAt: null }, { scheduledAt: { lte: new Date() } }],
        user: {
          OR: [
            { isPrivate: false },
            ...(visiblePrivateIds ? [{ id: { in: visiblePrivateIds } }] : []),
          ],
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      cursor: cursor ? { id: cursor } : undefined,
      include: { user: true },
    });

    const hasMore = posts.length > limit;
    const items = hasMore ? posts.slice(0, limit) : posts;
    results.items = items;
    results.nextCursor = hasMore ? items[items.length - 1].id : null;
    results.hasMore = hasMore;
  }

  return NextResponse.json({ data: results });
}
