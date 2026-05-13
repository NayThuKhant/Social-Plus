import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const cursor = url.searchParams.get("cursor");
  const limit = 20;
  const user = await getCurrentUser();

  // Trending posts: most engagement in last 24h
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const posts = await prisma.post.findMany({
    where: {
      isDeleted: false,
      createdAt: { gte: since },
      OR: [{ scheduledAt: null }, { scheduledAt: { lte: new Date() } }],
    },
    orderBy: [{ likesCount: "desc" }, { repostsCount: "desc" }, { createdAt: "desc" }],
    take: limit + 1,
    cursor: cursor ? { id: cursor } : undefined,
    include: {
      user: true,
      quoteOf: { include: { user: true } },
      poll: {
        include: {
          options: {
            include: user
              ? { votes: { where: { userId: user.id }, select: { optionId: true } } }
              : { votes: false },
          },
        },
      },
      ...(user
        ? {
            likes: { where: { userId: user.id } },
            repostedBy: { where: { userId: user.id } },
            bookmarks: { where: { userId: user.id } },
          }
        : {}),
    },
  });

  const hasMore = posts.length > limit;
  const items = hasMore ? posts.slice(0, limit) : posts;

  const enriched = items.map((p) => {
    const userVoteId = user
      ? (p.poll?.options.find((o) => (o.votes as { optionId: string }[]).length > 0)?.id ?? null)
      : null;
    return {
      ...p,
      isLiked: user ? p.likes?.length > 0 : false,
      isReposted: user ? p.repostedBy?.length > 0 : false,
      isBookmarked: user ? p.bookmarks?.length > 0 : false,
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
