import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getBlockedIds } from "@/lib/blocks";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const cursor = url.searchParams.get("cursor");
  const tab = url.searchParams.get("tab") || "foryou"; // foryou | following
  const limit = 20;

  const [following, blockedIds] = await Promise.all([
    prisma.follow.findMany({ where: { followerId: user.id }, select: { followingId: true } }),
    getBlockedIds(user.id),
  ]);
  const followingIds = [user.id, ...following.map((f) => f.followingId)];

  const baseWhere = {
    isDeleted: false,
    OR: [{ scheduledAt: null }, { scheduledAt: { lte: new Date() } }],
  };

  const whereClause = tab === "following"
    ? {
        ...baseWhere,
        userId: { in: followingIds, notIn: blockedIds },
      }
    : {
        // For You: all public posts, excluding blocked users
        ...baseWhere,
        userId: blockedIds.length ? { notIn: blockedIds } : undefined,
        user: { isPrivate: false },
      };

  const orderBy = tab === "following"
    ? [{ createdAt: "desc" as const }]
    : [{ viewsCount: "desc" as const }, { likesCount: "desc" as const }, { createdAt: "desc" as const }];

  const posts = await prisma.post.findMany({
    where: whereClause,
    orderBy,
    take: limit + 1,
    cursor: cursor ? { id: cursor } : undefined,
    include: {
      user: true,
      quoteOf: { include: { user: true } },
      poll: { include: { options: { include: { votes: { where: { userId: user.id }, select: { optionId: true } } } } } },
      likes: { where: { userId: user.id } },
      repostedBy: { where: { userId: user.id } },
      bookmarks: { where: { userId: user.id } },
    },
  });

  const hasMore = posts.length > limit;
  const items = hasMore ? posts.slice(0, limit) : posts;

  const enriched = items.map((p) => {
    const userVoteId = p.poll?.options.find((o) => o.votes.length > 0)?.id ?? null;
    return {
      ...p,
      isLiked: p.likes.length > 0,
      isReposted: p.repostedBy.length > 0,
      isBookmarked: p.bookmarks.length > 0,
      likes: undefined,
      repostedBy: undefined,
      bookmarks: undefined,
      poll: p.poll
        ? {
            ...p.poll,
            userVoteId,
            options: p.poll.options.map(({ votes: _v, ...o }) => o),
          }
        : null,
    };
  });

  return NextResponse.json({
    data: {
      items: enriched,
      nextCursor: hasMore ? items[items.length - 1].id : null,
      hasMore,
    },
  });
}
