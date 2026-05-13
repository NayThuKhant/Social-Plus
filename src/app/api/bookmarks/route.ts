import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const cursor = url.searchParams.get("cursor");
  const limit = 20;

  const bookmarks = await prisma.bookmark.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    cursor: cursor ? { userId_postId: { userId: user.id, postId: cursor } } : undefined,
    include: {
      post: {
        include: {
          user: true,
          quoteOf: { include: { user: true } },
          poll: {
            include: {
              options: {
                include: { votes: { where: { userId: user.id }, select: { optionId: true } } },
              },
            },
          },
          likes: { where: { userId: user.id } },
          repostedBy: { where: { userId: user.id } },
          bookmarks: { where: { userId: user.id } },
        },
      },
    },
  });

  const hasMore = bookmarks.length > limit;
  const items = (hasMore ? bookmarks.slice(0, limit) : bookmarks).map((b) => {
    const opts = b.post.poll?.options as Array<{ id: string; votes?: unknown[] }> | undefined;
    const userVoteId = opts?.find((o) => (o.votes?.length ?? 0) > 0)?.id ?? null;
    return {
      ...b.post,
      isLiked: b.post.likes.length > 0,
      isReposted: b.post.repostedBy.length > 0,
      isBookmarked: true,
      likes: undefined,
      repostedBy: undefined,
      bookmarks: undefined,
      poll: b.post.poll
        ? { ...b.post.poll, userVoteId, options: opts!.map(({ votes: _v, ...o }) => o) }
        : null,
    };
  });

  return NextResponse.json({
    data: {
      items,
      nextCursor: hasMore ? items[items.length - 1].id : null,
      hasMore,
    },
  });
}
