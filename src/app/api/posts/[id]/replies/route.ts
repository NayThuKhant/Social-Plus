import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: postId } = await params;
  const url = new URL(req.url);
  const cursor = url.searchParams.get("cursor");
  const limit = 20;

  const user = await getCurrentUser();

  const replies = await prisma.post.findMany({
    where: { replyToId: postId, isDeleted: false },
    orderBy: { likesCount: "desc" },
    take: limit + 1,
    cursor: cursor ? { id: cursor } : undefined,
    include: {
      user: true,
      poll: {
        include: {
          options: {
            include: user ? { votes: { where: { userId: user.id }, select: { optionId: true } } } : {},
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

  const hasMore = replies.length > limit;
  const items = hasMore ? replies.slice(0, limit) : replies;

  const enriched = items.map((p) => {
    const opts = p.poll?.options as Array<{ id: string; votes?: unknown[] }> | undefined;
    const userVoteId = opts?.find((o) => (o.votes?.length ?? 0) > 0)?.id ?? null;
    return {
      ...p,
      isLiked: user ? p.likes?.length > 0 : false,
      isReposted: user ? p.repostedBy?.length > 0 : false,
      isBookmarked: user ? p.bookmarks?.length > 0 : false,
      likes: undefined,
      repostedBy: undefined,
      bookmarks: undefined,
      poll: p.poll
        ? { ...p.poll, userVoteId, options: opts!.map(({ votes: _v, ...o }) => o) }
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
